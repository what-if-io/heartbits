// ---------------------------------------------------------------------------
// GET /api/v1/discover — paginated candidate list
//
// Filters:
//  - gender preferences (profile.seeking)
//  - age_min / age_max (derived from date_of_birth)
//  - proximity: same geohash prefix (first 4 chars ≈ 40km box)
//  - excludes: already-swiped users, self, deleted users
//
// Returns max 20 profiles with distance_band (never raw geohash or GPS).
// Rate limit: 60 requests/user/hour via Redis sliding window.
// ---------------------------------------------------------------------------
import { Elysia, t } from 'elysia'
import { authPlugin } from '../auth'
import { withUser } from '../db'
import { decryptField } from '../crypto'
import { rateLimit } from '../redis'
import type { DistanceBand } from '../types'
import { avatarUrl } from '../minio'

const DISCOVER_LIMIT = 20
const DISCOVER_RATE_LIMIT = 60
const DISCOVER_RATE_WINDOW_MS = 60 * 60 * 1000 // 1 hour

/** Derive integer age from ISO date string. */
function ageFromDob(dob: string): number {
  const birth = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

/**
 * Approximate distance band from geohash similarity.
 *
 * We only store geohash6, so we compute distance bands from shared prefix:
 *  - prefix length 6 (same ~1.2km cell) → "< 5km"
 *  - prefix length 5 (~40km)             → "< 20km"
 *  - prefix length 4 (~160km)            → "< 50km"
 *  - otherwise                           → "50km+"
 *
 * This is a conservative band — it's always safe to show a wider band than real.
 */
function distanceBand(myGeohash: string | null, theirGeohash: string | null): DistanceBand | null {
  if (!myGeohash || !theirGeohash) return null
  const my = myGeohash.toLowerCase()
  const their = theirGeohash.toLowerCase()

  let shared = 0
  for (let i = 0; i < Math.min(my.length, their.length, 6); i++) {
    if (my[i] === their[i]) shared++
    else break
  }

  if (shared >= 6) return '< 5km'
  if (shared >= 5) return '< 20km'
  if (shared >= 4) return '< 50km'
  return '50km+'
}



export const discoverRoute = new Elysia({ prefix: '/api/v1' })
  .use(authPlugin)
  .get(
    '/discover',
    async ({ auth, query, set }) => {
      // ── Rate limiting ────────────────────────────────────────────────────
      const rl = await rateLimit(
        `rl:discover:${auth.userId}`,
        DISCOVER_RATE_LIMIT,
        DISCOVER_RATE_WINDOW_MS,
      )
      if (!rl.allowed) {
        set.status = 429
        set.headers['X-RateLimit-Limit'] = String(DISCOVER_RATE_LIMIT)
        set.headers['X-RateLimit-Remaining'] = '0'
        set.headers['X-RateLimit-Reset'] = String(Math.ceil(rl.resetAt / 1000))
        return { error: 'Rate limit exceeded. Max 60 discovery requests per hour.' }
      }

      set.headers['X-RateLimit-Limit'] = String(DISCOVER_RATE_LIMIT)
      set.headers['X-RateLimit-Remaining'] = String(rl.remaining)
      set.headers['X-RateLimit-Reset'] = String(Math.ceil(rl.resetAt / 1000))

      return withUser(auth.userId, async (tx) => {
        // ── Load current user's profile for filter context ───────────────
        const [myProfile] = await tx<{
          gender: string | null
          seeking: string[] | null
          age_min: number | null
          age_max: number | null
          location_geohash6: string | null
        }[]>`
          SELECT gender, seeking, age_min, age_max, location_geohash6
          FROM app.profiles
          WHERE id = ${auth.userId}
          LIMIT 1
        `

        if (!myProfile) {
          set.status = 400
          return { error: 'Complete your profile before discovering others.' }
        }

        const geohashPrefix = myProfile.location_geohash6
          ? myProfile.location_geohash6.slice(0, 4)
          : null

        // `seeking` is NOT NULL DEFAULT '{}', so it is never SQL NULL. An empty
        // array means "no gender preference" → show everyone. Collapse empty to
        // null so the IS NULL branch below matches (otherwise gender = ANY('{}')
        // is always false and the feed is permanently empty for default users).
        const seekingFilter =
          myProfile.seeking && myProfile.seeking.length > 0 ? myProfile.seeking : null

        // ── Query candidates ──────────────────────────────────────────────
        // We use a subquery to exclude already-swiped users.
        // Age filtering is done in-app after decryption because date_of_birth
        // is encrypted. We fetch a larger batch (5×) and filter/truncate in JS.
        //
        // The geohash prefix filter (4 chars) narrows to ~160km candidates.
        // When no location set, skip location filter.

        const rawCandidates = await tx<{
          id: string
          display_name: Buffer | null
          date_of_birth: Buffer | null
          bio: Buffer | null
          gender: string | null
          location_geohash6: string | null
          avatar_media_id: string | null
        }[]>`
          SELECT
            p.id,
            p.display_name,
            p.date_of_birth,
            p.bio,
            p.gender,
            p.location_geohash6,
            p.avatar_media_id
          FROM app.profiles p
          JOIN app.users u ON u.id = p.id
          WHERE p.id != ${auth.userId}
            AND u.deleted_at IS NULL
            AND u.paused_at IS NULL
            -- Exclude already-swiped
            AND p.id NOT IN (
              SELECT swiped_id
              FROM app.swipes
              WHERE swiper_id = ${auth.userId}
            )
            -- Gender filter: only show profiles whose gender is in our seeking list
            -- (empty/unset seeking → seekingFilter is null → no filter applied)
            AND (
              ${seekingFilter} IS NULL
              OR p.gender = ANY(${seekingFilter ?? []})
            )
            -- Location filter: first 4 chars of geohash (≈160km box)
            AND (
              ${geohashPrefix} IS NULL
              OR p.location_geohash6 IS NULL
              OR LEFT(p.location_geohash6, 4) = ${geohashPrefix ?? ''}
            )
          ORDER BY RANDOM()
          LIMIT ${DISCOVER_LIMIT * 5}
        `

        // ── Decrypt + age filter ──────────────────────────────────────────
        const ageMin = myProfile.age_min ?? 18
        const ageMax = myProfile.age_max ?? 99

        const results: {
          id: string
          display_name: string | null
          age: number | null
          bio: string | null
          gender: string | null
          avatar_url: string | null
          distance_band: DistanceBand | null
          bpm: null
        }[] = []

        for (const candidate of rawCandidates) {
          if (results.length >= DISCOVER_LIMIT) break

          const [display_name, date_of_birth, bio] = await Promise.all([
            decryptField(candidate.display_name),
            decryptField(candidate.date_of_birth),
            decryptField(candidate.bio),
          ])

          const age = date_of_birth ? ageFromDob(date_of_birth) : null

          // Apply age filter (only if candidate has a dob set)
          if (age !== null && (age < ageMin || age > ageMax)) continue

          results.push({
            id: candidate.id,
            display_name,
            age,
            bio,
            gender: candidate.gender,
            avatar_url: avatarUrl(candidate.avatar_media_id),
            distance_band: distanceBand(myProfile.location_geohash6, candidate.location_geohash6),
            bpm: null,
          })
        }

        return {
          profiles: results,
          count: results.length,
        }
      })
    },
    {
      query: t.Object({
        // Reserved for future cursor-based pagination
        after: t.Optional(t.String()),
      }),
      detail: {
        summary: 'Discover candidate profiles',
        tags: ['discover'],
      },
    },
  )

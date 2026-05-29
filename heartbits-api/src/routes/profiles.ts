// ---------------------------------------------------------------------------
// GET /api/v1/profiles/:id — public profile view
// ---------------------------------------------------------------------------
import { Elysia, t } from 'elysia'
import { authPlugin } from '../auth'
import { withUser } from '../db'
import { decryptField } from '../crypto'

/** Derive integer age from stored date string without exposing the exact date. */
function ageFromDob(dob: string): number {
  const birth = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function buildAvatarUrl(mediaId: string | null): string | null {
  if (!mediaId) return null
  return `https://media.what-if.io/${process.env['MINIO_BUCKET'] ?? 'heartbits-media'}/${mediaId}`
}

export const profilesRoute = new Elysia({ prefix: '/api/v1' })
  .use(authPlugin)
  .get(
    '/profiles/:id',
    async ({ auth, params, set }) => {
      return withUser(auth.userId, async (tx) => {
        const rows = await tx<{
          id: string
          display_name: Buffer | null
          date_of_birth: Buffer | null
          bio: Buffer | null
          gender: string | null
          avatar_media_id: string | null
          deleted_at: Date | null
        }[]>`
          SELECT
            p.id,
            p.display_name,
            p.date_of_birth,
            p.bio,
            p.gender,
            p.avatar_media_id,
            u.deleted_at
          FROM app.profiles p
          JOIN app.users u ON u.id = p.id
          WHERE p.id = ${params.id}
          LIMIT 1
        `

        const profile = rows[0]
        if (!profile || profile.deleted_at !== null) {
          set.status = 404
          return { error: 'Profile not found' }
        }

        const [display_name, date_of_birth, bio] = await Promise.all([
          decryptField(profile.display_name),
          decryptField(profile.date_of_birth),
          decryptField(profile.bio),
        ])

        const age = date_of_birth ? ageFromDob(date_of_birth) : null

        return {
          id: profile.id,
          display_name,
          age,
          bio,
          gender: profile.gender,
          avatar_url: buildAvatarUrl(profile.avatar_media_id),
          // Distance band is only available in discover context
          distance_band: null,
          bpm: null,
        }
      })
    },
    {
      params: t.Object({
        id: t.String({ minLength: 1 }),
      }),
      detail: {
        summary: 'Get a public profile by ID',
        tags: ['profiles'],
      },
    },
  )

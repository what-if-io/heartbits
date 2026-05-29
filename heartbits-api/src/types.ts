// ---------------------------------------------------------------------------
// Shared TypeScript types for HeartBits API
// ---------------------------------------------------------------------------

/** Internal user identity, attached to every authenticated Elysia context. */
export interface AuthUser {
  userId: string      // app.users.id (UUIDv7)
  zitadelSub: string  // Zitadel `sub` claim
}

// ---------------------------------------------------------------------------
// DB row shapes returned by postgres.js — kept minimal on purpose
// ---------------------------------------------------------------------------

export interface UserRow {
  id: string
  zitadel_sub: string
  created_at: Date
  last_seen_at: Date | null
  deleted_at: Date | null
}

export interface ProfileRow {
  id: string                    // FK → users.id
  display_name: Buffer | null   // encrypted BYTEA
  date_of_birth: Buffer | null  // encrypted BYTEA
  bio: Buffer | null            // encrypted BYTEA
  gender: string | null
  seeking: string[] | null
  age_min: number | null
  age_max: number | null
  location_geohash6: string | null
  avatar_media_id: string | null
}

export interface MediaRow {
  id: string
  user_id: string
  bucket: string
  object_key: string
  purpose: 'avatar' | 'gallery'
  sort_order: number
  sha256: string | null
}

export interface SwipeRow {
  swiper_id: string
  swiped_id: string
  direction: 'like' | 'pass' | 'superlike'
  created_at: Date
}

export interface MatchRow {
  id: string
  user_a_id: string
  user_b_id: string
  matched_at: Date
  unmatched_at: Date | null
}

export interface BondRow {
  id: string
  match_id: string
  room_id: string
  created_at: Date
}

// ---------------------------------------------------------------------------
// API response shapes
// ---------------------------------------------------------------------------

export type DistanceBand = '< 5km' | '< 20km' | '< 50km' | '50km+'

export interface PublicProfile {
  id: string
  display_name: string
  age: number           // derived from date_of_birth; never exact
  gender: string | null
  bio: string | null
  avatar_url: string | null
  distance_band: DistanceBand | null
  bpm: null             // always null — relay provides live BPM
}

export interface DiscoverProfile extends PublicProfile {
  distance_band: DistanceBand | null
}

export interface MatchResponse {
  match_id: string
  partner: PublicProfile
  bond_room_id: string | null
  matched_at: string
}

export interface BondResponse {
  id: string
  match_id: string
  room_id: string
  created_at: string
}

// ---------------------------------------------------------------------------
// Geohash validation
// ---------------------------------------------------------------------------

/** Valid geohash characters (base32 Geohash alphabet) */
export const GEOHASH_CHARS = /^[0-9b-hj-np-z]{1,6}$/i

/** Validate that a string is a geohash of at most 6 chars. */
export function isValidGeohash(value: unknown): value is string {
  return typeof value === 'string' && GEOHASH_CHARS.test(value)
}

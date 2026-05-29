// ---------------------------------------------------------------------------
// GET /api/v1/matches — list active matches with partner profile + bond info
// ---------------------------------------------------------------------------
import { Elysia } from 'elysia'
import { authPlugin } from '../auth'
import { withUser } from '../db'
import { decryptField } from '../crypto'
import { avatarUrl } from '../minio'

function ageFromDob(dob: string): number {
  const birth = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

export const matchesRoute = new Elysia({ prefix: '/api/v1' })
  .use(authPlugin)
  .get(
    '/matches',
    async ({ auth }) => {
      return withUser(auth.userId, async (tx) => {
        // Fetch active (unmatched_at IS NULL) matches involving current user
        const rows = await tx<{
          match_id: string
          user_a_id: string
          user_b_id: string
          matched_at: Date
          bond_id: string | null
          room_id: string | null
          partner_display_name: Buffer | null
          partner_date_of_birth: Buffer | null
          partner_gender: string | null
          partner_avatar_media_id: string | null
        }[]>`
          SELECT
            m.id              AS match_id,
            m.user_a_id,
            m.user_b_id,
            m.matched_at,
            b.id              AS bond_id,
            b.room_id,
            p.display_name    AS partner_display_name,
            p.date_of_birth   AS partner_date_of_birth,
            p.gender          AS partner_gender,
            p.avatar_media_id AS partner_avatar_media_id
          FROM app.matches m
          LEFT JOIN app.bonds b ON b.match_id = m.id
          JOIN app.profiles p
            ON p.id = CASE
              WHEN m.user_a_id = ${auth.userId} THEN m.user_b_id
              ELSE m.user_a_id
            END
          JOIN app.users u ON u.id = p.id AND u.deleted_at IS NULL
          WHERE (m.user_a_id = ${auth.userId} OR m.user_b_id = ${auth.userId})
            AND m.unmatched_at IS NULL
          ORDER BY m.matched_at DESC
        `

        const matches = await Promise.all(
          rows.map(async (row) => {
            const [display_name, date_of_birth] = await Promise.all([
              decryptField(row.partner_display_name),
              decryptField(row.partner_date_of_birth),
            ])

            const partnerId =
              row.user_a_id === auth.userId ? row.user_b_id : row.user_a_id

            return {
              match_id: row.match_id,
              partner: {
                id: partnerId,
                display_name,
                age: date_of_birth ? ageFromDob(date_of_birth) : null,
                gender: row.partner_gender,
                avatar_url: avatarUrl(row.partner_avatar_media_id),
                bpm: null,
              },
              bond_id: row.bond_id,
              bond_room_id: row.room_id,
              matched_at: row.matched_at.toISOString(),
            }
          }),
        )

        return { matches, count: matches.length }
      })
    },
    {
      detail: {
        summary: 'List active matches',
        tags: ['matches'],
      },
    },
  )

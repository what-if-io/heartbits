import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { hasTestDb, adminSql, setupAuthMock } from '../../test/helpers'

const d = hasTestDb ? describe : describe.skip

const ME = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
const P = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
const SUB_ME = 'sub-matches-me'
const A = ME < P ? ME : P
const B = ME < P ? P : ME
const ROOM = '99999999-9999-9999-9999-999999999999'

d('GET /api/v1/matches', () => {
  let app: { handle: (r: Request) => Promise<Response> }
  let admin: ReturnType<typeof adminSql>
  let auth: Awaited<ReturnType<typeof setupAuthMock>>

  beforeAll(async () => {
    app = (await import('./matches')).matchesRoute as never
    admin = adminSql()
    auth = await setupAuthMock()
    await (await import('../redis')).redis.del('hb:jwks:raw')

    const clean = async () => {
      await admin`DELETE FROM app.bonds WHERE room_id = ${ROOM}`
      await admin`DELETE FROM app.matches WHERE user_a_id = ${A} AND user_b_id = ${B}`
      await admin`DELETE FROM app.profiles WHERE id IN (${ME}, ${P})`
      await admin`DELETE FROM app.users WHERE id IN (${ME}, ${P})`
    }
    await clean()
    await admin`INSERT INTO app.users (id, zitadel_sub) VALUES (${ME}, ${SUB_ME}), (${P}, 'sub-matches-p')`
    await admin`INSERT INTO app.profiles (id, gender) VALUES (${ME}, 'female'), (${P}, 'male')`
    const [m] = await admin<{ id: string }[]>`
      INSERT INTO app.matches (id, user_a_id, user_b_id, matched_at)
      VALUES (gen_random_uuid(), ${A}, ${B}, NOW()) RETURNING id`
    await admin`INSERT INTO app.bonds (id, match_id, room_id, created_at) VALUES (gen_random_uuid(), ${m!.id}, ${ROOM}, NOW())`
  })

  afterAll(async () => {
    await admin`DELETE FROM app.bonds WHERE room_id = ${ROOM}`
    await admin`DELETE FROM app.matches WHERE user_a_id = ${A} AND user_b_id = ${B}`
    await admin`DELETE FROM app.profiles WHERE id IN (${ME}, ${P})`
    await admin`DELETE FROM app.users WHERE id IN (${ME}, ${P})`
    await admin.end()
    auth.restore()
  })

  test('lists the match with partner + bond room', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/v1/matches', {
        headers: { authorization: `Bearer ${await auth.token(SUB_ME)}` }
      })
    )
    expect(res.status).toBe(200)
    const { matches, count } = (await res.json()) as {
      count: number
      matches: { partner: { id: string }; bond_room_id: string | null }[]
    }
    expect(count).toBe(1)
    expect(matches[0]!.partner.id).toBe(P)
    expect(matches[0]!.bond_room_id).toBe(ROOM)
  })
})

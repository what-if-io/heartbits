import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { hasTestDb, adminSql, setupAuthMock } from '../../test/helpers'

const d = hasTestDb ? describe : describe.skip

const ME = '1b1b1b1b-1b1b-1b1b-1b1b-1b1b1b1b1b1b'
const P = '2b2b2b2b-2b2b-2b2b-2b2b-2b2b2b2b2b2b'
const SUB_ME = 'sub-bonds-me'
const A = ME < P ? ME : P
const B = ME < P ? P : ME
const ROOM = 'b04d1111-2222-3333-4444-555566667777'

d('GET /api/v1/bonds + /bonds/:id (Art.9 consent gate)', () => {
  let app: { handle: (r: Request) => Promise<Response> }
  let admin: ReturnType<typeof adminSql>
  let auth: Awaited<ReturnType<typeof setupAuthMock>>
  let bondId: string
  let tok: string

  const getBond = (path: string) =>
    app.handle(new Request(`http://localhost${path}`, { headers: { authorization: `Bearer ${tok}` } }))

  const clean = async () => {
    await admin`DELETE FROM app.consents WHERE user_id IN (${ME}, ${P})`
    await admin`DELETE FROM app.bonds WHERE room_id = ${ROOM}`
    await admin`DELETE FROM app.matches WHERE user_a_id = ${A} AND user_b_id = ${B}`
    await admin`DELETE FROM app.profiles WHERE id IN (${ME}, ${P})`
    await admin`DELETE FROM app.users WHERE id IN (${ME}, ${P})`
  }

  beforeAll(async () => {
    app = (await import('./bonds')).bondsRoute as never
    admin = adminSql()
    auth = await setupAuthMock()
    await (await import('../redis')).redis.del('hb:jwks:raw')
    await clean()
    await admin`INSERT INTO app.users (id, zitadel_sub) VALUES (${ME}, ${SUB_ME}), (${P}, 'sub-bonds-p')`
    await admin`INSERT INTO app.profiles (id, gender) VALUES (${ME}, 'woman'), (${P}, 'man')`
    const [m] = await admin<{ id: string }[]>`
      INSERT INTO app.matches (id, user_a_id, user_b_id, matched_at)
      VALUES (gen_random_uuid(), ${A}, ${B}, NOW()) RETURNING id`
    const [bond] = await admin<{ id: string }[]>`
      INSERT INTO app.bonds (id, match_id, room_id, created_at)
      VALUES (gen_random_uuid(), ${m!.id}, ${ROOM}, NOW()) RETURNING id`
    bondId = bond!.id
    tok = await auth.token(SUB_ME)
  })

  afterAll(async () => {
    await clean()
    await admin.end()
    auth.restore()
  })

  test('GET /bonds lists the bond with partner + room', async () => {
    const res = await getBond('/api/v1/bonds')
    expect(res.status).toBe(200)
    const { bonds } = (await res.json()) as { bonds: { room_id: string; partner_id: string }[] }
    expect(bonds.find((b) => b.room_id === ROOM)?.partner_id).toBe(P)
  })

  test('GET /bonds/:id WITHOUT biometric consent → 403 (no room_id leaked)', async () => {
    const res = await getBond(`/api/v1/bonds/${bondId}`)
    expect(res.status).toBe(403)
    expect(await res.text()).not.toContain(ROOM)
  })

  test('GET /bonds/:id WITH active consent → 200 + room_id', async () => {
    await admin`
      INSERT INTO app.consents (user_id, consent_type, version, consented_at)
      VALUES (${ME}, 'biometric_relay', '1.0', NOW())`
    const res = await getBond(`/api/v1/bonds/${bondId}`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { room_id: string; relay_url: string }
    expect(body.room_id).toBe(ROOM)
    expect(body.relay_url).toContain(ROOM)
  })
})

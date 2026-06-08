import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { hasTestDb, adminSql, setupAuthMock } from '../../test/helpers'

const d = hasTestDb ? describe : describe.skip

const ME = '5a5a5a5a-5a5a-5a5a-5a5a-5a5a5a5a5a5a'
const P = '5b5b5b5b-5b5b-5b5b-5b5b-5b5b5b5b5b5b'
const SUB_ME = 'sub-safety-me'
const A = ME < P ? ME : P
const B = ME < P ? P : ME
const ROOM = '5afe0000-1111-2222-3333-444455556666'

d('Trust & Safety: blocks + reports', () => {
  let app: { handle: (r: Request) => Promise<Response> }
  let swipes: { handle: (r: Request) => Promise<Response> }
  let admin: ReturnType<typeof adminSql>
  let redis: typeof import('../redis').redis
  let auth: Awaited<ReturnType<typeof setupAuthMock>>
  let tok: string

  const json = (method: string, path: string, body?: unknown, target = app) =>
    target.handle(
      new Request(`http://localhost${path}`, {
        method,
        headers: { authorization: `Bearer ${tok}`, ...(body ? { 'content-type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {})
      })
    )

  const clean = async () => {
    await admin`DELETE FROM app.reports WHERE reporter_id IN (${ME}, ${P}) OR reported_id IN (${ME}, ${P})`
    await admin`DELETE FROM app.blocks WHERE blocker_id IN (${ME}, ${P}) OR blocked_id IN (${ME}, ${P})`
    await admin`DELETE FROM app.bonds WHERE room_id = ${ROOM}`
    await admin`DELETE FROM app.matches WHERE user_a_id = ${A} AND user_b_id = ${B}`
    await admin`DELETE FROM app.swipes WHERE swiper_id IN (${ME}, ${P}) OR swiped_id IN (${ME}, ${P})`
    await admin`DELETE FROM app.audit_log WHERE actor_id IN (${ME}, ${P})`
    await admin`DELETE FROM app.profiles WHERE id IN (${ME}, ${P})`
    await admin`DELETE FROM app.users WHERE id IN (${ME}, ${P})`
  }

  beforeAll(async () => {
    app = (await import('./safety')).safetyRoute as never
    swipes = (await import('./swipes')).swipesRoute as never
    admin = adminSql()
    redis = (await import('../redis')).redis
    auth = await setupAuthMock()
    await redis.del('hb:jwks:raw')
    await clean()
    await admin`INSERT INTO app.users (id, zitadel_sub) VALUES (${ME}, ${SUB_ME}), (${P}, 'sub-safety-p')`
    await admin`INSERT INTO app.profiles (id, gender) VALUES (${ME}, 'woman'), (${P}, 'man')`
    const [m] = await admin<{ id: string }[]>`
      INSERT INTO app.matches (id, user_a_id, user_b_id, matched_at)
      VALUES (gen_random_uuid(), ${A}, ${B}, NOW()) RETURNING id`
    await admin`INSERT INTO app.bonds (id, match_id, room_id, created_at) VALUES (gen_random_uuid(), ${m!.id}, ${ROOM}, NOW())`
    await redis.set(`relay:room:${ROOM}`, `${A}:${B}`)
    tok = await auth.token(SUB_ME)
  })

  afterAll(async () => {
    await clean()
    await redis.del(`relay:room:${ROOM}`)
    await admin.end()
    auth.restore()
  })

  test('cannot block yourself → 400', async () => {
    expect((await json('POST', '/api/v1/blocks', { user_id: ME })).status).toBe(400)
  })

  test('block severs the match + deletes the relay room key', async () => {
    const res = await json('POST', '/api/v1/blocks', { user_id: P })
    expect(res.status).toBe(201)
    // match severed
    const [match] = await admin<{ unmatched_at: Date | null }[]>`
      SELECT unmatched_at FROM app.matches WHERE user_a_id = ${A} AND user_b_id = ${B}`
    expect(match!.unmatched_at).not.toBeNull()
    // relay key gone
    expect(await redis.get(`relay:room:${ROOM}`)).toBeNull()
  })

  test('blocked user cannot be swiped → 403', async () => {
    const res = await swipes.handle(
      new Request('http://localhost/api/v1/swipes', {
        method: 'POST',
        headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' },
        body: JSON.stringify({ swiped_id: P, direction: 'like' })
      })
    )
    expect(res.status).toBe(403)
  })

  test('GET /blocks lists the block; DELETE unblocks', async () => {
    let list = (await (await json('GET', '/api/v1/blocks')).json()) as { blocks: { user_id: string }[] }
    expect(list.blocks.some((b) => b.user_id === P)).toBe(true)
    expect((await json('DELETE', `/api/v1/blocks/${P}`)).status).toBe(200)
    list = (await (await json('GET', '/api/v1/blocks')).json()) as { blocks: { user_id: string }[] }
    expect(list.blocks.some((b) => b.user_id === P)).toBe(false)
  })

  test('POST /reports files a report', async () => {
    const res = await json('POST', '/api/v1/reports', { user_id: P, reason: 'harassment', details: 'test' })
    expect(res.status).toBe(201)
    const [r] = await admin<{ reason: string; status: string }[]>`
      SELECT reason, status FROM app.reports WHERE reporter_id = ${ME} AND reported_id = ${P} LIMIT 1`
    expect(r!.reason).toBe('harassment')
    expect(r!.status).toBe('open')
  })
})

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { hasTestDb, adminSql, setupAuthMock } from '../../test/helpers'

const d = hasTestDb ? describe : describe.skip

const A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const SUB_A = 'sub-swipe-a'
const SUB_B = 'sub-swipe-b'

d('POST /api/v1/swipes', () => {
  let app: { handle: (r: Request) => Promise<Response> }
  let admin: ReturnType<typeof adminSql>
  let redis: typeof import('../redis').redis
  let auth: Awaited<ReturnType<typeof setupAuthMock>>

  const post = (tok: string | null, body: unknown) =>
    app.handle(
      new Request('http://localhost/api/v1/swipes', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(tok ? { authorization: `Bearer ${tok}` } : {})
        },
        body: JSON.stringify(body)
      })
    )

  beforeAll(async () => {
    app = (await import('./swipes')).swipesRoute as never
    admin = adminSql()
    redis = (await import('../redis')).redis
    auth = await setupAuthMock()
    await redis.del('hb:jwks:raw') // ignore any cached jwks_uri → use the mock

    const cleanup = async () => {
      await admin`DELETE FROM app.bonds WHERE match_id IN (SELECT id FROM app.matches WHERE user_a_id IN (${A}, ${B}) OR user_b_id IN (${A}, ${B}))`
      await admin`DELETE FROM app.matches WHERE user_a_id IN (${A}, ${B}) OR user_b_id IN (${A}, ${B})`
      await admin`DELETE FROM app.swipes WHERE swiper_id IN (${A}, ${B}) OR swiped_id IN (${A}, ${B})`
      await admin`DELETE FROM app.audit_log WHERE actor_id IN (${A}, ${B})`
      await admin`DELETE FROM app.users WHERE id IN (${A}, ${B})`
    }
    await cleanup()
    await admin`INSERT INTO app.users (id, zitadel_sub) VALUES (${A}, ${SUB_A}), (${B}, ${SUB_B})`
  })

  afterAll(async () => {
    await admin`DELETE FROM app.bonds WHERE match_id IN (SELECT id FROM app.matches WHERE user_a_id IN (${A}, ${B}) OR user_b_id IN (${A}, ${B}))`
    await admin`DELETE FROM app.matches WHERE user_a_id IN (${A}, ${B}) OR user_b_id IN (${A}, ${B})`
    await admin`DELETE FROM app.swipes WHERE swiper_id IN (${A}, ${B}) OR swiped_id IN (${A}, ${B})`
    await admin`DELETE FROM app.audit_log WHERE actor_id IN (${A}, ${B})`
    await admin`DELETE FROM app.users WHERE id IN (${A}, ${B})`
    await admin.end()
    auth.restore()
  })

  test('missing/invalid auth → 401', async () => {
    expect((await post(null, { swiped_id: B, direction: 'like' })).status).toBe(401)
  })

  test('cannot swipe yourself → 400', async () => {
    const tok = await auth.token(SUB_A)
    expect((await post(tok, { swiped_id: A, direction: 'like' })).status).toBe(400)
  })

  test('one-sided like → no match', async () => {
    const tok = await auth.token(SUB_A)
    const res = await post(tok, { swiped_id: B, direction: 'like' })
    expect(res.status).toBe(200)
    expect(((await res.json()) as { matched: boolean }).matched).toBe(false)
  })

  test('mutual like → match + bond + relay room key in Redis', async () => {
    const res = await post(await auth.token(SUB_B), { swiped_id: A, direction: 'like' })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { matched: boolean; match_id?: string; bond?: { room_id: string } }
    expect(body.matched).toBe(true)
    expect(body.match_id).toBeTruthy()
    expect(body.bond?.room_id).toBeTruthy()

    // Relay key written with canonical user_a:user_b ordering
    const userA = A < B ? A : B
    const userB = A < B ? B : A
    const relay = await redis.get(`relay:room:${body.bond!.room_id}`)
    expect(relay).toBe(`${userA}:${userB}`)
  })

  test('invalid direction → 422 (schema validation)', async () => {
    const tok = await auth.token(SUB_A)
    expect((await post(tok, { swiped_id: B, direction: 'nope' })).status).toBe(422)
  })
})

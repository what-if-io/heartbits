import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { hasTestDb, adminSql, setupAuthMock } from '../../test/helpers'

const d = hasTestDb ? describe : describe.skip

const ME = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
const C1 = 'ccccccc1-cccc-cccc-cccc-cccccccccccc'
const C2 = 'ccccccc2-cccc-cccc-cccc-cccccccccccc'
const SUB_ME = 'sub-disc-me'
const ALL = [ME, C1, C2]

d('GET /api/v1/discover', () => {
  let app: { handle: (r: Request) => Promise<Response> }
  let admin: ReturnType<typeof adminSql>
  let auth: Awaited<ReturnType<typeof setupAuthMock>>

  const get = (tok: string) =>
    app.handle(
      new Request('http://localhost/api/v1/discover', {
        headers: { authorization: `Bearer ${tok}` }
      })
    )

  beforeAll(async () => {
    app = (await import('./discover')).discoverRoute as never
    admin = adminSql()
    auth = await setupAuthMock()
    await (await import('../redis')).redis.del('hb:jwks:raw')

    await admin`DELETE FROM app.swipes WHERE swiper_id IN ${admin(ALL)} OR swiped_id IN ${admin(ALL)}`
    await admin`DELETE FROM app.profiles WHERE id IN ${admin(ALL)}`
    await admin`DELETE FROM app.users WHERE id IN ${admin(ALL)}`
    await admin`INSERT INTO app.users (id, zitadel_sub) VALUES (${ME}, ${SUB_ME}), (${C1}, 'sub-c1'), (${C2}, 'sub-c2')`
    // ME seeks anyone ('{}' → no gender filter); candidates have a gender set.
    await admin`INSERT INTO app.profiles (id, gender, seeking) VALUES (${ME}, 'female', '{}'), (${C1}, 'male', '{}'), (${C2}, 'female', '{}')`
  })

  afterAll(async () => {
    await admin`DELETE FROM app.swipes WHERE swiper_id IN ${admin(ALL)} OR swiped_id IN ${admin(ALL)}`
    await admin`DELETE FROM app.profiles WHERE id IN ${admin(ALL)}`
    await admin`DELETE FROM app.users WHERE id IN ${admin(ALL)}`
    await admin.end()
    auth.restore()
  })

  test('returns candidates, excluding self', async () => {
    const res = await get(await auth.token(SUB_ME))
    expect(res.status).toBe(200)
    const { profiles } = (await res.json()) as { profiles: { id: string }[] }
    const ids = profiles.map((p: { id: string }) => p.id)
    expect(ids).toContain(C1)
    expect(ids).toContain(C2)
    expect(ids).not.toContain(ME)
  })

  test('excludes already-swiped candidates', async () => {
    await admin`INSERT INTO app.swipes (swiper_id, swiped_id, direction, created_at) VALUES (${ME}, ${C1}, 'pass', NOW())`
    const res = await get(await auth.token(SUB_ME))
    const ids = ((await res.json()) as { profiles: { id: string }[] }).profiles.map((p) => p.id)
    expect(ids).not.toContain(C1)
    expect(ids).toContain(C2)
  })
})

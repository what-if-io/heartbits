import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test'
import { hasTestDb, adminSql } from '../../test/helpers'

const d = hasTestDb ? describe : describe.skip

function post(app: { handle: (r: Request) => Promise<Response> }, email: unknown, ip = '203.0.113.7') {
  return app.handle(
    new Request('http://localhost/api/v1/waitlist', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
      body: JSON.stringify({ email, source: 'test' })
    })
  )
}

d('POST /api/v1/waitlist', () => {
  let app: { handle: (r: Request) => Promise<Response> }
  let admin: ReturnType<typeof adminSql>
  let redis: typeof import('../redis').redis

  beforeAll(async () => {
    app = (await import('./waitlist')).waitlistRoute as never
    admin = adminSql()
    redis = (await import('../redis')).redis
  })

  beforeEach(async () => {
    await admin`DELETE FROM app.waitlist WHERE email_norm LIKE '%@wl.test'`
    await redis.del('hb:rl:waitlist:203.0.113.7', 'hb:rl:waitlist:203.0.113.9', 'hb:worker:notifications')
  })

  afterAll(async () => {
    await admin`DELETE FROM app.waitlist WHERE email_norm LIKE '%@wl.test'`
    await admin.end()
    // shared `redis` singleton is left open intentionally (see db test note)
  })

  test('valid new email → 200, row inserted, confirmation enqueued', async () => {
    const res = await post(app, 'Alice@WL.test')
    expect(res.status).toBe(200)
    const rows = await admin`SELECT email, email_norm FROM app.waitlist WHERE email_norm = 'alice@wl.test'`
    expect(rows.length).toBe(1)
    expect(rows[0]!.email_norm).toBe('alice@wl.test') // normalised lower-case
    const queued = await redis.lrange('hb:worker:notifications', 0, -1)
    expect(queued.some((j) => j.includes('waitlistConfirm'))).toBe(true)
  })

  test('duplicate email → 200 but no second row, no second enqueue', async () => {
    await post(app, 'dupe@wl.test')
    await redis.del('hb:worker:notifications')
    const res = await post(app, 'dupe@wl.test')
    expect(res.status).toBe(200)
    const rows = await admin`SELECT id FROM app.waitlist WHERE email_norm = 'dupe@wl.test'`
    expect(rows.length).toBe(1)
    const queued = await redis.lrange('hb:worker:notifications', 0, -1)
    expect(queued.length).toBe(0)
  })

  test('invalid email → 400', async () => {
    const res = await post(app, 'not-an-email')
    expect(res.status).toBe(400)
  })

  test('per-IP rate limit kicks in after 5 signups', async () => {
    const ip = '203.0.113.9'
    for (let i = 0; i < 5; i++) {
      const ok = await post(app, `rl${i}@wl.test`, ip)
      expect(ok.status).toBe(200)
    }
    const sixth = await post(app, 'rl5@wl.test', ip)
    expect(sixth.status).toBe(429)
  })
})

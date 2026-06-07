import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { hasTestDb, adminSql, setupAuthMock } from '../../test/helpers'

const d = hasTestDb ? describe : describe.skip
const SUB = 'sub-me-flow'

d('/api/v1/me lifecycle', () => {
  let app: { handle: (r: Request) => Promise<Response> }
  let admin: ReturnType<typeof adminSql>
  let auth: Awaited<ReturnType<typeof setupAuthMock>>
  let tok: string

  const req = (method: string, path: string, body?: unknown) =>
    app.handle(
      new Request(`http://localhost${path}`, {
        method,
        headers: {
          authorization: `Bearer ${tok}`,
          'x-forwarded-for': '203.0.113.1', // valid IP for ::inet casts (consent/audit)
          ...(body ? { 'content-type': 'application/json' } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {})
      })
    )

  beforeAll(async () => {
    app = (await import('./me')).meRoutes as never
    admin = adminSql()
    auth = await setupAuthMock()
    await (await import('../redis')).redis.del('hb:jwks:raw')
    await admin`DELETE FROM app.users WHERE zitadel_sub = ${SUB}` // cascades profile/consents
    tok = await auth.token(SUB)
  })

  afterAll(async () => {
    await admin`DELETE FROM app.users WHERE zitadel_sub = ${SUB}`
    await admin.end()
    auth.restore()
  })

  test('POST /me/init creates the account (bypasses RLS via SECURITY DEFINER)', async () => {
    const res = await req('POST', '/api/v1/me/init')
    expect([200, 201]).toContain(res.status)
    const body = (await res.json()) as { user_id: string; created: boolean }
    expect(body.user_id).toBeTruthy()
    expect(body.created).toBe(true)
  })

  test('PATCH /me encrypts PII; GET /me returns it decrypted', async () => {
    const patch = await req('PATCH', '/api/v1/me', {
      display_name: 'Alice',
      date_of_birth: '1995-05-05',
      gender: 'woman',
      seeking: ['man']
    })
    expect(patch.status).toBe(200)

    const res = await req('GET', '/api/v1/me')
    expect(res.status).toBe(200)
    const me = (await res.json()) as {
      display_name: string
      date_of_birth: string
      age: number
      gender: string
      seeking: string[]
    }
    expect(me.display_name).toBe('Alice') // decrypted round-trip
    expect(me.date_of_birth).toBe('1995-05-05')
    expect(typeof me.age).toBe('number')
    expect(me.gender).toBe('woman')
    expect(me.seeking).toEqual(['man'])

    // Verify it's actually stored ENCRYPTED (not plaintext) in the column
    const [rowRaw] = await admin<{ display_name: Buffer | null }[]>`
      SELECT display_name FROM app.profiles WHERE id = (SELECT id FROM app.users WHERE zitadel_sub = ${SUB})`
    expect(rowRaw!.display_name?.toString('utf8')).not.toContain('Alice')
  })

  test('POST /me/consent grants biometric_relay consent', async () => {
    const res = await req('POST', '/api/v1/me/consent', { consent_type: 'biometric_relay', version: '1.0' })
    expect([200, 201]).toContain(res.status)
  })
})

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { hasTestDb, adminSql } from '../test/helpers'

// The crucial security property: with the app connecting as the non-owner
// `heartbits_api` role, Row-Level Security must isolate users. (See the RLS fix
// + migration 004 FORCE ROW LEVEL SECURITY.)
const d = hasTestDb ? describe : describe.skip

const A = '11111111-1111-1111-1111-111111111111'
const B = '22222222-2222-2222-2222-222222222222'

d('RLS isolation (heartbits_api role)', () => {
  let sql: typeof import('./db').sql
  let withUser: typeof import('./db').withUser
  let admin: ReturnType<typeof adminSql>

  beforeAll(async () => {
    const db = await import('./db')
    sql = db.sql
    withUser = db.withUser
    admin = adminSql()
    await admin`DELETE FROM app.profiles WHERE id IN (${A}, ${B})`
    await admin`DELETE FROM app.users WHERE id IN (${A}, ${B})`
    await admin`INSERT INTO app.users (id, zitadel_sub) VALUES (${A}, 'sub-a'), (${B}, 'sub-b')`
    await admin`INSERT INTO app.profiles (id, gender, seeking) VALUES (${A}, 'female', '{}'), (${B}, 'male', '{}')`
  })

  afterAll(async () => {
    await admin`DELETE FROM app.profiles WHERE id IN (${A}, ${B})`
    await admin`DELETE FROM app.users WHERE id IN (${A}, ${B})`
    await admin.end()
    // NOTE: do not end the shared `sql` pool — it's a module singleton other
    // test files import too; bun tears down the process on exit.
  })

  test('no user context → profiles are invisible (RLS denies)', async () => {
    const rows = await sql`SELECT id FROM app.profiles WHERE id IN (${A}, ${B})`
    expect(rows.length).toBe(0)
  })

  test('with user context → the user can read', async () => {
    const rows = await withUser(A, (tx) => tx`SELECT id FROM app.profiles WHERE id = ${A}`)
    expect(rows.length).toBe(1)
  })

  test("a user cannot UPDATE another user's profile", async () => {
    const res = await withUser(
      A,
      (tx) => tx`UPDATE app.profiles SET bio = 'hacked' WHERE id = ${B} RETURNING id`
    )
    expect(res.length).toBe(0)
  })

  test("a user cannot DELETE another user's row", async () => {
    const res = await withUser(
      A,
      (tx) => tx`DELETE FROM app.users WHERE id = ${B} RETURNING id`
    )
    expect(res.length).toBe(0)
    // B still exists (verified via superuser)
    const still = await admin`SELECT id FROM app.users WHERE id = ${B}`
    expect(still.length).toBe(1)
  })
})

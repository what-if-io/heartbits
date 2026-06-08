import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { hasTestDb, adminSql, setupAuthMock } from '../../test/helpers'

const d = hasTestDb ? describe : describe.skip

const ME = '6c6c6c6c-0001-0001-0001-000000000001'
const P = '6c6c6c6c-0002-0002-0002-000000000002'
const X = '6c6c6c6c-0003-0003-0003-000000000003' // non-participant
const SUB_ME = 'sub-msg-me'
const SUB_P = 'sub-msg-p'
const SUB_X = 'sub-msg-x'
const A = ME < P ? ME : P
const B = ME < P ? P : ME

d('Chat messages', () => {
  let app: { handle: (r: Request) => Promise<Response> }
  let admin: ReturnType<typeof adminSql>
  let auth: Awaited<ReturnType<typeof setupAuthMock>>
  let matchId: string

  const req = (method: string, path: string, tok: string, body?: unknown) =>
    app.handle(
      new Request(`http://localhost${path}`, {
        method,
        headers: { authorization: `Bearer ${tok}`, ...(body ? { 'content-type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {})
      })
    )

  const clean = async () => {
    await admin`DELETE FROM app.matches WHERE user_a_id = ${A} AND user_b_id = ${B}`
    await admin`DELETE FROM app.users WHERE id IN (${ME}, ${P}, ${X})`
  }

  beforeAll(async () => {
    app = (await import('./messages')).messagesRoute as never
    admin = adminSql()
    auth = await setupAuthMock()
    await (await import('../redis')).redis.del('hb:jwks:raw')
    await clean()
    await admin`INSERT INTO app.users (id, zitadel_sub) VALUES (${ME}, ${SUB_ME}), (${P}, ${SUB_P}), (${X}, ${SUB_X})`
    const [mt] = await admin<{ id: string }[]>`
      INSERT INTO app.matches (id, user_a_id, user_b_id, matched_at)
      VALUES (gen_random_uuid(), ${A}, ${B}, NOW()) RETURNING id`
    matchId = mt!.id
  })

  afterAll(async () => {
    await clean()
    await admin.end()
    auth.restore()
  })

  let msgId: string

  test('send → 201, body round-trips (encrypted at rest)', async () => {
    const res = await req('POST', `/api/v1/matches/${matchId}/messages`, await auth.token(SUB_ME), { body: 'hey there 👋' })
    expect(res.status).toBe(201)
    const msg = (await res.json()) as { id: string; body: string; mine: boolean }
    expect(msg.body).toBe('hey there 👋')
    expect(msg.mine).toBe(true)
    msgId = msg.id
    // ciphertext at rest, not plaintext
    const [raw] = await admin<{ body_encrypted: Buffer }[]>`SELECT body_encrypted FROM app.messages WHERE id = ${msgId}`
    expect(raw!.body_encrypted.toString('utf8')).not.toContain('hey there')
  })

  test('reply references the parent', async () => {
    const res = await req('POST', `/api/v1/matches/${matchId}/messages`, await auth.token(SUB_P), { body: 'hi!', reply_to_id: msgId })
    const msg = (await res.json()) as { reply_to_id: string }
    expect(msg.reply_to_id).toBe(msgId)
  })

  test('edit sets edited_at and new body', async () => {
    const res = await req('PATCH', `/api/v1/messages/${msgId}`, await auth.token(SUB_ME), { body: 'edited text' })
    expect(res.status).toBe(200)
    const msg = (await res.json()) as { body: string; edited_at: string | null }
    expect(msg.body).toBe('edited text')
    expect(msg.edited_at).not.toBeNull()
  })

  test('react then list shows the reaction; unreact removes it', async () => {
    expect((await req('POST', `/api/v1/messages/${msgId}/reactions`, await auth.token(SUB_P), { emoji: '❤️' })).status).toBe(201)
    let list = (await (await req('GET', `/api/v1/matches/${matchId}/messages`, await auth.token(SUB_ME))).json()) as {
      messages: { id: string; reactions: { emoji: string; count: number }[] }[]
    }
    const reacted = list.messages.find((mm) => mm.id === msgId)!
    expect(reacted.reactions.find((x) => x.emoji === '❤️')?.count).toBe(1)

    await req('DELETE', `/api/v1/messages/${msgId}/reactions/${encodeURIComponent('❤️')}`, await auth.token(SUB_P))
    list = (await (await req('GET', `/api/v1/matches/${matchId}/messages`, await auth.token(SUB_ME))).json()) as never
    expect(list.messages.find((mm) => mm.id === msgId)!.reactions.length).toBe(0)
  })

  test('read receipts mark the partner messages read', async () => {
    const res = await req('POST', `/api/v1/matches/${matchId}/read`, await auth.token(SUB_ME))
    const { marked } = (await res.json()) as { marked: number }
    expect(marked).toBeGreaterThanOrEqual(1) // P's reply
  })

  test('soft-delete hides the body', async () => {
    expect((await req('DELETE', `/api/v1/messages/${msgId}`, await auth.token(SUB_ME))).status).toBe(200)
    const list = (await (await req('GET', `/api/v1/matches/${matchId}/messages`, await auth.token(SUB_ME))).json()) as {
      messages: { id: string; body: string | null; deleted: boolean }[]
    }
    const del = list.messages.find((mm) => mm.id === msgId)!
    expect(del.deleted).toBe(true)
    expect(del.body).toBeNull()
  })

  test('non-participant cannot read the match messages → 404', async () => {
    const res = await req('GET', `/api/v1/matches/${matchId}/messages`, await auth.token(SUB_X))
    expect(res.status).toBe(404)
  })
})

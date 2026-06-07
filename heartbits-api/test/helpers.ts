import postgres from 'postgres'
import { generateKeyPair, exportJWK, SignJWT, type KeyLike } from 'jose'

// Integration tests run only when a test database is configured; otherwise they
// describe.skip so `bun test` (and `make check`) stay fast and DB-free.
export const hasTestDb = !!process.env.TEST_DATABASE_URL

// Stand up a fake Zitadel: a real RS256 keypair whose public JWKS is served by
// intercepting the discovery + jwks_uri fetches the auth plugin makes. token(sub)
// mints a valid JWT (correct iss/aud) so the REAL auth path verifies it.
const JWKS_URI = 'https://jwks.test.local/keys'
const KID = 'test-key'

// One keypair shared across all test files: the auth module caches the remote
// JWKS as a process singleton, so every file must verify against the same key.
let _kp: { privateKey: KeyLike; jwk: Record<string, unknown> } | null = null
async function sharedKey(): Promise<{ privateKey: KeyLike; jwk: Record<string, unknown> }> {
  if (!_kp) {
    const { publicKey, privateKey } = await generateKeyPair('RS256', { extractable: true })
    _kp = { privateKey, jwk: { ...(await exportJWK(publicKey)), kid: KID, alg: 'RS256', use: 'sig' } }
  }
  return _kp
}

export async function setupAuthMock() {
  const { privateKey, jwk } = await sharedKey()
  const realFetch = globalThis.fetch

  globalThis.fetch = (async (input: Request | string | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (url === process.env.ZITADEL_JWKS_URL) return Response.json({ jwks_uri: JWKS_URI })
    if (url === JWKS_URI) return Response.json({ keys: [jwk] })
    return realFetch(input as never, init)
  }) as typeof fetch

  return {
    token: (sub: string) =>
      new SignJWT({})
        .setProtectedHeader({ alg: 'RS256', kid: KID })
        .setIssuer(process.env.ZITADEL_ISSUER!)
        .setAudience(process.env.ZITADEL_CLIENT_ID!)
        .setSubject(sub)
        .setExpirationTime('5m')
        .sign(privateKey),
    restore: () => {
      globalThis.fetch = realFetch
    }
  }
}

// Superuser connection to the test DB — used to seed/clean rows bypassing RLS.
export function adminSql() {
  const url = process.env.TEST_ADMIN_DATABASE_URL
  if (!url) throw new Error('TEST_ADMIN_DATABASE_URL is required for integration tests')
  return postgres(url, { max: 2, transform: { undefined: null } })
}

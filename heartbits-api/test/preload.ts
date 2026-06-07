// Runs before any test module loads (configured in bunfig.toml).
// Unit tests need only the encryption key. Integration tests additionally set
// TEST_DATABASE_URL / TEST_REDIS_URL, which we map onto the names db.ts/redis.ts
// read at import time.
process.env.HB_FIELD_ENCRYPTION_KEY ||=
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
process.env.ZITADEL_ISSUER ||= 'https://auth.test.local'
process.env.ZITADEL_CLIENT_ID ||= 'test-client'
process.env.ZITADEL_JWKS_URL ||= 'https://auth.test.local/.well-known/openid-configuration'

if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
if (process.env.TEST_REDIS_URL) process.env.REDIS_URL = process.env.TEST_REDIS_URL

// Set the field-encryption key before crypto.ts reads it (lazily, in getKey()).
process.env.HB_FIELD_ENCRYPTION_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

import { describe, expect, test } from 'bun:test'
import { encrypt, decrypt, encryptIfPresent, decryptField } from './crypto'

describe('crypto: encrypt/decrypt round-trip', () => {
  test('round-trips ASCII, unicode, and empty-ish strings', async () => {
    for (const pt of ['hello', 'Ünïcödé 💓 名前', 'a', ' ', '1990-05-01']) {
      expect(await decrypt(await encrypt(pt))).toBe(pt)
    }
  })

  test('output is iv:ciphertext:tag (3 base64 parts)', async () => {
    const parts = (await encrypt('secret')).split(':')
    expect(parts).toHaveLength(3)
    for (const p of parts) expect(p).toBe(Buffer.from(p, 'base64').toString('base64'))
  })

  test('uses a random IV — same plaintext encrypts differently each time', async () => {
    expect(await encrypt('same')).not.toBe(await encrypt('same'))
  })
})

describe('crypto: tamper + format rejection', () => {
  test('rejects a tampered ciphertext (GCM auth tag)', async () => {
    const [iv, ct, tag] = (await encrypt('top secret')).split(':')
    const flipped = Buffer.from(ct!, 'base64')
    flipped[0] = (flipped[0] ?? 0) ^ 0xff
    const tampered = `${iv}:${flipped.toString('base64')}:${tag}`
    await expect(decrypt(tampered)).rejects.toThrow()
  })

  test('rejects malformed input (wrong part count)', async () => {
    await expect(decrypt('not-valid')).rejects.toThrow('Invalid encrypted field format')
    await expect(decrypt('a:b')).rejects.toThrow()
  })
})

describe('crypto: optional-field helpers', () => {
  test('encryptIfPresent returns null for null/undefined/empty', async () => {
    expect(await encryptIfPresent(null)).toBeNull()
    expect(await encryptIfPresent(undefined)).toBeNull()
    expect(await encryptIfPresent('')).toBeNull()
  })

  test('encryptIfPresent encrypts a real value', async () => {
    const enc = await encryptIfPresent('Jane')
    expect(enc).not.toBeNull()
    expect(await decrypt(enc!)).toBe('Jane')
  })

  test('decryptField handles null, string, and Buffer (postgres BYTEA)', async () => {
    expect(await decryptField(null)).toBeNull()
    expect(await decryptField('')).toBeNull()
    const enc = await encrypt('Bio text')
    expect(await decryptField(enc)).toBe('Bio text')
    expect(await decryptField(Buffer.from(enc, 'utf8'))).toBe('Bio text')
  })
})

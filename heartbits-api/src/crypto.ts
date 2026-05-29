// ---------------------------------------------------------------------------
// AES-256-GCM field-level encryption for PII columns
//
// Format stored in DB (BYTEA column, hex-encoded in transit):
//   "<iv_base64>:<ciphertext_base64>:<tag_base64>"
//
// Key source: HB_FIELD_ENCRYPTION_KEY env var — hex-encoded 32 bytes
// Generate with:  openssl rand -hex 32
// ---------------------------------------------------------------------------

const KEY_ENV = 'HB_FIELD_ENCRYPTION_KEY'
const ALGORITHM = 'AES-GCM'
const IV_LENGTH = 12   // 96-bit IV — recommended for GCM
const TAG_LENGTH = 16  // 128-bit authentication tag

let _key: CryptoKey | null = null

async function getKey(): Promise<CryptoKey> {
  if (_key) return _key

  const hexKey = process.env[KEY_ENV]
  if (!hexKey || hexKey.length !== 64) {
    throw new Error(
      `${KEY_ENV} must be a 64-character hex string (32 bytes). ` +
      `Generate with: openssl rand -hex 32`,
    )
  }

  const keyBytes = Buffer.from(hexKey, 'hex')
  _key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: ALGORITHM },
    false, // not extractable
    ['encrypt', 'decrypt'],
  )
  return _key
}

/**
 * Encrypt a plaintext string.
 * Returns a string in the form:  "<iv_b64>:<ciphertext_b64>:<tag_b64>"
 * Safe to store in a BYTEA column (no binary escaping needed since it's printable ASCII).
 */
export async function encrypt(plaintext: string): Promise<string> {
  const key = await getKey()
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const encoder = new TextEncoder()

  const ciphertextWithTag = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH * 8 },
    key,
    encoder.encode(plaintext),
  )

  // SubtleCrypto appends the tag at the end of the ciphertext buffer
  const ciphertextWithTagBytes = new Uint8Array(ciphertextWithTag)
  const ciphertext = ciphertextWithTagBytes.slice(0, -TAG_LENGTH)
  const tag = ciphertextWithTagBytes.slice(-TAG_LENGTH)

  const b64 = (buf: Uint8Array) => Buffer.from(buf).toString('base64')
  return `${b64(iv)}:${b64(ciphertext)}:${b64(tag)}`
}

/**
 * Decrypt a value previously produced by `encrypt()`.
 * Throws on invalid format, bad key, or tampered ciphertext.
 */
export async function decrypt(stored: string): Promise<string> {
  const key = await getKey()
  const parts = stored.split(':')

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted field format — expected iv:ciphertext:tag')
  }

  const [ivB64, ciphertextB64, tagB64] = parts as [string, string, string]

  const iv = Buffer.from(ivB64, 'base64')
  const ciphertext = Buffer.from(ciphertextB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')

  // Reassemble ciphertext+tag for SubtleCrypto
  const combined = new Uint8Array(ciphertext.length + tag.length)
  combined.set(ciphertext, 0)
  combined.set(tag, ciphertext.length)

  const plaintext = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH * 8 },
    key,
    combined,
  )

  return new TextDecoder().decode(plaintext)
}

/**
 * Encrypt a value only if it is non-null/non-undefined.
 * Convenience wrapper for optional profile fields.
 */
export async function encryptIfPresent(value: string | null | undefined): Promise<string | null> {
  if (value == null || value === '') return null
  return encrypt(value)
}

/**
 * Decrypt a BYTEA column value coming back from postgres.js.
 * postgres.js returns BYTEA as a Buffer (Node.js Buffer / Uint8Array).
 * We store printable ASCII in the column, so Buffer → string is lossless.
 */
export async function decryptField(raw: Buffer | string | null): Promise<string | null> {
  if (raw == null) return null
  const stored = typeof raw === 'string' ? raw : raw.toString('utf8')
  if (!stored) return null
  return decrypt(stored)
}

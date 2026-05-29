// ---------------------------------------------------------------------------
// MinIO client — shared across API routes and worker
// ---------------------------------------------------------------------------
import { Client } from 'minio'

export const BUCKET = process.env['MINIO_BUCKET'] ?? 'heartbits-media'

export const minio: Client | null = (() => {
  const ep = process.env['MINIO_ENDPOINT']
  const ak = process.env['MINIO_ACCESS_KEY']
  const sk = process.env['MINIO_SECRET_KEY']
  if (!ep || !ak || !sk) return null
  const colonIdx = ep.lastIndexOf(':')
  const host = colonIdx > 0 ? ep.slice(0, colonIdx) : ep
  const port = colonIdx > 0 ? parseInt(ep.slice(colonIdx + 1), 10) : 9000
  return new Client({
    endPoint: host,
    port,
    useSSL: process.env['MINIO_USE_SSL'] === 'true',
    accessKey: ak,
    secretKey: sk,
  })
})()

if (minio) {
  console.log(`[minio] client initialised → ${process.env['MINIO_ENDPOINT']}`)
} else {
  console.warn('[minio] not configured — media features will be disabled')
}

/** Canonical public URL for a media row id. */
export function avatarUrl(mediaId: string | null): string | null {
  if (!mediaId) return null
  const domain = process.env['MEDIA_DOMAIN'] ?? 'media.heartbits.example.com'
  return `https://${domain}/${BUCKET}/${mediaId}`
}

/**
 * Idempotent: create the media bucket and set a public-read policy.
 * Called once at API startup — non-fatal if MinIO is unavailable.
 */
export async function ensureBucket(): Promise<void> {
  if (!minio) return
  try {
    const exists = await minio.bucketExists(BUCKET)
    if (!exists) {
      await minio.makeBucket(BUCKET)
      console.log(`[minio] created bucket: ${BUCKET}`)
    }
    // Public read so avatars are served directly through the media CDN/proxy
    await minio.setBucketPolicy(
      BUCKET,
      JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${BUCKET}/*`],
          },
        ],
      }),
    )
  } catch (e) {
    console.warn('[minio] ensureBucket failed (non-fatal):', e instanceof Error ? e.message : e)
  }
}

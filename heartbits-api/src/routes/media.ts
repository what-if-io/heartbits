// ---------------------------------------------------------------------------
// /api/v1/me/avatar — profile photo upload
//
// POST /api/v1/me/avatar   multipart/form-data { file }
//   Uploads JPEG/WebP/PNG (max 8 MB) to MinIO, replaces existing avatar.
//   Returns { avatar_url }.
// ---------------------------------------------------------------------------
import { Elysia, t } from 'elysia'
import { authPlugin } from '../auth'
import { withUser } from '../db'
import { minio, BUCKET, avatarUrl } from '../minio'

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/png':  'png',
}

export const mediaRoute = new Elysia({ prefix: '/api/v1' })
  .use(authPlugin)
  .post(
    '/me/avatar',
    async ({ auth, body, set }) => {
      const client = minio
      if (!client) {
        set.status = 503
        return { error: 'Media storage is not configured on this server.' }
      }

      const file = body.file as File
      const ext = MIME_TO_EXT[file.type]
      if (!ext) {
        set.status = 400
        return { error: 'Unsupported image type. Send JPEG, WebP, or PNG.' }
      }

      const buffer = Buffer.from(await file.arrayBuffer())
      // Object key == media row id so the public URL (avatarUrl → /{BUCKET}/{id})
      // resolves directly to the stored object. Content-Type travels as metadata,
      // so the extension is not needed in the key.
      const mediaId   = crypto.randomUUID()
      const objectKey = mediaId

      // Upload to MinIO first — if this fails, DB stays untouched
      await client.putObject(BUCKET, objectKey, buffer, buffer.length, {
        'Content-Type':  file.type,
        'Cache-Control': 'public, max-age=31536000, immutable',
      })

      return withUser(auth.userId, async (tx) => {
        // Fetch current avatar so we can clean it up after the update
        const [profile] = await tx<{ avatar_media_id: string | null }[]>`
          SELECT avatar_media_id FROM app.profiles WHERE id = ${auth.userId}
        `
        const oldMediaId = profile?.avatar_media_id ?? null

        // Insert new media row
        const [media] = await tx<{ id: string }[]>`
          INSERT INTO app.media (id, user_id, bucket, object_key, purpose)
          VALUES (${mediaId}, ${auth.userId}, ${BUCKET}, ${objectKey}, 'avatar')
          RETURNING id
        `
        if (!media) throw new Error('media insert returned no row')

        // Point profile at the new avatar
        await tx`
          UPDATE app.profiles
          SET avatar_media_id = ${media.id}
          WHERE id = ${auth.userId}
        `

        await tx`
          INSERT INTO app.audit_log (id, actor_id, action, target_type, target_id, created_at)
          VALUES (gen_random_uuid(), ${auth.userId}, 'avatar.upload', 'media', ${media.id}, NOW())
        `

        // Remove old MinIO object and media row (best-effort — non-fatal)
        if (oldMediaId) {
          const [oldMedia] = await tx<{ object_key: string }[]>`
            SELECT object_key FROM app.media WHERE id = ${oldMediaId}
          `.catch(() => [])
          if (oldMedia) {
            await client.removeObject(BUCKET, oldMedia.object_key).catch(() => {/* ignore */})
          }
          await tx`DELETE FROM app.media WHERE id = ${oldMediaId}`.catch(() => {/* ignore */})
        }

        set.status = 200
        return { avatar_url: avatarUrl(media.id) }
      })
    },
    {
      body: t.Object({
        file: t.File({ type: ['image/jpeg', 'image/webp', 'image/png'], maxSize: '8m' }),
      }),
      detail: { summary: 'Upload or replace profile avatar (max 8 MB)', tags: ['me'] },
    },
  )

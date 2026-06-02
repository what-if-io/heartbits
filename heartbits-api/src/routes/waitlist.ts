// ---------------------------------------------------------------------------
// POST /api/v1/waitlist — pre-launch email capture (public, no auth)
//
// Stores the email (deduped on a normalised form) and enqueues a branded
// confirmation email for new signups only. Rate-limited per IP. Always returns
// a generic success so the endpoint never reveals whether an email is already
// on the list.
// ---------------------------------------------------------------------------
import { Elysia, t } from 'elysia'
import { sql } from '../db'
import { redis } from '../redis'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const RATE_LIMIT = 5          // signups
const RATE_WINDOW = 3600      // per hour, per IP

export const waitlistRoute = new Elysia().post(
  '/api/v1/waitlist',
  async ({ body, set, request }) => {
    // Use the RIGHTMOST X-Forwarded-For hop — that's the IP Caddy appended, which
    // a client cannot spoof. (The leftmost entry is attacker-controlled.)
    const xff = request.headers.get('x-forwarded-for')
    const ip =
      xff?.split(',').map((s) => s.trim()).filter(Boolean).pop() ||
      request.headers.get('x-real-ip') ||
      'unknown'

    // Per-IP rate limit (Redis fixed window)
    const rlKey = `hb:rl:waitlist:${ip}`
    const hits = await redis.incr(rlKey)
    if (hits === 1) await redis.expire(rlKey, RATE_WINDOW)
    if (hits > RATE_LIMIT) {
      set.status = 429
      return { error: 'Too many requests. Please try again later.' }
    }

    const email = String(body.email ?? '').trim()
    if (!EMAIL_RE.test(email) || email.length > 254) {
      set.status = 400
      return { error: 'Please enter a valid email address.' }
    }
    const emailNorm = email.toLowerCase()

    // Idempotent insert — dedup on the normalised email
    const inserted = await sql<{ id: string }[]>`
      INSERT INTO app.waitlist (email, email_norm, locale, source)
      VALUES (${email}, ${emailNorm}, ${body.locale ?? null}, ${body.source ?? 'web'})
      ON CONFLICT (email_norm) DO NOTHING
      RETURNING id
    `
    const isNew = inserted.length > 0

    // Confirmation email for genuinely new signups only
    if (isNew) {
      await redis
        .lpush(
          'hb:worker:notifications',
          JSON.stringify({ to: email, type: 'waitlistConfirm', data: { email } }),
        )
        .catch((e) => console.error('[waitlist] enqueue failed:', e instanceof Error ? e.message : e))
    }

    set.status = 200
    return { ok: true, message: "You're on the list — check your inbox to confirm." }
  },
  {
    body: t.Object({
      email: t.String({ maxLength: 254 }),
      locale: t.Optional(t.String({ maxLength: 16 })),
      source: t.Optional(t.String({ maxLength: 32 })),
    }),
    detail: { summary: 'Join the pre-launch waitlist', tags: ['waitlist'] },
  },
)

// ---------------------------------------------------------------------------
// SMTP mailer — sends transactional emails via nodemailer.
//
// Reads the same SMTP_* env vars Zitadel uses:
//   SMTP_HOST       host, or host:port
//   SMTP_PORT       optional; defaults to the port in SMTP_HOST, else 587
//   SMTP_USER       smtp username (e.g. no-reply@what-if.io)
//   SMTP_PASSWORD   smtp password / submission token
//   SMTP_FROM       envelope/from address (defaults to SMTP_USER)
//   SMTP_FROM_NAME  display name (defaults to "HeartBits")
//
// If SMTP is not configured, sendMail() logs the email and no-ops — safe for
// local dev and CI.
// ---------------------------------------------------------------------------

import nodemailer, { type Transporter } from 'nodemailer'

const RAW_HOST = process.env['SMTP_HOST'] ?? ''
const [HOST, HOST_PORT] = RAW_HOST.split(':')
const PORT = parseInt(process.env['SMTP_PORT'] ?? HOST_PORT ?? '587', 10)
const USER = process.env['SMTP_USER'] ?? ''
const PASS = process.env['SMTP_PASSWORD'] ?? ''
const FROM = process.env['SMTP_FROM'] ?? USER
const FROM_NAME = process.env['SMTP_FROM_NAME'] ?? 'HeartBits'

let transport: Transporter | null = null
let warned = false

function getTransport(): Transporter | null {
  if (!HOST || !USER || !PASS) {
    if (!warned) {
      console.warn('[mailer] SMTP not configured — emails will be logged, not sent')
      warned = true
    }
    return null
  }
  if (transport) return transport
  transport = nodemailer.createTransport({
    host: HOST,
    port: PORT,
    secure: PORT === 465,     // 465 = implicit TLS; 587 = STARTTLS
    requireTLS: PORT !== 465,
    auth: { user: USER, pass: PASS },
  })
  return transport
}

export interface Mail {
  to: string
  subject: string
  html: string
  text: string
}

/** Send one email. No-ops (with a log line) when SMTP is unconfigured. */
export async function sendMail(m: Mail): Promise<void> {
  const t = getTransport()
  if (!t) {
    console.log(`[mailer] (dry-run) → ${m.to}  «${m.subject}»`)
    return
  }
  await t.sendMail({
    from: `"${FROM_NAME}" <${FROM}>`,
    to: m.to,
    subject: m.subject,
    text: m.text,
    html: m.html,
  })
}

/** Verify SMTP connectivity (handshake + auth). Returns false if unconfigured. */
export async function verifyMailer(): Promise<boolean> {
  const t = getTransport()
  if (!t) return false
  try {
    await t.verify()
    return true
  } catch (e) {
    console.error('[mailer] verify failed:', e instanceof Error ? e.message : e)
    return false
  }
}

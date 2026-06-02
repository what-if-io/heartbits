// ---------------------------------------------------------------------------
// Transactional email templates. Each returns { subject, html, text }.
// User-supplied values are HTML-escaped for the HTML body via esc(); the
// plain-text body uses the raw values.
// ---------------------------------------------------------------------------

import { BRAND, esc, renderHtml, renderText, type EmailParts } from './render'

const para = (html: string) => `<p style="margin:0 0 14px;">${html}</p>`
const strong = (s: string) => `<strong style="color:${BRAND.text};font-weight:600;">${esc(s)}</strong>`

// ── Welcome ──────────────────────────────────────────────────────────────────
export function welcome(d: { name?: string }): EmailParts {
  const name = d.name?.trim() || 'there'
  const title = 'Your heart just joined HeartBits'
  return {
    subject: 'Welcome to HeartBits ♥',
    html: renderHtml({
      title,
      preheader: 'A like is a heartbeat. Finish your profile to begin.',
      bodyHtml:
        para(`Hi ${esc(name)},`) +
        para(`Welcome to HeartBits — the one place where a like is a heartbeat. Finish your profile, and the moment you match, your hearts can sync live for the very first time.`),
      cta: { label: 'Complete your profile', url: `${BRAND.appUrl}/profile` },
    }),
    text: renderText({
      title,
      lines: [
        `Hi ${name},`,
        '',
        'Welcome to HeartBits — the one place where a like is a heartbeat. Finish your profile, and the moment you match, your hearts can sync live for the very first time.',
      ],
      cta: { label: 'Complete your profile', url: `${BRAND.appUrl}/profile` },
    }),
  }
}

// ── New match ────────────────────────────────────────────────────────────────
export function newMatch(d: { name?: string; matchName: string }): EmailParts {
  const name = d.name?.trim() || 'there'
  const title = `You and ${d.matchName} matched`
  return {
    subject: `It's a match — ${d.matchName} ♥`,
    html: renderHtml({
      title,
      preheader: `You and ${d.matchName} liked each other. Your hearts can sync now.`,
      bodyHtml:
        para(`Hi ${esc(name)},`) +
        para(`You and ${strong(d.matchName)} liked each other — which on HeartBits means your hearts can now sync live. Open the match to share your first beats together.`),
      cta: { label: 'Open your match', url: `${BRAND.appUrl}/matches` },
    }),
    text: renderText({
      title,
      lines: [
        `Hi ${name},`,
        '',
        `You and ${d.matchName} liked each other — which on HeartBits means your hearts can now sync live. Open the match to share your first beats together.`,
      ],
      cta: { label: 'Open your match', url: `${BRAND.appUrl}/matches` },
    }),
  }
}

// ── New message ──────────────────────────────────────────────────────────────
export function newMessage(d: { name?: string; fromName: string; preview?: string }): EmailParts {
  const name = d.name?.trim() || 'there'
  const title = `${d.fromName} sent you a message`
  const previewHtml = d.preview
    ? para(`<span style="color:${BRAND.muted};font-style:italic;">&ldquo;${esc(d.preview)}&rdquo;</span>`)
    : ''
  return {
    subject: `New message from ${d.fromName}`,
    html: renderHtml({
      title,
      preheader: d.preview ? `“${d.preview}”` : `${d.fromName} just messaged you on HeartBits.`,
      bodyHtml:
        para(`Hi ${esc(name)},`) +
        para(`${strong(d.fromName)} just sent you a message on HeartBits.`) +
        previewHtml,
      cta: { label: 'Read &amp; reply', url: `${BRAND.appUrl}/matches` },
    }),
    text: renderText({
      title,
      lines: [
        `Hi ${name},`,
        '',
        `${d.fromName} just sent you a message on HeartBits.`,
        ...(d.preview ? ['', `"${d.preview}"`] : []),
      ],
      cta: { label: 'Read & reply', url: `${BRAND.appUrl}/matches` },
    }),
  }
}

// ── Account deletion scheduled ───────────────────────────────────────────────
export function accountDeletionScheduled(d: { name?: string; purgeDate: string }): EmailParts {
  const name = d.name?.trim() || 'there'
  const title = 'Your account has been deleted'
  return {
    subject: 'Your HeartBits account has been deleted',
    html: renderHtml({
      title,
      preheader: `Your data has been erased and will be permanently removed on ${d.purgeDate}.`,
      bodyHtml:
        para(`Hi ${esc(name)},`) +
        para(`Your HeartBits account has been deleted. Your personal data has already been erased, and everything remaining will be permanently removed on ${strong(d.purgeDate)}.`) +
        para(`If you didn't request this, please contact us right away at <a href="mailto:${BRAND.contact}" style="color:${BRAND.coral};text-decoration:none;">${BRAND.contact}</a>.`),
    }),
    text: renderText({
      title,
      lines: [
        `Hi ${name},`,
        '',
        `Your HeartBits account has been deleted. Your personal data has already been erased, and everything remaining will be permanently removed on ${d.purgeDate}.`,
        '',
        `If you didn't request this, please contact us right away at ${BRAND.contact}.`,
      ],
    }),
  }
}

// ── Data export ready (GDPR Art. 20) ─────────────────────────────────────────
export function dataExportReady(d: { name?: string; url: string; expiresIn: string }): EmailParts {
  const name = d.name?.trim() || 'there'
  const title = 'Your data export is ready'
  return {
    subject: 'Your HeartBits data export is ready',
    html: renderHtml({
      title,
      preheader: `Download your data — the link expires in ${d.expiresIn}.`,
      bodyHtml:
        para(`Hi ${esc(name)},`) +
        para(`The HeartBits data export you requested is ready. For your security, the download link expires in ${strong(d.expiresIn)}.`),
      cta: { label: 'Download your data', url: d.url },
    }),
    text: renderText({
      title,
      lines: [
        `Hi ${name},`,
        '',
        `The HeartBits data export you requested is ready. For your security, the download link expires in ${d.expiresIn}.`,
      ],
      cta: { label: 'Download your data', url: d.url },
    }),
  }
}

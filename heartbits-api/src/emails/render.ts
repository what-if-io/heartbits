// ---------------------------------------------------------------------------
// Brand-consistent transactional email layout — HTML + plain text.
//
// No dependencies — pure string builders. The HTML is email-client-safe:
// table layout, inline styles, 600px width, dark HeartBits theme, and a
// bulletproof (table-based) CTA button. Each template returns both an HTML
// and a plain-text body so clients that prefer text get an equally clean read.
//
// Brand: bg #070710 · coral #FF6B6B · gradient coral→magenta→purple · serif H1.
// ---------------------------------------------------------------------------

export const BRAND = {
  bg:      '#070710',
  outer:   '#030308',   // page backdrop — darker than the panel so the card floats
  panel:   '#0e0e1a',
  coral:   '#FF6B6B',
  magenta: '#E81F8C',
  purple:  '#7B35DE',
  text:    '#ededf2',
  muted:   '#8a8a99',
  faint:   '#4a4a57',
  border:  '#1d1d2b',
  appUrl:  'https://heartbits.what-if.io',
  contact: 'hello@what-if.io',
} as const

const SANS = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`
const SERIF = `Georgia,'Times New Roman',serif`

/** Escape user-supplied values before interpolating into HTML. */
export function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export interface EmailParts {
  subject: string
  html: string
  text: string
}

export interface Cta {
  label: string
  url: string
}

interface HtmlLayout {
  title: string       // serif H1 at the top of the body
  preheader: string   // hidden inbox-preview line
  bodyHtml: string    // inner HTML — caller is responsible for escaping user data
  cta?: Cta
}

/** Bulletproof, table-based CTA button (renders in Outlook too). */
function button(cta: Cta): string {
  return `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:30px 0 6px;">
          <tr>
            <td align="center" bgcolor="${BRAND.coral}" style="border-radius:999px;">
              <a href="${cta.url}" target="_blank"
                 style="display:inline-block;padding:14px 34px;font-family:${SANS};font-size:15px;font-weight:600;color:#1a0710;text-decoration:none;border-radius:999px;">${esc(cta.label)}</a>
            </td>
          </tr>
        </table>`
}

export function renderHtml(o: HtmlLayout): string {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <meta name="color-scheme" content="dark light"/>
  <meta name="supported-color-schemes" content="dark light"/>
  <title>${esc(o.title)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.outer};-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${BRAND.outer};font-size:1px;line-height:1px;">${esc(o.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.outer};">
    <tr>
      <td align="center" style="padding:44px 24px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background:${BRAND.panel};border:1px solid ${BRAND.border};border-radius:18px;overflow:hidden;">
          <tr>
            <td style="padding:34px 40px 0;">
              <span style="font-family:${SERIF};font-size:23px;letter-spacing:0.4px;color:${BRAND.coral};">HeartBits</span>
              <span style="color:${BRAND.coral};font-size:17px;">&#9829;</span>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 40px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td height="3" bgcolor="${BRAND.coral}" style="height:3px;line-height:3px;font-size:0;background:linear-gradient(90deg,${BRAND.coral},${BRAND.magenta} 45%,${BRAND.purple});border-radius:3px;">&nbsp;</td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:30px 40px 8px;">
              <h1 style="margin:0 0 18px;font-family:${SERIF};font-weight:400;font-size:27px;line-height:1.25;color:${BRAND.text};">${esc(o.title)}</h1>
              <div style="font-family:${SANS};font-size:15px;line-height:1.7;color:${BRAND.muted};">${o.bodyHtml}</div>
              ${o.cta ? button(o.cta) : ''}
            </td>
          </tr>
          <tr>
            <td style="padding:26px 40px 36px;border-top:1px solid ${BRAND.border};">
              <p style="margin:0 0 7px;font-family:${SANS};font-size:12px;line-height:1.6;color:${BRAND.muted};">You're receiving this because you have a HeartBits account.</p>
              <p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.6;color:${BRAND.muted};">
                <a href="${BRAND.appUrl}" style="color:${BRAND.coral};text-decoration:none;">heartbits.what-if.io</a>
                &nbsp;&middot;&nbsp;
                <a href="mailto:${BRAND.contact}" style="color:${BRAND.coral};text-decoration:none;">${BRAND.contact}</a>
                &nbsp;&middot;&nbsp;
                <a href="${BRAND.appUrl}/profile" style="color:${BRAND.muted};text-decoration:underline;">Notification settings</a>
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:18px 0 0;font-family:${SANS};font-size:11px;color:${BRAND.faint};">HeartBits — feel someone's heartbeat, live.</p>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/** Plain-text counterpart — clean and readable, same content as the HTML. */
export function renderText(o: { title: string; lines: string[]; cta?: Cta }): string {
  const out = ['HeartBits  ♥', '─────────────', '', o.title, '', ...o.lines]
  if (o.cta) out.push('', `${o.cta.label}:`, o.cta.url)
  out.push(
    '',
    '—',
    'heartbits.what-if.io · hello@what-if.io',
    'Notification settings: https://heartbits.what-if.io/profile',
  )
  return out.join('\n')
}

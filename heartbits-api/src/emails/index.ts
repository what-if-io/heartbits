// ---------------------------------------------------------------------------
// HeartBits transactional emails — public entry point.
//
// Usage:
//   import { emails } from './emails'
//   const { subject, html, text } = emails.newMatch({ name, matchName })
//   await sendMail({ to, subject, html, text })   // wire to your SMTP/provider
//
// Templates are pure functions returning { subject, html, text } — no I/O, so
// they're trivial to unit-test and to preview (see ./preview.ts).
// ---------------------------------------------------------------------------

export * from './render'
export {
  welcome,
  newMatch,
  newMessage,
  waitlistConfirm,
  accountDeletionScheduled,
  dataExportReady,
} from './templates'

import * as templates from './templates'

/** Named registry — handy for queue-driven dispatch in the worker. */
export const emails = templates
export type EmailName = keyof typeof templates

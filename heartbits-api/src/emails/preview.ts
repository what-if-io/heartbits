// ---------------------------------------------------------------------------
// Preview generator — renders every template to HTML + TXT for eyeballing.
//   bun run src/emails/preview.ts
// Then open src/emails/preview/index.html in a browser.
// (The preview/ output dir is gitignored.)
// ---------------------------------------------------------------------------

import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import * as T from './templates'
import type { EmailParts } from './render'

const samples: Record<string, EmailParts> = {
  'welcome':                    T.welcome({ name: 'Alex' }),
  'new-match':                  T.newMatch({ name: 'Alex', matchName: 'Sam' }),
  'new-message':                T.newMessage({ name: 'Alex', fromName: 'Sam', preview: 'Your taste in music is dangerous — coffee this week?' }),
  'account-deletion-scheduled': T.accountDeletionScheduled({ name: 'Alex', purgeDate: '2 July 2026' }),
  'data-export-ready':          T.dataExportReady({ name: 'Alex', url: 'https://heartbits.what-if.io/export/sample', expiresIn: '24 hours' }),
}

const here = dirname(fileURLToPath(import.meta.url))
const dir = join(here, 'preview')
mkdirSync(dir, { recursive: true })

let index = `<!doctype html><html><head><meta charset="utf-8"/><title>HeartBits email previews</title></head>` +
  `<body style="background:#070710;font-family:-apple-system,Segoe UI,Roboto,sans-serif;padding:40px;color:#ededf2;">` +
  `<h1 style="font-family:Georgia,serif;color:#FF6B6B;font-weight:400;">HeartBits email previews <span>&#9829;</span></h1><ul style="line-height:2;">`

for (const [name, parts] of Object.entries(samples)) {
  writeFileSync(join(dir, `${name}.html`), parts.html)
  writeFileSync(join(dir, `${name}.txt`), parts.text)
  index += `<li><a style="color:#FF6B6B;" href="./${name}.html">${name}.html</a> ` +
    `<a style="color:#8a8a99;font-size:13px;" href="./${name}.txt">(txt)</a> ` +
    `<span style="color:#8a8a99;">— ${parts.subject}</span></li>`
  // eslint-disable-next-line no-console
  console.log(`✓ ${name.padEnd(28)} ${parts.subject}`)
}

index += `</ul></body></html>`
writeFileSync(join(dir, 'index.html'), index)
// eslint-disable-next-line no-console
console.log(`\nOpen: ${join(dir, 'index.html')}`)

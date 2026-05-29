/**
 * HeartBits demo recording script — Playwright
 *
 * Records a full walkthrough of the demo flow:
 *   Landing → Login → Demo → Discover → Bond → Matches → Profile → Pitch
 *
 * Usage:
 *   npx playwright install chromium
 *   npx ts-node scripts/record-demo.ts
 *   # or via bun:
 *   bun run scripts/record-demo.ts
 *
 * Output: ./demo-recording.webm + screenshots in ./demo-screenshots/
 *
 * Set BASE_URL env var to target a different host (default: https://heartbits.example.com)
 * Set STAGING_PASSWORD env var if the staging gate is active.
 */

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const BASE_URL = process.env.BASE_URL ?? 'https://heartbits.example.com';
const STAGING_PASSWORD = process.env.STAGING_PASSWORD ?? '';
const SCREENSHOT_DIR = path.join(process.cwd(), 'demo-screenshots');
const VIDEO_DIR = path.join(process.cwd(), 'demo-video');

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
fs.mkdirSync(VIDEO_DIR, { recursive: true });

async function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function shot(page: import('playwright').Page, name: string) {
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `${name}.png`),
    fullPage: false,
  });
  console.log(`  📸 ${name}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 14 Pro dimensions
    deviceScaleFactor: 2,
    recordVideo: { dir: VIDEO_DIR, size: { width: 390, height: 844 } },
    colorScheme: 'dark',
  });
  const page = await context.newPage();

  try {
    console.log('🎬 Starting HeartBits demo recording...\n');

    // ── 1. Pitch page ───────────────────────────────────────
    console.log('1/8  Pitch page');
    await page.goto(`${BASE_URL}/pitch`);
    await page.waitForLoadState('networkidle');
    await delay(1500);
    await shot(page, '01-pitch');
    await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'smooth' }));
    await delay(800);
    await shot(page, '02-pitch-features');

    // ── 2. Login page ───────────────────────────────────────
    console.log('2/8  Login page');
    await page.goto(`${BASE_URL}/auth/login`);
    await page.waitForLoadState('networkidle');
    await delay(1200);
    await shot(page, '03-login');

    // ── 3. Enter demo mode ──────────────────────────────────
    console.log('3/8  Entering demo mode');
    // Pass staging cookie if needed
    if (STAGING_PASSWORD) {
      await context.addCookies([{
        name: 'hb_staging',
        value: STAGING_PASSWORD,
        domain: new URL(BASE_URL).hostname,
        path: '/',
        httpOnly: true,
        secure: BASE_URL.startsWith('https'),
        sameSite: 'Lax',
      }]);
    }
    await page.goto(`${BASE_URL}/auth/demo`);
    await page.waitForURL('**/discover', { timeout: 8000 });
    await delay(1200);

    // ── 4. Discover screen ──────────────────────────────────
    console.log('4/8  Discover');
    await shot(page, '04-discover');
    await delay(800);

    // Swipe a card (drag right = heart)
    const card = page.locator('.card-stack').first();
    if (await card.isVisible({ timeout: 2000 }).catch(() => false)) {
      const box = await card.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, { steps: 15 });
        await delay(300);
        await shot(page, '05-discover-swipe');
        await page.mouse.up();
        await delay(600);
      }
    }

    // ── 5. Bond screen ──────────────────────────────────────
    console.log('5/8  Bond');
    await page.goto(`${BASE_URL}/bond/ela`);
    await page.waitForLoadState('networkidle');
    await delay(2000); // let heartbeat animate
    await shot(page, '06-bond');
    await delay(1500);
    await shot(page, '07-bond-synced');

    // ── 6. Matches screen ───────────────────────────────────
    console.log('6/8  Matches');
    await page.goto(`${BASE_URL}/matches`);
    await page.waitForLoadState('networkidle');
    await delay(1200);
    await shot(page, '08-matches');

    // ── 7. Profile screen ───────────────────────────────────
    console.log('7/8  Profile');
    await page.goto(`${BASE_URL}/profile`);
    await page.waitForLoadState('networkidle');
    await delay(1200);
    await shot(page, '09-profile');

    // ── 8. Back to pitch ────────────────────────────────────
    console.log('8/8  Pitch CTA');
    await page.goto(`${BASE_URL}/pitch`);
    await page.waitForLoadState('networkidle');
    await delay(800);
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
    await delay(1200);
    await shot(page, '10-pitch-cta');

    console.log('\n✓ Recording complete.');
    console.log(`  Screenshots: ${SCREENSHOT_DIR}`);
    console.log(`  Video: ${VIDEO_DIR} (check for .webm file)`);

  } finally {
    await context.close();
    await browser.close();
  }
})();

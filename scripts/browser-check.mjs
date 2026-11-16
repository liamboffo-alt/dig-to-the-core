// Drives the real game in headless Chromium:  node scripts/browser-check.mjs [url]
// Checks: loads without console errors, digging works, buying works, the save survives a reload.
import { createRequire } from 'node:module';

// Works with a project-local or a globally installed Playwright.
const { chromium, devices } = createRequire(import.meta.url)('playwright');

const url = process.argv[2] ?? 'http://localhost:5173/';
const shots = process.env.SHOTS ?? '.';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let failed = false;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`);
  if (!ok) failed = true;
};

const setups = [
  ['phone', devices['Pixel 7']],
  ['desktop', { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }],
];

for (const [label, opts] of setups) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url);
  await page.waitForFunction(() => window.__dig, null, { timeout: 15000 });
  const state = () => page.evaluate(() => {
    const s = window.__dig.session;
    return { depth: s.hole.depth, cash: s.player.cash, hits: s.player.counters.hits, power: s.player.upgrades.power ?? 0 };
  });

  const box = await page.locator('#stage').boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height * 0.6;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${shots}/${label}-digging.png` });
  await page.mouse.up();
  const a = await state();
  check(`${label}: holding digs`, a.depth > 0 && a.hits >= 10, `depth ${a.depth.toFixed(4)} m, ${a.hits} hits, $${a.cash.toFixed(0)}`);

  if (label === 'phone') await page.locator('[data-tab="shop"]').click();
  await page.locator('[data-act="upgrade:power"]').dispatchEvent('pointerdown');
  await page.locator('[data-act="upgrade:power"]').dispatchEvent('pointerup');
  const b = await state();
  check(`${label}: an upgrade is affordable and buys after 6 s of play`, b.power === 1 && b.cash < a.cash, `power level ${b.power}`);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${shots}/${label}-shop.png` });

  await page.evaluate(() => window.__dig.session.save());
  await page.reload();
  await page.waitForFunction(() => window.__dig, null, { timeout: 15000 });
  const c = await state();
  check(`${label}: save survives a reload`, c.power === 1 && c.depth >= b.depth && c.hits === b.hits, `depth ${c.depth.toFixed(4)} m`);

  const fps = await page.evaluate(() => new Promise((resolve) => {
    let n = 0;
    const t0 = performance.now();
    const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else resolve(n / 2); };
    requestAnimationFrame(f);
  }));
  console.log(`      ${label}: ${fps.toFixed(0)} fps (headless software rendering, not a real GPU)`);
  check(`${label}: no console errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}
await browser.close();
process.exit(failed ? 1 : 0);

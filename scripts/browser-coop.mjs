// Two browsers in one co-op room:  node scripts/browser-coop.mjs [url]
// Needs the game server running (npm run server) as well as the page at [url].
import { createRequire } from 'node:module';

const { chromium, devices } = createRequire(import.meta.url)('playwright');
const url = process.argv[2] ?? 'http://localhost:5173/';
const shots = process.env.SHOTS ?? '.';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let failed = false;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`);
  if (!ok) failed = true;
};
const errors = [];

async function open(name) {
  const ctx = await browser.newContext(devices['Pixel 7']);
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`${name}: ${e}`));
  await page.goto(url);
  await page.waitForFunction(() => window.__dig);
  await page.locator('[data-tab="more"]').click();
  await page.locator('#co-name').fill(name);
  return page;
}
const press = async (page, sel) => {
  await page.locator(sel).first().dispatchEvent('pointerdown');
  await page.locator(sel).first().dispatchEvent('pointerup');
};
const state = (page) => page.evaluate(() => {
  const s = window.__dig.session;
  return { mode: s.mode, code: s.roomCode, depth: s.hole.depth, cash: s.player.cash, peers: s.peers.map((p) => p.name), hits: s.player.counters.hits, power: s.player.upgrades.power ?? 0 };
});

const ann = await open('Ann');
// Give Ann a solo save first, to prove co-op leaves it alone.
await ann.evaluate(() => { window.__dig.session.player.cash = 777; window.__dig.session.save(); });
await press(ann, '[data-act="create"]');
await ann.waitForFunction(() => window.__dig.session.mode === 'coop' && window.__dig.session.roomCode, null, { timeout: 8000 });
const code = (await state(ann)).code;
check('Ann creates a room and gets a code', /^[A-Z2-9]{5}$/.test(code), code);

const bob = await open('Bob');
await bob.locator('#co-code').fill(code);
await press(bob, '[data-act="join"]');
await bob.waitForFunction(() => window.__dig.session.mode === 'coop', null, { timeout: 8000 });
await ann.locator('[data-tab="more"]').click(); // close the sheets so the pit is visible
await bob.locator('[data-tab="more"]').click();

const box = await ann.locator('#stage').boundingBox();
await ann.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await ann.mouse.down();
await ann.waitForTimeout(5000);
await ann.mouse.up();
await ann.waitForTimeout(400);
const a = await state(ann), b = await state(bob);
check('both players are in the room', a.peers.length === 2 && b.peers.includes('Ann') && b.peers.includes('Bob'), b.peers.join(', '));
check('Ann digs and Bob sees the same hole', a.depth > 0 && Math.abs(a.depth - b.depth) < 0.002, `Ann ${a.depth.toFixed(4)} m, Bob ${b.depth.toFixed(4)} m`);
check('cash stays personal', a.cash > 0 && b.cash === 0, `Ann $${a.cash.toFixed(0)}, Bob $${b.cash.toFixed(0)}`);

await ann.locator('[data-tab="shop"]').click();
await press(ann, '[data-act="upgrade:power"]');
await ann.waitForTimeout(500);
check('buying goes through the server', (await state(ann)).power === 1);
await bob.screenshot({ path: `${shots}/coop-bob-sees-ann.png` });

await ann.locator('[data-tab="more"]').click();
await ann.waitForTimeout(1500);
const board = await ann.locator('#lb-room .li').allTextContents();
check('room leaderboard ranks contribution', board.length === 2 && /Ann/.test(board[0]) && /100%/.test(board[0]), board.join(' / '));
const global = await ann.locator('#lb-global .li').first().textContent();
check('deepest-dig leaderboard lists the room', (global ?? '').includes(code), global ?? '');
await ann.screenshot({ path: `${shots}/coop-leaderboard.png` });

await press(ann, '[data-act="leave"]');
await ann.waitForTimeout(400);
const solo = await state(ann);
check('leaving returns to the untouched solo save', solo.mode === 'solo' && solo.cash >= 777 && solo.cash < 800, `$${solo.cash.toFixed(0)}`);
check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
process.exit(failed ? 1 : 0);

// A guided tour of the later game in headless Chromium, using the debug handle to skip ahead.
//   node scripts/browser-tour.mjs [url]      (screenshots go to $SHOTS or the current folder)
// Checks barriers, layer changes, helpers, the collection book, rebirth, the prestige tree,
// offline earnings, export/import and the core ending, and that none of it logs an error.
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

const ctx = await browser.newContext(devices['Pixel 7']);
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(url);
await page.waitForFunction(() => window.__dig);
const shot = (name) => page.screenshot({ path: `${shots}/tour-${name}.png` });
const get = (fn, arg) => page.evaluate(fn, arg);
const press = async (sel) => {
  await page.locator(sel).first().dispatchEvent('pointerdown');
  await page.locator(sel).first().dispatchEvent('pointerup');
};
const hold = async (ms) => {
  const box = await page.locator('#stage').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
};

// --- helpers and tools
await get(() => { window.__dig.session.player.cash = 5e6; });
await page.locator('[data-tab="crew"]').click();
await press('[data-act="helper:mole"]');
await press('[data-act="helper:dog"]');
await press('[data-act="helper:miner"]');
await page.locator('[data-tab="shop"]').click();
for (let i = 0; i < 3; i++) await press('[data-act="tool"]');
const t1 = await get(() => ({ tool: window.__dig.session.player.tool, helpers: window.__dig.session.player.helpers }));
check('tools and helpers buy from the panels', t1.tool === 3 && t1.helpers.mole === 1 && t1.helpers.miner === 1, JSON.stringify(t1));
await page.locator('[data-tab="shop"]').click(); // close the sheet
await hold(1500);
await shot('jackhammer-helpers');

// --- barrier: too weak, then strong enough
await get(() => { const s = window.__dig.session; s.hole.depth = 10; s.player.tool = 0; s.player.rev++; s.player.helpers = {}; });
await hold(1200);
const b1 = await get(() => ({ shown: !document.getElementById('boss').hidden, text: document.getElementById('boss-need').textContent, hp: window.__dig.session.hole.barrierHp }));
check('barrier appears at the layer boundary and says it is too tough', b1.shown && /Too tough/.test(b1.text) && b1.hp > 0, b1.text);
await shot('barrier');
await get(() => { const s = window.__dig.session; s.player.tool = 4; s.player.rev++; });
await hold(4000);
const b2 = await get(() => ({ layer: window.__dig.session.hole.barriersBroken, depth: window.__dig.session.hole.depth, name: document.getElementById('layer-name').textContent }));
check('enough burst damage breaks the barrier into the next layer', b2.layer === 1 && b2.depth > 10, `${b2.name}, ${b2.depth.toFixed(2)} m`);
await shot('bedrock');

// --- deep layers and machine tools render
for (const [layer, tool, depth] of [[2, 5, 5000], [3, 7, 100000], [4, 9, 1500000], [5, 11, 4000000], [6, 15, 6000000]]) {
  await get(([l, t, d]) => { const s = window.__dig.session; s.hole.barriersBroken = l; s.hole.depth = d; s.player.tool = t; s.player.rev++; s.player.run.milestone = 99; }, [layer, tool, depth]);
  await hold(1600);
  await shot(`layer${layer}-tool${tool}`);
}
check('all seven layers and the machine tools render', errors.length === 0, errors.slice(0, 2).join(' | '));

// --- collection book
await get(() => { const p = window.__dig.session.player; for (const id of ['keys', 'boot', 'bone', 'capsule', 'ammonite']) p.finds[id] = 1; p.rev++; });
await page.locator('[data-tab="book"]').click();
await page.waitForTimeout(400);
const book = await page.locator('#panel .cell:not(.unknown)').count();
check('collection book shows found items', book === 5, `${book} cells`);
await shot('book');

// --- rebirth and prestige tree
await get(() => { const s = window.__dig.session; s.player.run.maxDepth = s.hole.depth; });
await page.locator('[data-tab="rebirth"]').click();
await page.waitForTimeout(300);
await press('[data-act="rebirth"]');
await page.waitForTimeout(200);
await shot('rebirth-confirm');
await page.locator('[data-do="go"]').click();
await page.waitForTimeout(600);
const r1 = await get(() => { const s = window.__dig.session; return { depth: s.hole.depth, shards: s.player.prestige.shards, rebirths: s.player.prestige.rebirths, tool: s.player.tool, cash: s.player.cash }; });
check('rebirth resets the run and pays shards', r1.depth < 1 && r1.shards > 0 && r1.rebirths === 1 && r1.tool === 0, JSON.stringify(r1));
await press('[data-act="node:might"]');
await press('[data-act="buynode"]');
await page.waitForTimeout(300);
const r2 = await get(() => window.__dig.session.player.prestige.nodes.might);
check('prestige node buys with shards', r2 >= 1, `Deep Memory level ${r2}`);
await shot('prestige-tree');

// --- export / import
await page.locator('[data-tab="more"]').click();
await page.waitForTimeout(300);
await press('[data-act="export"]');
const exported = await page.locator('#save-text').inputValue();
const before = await get(() => window.__dig.session.player.prestige.shards);
await get(() => { window.__dig.session.player.prestige.shards = 0; });
await press('[data-act="import"]');
await page.waitForTimeout(300);
const r3 = await get(() => window.__dig.session.player.prestige.shards);
check('export then import restores the save', exported.startsWith('DIG1.') && r3 === before && before > 0, `${exported.length} chars`);

// --- offline earnings
await get(() => {
  const s = window.__dig.session;
  s.player.helpers = { mole: 20 }; s.player.rev++;
  s.save();
  const raw = JSON.parse(localStorage.getItem('dig-core-save-v1'));
  raw.savedAt -= 2 * 3600 * 1000;
  localStorage.setItem('dig-core-save-v1', JSON.stringify(raw));
  window.__dig.session.save = () => {}; // keep the back-dated save through the reload
});
await page.reload();
await page.waitForFunction(() => window.__dig);
await page.waitForTimeout(400);
const off = await page.locator('#modal .sheet h2').textContent().catch(() => '');
check('offline earnings are paid on return', /Welcome back/.test(off ?? ''), (await page.locator('#modal .stat').textContent().catch(() => '')) ?? '');
await shot('offline');
await page.locator('[data-do="ok"]').click();

// --- the core
await get(() => { const s = window.__dig.session; s.hole.barriersBroken = 6; s.hole.depth = 6371000; s.player.tool = 15; s.player.ext.modifiers.push({ stat: 'tapPower', op: 'mult', value: 1e20 }); s.player.rev++; });
await hold(1500);
await shot('core-finale');
await page.waitForTimeout(4500);
const end = await page.locator('#modal .sheet h2').textContent().catch(() => '');
check('reaching the core plays the ending', /centre of Earth/.test(end ?? ''), end ?? '');
await shot('core-ending');
await page.locator('[data-do="travel"]').click();
await page.waitForTimeout(800);
const planet = await get(() => ({ planet: window.__dig.session.hole.planet, depth: window.__dig.session.hole.depth, name: document.getElementById('planet-name').textContent }));
check('the next planet unlocks and starts fresh', planet.planet === 1 && planet.depth < 1, planet.name);

check('no console errors during the tour', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
process.exit(failed ? 1 : 0);

// The scripted "reasonable player" used by scripts/balance.ts.
//
// The player: holds the dig button the whole time, looks at the shop every 1.5 s and buys
// whatever pays for itself fastest (saving up for it if needed), rebirths once progress
// stalls, and spends shards on the prestige tree in a fixed priority order.

import { HELPERS, LAYERS, MILESTONES, PRESTIGE_NODES, TOOLS, UPGRADES, BALANCE } from '../src/data';
import {
  buyHelper, buyNode, buyTool, buyUpgrade, createHole, createPlayer, expectedIncome, formatDepth,
  formatNumber, formatTime, getStats, helperCost, hit, layerIndex, layerProgress, nodeCost, nodeUnlocked,
  pendingShards, rebirth, tick, toolCost, upgradeCost, expectedDps,
  type Hole, type Player, type SimEvent,
} from '../src/sim';

const TICK = 100;
const SHOP_EVERY = 1500;
const NODE_PRIORITY = ['might', 'wealth', 'headstart', 'crew', 'crit', 'seed', 'titan', 'breaker', 'magnet', 'momentum', 'overdrive', 'bulk', 'luck', 'night'];

interface Option { cost: number; buy: () => void; gain: number; label: string }

function shopOptions(p: Player, h: Hole): Option[] {
  const s = getStats(p, h.planet);
  const base = expectedIncome(p, h);
  const out: Option[] = [];
  const gainOf = (apply: () => void, revert: () => void) => {
    apply(); p.rev++;
    const g = expectedIncome(p, h) - base;
    revert(); p.rev++;
    return g;
  };
  if (p.tool + 1 < TOOLS.length) {
    out.push({
      cost: toolCost(p, s), label: 'tool:' + TOOLS[p.tool + 1].id, buy: () => buyTool(p, h),
      gain: gainOf(() => { p.tool++; }, () => { p.tool--; }),
    });
  }
  for (const u of UPGRADES) {
    const lvl = p.upgrades[u.id] ?? 0;
    if (u.max != null && lvl >= u.max) continue;
    out.push({
      cost: upgradeCost(u, lvl, s), label: 'up:' + u.id, buy: () => buyUpgrade(p, h, u.id),
      gain: gainOf(() => { p.upgrades[u.id] = lvl + 1; }, () => { p.upgrades[u.id] = lvl; }),
    });
  }
  for (const d of HELPERS) {
    const n = p.helpers[d.id] ?? 0;
    out.push({
      cost: helperCost(d, n, s), label: 'help:' + d.id, buy: () => buyHelper(p, h, d.id),
      gain: gainOf(() => { p.helpers[d.id] = n + 1; }, () => { p.helpers[d.id] = n; }),
    });
  }
  return out;
}

/** Returns the label of what was bought, or null. */
function shopOnce(p: Player, h: Hole): string | null {
  const income = Math.max(expectedIncome(p, h), 1e-9);
  let best: Option | null = null, bestScore = Infinity;
  for (const o of shopOptions(p, h)) {
    if (o.cost <= p.cash * 0.12) { o.buy(); return o.label; } // pocket change: just buy it
    if (o.gain <= 0) continue;
    const score = Math.max(0, o.cost - p.cash) / income + o.cost / o.gain;
    if (score < bestScore) { bestScore = score; best = o; }
  }
  if (best && best.cost <= p.cash) { best.buy(); return best.label; }
  return null;
}

function spendShards(p: Player): void {
  for (let guard = 0; guard < 200; guard++) {
    const pick = NODE_PRIORITY.map((id) => PRESTIGE_NODES.find((n) => n.id === id)!)
      .filter((n) => nodeUnlocked(p, n) && (p.prestige.nodes[n.id] ?? 0) < n.max && nodeCost(n, p.prestige.nodes[n.id] ?? 0) <= p.prestige.shards)
      .sort((a, b) => nodeCost(a, p.prestige.nodes[a.id] ?? 0) - nodeCost(b, p.prestige.nodes[b.id] ?? 0))[0];
    if (!pick) return;
    buyNode(p, pick.id);
  }
}

export interface SimResult {
  log: [number, string][];
  runs: { n: number; start: number; end: number; depth: number; shards: number; tool: string; dps: number }[];
  player: Player; hole: Hole; timeMs: number; firstBuy: number; longestGap: number; gapAt: number;
}

export interface SimOptions { noRebirth?: boolean; probe?: (t: number, p: Player, h: Hole) => void; probeEveryMs?: number;
  /** Replace the stall-based rebirth decision (used by the auto-tuner). */
  stopWhen?: () => boolean;
  ignoreComplete?: boolean;
  forceRebirth?: (run: number, runTimeMs: number, p: Player, h: Hole) => boolean }

export function simulate(SEED: number, MAX_HOURS: number, VERBOSE: boolean, opts: SimOptions = {}): SimResult {
const p = createPlayer(SEED);
const h = createHole(0, false);
const events: SimEvent[] = [];
let t = 0;
const log: [number, string][] = [];
const note = (text: string) => { log.push([t, text]); };

let firstBuy = -1, firstTool = -1;
let lastNew = 0, longestGap = 0, gapAt = 0;
const layersSeen = new Set<number>([0]);
const milestonesSeen = new Set<number>();
const runs: { n: number; start: number; end: number; depth: number; shards: number; tool: string; dps: number }[] = [];
let runStart = 0;
let history: [number, number][] = []; // [time, smooth shards] for stall detection
const somethingNew = () => { const gap = t - lastNew; if (gap > longestGap) { longestGap = gap; gapAt = t; } lastNew = t; };

const smoothShards = () => {
  const d = p.run.maxDepth, r = BALANCE.rebirth;
  return d < r.minDepth ? 0 : r.shardBase * Math.pow(r.shardGrowth, layerProgress(d) - 1) * getStats(p, h.planet).shards;
};

while ((opts.ignoreComplete || !h.complete) && t < MAX_HOURS * 3600_000 && !(opts.stopWhen && opts.stopWhen())) {
  t += TICK;
  events.length = 0;
  tick(p, h, TICK, events);
  while (hit(p, h, events)) { /* hold to dig */ }

  for (const e of events) {
    if (e.type === 'layer' && !layersSeen.has(e.index)) {
      layersSeen.add(e.index);
      note(`New layer: ${LAYERS[e.index].name} (run ${p.prestige.rebirths + 1})`);
      somethingNew();
    }
    if (e.type === 'milestone' && e.first && !milestonesSeen.has(e.index)) {
      milestonesSeen.add(e.index);
      if (VERBOSE) note(`Milestone: ${MILESTONES[e.index].name}`);
      somethingNew();
    }
    if (e.type === 'achievement' || (e.type === 'find' && e.isNew)) somethingNew();
  }

  if (t % SHOP_EVERY === 0) {
    for (let i = 0; i < 4; i++) {
      const bought = shopOnce(p, h);
      if (!bought) break;
      somethingNew();
      if (firstBuy < 0) { firstBuy = t; note(`First upgrade bought (${bought})`); }
      if (process.env.TRACE && t < 90000) console.log(t, bought, p.cash.toFixed(0), expectedIncome(p, h).toFixed(1));
      if (bought.startsWith('tool:')) {
        if (firstTool < 0) { firstTool = t; }
        if (VERBOSE || p.prestige.rebirths === 0) note(`Tool: ${TOOLS[p.tool].name}`);
      }
    }
  }

  if (opts.probe && t % (opts.probeEveryMs ?? 60_000) === 0) opts.probe(t, p, h);

  // Rebirth when progress has stalled.
  if (!opts.noRebirth && t % 5000 === 0) {
    const now = smoothShards();
    history.push([t, now]);
    while (history.length && history[0][0] < t - 180_000) history.shift();
    const runTime = t - runStart;
    const pend = pendingShards(p, h);
    const stalled = history.length >= 30 && now < history[0][1] * 1.12;
    const worthIt = pend >= Math.max(1, p.prestige.totalShards * 0.3);
    const go = opts.forceRebirth
      ? opts.forceRebirth(p.prestige.rebirths + 1, runTime, p, h)
      : pend >= 1 && runTime >= 240_000 && stalled && (worthIt || runTime > 900_000);
    {
      if (go && pendingShards(p, h) >= 1) {
        const pend = pendingShards(p, h);
        runs.push({ n: p.prestige.rebirths + 1, start: runStart, end: t, depth: h.depth, shards: pend, tool: TOOLS[p.tool].name, dps: expectedDps(getStats(p, h.planet)) });
        note(`Rebirth #${p.prestige.rebirths + 1} at ${formatDepth(h.depth)} for ${pend} shards (run lasted ${formatTime(runTime / 1000)})`);
        rebirth(p, h, events);
        spendShards(p);
        runStart = t;
        history = [];
        somethingNew();
      }
    }
  }
}
runs.push({ n: p.prestige.rebirths + 1, start: runStart, end: t, depth: h.depth, shards: 0, tool: TOOLS[p.tool].name, dps: expectedDps(getStats(p, h.planet)) });
if (h.complete) note(`CORE REACHED on run ${p.prestige.rebirths + 1}`);
else note(`Gave up after ${MAX_HOURS} h at ${formatDepth(h.depth)} in ${LAYERS[layerIndex(h)].name}`);

  return { log, runs, player: p, hole: h, timeMs: t, firstBuy, longestGap, gapAt };
}

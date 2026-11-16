// The whole game, as pure functions over plain data. No DOM, no clock, no Math.random:
// time arrives as dt and randomness comes from the RNG state stored on the player, so the
// same inputs always produce the same result. The browser, the tests, the balance script
// and the co-op server all run exactly this code.

import {
  ACHIEVEMENTS, BALANCE, FINDS, FIND_SETS, HELPERS, LAYERS, MILESTONES, ORES, PRESTIGE_NODES,
  TOOLS, UPGRADES, type CounterKey, type HelperDef, type PrestigeNodeDef, type UpgradeDef,
} from '../data';
import { nextRandom } from './rng';
import { expectedDps, expectedOreBonus, getStats, type Stats } from './stats';
import type { Hole, Player, SimEvent } from './types';
import {
  CORE_DEPTH, LAST_LAYER, barrierMaxHp, burstMs, layerFraction, layerIndex, layerIndexAtDepth, planetAt, strata,
  stratumIndex, valueOf, workToDepth,
} from './world';

const ORE_BY_ID = new Map(ORES.map((o) => [o.id, o]));
const COUNTERS: CounterKey[] = [
  'hits', 'crits', 'cashEarned', 'maxDepth', 'rebirths', 'barriers', 'finds', 'uniqueFinds',
  'ores', 'helpers', 'maxCombo', 'toolTier', 'sets', 'planets', 'playSeconds',
];

// ---------------------------------------------------------------- creation

export function createHole(planet = 0, shared = false): Hole {
  return { planet, shared, depth: 0, barriersBroken: 0, barrierHp: -1, barrierTimer: 0, complete: false };
}

export function createPlayer(seed = 1): Player {
  const counters = {} as Record<CounterKey, number>;
  for (const c of COUNTERS) counters[c] = 0;
  return {
    rev: 0, rng: seed >>> 0, cash: 0, tool: 0, upgrades: {}, helpers: {},
    combo: 0, comboTimer: 0, cooldown: 0,
    run: freshRun(),
    prestige: { shards: 0, totalShards: 0, rebirths: 0, nodes: {} },
    finds: {}, ores: {}, achievements: {}, milestonesEver: 0, counters,
    ext: {
      modifiers: [], pets: [], quests: {}, daily: { lastClaimDay: 0, streak: 0 },
      cosmetics: { owned: [], equipped: {} }, events: {}, trades: [],
    },
  };
}

function freshRun(): Player['run'] {
  return { damage: 0, maxDepth: 0, timeMs: 0, milestone: 0, cashEarned: 0 };
}

// ---------------------------------------------------------------- queries

/**
 * The depth that counts as a player's own progress this run. Solo: the hole.
 * Co-op: how deep their own damage would have taken them, so nobody is handed
 * milestones or shards just for joining a deep room.
 */
export function progressDepth(player: Player, hole: Hole): number {
  return hole.shared ? workToDepth(hole.planet, player.run.damage) : hole.depth;
}

export function expectedIncome(player: Player, hole: Hole): number {
  const s = getStats(player, hole.planet);
  const li = layerIndex(hole);
  const ore = expectedOreBonus(s, LAYERS[li].ores, (id) => ORE_BY_ID.get(id)?.value ?? 0);
  const crit = 1 + s.critChance * (s.critMult - 1);
  const combo = 1 + s.comboMax * BALANCE.combo.damagePerCombo;
  const tap = s.hitDamage * s.speed * crit * combo;
  return (tap * (1 + ore) + s.helperDps) * valueOf(hole.planet, li) * s.cash;
}

export function toolCost(player: Player, s: Stats): number {
  const next = TOOLS[player.tool + 1];
  return next ? Math.ceil(next.cost * s.cost) : Infinity;
}
export function upgradeCost(def: UpgradeDef, level: number, s: Stats): number {
  return Math.ceil(def.cost * Math.pow(def.growth, level) * s.cost);
}
export function helperCost(def: HelperDef, owned: number, s: Stats): number {
  return Math.ceil(def.cost * Math.pow(def.growth, owned) * s.cost);
}
export function nodeCost(def: PrestigeNodeDef, level: number): number {
  return Math.ceil(def.cost * Math.pow(def.growth, level));
}

/** Layers cleared, counting the fraction of the layer you are in: 2.5 = halfway through the crust. */
export function layerProgress(depth: number): number {
  const li = layerIndexAtDepth(depth);
  return li + layerFraction(li, depth);
}

export function shardsForDepth(depth: number, shardMult: number): number {
  const r = BALANCE.rebirth;
  if (depth < r.minDepth) return 0;
  return Math.floor(r.shardBase * Math.pow(r.shardGrowth, layerProgress(depth) - 1) * shardMult);
}
export function pendingShards(player: Player, hole: Hole): number {
  return shardsForDepth(player.run.maxDepth, getStats(player, hole.planet).shards);
}

export function startingCash(s: Stats): number {
  const level = Math.floor(s.startCash);
  return level <= 0 ? 0 : BALANCE.seedMoney.base * Math.pow(BALANCE.seedMoney.growth, level - 1);
}

// ---------------------------------------------------------------- digging

interface DamageResult { dug: number; cash: number; barrier: boolean }

/** Spend damage on the hole: dig, or wear down the barrier, and pay the player for it. */
function applyDamage(
  player: Player, hole: Hole, s: Stats, damage: number, events: SimEvent[], allowBarrier: boolean,
): DamageResult {
  let left = damage, dug = 0, cashBase = 0, barrier = false;
  const strataList = strata();
  const hardnessMult = planetAt(hole.planet).hardnessMult;
  for (let guard = 0; guard < 200 && left > 0; guard++) {
    const li = layerIndex(hole);
    const value = valueOf(hole.planet, li);
    if (hole.complete) { cashBase += left * value; break; }
    const end = LAYERS[li].end;
    if (hole.depth >= end) {
      barrier = true;
      cashBase += left * value;
      if (!allowBarrier) break;
      if (hole.barrierHp < 0) {
        hole.barrierHp = barrierMaxHp(hole.planet, li);
        hole.barrierTimer = burstMs(hole.planet);
        events.push({ type: 'barrierStart', index: li });
      }
      hole.barrierHp -= left * s.boss;
      if (hole.barrierHp <= 0) {
        hole.barrierHp = -1;
        hole.barrierTimer = 0;
        hole.barriersBroken++;
        player.counters.barriers++;
        events.push({ type: 'barrierBreak', index: li });
        if (li >= LAST_LAYER) {
          hole.complete = true;
          events.push({ type: 'core' });
          awardCompletion(player, hole);
        } else {
          events.push({ type: 'layer', index: li + 1 });
        }
      }
      break; // whatever is left of the blow is absorbed by the barrier
    }
    // Dig through the current stratum (hardness is constant inside one).
    const st = strataList[stratumIndex(li, hole.depth)];
    const h = st.hardness * hardnessMult;
    const need = (st.end - hole.depth) * h;
    if (left < need) {
      const d = left / h;
      hole.depth += d; dug += d; cashBase += left * value;
      break;
    }
    dug += st.end - hole.depth;
    hole.depth = st.end;
    cashBase += need * value;
    left -= need;
  }
  const cash = cashBase * s.cash;
  player.cash += cash;
  player.run.cashEarned += cash;
  player.counters.cashEarned += cash;
  player.run.damage += damage;
  const progress = progressDepth(player, hole);
  if (progress > player.run.maxDepth) player.run.maxDepth = progress;
  return { dug, cash, barrier };
}

/** Core reached: pay out the planet's completion shards. The co-op server calls this for everyone in the room. */
export function awardCompletion(player: Player, hole: Hole): number {
  const shards = Math.floor(planetAt(hole.planet).completionShards * getStats(player, hole.planet).shards);
  player.prestige.shards += shards;
  player.prestige.totalShards += shards;
  player.counters.planets++;
  player.rev++;
  return shards;
}

/** One swing of the tool. Returns false if the swing is still on cooldown. */
export function hit(player: Player, hole: Hole, events: SimEvent[]): boolean {
  if (player.cooldown > 0) return false;
  const s = getStats(player, hole.planet);
  const crit = nextRandom(player) < s.critChance;
  const combo = Math.min(player.combo, s.comboMax);
  const damage = s.hitDamage * (crit ? s.critMult : 1) * (1 + combo * BALANCE.combo.damagePerCombo);
  const li = layerIndex(hole);
  const res = applyDamage(player, hole, s, damage, events, true);

  player.combo = Math.min(player.combo + 1, s.comboMax);
  player.comboTimer = BALANCE.combo.decayMs;
  player.cooldown = Math.max(player.cooldown, -100) + 1000 / s.speed;
  const c = player.counters;
  c.hits++;
  if (crit) c.crits++;
  if (player.combo > c.maxCombo) c.maxCombo = player.combo;
  events.push({ type: 'hit', damage, crit, dug: res.dug, cash: res.cash, combo: player.combo, barrier: res.barrier });

  // Ore
  const loot = BALANCE.loot;
  if (nextRandom(player) < Math.min(loot.oreChance * s.luck, loot.maxOreChance)) {
    const table = LAYERS[li].ores;
    let total = 0;
    for (const o of table) total += o.weight;
    let roll = nextRandom(player) * total;
    let pick = table[0].id;
    for (const o of table) { roll -= o.weight; if (roll < 0) { pick = o.id; break; } }
    const cash = res.cash * (ORE_BY_ID.get(pick)?.value ?? 1);
    gainCash(player, cash);
    player.ores[pick] = (player.ores[pick] ?? 0) + 1;
    c.ores++;
    events.push({ type: 'ore', id: pick, cash });
  }

  // Rare find
  if (nextRandom(player) < Math.min(loot.findChance * s.luck, loot.maxFindChance)) {
    const fromLayer = nextRandom(player) < loot.findCurrentLayerBias ? li : Math.floor(nextRandom(player) * (li + 1));
    const pool = FINDS.filter((f) => f.layer === LAYERS[fromLayer].id);
    if (pool.length > 0) {
      let total = 0;
      for (const f of pool) total += loot.rarityWeight[f.rarity];
      let roll = nextRandom(player) * total;
      let found = pool[0];
      for (const f of pool) { roll -= loot.rarityWeight[f.rarity]; if (roll < 0) { found = f; break; } }
      const isNew = !player.finds[found.id];
      player.finds[found.id] = (player.finds[found.id] ?? 0) + 1;
      c.finds++;
      const cash = res.cash * (isNew ? loot.newFindHits : loot.duplicateFindHits);
      gainCash(player, cash);
      events.push({ type: 'find', id: found.id, isNew, cash });
      if (isNew) {
        c.uniqueFinds++;
        player.rev++;
        const setDone = FINDS.every((f) => f.set !== found.set || player.finds[f.id]);
        if (setDone && FIND_SETS.some((x) => x.id === found.set)) {
          c.sets++;
          events.push({ type: 'setComplete', id: found.set });
        }
      }
    }
  }
  return true;
}

function gainCash(player: Player, cash: number): void {
  player.cash += cash;
  player.run.cashEarned += cash;
  player.counters.cashEarned += cash;
}

// ---------------------------------------------------------------- time

/** Advance the hole's own clock: an unbroken barrier regenerates when its burst window closes. */
export function tickHole(hole: Hole, dtMs: number, events: SimEvent[]): void {
  if (hole.barrierTimer > 0) {
    hole.barrierTimer -= dtMs;
    if (hole.barrierTimer <= 0) {
      hole.barrierTimer = 0;
      hole.barrierHp = -1;
      events.push({ type: 'barrierReset', index: layerIndex(hole) });
    }
  }
}

/** Advance one player: cooldowns, combo decay, helper digging, milestones and achievements. */
export function tickPlayer(player: Player, hole: Hole, dtMs: number, events: SimEvent[]): void {
  player.cooldown = Math.max(player.cooldown - dtMs, -100);
  if (player.comboTimer > 0) {
    player.comboTimer -= dtMs;
    if (player.comboTimer <= 0) { player.comboTimer = 0; player.combo = 0; }
  }
  player.run.timeMs += dtMs;
  player.counters.playSeconds += dtMs / 1000;
  const s = getStats(player, hole.planet);
  if (s.helperDps > 0) applyDamage(player, hole, s, (s.helperDps * dtMs) / 1000, events, true);
  checkProgress(player, hole, events);
}

/** Solo convenience: one call per frame. */
export function tick(player: Player, hole: Hole, dtMs: number, events: SimEvent[]): void {
  tickHole(hole, dtMs, events);
  tickPlayer(player, hole, dtMs, events);
}

export function checkProgress(player: Player, hole: Hole, events: SimEvent[]): void {
  const c = player.counters;
  if (player.run.maxDepth > c.maxDepth) c.maxDepth = player.run.maxDepth;

  while (player.run.milestone < MILESTONES.length && player.run.maxDepth >= MILESTONES[player.run.milestone].depth) {
    const index = player.run.milestone++;
    const def = MILESTONES[index];
    const cash = expectedIncome(player, hole) * def.rewardSeconds;
    gainCash(player, cash);
    const first = index >= player.milestonesEver;
    let shards = 0;
    if (first) {
      player.milestonesEver = index + 1;
      shards = def.shards ?? 0;
      player.prestige.shards += shards;
      player.prestige.totalShards += shards;
      player.rev++;
    }
    events.push({ type: 'milestone', index, cash, first, shards });
  }

  for (const a of ACHIEVEMENTS) {
    if (!player.achievements[a.id] && c[a.counter] >= a.goal) {
      player.achievements[a.id] = 1;
      player.rev++;
      events.push({ type: 'achievement', id: a.id });
    }
  }
}

/** Helpers keep digging while you are away. They earn cash at a barrier but cannot break it. */
export function applyOffline(player: Player, hole: Hole, elapsedMs: number): { seconds: number; cash: number; dug: number } {
  const s = getStats(player, hole.planet);
  const seconds = Math.min(elapsedMs / 1000, s.offlineCapH * 3600);
  if (seconds < BALANCE.offline.minSeconds || s.helperDps <= 0) return { seconds: 0, cash: 0, dug: 0 };
  const events: SimEvent[] = [];
  const res = applyDamage(player, hole, s, s.helperDps * seconds * s.offlineEff, events, false);
  checkProgress(player, hole, events);
  return { seconds, cash: res.cash, dug: res.dug };
}

// ---------------------------------------------------------------- buying

export function buyTool(player: Player, hole: Hole): boolean {
  const cost = toolCost(player, getStats(player, hole.planet));
  if (player.cash < cost) return false;
  player.cash -= cost;
  player.tool++;
  player.rev++;
  if (player.tool > player.counters.toolTier) player.counters.toolTier = player.tool;
  return true;
}

/** Buys up to `count` levels. Returns how many were bought. */
export function buyUpgrade(player: Player, hole: Hole, id: string, count = 1): number {
  const def = UPGRADES.find((u) => u.id === id);
  if (!def) return 0;
  const s = getStats(player, hole.planet);
  let bought = 0;
  while (bought < count) {
    const level = player.upgrades[id] ?? 0;
    if (def.max != null && level >= def.max) break;
    const cost = upgradeCost(def, level, s);
    if (player.cash < cost) break;
    player.cash -= cost;
    player.upgrades[id] = level + 1;
    bought++;
  }
  if (bought) player.rev++;
  return bought;
}

export function buyHelper(player: Player, hole: Hole, id: string, count = 1): number {
  const def = HELPERS.find((h) => h.id === id);
  if (!def) return 0;
  const s = getStats(player, hole.planet);
  let bought = 0;
  while (bought < count) {
    const owned = player.helpers[id] ?? 0;
    const cost = helperCost(def, owned, s);
    if (player.cash < cost) break;
    player.cash -= cost;
    player.helpers[id] = owned + 1;
    bought++;
  }
  if (bought) {
    player.rev++;
    let total = 0;
    for (const h of HELPERS) total += player.helpers[h.id] ?? 0;
    if (total > player.counters.helpers) player.counters.helpers = total;
  }
  return bought;
}

export function nodeUnlocked(player: Player, def: PrestigeNodeDef): boolean {
  return def.requires.every((r) => (player.prestige.nodes[r] ?? 0) > 0);
}

export function buyNode(player: Player, id: string): boolean {
  const def = PRESTIGE_NODES.find((n) => n.id === id);
  if (!def || !nodeUnlocked(player, def)) return false;
  const level = player.prestige.nodes[id] ?? 0;
  if (level >= def.max) return false;
  const cost = nodeCost(def, level);
  if (player.prestige.shards < cost) return false;
  player.prestige.shards -= cost;
  player.prestige.nodes[id] = level + 1;
  player.rev++;
  return true;
}

// ---------------------------------------------------------------- rebirth

/** Wipe everything a run earns. Prestige, collection, achievements and counters survive. */
export function resetRun(player: Player, hole: Hole): void {
  player.upgrades = {};
  player.helpers = {};
  player.combo = 0;
  player.comboTimer = 0;
  player.cooldown = 0;
  player.run = freshRun();
  player.rev++;
  const s = getStats(player, hole.planet);
  player.tool = s.startTool;
  player.cash = startingCash(s);
  player.rev++;
  if (player.tool > player.counters.toolTier) player.counters.toolTier = player.tool;
  if (!hole.shared) resetHole(hole);
}

export function resetHole(hole: Hole): void {
  hole.depth = 0;
  hole.barriersBroken = 0;
  hole.barrierHp = -1;
  hole.barrierTimer = 0;
  hole.complete = false;
}

/** Trade the run for Core Shards. Returns the shards gained, or 0 if rebirth is not available. */
export function rebirth(player: Player, hole: Hole, events: SimEvent[]): number {
  const shards = pendingShards(player, hole);
  if (shards < 1) return 0;
  player.prestige.shards += shards;
  player.prestige.totalShards += shards;
  player.prestige.rebirths++;
  player.counters.rebirths++;
  resetRun(player, hole);
  events.push({ type: 'rebirth', shards });
  return shards;
}

/** After the core: move the hole to the next planet. Solo also starts a fresh run there. */
export function travel(player: Player, hole: Hole, events: SimEvent[]): boolean {
  if (!hole.complete) return false;
  hole.planet++;
  resetHole(hole);
  if (!hole.shared) resetRun(player, hole);
  player.rev++;
  events.push({ type: 'planet', index: hole.planet });
  return true;
}

export { CORE_DEPTH, expectedDps };

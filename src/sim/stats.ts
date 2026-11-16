import {
  ACHIEVEMENTS, BALANCE, FINDS, FIND_SETS, HELPERS, PRESTIGE_EXTRA, PRESTIGE_NODES, TOOLS, UPGRADES,
  type Modifier, type StatKey,
} from '../data';
import type { Player } from './types';
import { planetAt } from './world';

export type Stats = Record<StatKey, number> & {
  /** Damage of one ordinary hit (before crit and combo). */
  hitDamage: number;
  /** Total helper damage per second. */
  helperDps: number;
  /** The permanent multiplier earned from rebirths. */
  rebirthMult: number;
};

const BASE: Record<StatKey, number> = {
  damage: 1, tapPower: 1, speed: BALANCE.hit.baseSpeed,
  critChance: BALANCE.crit.baseChance, critMult: BALANCE.crit.baseMult,
  cash: 1, luck: 1, helper: 1,
  offlineEff: BALANCE.offline.baseEfficiency, offlineCapH: BALANCE.offline.baseCapHours,
  comboMax: BALANCE.combo.baseMax, shards: 1, boss: 1, cost: 1, startTool: 0, startCash: 0,
};

export function rebirthMultiplier(totalShards: number): number {
  return 1 + BALANCE.rebirth.multPerShard * Math.pow(totalShards, BALANCE.rebirth.multExp);
}

export function completedSets(player: Player): string[] {
  return FIND_SETS.filter((set) =>
    FINDS.every((f) => f.set !== set.id || (player.finds[f.id] ?? 0) > 0),
  ).map((s) => s.id);
}

/** Every modifier currently acting on a player. This is the single place new systems plug into. */
export function collectModifiers(player: Player, planet: number): Modifier[] {
  const out: Modifier[] = [];
  const leveled = (effect: Modifier, level: number) => {
    if (level <= 0) return;
    out.push({
      stat: effect.stat, op: effect.op,
      value: effect.op === 'add' ? effect.value * level : Math.pow(effect.value, level),
    });
  };
  for (const u of UPGRADES) leveled(u.effect, player.upgrades[u.id] ?? 0);
  for (const n of PRESTIGE_NODES) {
    const level = player.prestige.nodes[n.id] ?? 0;
    leveled(n.effect, level);
    for (const extra of PRESTIGE_EXTRA[n.id] ?? []) leveled(extra, level);
  }
  out.push({ stat: 'damage', op: 'mult', value: rebirthMultiplier(player.prestige.totalShards) });
  if (player.milestonesEver > 0) {
    out.push({ stat: 'damage', op: 'add', value: BALANCE.milestones.damagePerMilestone * player.milestonesEver });
  }
  for (const set of FIND_SETS) {
    if (FINDS.every((f) => f.set !== set.id || (player.finds[f.id] ?? 0) > 0)) out.push(set.bonus);
  }
  for (const a of ACHIEVEMENTS) if (player.achievements[a.id]) out.push(a.reward);
  const rules = planetAt(planet).rules;
  if (rules.helperMult != null) out.push({ stat: 'helper', op: 'mult', value: rules.helperMult });
  if (rules.tapMult != null) out.push({ stat: 'tapPower', op: 'mult', value: rules.tapMult });
  // Pets, events, cosmetics, quest rewards: push Modifiers into player.ext.modifiers.
  for (const m of player.ext.modifiers) out.push(m);
  return out;
}

const cache = new WeakMap<Player, { rev: number; planet: number; stats: Stats }>();

/** Derived stats. Cached until player.rev changes, so it is cheap to call per hit. */
export function getStats(player: Player, planet: number): Stats {
  const hit = cache.get(player);
  if (hit && hit.rev === player.rev && hit.planet === planet) return hit.stats;

  const add = { ...BASE };
  const mult: Record<string, number> = {};
  for (const m of collectModifiers(player, planet)) {
    if (m.op === 'add') add[m.stat] += m.value;
    else mult[m.stat] = (mult[m.stat] ?? 1) * m.value;
  }
  const s = {} as Stats;
  for (const key of Object.keys(BASE) as StatKey[]) s[key] = add[key] * (mult[key] ?? 1);

  s.speed = Math.min(s.speed, BALANCE.hit.maxSpeed);
  s.critChance = Math.min(s.critChance, BALANCE.crit.maxChance);
  s.comboMax = Math.floor(s.comboMax);
  s.startTool = Math.min(Math.floor(s.startTool), TOOLS.length - 1);
  s.rebirthMult = rebirthMultiplier(player.prestige.totalShards);
  s.hitDamage = TOOLS[player.tool].power * s.tapPower * s.damage;
  let helperBase = 0;
  for (const h of HELPERS) helperBase += (player.helpers[h.id] ?? 0) * h.dps;
  s.helperDps = helperBase * s.helper * s.damage;

  cache.set(player, { rev: player.rev, planet, stats: s });
  return s;
}

/** Average damage per second of a player who holds the dig button, helpers included. */
export function expectedDps(s: Stats): number {
  const crit = 1 + s.critChance * (s.critMult - 1);
  const combo = 1 + s.comboMax * BALANCE.combo.damagePerCombo;
  return s.hitDamage * s.speed * crit * combo + s.helperDps;
}

/** Average cash multiplier from ore drops, on top of the cash a hit earns. */
export function expectedOreBonus(s: Stats, ores: { id: string; weight: number }[], oreValue: (id: string) => number): number {
  const chance = Math.min(BALANCE.loot.oreChance * s.luck, BALANCE.loot.maxOreChance);
  let total = 0, weighted = 0;
  for (const o of ores) { total += o.weight; weighted += o.weight * oreValue(o.id); }
  return total > 0 ? (chance * weighted) / total : 0;
}

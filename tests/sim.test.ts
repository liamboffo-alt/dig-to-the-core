import { describe, expect, it } from 'vitest';
import { BALANCE, HELPERS, LAYERS, MILESTONES, PRESTIGE_NODES, TOOLS, UPGRADES } from '../src/data';
import {
  CORE_DEPTH, applyOffline, atBarrier, barrierMaxHp, buyHelper, buyNode, buyTool, buyUpgrade, createHole,
  createPlayer, depthToWork, deserialize, expectedDps, exportSave, formatDepth, formatNumber, formatPercent,
  getStats, helperCost, hit, importSave, layerIndex, layerProgress, makeSave, nodeCost, pendingShards, rebirth,
  rebirthMultiplier, restoreSave, serialize, shardsForDepth, strata, tick, toolCost, travel, upgradeCost,
  workToDepth, type Hole, type Player, type SimEvent,
} from '../src/sim';

const setup = (seed = 7): { p: Player; h: Hole; ev: SimEvent[] } => ({ p: createPlayer(seed), h: createHole(), ev: [] });
/** Hold the dig button for `ms` of simulated time. */
function dig(p: Player, h: Hole, ms: number, ev: SimEvent[] = []): SimEvent[] {
  for (let t = 0; t < ms; t += 50) { tick(p, h, 50, ev); hit(p, h, ev); }
  return ev;
}

describe('number formatting', () => {
  it('uses K, M, B, T then aa, ab...', () => {
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(1234)).toBe('1.23K');
    expect(formatNumber(15_300_000)).toBe('15.3M');
    expect(formatNumber(2.5e9)).toBe('2.50B');
    expect(formatNumber(7e12)).toBe('7.00T');
    expect(formatNumber(1e15)).toBe('1.00aa');
    expect(formatNumber(1e18)).toBe('1.00ab');
    expect(formatNumber(3.2e93)).toBe('3.20ba');
    expect(formatNumber(999_999)).toBe('1.00M');
  });
  it('formats depth and progress', () => {
    expect(formatDepth(0.004)).toBe('4.0 mm');
    expect(formatDepth(0.5)).toBe('50.0 cm');
    expect(formatDepth(12.345)).toBe('12.35 m');
    expect(formatDepth(6_371_000)).toBe('6,371 km');
    expect(formatPercent(1)).toBe('100%');
    expect(formatPercent(0.0000001)).toMatch(/^0\.0000100%$/);
  });
});

describe('data sanity', () => {
  it('layers are contiguous, end at the core and get harder', () => {
    expect(LAYERS[0].start).toBe(0);
    for (let i = 1; i < LAYERS.length; i++) {
      expect(LAYERS[i].start).toBe(LAYERS[i - 1].end);
      expect(LAYERS[i].hardness).toBeGreaterThan(LAYERS[i - 1].hardnessEnd);
      expect(LAYERS[i].barrier.hp).toBeGreaterThan(LAYERS[i - 1].barrier.hp);
    }
    expect(CORE_DEPTH).toBe(BALANCE.coreDepth);
    const s = strata();
    expect(s.length).toBe(LAYERS.length * BALANCE.strataPerLayer);
    for (let i = 1; i < s.length; i++) {
      expect(s[i].start).toBeCloseTo(s[i - 1].end, 6);
      expect(s[i].hardness).toBeGreaterThanOrEqual(s[i - 1].hardness);
    }
  });
  it('tools and helpers get stronger and dearer', () => {
    for (let i = 1; i < TOOLS.length; i++) {
      expect(TOOLS[i].power).toBeGreaterThan(TOOLS[i - 1].power);
      expect(TOOLS[i].cost).toBeGreaterThan(TOOLS[i - 1].cost);
    }
    for (let i = 1; i < HELPERS.length; i++) expect(HELPERS[i].dps / HELPERS[i].cost).toBeLessThan(HELPERS[i - 1].dps / HELPERS[i - 1].cost);
  });
  it('ids are unique and references resolve', () => {
    for (const list of [TOOLS, UPGRADES, HELPERS, PRESTIGE_NODES, LAYERS]) {
      expect(new Set(list.map((x) => x.id)).size).toBe(list.length);
    }
    for (const n of PRESTIGE_NODES) for (const r of n.requires) expect(PRESTIGE_NODES.some((x) => x.id === r)).toBe(true);
    for (let i = 1; i < MILESTONES.length; i++) expect(MILESTONES[i].depth).toBeGreaterThan(MILESTONES[i - 1].depth);
  });
});

describe('costs', () => {
  it('upgrade and helper costs grow geometrically', () => {
    const { p } = setup();
    const s = getStats(p, 0);
    const power = UPGRADES.find((u) => u.id === 'power')!;
    expect(upgradeCost(power, 0, s)).toBe(power.cost);
    expect(upgradeCost(power, 3, s)).toBe(Math.ceil(power.cost * power.growth ** 3));
    expect(helperCost(HELPERS[0], 10, s)).toBe(Math.ceil(HELPERS[0].cost * HELPERS[0].growth ** 10));
    expect(toolCost(p, s)).toBe(TOOLS[1].cost);
  });
  it('buying spends cash, respects max level and refuses when broke', () => {
    const { p, h } = setup();
    expect(buyUpgrade(p, h, 'power')).toBe(0);
    expect(buyTool(p, h)).toBe(false);
    p.cash = 35;
    expect(buyUpgrade(p, h, 'power', 10)).toBe(2); // 10 + 20
    expect(p.cash).toBe(5);
    p.cash = 1e60;
    const speed = UPGRADES.find((u) => u.id === 'speed')!;
    expect(buyUpgrade(p, h, 'speed', 999)).toBe(speed.max);
    expect(buyUpgrade(p, h, 'speed')).toBe(0);
    expect(buyTool(p, h)).toBe(true);
    expect(p.tool).toBe(1);
    expect(buyHelper(p, h, 'mole', 5)).toBe(5);
    expect(p.counters.helpers).toBe(5);
  });
  it('the cost stat discounts everything', () => {
    const { p, h } = setup();
    p.ext.modifiers.push({ stat: 'cost', op: 'mult', value: 0.5 });
    p.rev++;
    expect(toolCost(p, getStats(p, h.planet))).toBe(TOOLS[1].cost / 2);
  });
});

describe('damage', () => {
  it('a spoon hit digs power / hardness metres and pays power * value', () => {
    const { p, h, ev } = setup();
    p.ext.modifiers.push({ stat: 'critChance', op: 'add', value: -1 }, { stat: 'luck', op: 'mult', value: 0 });
    p.rev++;
    expect(hit(p, h, ev)).toBe(true);
    expect(h.depth).toBeCloseTo(TOOLS[0].power / LAYERS[0].hardness, 12);
    expect(p.cash).toBeCloseTo(TOOLS[0].power * LAYERS[0].value, 12);
    expect(ev[0]).toMatchObject({ type: 'hit', crit: false, combo: 1 });
  });
  it('hits respect the swing cooldown', () => {
    const { p, h, ev } = setup();
    expect(hit(p, h, ev)).toBe(true);
    expect(hit(p, h, ev)).toBe(false);
    tick(p, h, 1000 / BALANCE.hit.baseSpeed, ev);
    expect(hit(p, h, ev)).toBe(true);
  });
  it('combo builds, boosts damage and decays', () => {
    const { p, h } = setup();
    p.ext.modifiers.push({ stat: 'critChance', op: 'add', value: -1 });
    p.rev++;
    const ev = dig(p, h, 20_000);
    const hits = ev.filter((e) => e.type === 'hit') as Extract<SimEvent, { type: 'hit' }>[];
    expect(p.combo).toBe(BALANCE.combo.baseMax);
    expect(hits[hits.length - 1].damage).toBeCloseTo(hits[0].damage * (1 + BALANCE.combo.baseMax * BALANCE.combo.damagePerCombo), 9);
    tick(p, h, BALANCE.combo.decayMs + 1, []);
    expect(p.combo).toBe(0);
  });
  it('crits multiply damage', () => {
    const { p, h, ev } = setup();
    p.ext.modifiers.push({ stat: 'critChance', op: 'add', value: 1 });
    p.rev++;
    hit(p, h, ev);
    const e = ev[0] as Extract<SimEvent, { type: 'hit' }>;
    expect(e.crit).toBe(true);
    expect(e.damage).toBeCloseTo(TOOLS[0].power * BALANCE.crit.baseMult, 9);
  });
  it('tools, upgrades and helpers raise expected dps', () => {
    const { p, h } = setup();
    const base = expectedDps(getStats(p, 0));
    p.cash = 1e9;
    buyUpgrade(p, h, 'power');
    const a = expectedDps(getStats(p, 0));
    buyTool(p, h);
    const b = expectedDps(getStats(p, 0));
    buyHelper(p, h, 'mole');
    const c = expectedDps(getStats(p, 0));
    expect(a).toBeGreaterThan(base);
    expect(b / a).toBeCloseTo(TOOLS[1].power / TOOLS[0].power, 9);
    expect(c - b).toBeCloseTo(HELPERS[0].dps * getStats(p, 0).damage, 9);
  });
  it('helpers dig on their own', () => {
    const { p, h } = setup();
    p.cash = 1e6;
    buyHelper(p, h, 'mole', 10);
    const cash = p.cash;
    tick(p, h, 10_000, []);
    expect(h.depth).toBeCloseTo((HELPERS[0].dps * 10 * 10 * getStats(p, 0).damage) / LAYERS[0].hardness, 9);
    expect(p.cash).toBeGreaterThan(cash);
  });
  it('work and depth convert both ways', () => {
    for (const d of [0.5, 9, 10, 150, 5000, 1e6, CORE_DEPTH]) expect(workToDepth(0, depthToWork(0, d))).toBeCloseTo(d, 5);
  });
});

describe('barriers', () => {
  const atFirstBarrier = () => {
    const s = setup();
    s.h.depth = LAYERS[0].end;
    return s;
  };
  it('stop the dig at the layer boundary', () => {
    const { p, h, ev } = setup();
    h.depth = LAYERS[0].end - 0.1;
    p.ext.modifiers.push({ stat: 'tapPower', op: 'mult', value: 1000 });
    p.rev++;
    dig(p, h, 400, ev);
    expect(h.depth).toBe(LAYERS[0].end);
    expect(atBarrier(h)).toBe(true);
    expect(layerIndex(h)).toBe(0);
  });
  it('regenerate when the burst window runs out', () => {
    const { p, h, ev } = atFirstBarrier();
    p.ext.modifiers.push({ stat: 'critChance', op: 'add', value: -1 });
    p.rev++;
    hit(p, h, ev);
    expect(ev.some((e) => e.type === 'barrierStart')).toBe(true);
    expect(h.barrierHp).toBeCloseTo(barrierMaxHp(0, 0) - 1, 6);
    tick(p, h, BALANCE.barrier.burstSeconds * 1000 + 1, ev);
    expect(ev.some((e) => e.type === 'barrierReset')).toBe(true);
    expect(h.barrierHp).toBe(-1);
    expect(h.depth).toBe(LAYERS[0].end);
  });
  it('break with enough burst damage and open the next layer', () => {
    const { p, h, ev } = atFirstBarrier();
    p.ext.modifiers.push({ stat: 'tapPower', op: 'mult', value: barrierMaxHp(0, 0) });
    p.rev++;
    hit(p, h, ev);
    expect(ev.map((e) => e.type)).toEqual(expect.arrayContaining(['barrierStart', 'barrierBreak', 'layer']));
    expect(layerIndex(h)).toBe(1);
    expect(p.counters.barriers).toBe(1);
    tick(p, h, 400, ev);
    hit(p, h, ev);
    expect(h.depth).toBeGreaterThan(LAYERS[0].end);
  });
  it('the last barrier is the core', () => {
    const { p, h, ev } = setup();
    h.barriersBroken = LAYERS.length - 1;
    h.depth = CORE_DEPTH;
    p.ext.modifiers.push({ stat: 'tapPower', op: 'mult', value: 1e30 });
    p.rev++;
    hit(p, h, ev);
    expect(h.complete).toBe(true);
    expect(ev.some((e) => e.type === 'core')).toBe(true);
    expect(p.counters.planets).toBe(1);
    expect(p.prestige.shards).toBeGreaterThan(0);
    expect(travel(p, h, ev)).toBe(true);
    expect(h.planet).toBe(1);
    expect(h.depth).toBe(0);
  });
});

describe('rebirth', () => {
  it('shards follow the formula and need the minimum depth', () => {
    const r = BALANCE.rebirth;
    expect(shardsForDepth(r.minDepth - 1, 1)).toBe(0);
    expect(shardsForDepth(LAYERS[1].end, 1)).toBe(r.shardBase * r.shardGrowth);
    expect(shardsForDepth(LAYERS[2].end, 2)).toBe(2 * r.shardBase * r.shardGrowth ** 2);
    expect(layerProgress(CORE_DEPTH)).toBe(LAYERS.length);
    expect(shardsForDepth(5000, 1)).toBeGreaterThan(shardsForDepth(2000, 1));
  });
  it('the permanent multiplier grows with total shards', () => {
    expect(rebirthMultiplier(0)).toBe(1);
    expect(rebirthMultiplier(100)).toBeCloseTo(1 + BALANCE.rebirth.multPerShard * 100 ** BALANCE.rebirth.multExp, 9);
  });
  it('resets the run, keeps the permanent things', () => {
    const { p, h, ev } = setup();
    expect(rebirth(p, h, ev)).toBe(0);
    p.cash = 1e12; buyTool(p, h); buyUpgrade(p, h, 'power', 5); buyHelper(p, h, 'mole', 3);
    p.finds.keys = 1; p.achievements.hits1 = 1;
    h.depth = 600; h.barriersBroken = 1; p.run.maxDepth = 600;
    const expected = pendingShards(p, h);
    expect(expected).toBeGreaterThan(0);
    expect(rebirth(p, h, ev)).toBe(expected);
    expect(p).toMatchObject({ cash: 0, tool: 0, upgrades: {}, helpers: {} });
    expect(h).toMatchObject({ depth: 0, barriersBroken: 0 });
    expect(p.prestige).toMatchObject({ shards: expected, totalShards: expected, rebirths: 1 });
    expect(p.finds.keys).toBe(1);
    expect(p.achievements.hits1).toBe(1);
    expect(getStats(p, 0).damage).toBeGreaterThan(1);
  });
  it('prestige nodes cost shards, need their parents and apply', () => {
    const { p } = setup();
    p.prestige.shards = 100;
    expect(buyNode(p, 'wealth')).toBe(false); // needs might
    const before = getStats(p, 0).damage;
    expect(buyNode(p, 'might')).toBe(true);
    expect(getStats(p, 0).damage).toBeCloseTo(before * 1.5, 9);
    const might = PRESTIGE_NODES.find((n) => n.id === 'might')!;
    expect(p.prestige.shards).toBe(100 - nodeCost(might, 0));
    expect(buyNode(p, 'wealth')).toBe(true);
    expect(buyNode(p, 'headstart')).toBe(true);
    expect(buyNode(p, 'seed')).toBe(true);
    const h = createHole();
    p.run.maxDepth = 500;
    rebirth(p, h, []);
    expect(p.tool).toBe(1);
    expect(p.cash).toBe(BALANCE.seedMoney.base);
  });
  it('co-op rebirth pays for your own digging and leaves the shared hole alone', () => {
    const p = createPlayer(3);
    const h = createHole(0, true);
    h.depth = 20_000; h.barriersBroken = 2;
    dig(p, h, 2000);
    expect(pendingShards(p, h)).toBe(0); // deep room, but this player has barely dug
    p.run.damage = depthToWork(0, 800);
    dig(p, h, 400);
    expect(pendingShards(p, h)).toBeGreaterThan(0);
    rebirth(p, h, []);
    expect(h.depth).toBeGreaterThanOrEqual(20_000);
  });
});

describe('progress', () => {
  it('milestones pay each run, and extra the first time', () => {
    const { p, h } = setup();
    h.depth = 1.99;
    p.ext.modifiers.push({ stat: 'tapPower', op: 'mult', value: 500 });
    p.rev++;
    const ev = dig(p, h, 1000);
    const m = ev.filter((e) => e.type === 'milestone') as Extract<SimEvent, { type: 'milestone' }>[];
    expect(m.map((x) => x.index)).toEqual([0, 1]);
    expect(m.every((x) => x.first && x.cash > 0)).toBe(true);
    expect(p.milestonesEver).toBe(2);
    expect(getStats(p, 0).damage).toBeCloseTo(1 + 2 * BALANCE.milestones.damagePerMilestone, 9);
  });
  it('achievements unlock from counters and grant their reward', () => {
    const { p, h } = setup();
    p.counters.hits = 499;
    const ev = dig(p, h, 500);
    expect(ev.some((e) => e.type === 'achievement' && e.id === 'hits1')).toBe(true);
    expect(p.achievements.hits1).toBe(1);
  });
  it('rare finds fill the collection and sets grant bonuses', () => {
    const { p, h } = setup();
    p.ext.modifiers.push({ stat: 'luck', op: 'mult', value: 1000 });
    p.rev++;
    const ev = dig(p, h, 120_000);
    expect(ev.some((e) => e.type === 'ore')).toBe(true);
    expect(ev.some((e) => e.type === 'find' && e.isNew)).toBe(true);
    expect(ev.some((e) => e.type === 'setComplete' && e.id === 'backyard')).toBe(true);
    expect(p.counters.uniqueFinds).toBe(4);
    expect(p.counters.sets).toBe(1);
  });
  it('offline earnings use helper dps, efficiency and the cap, and stop at barriers', () => {
    const { p, h } = setup();
    expect(applyOffline(p, h, 3_600_000).seconds).toBe(0); // no helpers
    p.cash = 1e30; buyHelper(p, h, 'mole', 100); p.cash = 0;
    const s = getStats(p, 0);
    const short = applyOffline(p, h, 30_000);
    expect(short.seconds).toBe(0);
    const res = applyOffline(p, h, 100 * 3_600_000);
    expect(res.seconds).toBe(s.offlineCapH * 3600);
    expect(h.depth).toBe(LAYERS[0].end);
    expect(h.barrierHp).toBe(-1);
    expect(p.cash).toBeCloseTo(s.helperDps * res.seconds * s.offlineEff * LAYERS[0].value, 3);
  });
});

describe('determinism and saving', () => {
  const play = (seed: number) => {
    const { p, h } = setup(seed);
    for (let t = 0; t < 120_000; t += 50) {
      tick(p, h, 50, []); hit(p, h, []);
      if (t % 1000 === 0) { buyTool(p, h); buyUpgrade(p, h, 'power'); buyHelper(p, h, 'mole'); }
    }
    return { p, h };
  };
  it('same seed and inputs give the same game', () => {
    expect(serialize(makeSave(play(42).p, play(42).h, 0))).toBe(serialize(makeSave(play(42).p, play(42).h, 0)));
    expect(play(42).p.cash).not.toBe(play(43).p.cash);
  });
  it('save and load round-trip exactly, and play on identically', () => {
    const a = play(5);
    const copy = deserialize(serialize(makeSave(a.p, a.h, 123)));
    expect(copy.savedAt).toBe(123);
    expect(copy.player).toEqual(a.p);
    expect(copy.hole).toEqual(a.h);
    dig(a.p, a.h, 5000);
    dig(copy.player, copy.hole, 5000);
    expect(copy.player).toEqual(a.p);
  });
  it('export strings round-trip and reject damage', () => {
    const a = play(9);
    const text = exportSave(makeSave(a.p, a.h, 1));
    expect(text.startsWith('DIG1.')).toBe(true);
    expect(importSave(text).player).toEqual(a.p);
    expect(() => importSave(text.slice(0, -3) + 'zzz')).toThrow();
    expect(() => importSave('hello')).toThrow();
  });
  it('old or partial saves are filled in with defaults', () => {
    const s = restoreSave({ v: 1, player: { cash: 55, prestige: { shards: 3 } }, hole: { depth: 12 } });
    expect(s.player.cash).toBe(55);
    expect(s.player.prestige).toMatchObject({ shards: 3, rebirths: 0 });
    expect(s.player.ext.pets).toEqual([]);
    expect(s.hole).toMatchObject({ depth: 12, planet: 0, barrierHp: -1 });
    expect(() => restoreSave({ v: 99 })).toThrow();
  });
});

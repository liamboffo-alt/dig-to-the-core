import type { Modifier, PrestigeNodeDef } from './types';

// The rebirth tree, bought with Core Shards. Permanent.
// Cost of the next level = cost * growth ^ level. `requires` lists nodes that need level >= 1.
// pos is [column, row] in the tree view.
export const PRESTIGE_NODES: PrestigeNodeDef[] = [
  { id: 'might',     name: 'Deep Memory',    icon: '🧠', desc: 'x1.5 all damage per level',          cost: 1,  growth: 3,   max: 12,  requires: [],          effect: { stat: 'damage', op: 'mult', value: 1.5 },      pos: [2, 0] },
  { id: 'wealth',    name: 'Gold Sense',     icon: '🪙', desc: 'x1.25 cash per level',               cost: 2,  growth: 3,   max: 10,  requires: ['might'],   effect: { stat: 'cash', op: 'mult', value: 1.25 },     pos: [1, 1] },
  { id: 'crew',      name: 'Crew Training',  icon: '👷', desc: 'x1.6 helper damage per level',       cost: 2,  growth: 3,   max: 10,  requires: ['might'],   effect: { stat: 'helper', op: 'mult', value: 1.6 },    pos: [3, 1] },
  { id: 'headstart', name: 'Head Start',     icon: '🎒', desc: 'Start each run one tool tier higher', cost: 3, growth: 3,   max: 5,  requires: ['wealth'],  effect: { stat: 'startTool', op: 'add', value: 1 },    pos: [0, 2] },
  { id: 'seed',      name: 'Seed Money',     icon: '🌱', desc: 'Start each run with cash: $50, then x20 per level', cost: 2, growth: 2.5, max: 8, requires: ['wealth'], effect: { stat: 'startCash', op: 'add', value: 1 }, pos: [1, 2] },
  { id: 'crit',      name: 'Critical Mass',  icon: '☄️', desc: '+1x crit damage and +3% crit chance', cost: 4, growth: 2.5, max: 6,  requires: ['might'],   effect: { stat: 'critMult', op: 'add', value: 1 },     pos: [2, 2] },
  { id: 'night',     name: 'Night Shift',    icon: '🌙', desc: '+10% offline efficiency per level',  cost: 3,  growth: 2,   max: 5,  requires: ['crew'],    effect: { stat: 'offlineEff', op: 'add', value: 0.1 }, pos: [3, 2] },
  { id: 'luck',      name: 'Lucky Strike',   icon: '🍀', desc: '+30% ore and rare-find chance',      cost: 3,  growth: 2.5, max: 5,  requires: ['crew'],    effect: { stat: 'luck', op: 'add', value: 0.3 },       pos: [4, 2] },
  { id: 'bulk',      name: 'Bulk Discount',  icon: '🏷️', desc: 'Everything costs 8% less cash',      cost: 10, growth: 3,   max: 5,  requires: ['seed'],    effect: { stat: 'cost', op: 'mult', value: 0.92 },     pos: [1, 3] },
  { id: 'breaker',   name: 'Wall Breaker',   icon: '🧨', desc: '+50% damage to barriers',            cost: 8,  growth: 2.5, max: 6,  requires: ['crit'],    effect: { stat: 'boss', op: 'add', value: 0.5 },       pos: [2, 3] },
  { id: 'momentum',  name: 'Momentum',       icon: '🌊', desc: '+15 max combo',                      cost: 8,  growth: 2.5, max: 6,  requires: ['crit'],    effect: { stat: 'comboMax', op: 'add', value: 15 },    pos: [3, 3] },
  { id: 'magnet',    name: 'Shard Magnet',   icon: '🧲', desc: '+25% Core Shards from rebirth',      cost: 15, growth: 3,   max: 6,  requires: ['breaker'], effect: { stat: 'shards', op: 'add', value: 0.25 },    pos: [2, 4] },
  { id: 'overdrive', name: 'Overdrive',      icon: '🚀', desc: '+1 hit per second',                  cost: 40, growth: 4,   max: 3,  requires: ['momentum'], effect: { stat: 'speed', op: 'add', value: 1 },       pos: [3, 4] },
  { id: 'titan',     name: 'Titan Strength', icon: '🌋', desc: 'x1.5 all damage per level',          cost: 400, growth: 4,  max: 6,  requires: ['magnet'],  effect: { stat: 'damage', op: 'mult', value: 1.5 },      pos: [2, 5] },
];

/** Extra effects that ride along with a node (a node can change more than one stat). */
export const PRESTIGE_EXTRA: Record<string, Modifier[]> = {
  crit: [{ stat: 'critChance', op: 'add', value: 0.03 }],
};

import type { UpgradeDef } from './types';

// Repeatable cash upgrades. Cost of the next level = cost * growth ^ level.
// effect.op 'mult' compounds per level (value ^ level); 'add' stacks (value * level).
// These reset on rebirth.
export const UPGRADES: UpgradeDef[] = [
  { id: 'power',    name: 'Sharpen',           icon: '💪', desc: '+10% hit power (compounding)',   cost: 10,   growth: 2.0, effect: { stat: 'tapPower', op: 'mult', value: 1.1 } },
  { id: 'value',    name: 'Ore Appraisal',     icon: '💰', desc: '+10% cash (compounding)',        cost: 25,   growth: 2.2, effect: { stat: 'cash', op: 'mult', value: 1.1 } },
  { id: 'speed',    name: 'Quick Hands',       icon: '⚡', desc: '+0.25 hits per second',          cost: 40,   growth: 6,   max: 20, effect: { stat: 'speed', op: 'add', value: 0.25 } },
  { id: 'crit',     name: 'Keen Eye',          icon: '🎯', desc: '+2% crit chance',                cost: 150,  growth: 8,   max: 15, effect: { stat: 'critChance', op: 'add', value: 0.02 } },
  { id: 'critMult', name: 'Heavy Blows',       icon: '💥', desc: '+0.5x crit damage',              cost: 500,  growth: 5,   max: 20, effect: { stat: 'critMult', op: 'add', value: 0.5 } },
  { id: 'crew',     name: 'Crew Tools',        icon: '🧰', desc: '+10% helper damage (compounding)', cost: 120, growth: 2.0, effect: { stat: 'helper', op: 'mult', value: 1.1 } },
  { id: 'luck',     name: "Prospector's Nose", icon: '🍀', desc: '+10% ore and rare-find chance',  cost: 300,  growth: 4,   max: 25, effect: { stat: 'luck', op: 'add', value: 0.1 } },
  { id: 'combo',    name: 'Rhythm',            icon: '🥁', desc: '+5 max combo',                   cost: 1000, growth: 25,  max: 10, effect: { stat: 'comboMax', op: 'add', value: 5 } },
];

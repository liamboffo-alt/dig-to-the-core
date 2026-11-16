// Shared shapes for all balance/content data. Nothing in here has behaviour.

/** Every tunable stat in the game. New systems (pets, events, cosmetics...) add Modifiers on these. */
export type StatKey =
  | 'damage'      // global damage multiplier (taps and helpers)
  | 'tapPower'    // multiplier on manual hits only
  | 'speed'       // hits per second while holding
  | 'critChance'  // 0..1
  | 'critMult'    // damage multiplier on a crit
  | 'cash'        // cash multiplier
  | 'luck'        // multiplier on ore and rare-find chance
  | 'helper'      // multiplier on helper dps
  | 'offlineEff'  // fraction of helper dps earned offline
  | 'offlineCapH' // offline cap in hours
  | 'comboMax'    // highest combo count
  | 'shards'      // multiplier on shards earned by rebirth
  | 'boss'        // multiplier on damage dealt to barriers
  | 'cost'        // multiplier on cash costs (lower is cheaper)
  | 'startTool'   // tool tier you begin a run with
  | 'startCash';  // Seed Money level (see BALANCE.seedMoney)

export interface Modifier {
  stat: StatKey;
  /** add: summed onto the base value. mult: multiplied in afterwards. */
  op: 'add' | 'mult';
  value: number;
}

export type ToolAnim = 'swing' | 'pound' | 'spin' | 'beam';

export interface ToolDef {
  id: string;
  name: string;
  desc: string;
  power: number;   // base damage per hit
  cost: number;    // cash
  // Look and feel
  model: string;   // which generated model the renderer builds
  anim: ToolAnim;
  color: number;
  glow: number;    // emissive accent colour
  shake: number;   // screen shake strength 0..1
  sound: 'thud' | 'clink' | 'rattle' | 'grind' | 'zap' | 'boom';
}

export interface OreDef {
  id: string;
  name: string;
  color: number;
  /** Cash = this multiple of the cash the hit itself earned. */
  value: number;
}

export interface LayerDef {
  id: string;
  name: string;
  start: number;     // metres
  end: number;       // metres
  hardness: number;     // damage needed per metre at the top of the layer
  hardnessEnd: number;  // ...rising smoothly to this at the bottom
  value: number;     // cash earned per point of damage
  ores: { id: string; weight: number }[];
  barrier: { name: string; desc: string; hp: number; color: number };
  look: {
    wall: number; wall2: number; floor: number; fog: number; debris: number;
    emissive: number; glow: number; // glow 0..1: how much the layer lights itself
  };
}

export interface PlanetDef {
  id: string;
  name: string;
  desc: string;
  hardnessMult: number;
  valueMult: number;
  barrierMult: number;
  /** Shards awarded for finishing this planet. */
  completionShards: number;
  /** Per-planet rule changes. Add keys here for new planets. */
  rules: { burstSecondsMult?: number; helperMult?: number; tapMult?: number };
  tint: number;
}

export interface HelperDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  dps: number;
  cost: number;
  growth: number;
}

export interface UpgradeDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  cost: number;
  growth: number;
  max?: number;
  /** Applied once per level. add: value*level, mult: value^level. */
  effect: Modifier;
}

export interface PrestigeNodeDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  cost: number;    // shards for level 1
  growth: number;  // cost multiplier per level
  max: number;
  requires: string[];
  effect: Modifier;
  pos: [number, number]; // column, row in the tree view
}

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export interface FindDef {
  id: string;
  name: string;
  icon: string;
  layer: string;
  rarity: Rarity;
  set: string;
}

export interface FindSetDef {
  id: string;
  name: string;
  bonusText: string;
  bonus: Modifier;
}

export interface MilestoneDef {
  depth: number;
  name: string;
  /** Cash reward, as seconds of your current expected income. */
  rewardSeconds: number;
  /** Shards granted the first time ever. */
  shards?: number;
}

/** Lifetime counters that achievements can watch. */
export type CounterKey =
  | 'hits' | 'crits' | 'cashEarned' | 'maxDepth' | 'rebirths' | 'barriers'
  | 'finds' | 'uniqueFinds' | 'ores' | 'helpers' | 'maxCombo' | 'toolTier'
  | 'sets' | 'planets' | 'playSeconds';

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  counter: CounterKey;
  goal: number;
  reward: Modifier;
}

import type { CounterKey, Modifier } from '../data';

/** The hole being dug. In co-op one Hole is shared by every player in the room. */
export interface Hole {
  planet: number;          // index into PLANETS (may run past the end: endless scaling)
  shared: boolean;         // true in co-op: the hole outlives any one player's run
  depth: number;           // metres
  barriersBroken: number;  // how many layer barriers are gone this dig
  barrierHp: number;       // remaining hp of the engaged barrier, or -1 when not engaged
  barrierTimer: number;    // ms left in the burst window, 0 when not engaged
  complete: boolean;       // core reached
}

export interface Player {
  rev: number;             // bumped whenever derived stats may have changed
  rng: number;             // uint32 RNG state: all randomness is replayable
  cash: number;
  tool: number;
  upgrades: Record<string, number>;
  helpers: Record<string, number>;
  combo: number;
  comboTimer: number;      // ms until the combo drops
  cooldown: number;        // ms until the next hit is allowed
  run: {
    damage: number;        // damage dealt this run (co-op rebirth uses this)
    maxDepth: number;
    timeMs: number;
    milestone: number;     // index of the next milestone this run
    cashEarned: number;
  };
  prestige: {
    shards: number;
    totalShards: number;
    rebirths: number;
    nodes: Record<string, number>;
  };
  finds: Record<string, number>;     // rare find id -> times found
  ores: Record<string, number>;      // ore id -> times found
  achievements: Record<string, 1>;
  milestonesEver: number;            // how many milestones have ever been reached
  counters: Record<CounterKey, number>;
  /**
   * Hooks for systems that are designed but not built yet. Anything placed in
   * `modifiers` is already picked up by computeStats, so pets, events and
   * cosmetics can change the game without touching the simulation.
   */
  ext: {
    modifiers: Modifier[];
    pets: { id: string; rarity: string; level: number; equipped: boolean }[];
    quests: Record<string, { progress: number; claimed: boolean }>;
    daily: { lastClaimDay: number; streak: number };
    cosmetics: { owned: string[]; equipped: Record<string, string> };
    events: Record<string, { joinedAt: number; score: number }>;
    trades: { id: string; with: string; give: string; get: string }[];
  };
}

/** Everything the simulation reports back so that rendering, sound and UI can react. */
export type SimEvent =
  | { type: 'hit'; damage: number; crit: boolean; dug: number; cash: number; combo: number; barrier: boolean }
  | { type: 'ore'; id: string; cash: number }
  | { type: 'find'; id: string; isNew: boolean; cash: number }
  | { type: 'setComplete'; id: string }
  | { type: 'milestone'; index: number; cash: number; first: boolean; shards: number }
  | { type: 'achievement'; id: string }
  | { type: 'layer'; index: number }
  | { type: 'barrierStart'; index: number }
  | { type: 'barrierReset'; index: number }
  | { type: 'barrierBreak'; index: number }
  | { type: 'core' }
  | { type: 'rebirth'; shards: number }
  | { type: 'planet'; index: number };

export type Mode = 'solo' | 'coop';

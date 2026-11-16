// Global balance constants. Per-item numbers live next to the items
// (tools.ts, layers.ts, helpers.ts ...). Tune with `npm run balance`.

export const BALANCE = {
  /** Centre of the Earth, metres. */
  coreDepth: 6_371_000,

  /** Each layer is cut into this many strata; hardness steps up from stratum to stratum. */
  strataPerLayer: 8,

  hit: {
    baseSpeed: 3,          // hits per second while holding
    maxSpeed: 12,          // hard cap, also enforced by the co-op server
  },

  combo: {
    baseMax: 30,
    damagePerCombo: 0.01,  // +1% damage per combo step
    decayMs: 1500,         // combo drops if you stop digging this long
  },

  crit: { baseChance: 0.02, baseMult: 3, maxChance: 0.75 },

  loot: {
    oreChance: 0.10,       // per hit, times luck
    maxOreChance: 0.5,
    findChance: 0.004,     // per hit, times luck
    maxFindChance: 0.05,
    /** Chance a rare find comes from the current layer rather than any layer above. */
    findCurrentLayerBias: 0.7,
    /** Duplicate finds pay this many hits' worth of cash. */
    duplicateFindHits: 40,
    newFindHits: 150,
    rarityWeight: { common: 50, uncommon: 30, rare: 15, legendary: 5 },
  },

  barrier: {
    /** You must empty a barrier's HP inside this window or it regenerates. */
    burstSeconds: 20,
  },

  offline: { baseEfficiency: 0.5, baseCapHours: 8, minSeconds: 60 },

  rebirth: {
    minDepth: 150,         // metres of your own digging this run before rebirth unlocks
    // shards = shardBase * shardGrowth ^ (layers cleared - 1), counting the fraction of the
    // current layer. So finishing bedrock pays shardBase * shardGrowth, the crust x shardGrowth more...
    shardBase: 3,
    shardGrowth: 5,
    /** Permanent multiplier = 1 + multPerShard * totalShardsEverEarned ^ multExp */
    multPerShard: 0.25,
    multExp: 0.5,
  },

  /** Seed Money (stat startCash counts levels): cash = base * growth ^ (level - 1). */
  seedMoney: { base: 50, growth: 20 },

  milestones: {
    /** Each milestone ever reached adds this much permanent damage. */
    damagePerMilestone: 0.03,
  },

  /** Planets past the end of planets.ts repeat the last one, scaled by this per extra planet. */
  endlessPlanetScale: 1e6,

  autosaveMs: 10_000,
} as const;

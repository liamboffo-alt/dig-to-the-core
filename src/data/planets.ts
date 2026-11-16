import type { PlanetDef } from './types';

// Planets reuse the layer table scaled by these multipliers, plus optional rule changes.
// Finishing the last planet in this list keeps going with BALANCE.endlessPlanetScale.
// A future planet with its own layers would add a `layers` field here and a lookup
// in sim/world.ts (see README, "Designed for later").
export const PLANETS: PlanetDef[] = [
  {
    id: 'earth', name: 'Earth', desc: 'Home. 6,371 km to the centre.',
    hardnessMult: 1, valueMult: 1, barrierMult: 1, completionShards: 50_000, rules: {}, tint: 0x4fc3f7,
  },
  {
    id: 'vulcan', name: 'Vulcan Prime', desc: 'A dense iron world. Barriers heal twice as fast and helpers work at half strength.',
    hardnessMult: 1e5, valueMult: 300, barrierMult: 1e5, completionShards: 5_000_000,
    rules: { burstSecondsMult: 0.5, helperMult: 0.5 }, tint: 0xff7043,
  },
];

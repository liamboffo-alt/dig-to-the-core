import type { MilestoneDef } from './types';

// Depth milestones, shallowest first. Reached again every run for the cash reward;
// the first time ever also grants permanent damage (BALANCE.milestones) and any shards.
export const MILESTONES: MilestoneDef[] = [
  { depth: 0.5,       name: 'Ankle deep',                          rewardSeconds: 4 },
  { depth: 2,         name: 'A proper hole',                       rewardSeconds: 6 },
  { depth: 5,         name: 'Over your head',                      rewardSeconds: 8 },
  { depth: 10,        name: 'Topsoil cleared',                     rewardSeconds: 8 },
  { depth: 25,        name: 'Deeper than a well',                  rewardSeconds: 12 },
  { depth: 50,        name: 'Catacomb depth',                       rewardSeconds: 12 },
  { depth: 100,       name: 'A hundred metres',                    rewardSeconds: 12 },
  { depth: 150,       name: 'Rebirth unlocked',                    rewardSeconds: 12 },
  { depth: 500,       name: 'Half a kilometre',                    rewardSeconds: 12 },
  { depth: 1_000,     name: 'One kilometre down',                  rewardSeconds: 16, shards: 5 },
  { depth: 4_000,     name: 'Deepest mine on Earth',               rewardSeconds: 16 },
  { depth: 12_262,    name: 'Kola Borehole: the deepest hole humans ever dug', rewardSeconds: 24, shards: 15 },
  { depth: 35_000,    name: 'Through the crust',                   rewardSeconds: 24, shards: 40 },
  { depth: 100_000,   name: '100 km: deeper than space is high',   rewardSeconds: 24 },
  { depth: 410_000,   name: 'The 410 discontinuity',               rewardSeconds: 24, shards: 150 },
  { depth: 660_000,   name: 'Upper mantle cleared',                rewardSeconds: 24, shards: 300 },
  { depth: 1_000_000, name: 'One thousand kilometres',             rewardSeconds: 24 },
  { depth: 2_000_000, name: 'Two thousand kilometres',             rewardSeconds: 24, shards: 1500 },
  { depth: 2_891_000, name: 'The core-mantle boundary',            rewardSeconds: 24, shards: 3000 },
  { depth: 3_185_500, name: 'Halfway to the centre',               rewardSeconds: 24 },
  { depth: 4_000_000, name: 'Swimming in liquid iron',             rewardSeconds: 24, shards: 6000 },
  { depth: 5_150_000, name: 'Inner core reached',                  rewardSeconds: 24, shards: 10000 },
  { depth: 6_000_000, name: 'Almost there',                        rewardSeconds: 24, shards: 15000 },
  { depth: 6_371_000, name: 'THE CENTRE OF THE EARTH',             rewardSeconds: 48 },
];

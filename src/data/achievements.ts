import type { AchievementDef } from './types';

const dmg = (v: number) => ({ stat: 'damage' as const, op: 'add' as const, value: v });
const cash = (v: number) => ({ stat: 'cash' as const, op: 'add' as const, value: v });

// Achievements watch a lifetime counter and grant a small permanent bonus.
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'hits1',    name: 'Blisters',          desc: 'Dig 500 times',               counter: 'hits', goal: 500, reward: dmg(0.02) },
  { id: 'hits2',    name: 'Calluses',          desc: 'Dig 5,000 times',             counter: 'hits', goal: 5_000, reward: dmg(0.03) },
  { id: 'hits3',    name: 'Arms of Steel',     desc: 'Dig 50,000 times',            counter: 'hits', goal: 50_000, reward: dmg(0.05) },
  { id: 'crit1',    name: 'Sweet Spot',        desc: 'Land 100 crits',              counter: 'crits', goal: 100, reward: dmg(0.02) },
  { id: 'crit2',    name: 'Surgical',          desc: 'Land 5,000 crits',            counter: 'crits', goal: 5_000, reward: dmg(0.05) },
  { id: 'combo1',   name: 'In the Groove',     desc: 'Reach a 30 combo',            counter: 'maxCombo', goal: 30, reward: dmg(0.02) },
  { id: 'combo2',   name: 'Unstoppable',       desc: 'Reach a 100 combo',           counter: 'maxCombo', goal: 100, reward: dmg(0.05) },
  { id: 'cash1',    name: 'Pocket Money',      desc: 'Earn $10K in total',          counter: 'cashEarned', goal: 1e4, reward: cash(0.03) },
  { id: 'cash2',    name: 'Millionaire',       desc: 'Earn $1M in total',           counter: 'cashEarned', goal: 1e6, reward: cash(0.03) },
  { id: 'cash3',    name: 'Billionaire',       desc: 'Earn $1B in total',           counter: 'cashEarned', goal: 1e9, reward: cash(0.05) },
  { id: 'cash4',    name: 'Trillionaire',      desc: 'Earn $1T in total',           counter: 'cashEarned', goal: 1e12, reward: cash(0.05) },
  { id: 'cash5',    name: 'Beyond Counting',   desc: 'Earn $1ab in total',          counter: 'cashEarned', goal: 1e18, reward: cash(0.10) },
  { id: 'tool1',    name: 'Tooled Up',         desc: 'Own a Pickaxe',               counter: 'toolTier', goal: 2, reward: dmg(0.02) },
  { id: 'tool2',    name: 'Heavy Machinery',   desc: 'Own a Tunnel Borer',          counter: 'toolTier', goal: 5, reward: dmg(0.03) },
  { id: 'tool3',    name: 'Science Fiction',   desc: 'Own an Antimatter Lance',     counter: 'toolTier', goal: 8, reward: dmg(0.05) },
  { id: 'tool4',    name: 'World Ender',       desc: 'Own the Planet Cracker',      counter: 'toolTier', goal: 15, reward: dmg(0.10) },
  { id: 'help1',    name: 'Not Alone',         desc: 'Own 10 helpers',              counter: 'helpers', goal: 10, reward: cash(0.02) },
  { id: 'help2',    name: 'Foreman',           desc: 'Own 100 helpers',             counter: 'helpers', goal: 100, reward: cash(0.03) },
  { id: 'help3',    name: 'Workforce',         desc: 'Own 400 helpers',             counter: 'helpers', goal: 400, reward: cash(0.05) },
  { id: 'wall1',    name: 'Breakthrough',      desc: 'Break your first barrier',    counter: 'barriers', goal: 1, reward: dmg(0.03) },
  { id: 'wall2',    name: 'Demolition Expert', desc: 'Break 25 barriers',           counter: 'barriers', goal: 25, reward: dmg(0.05) },
  { id: 'find1',    name: 'Finders Keepers',   desc: 'Find 5 different rare items', counter: 'uniqueFinds', goal: 5, reward: cash(0.03) },
  { id: 'find2',    name: 'Curator',           desc: 'Find 15 different rare items', counter: 'uniqueFinds', goal: 15, reward: cash(0.05) },
  { id: 'find3',    name: 'Museum Piece',      desc: 'Find every rare item',        counter: 'uniqueFinds', goal: 28, reward: dmg(0.25) },
  { id: 'set1',     name: 'Completionist',     desc: 'Complete a collection set',   counter: 'sets', goal: 1, reward: dmg(0.03) },
  { id: 'ore1',     name: 'Rock Hound',        desc: 'Find 1,000 ores',             counter: 'ores', goal: 1_000, reward: cash(0.03) },
  { id: 'depth1',   name: 'Out of Sight',      desc: 'Reach 100 m',                 counter: 'maxDepth', goal: 100, reward: dmg(0.02) },
  { id: 'depth2',   name: 'Deeper Than Kola',  desc: 'Reach 12.3 km',               counter: 'maxDepth', goal: 12_262, reward: dmg(0.05) },
  { id: 'depth3',   name: 'Mantle Diver',      desc: 'Reach the mantle',            counter: 'maxDepth', goal: 35_000, reward: dmg(0.05) },
  { id: 'depth4',   name: 'Core Sample',       desc: 'Reach the outer core',        counter: 'maxDepth', goal: 2_891_000, reward: dmg(0.10) },
  { id: 'rebirth1', name: 'Again!',            desc: 'Rebirth once',                counter: 'rebirths', goal: 1, reward: dmg(0.05) },
  { id: 'rebirth2', name: 'Groundhog',         desc: 'Rebirth 5 times',             counter: 'rebirths', goal: 5, reward: dmg(0.05) },
  { id: 'rebirth3', name: 'Eternal Digger',    desc: 'Rebirth 15 times',            counter: 'rebirths', goal: 15, reward: dmg(0.10) },
  { id: 'planet1',  name: 'Journey Complete',  desc: 'Reach the centre of a planet', counter: 'planets', goal: 1, reward: dmg(0.5) },
];

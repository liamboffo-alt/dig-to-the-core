import type { HelperDef } from './types';

// Auto-diggers. Each one owned adds `dps` damage per second, forever, including offline.
// Cost of the next one = cost * growth ^ owned. Each tier is about x8.4 the dps for x100 the cash.
export const HELPERS: HelperDef[] = [
  { id: 'mole', name: 'Garden Mole', icon: '🐹', desc: 'Small, keen, slightly lost.', dps: 0.5, cost: 15, growth: 1.15 },
  { id: 'dog', name: 'Digging Dog', icon: '🐕', desc: 'Thinks there is a bone down there.', dps: 4.2, cost: 1500, growth: 1.15 },
  { id: 'miner', name: 'Miner', icon: '⛏️', desc: 'Union rates apply.', dps: 35, cost: 1.5e5, growth: 1.15 },
  { id: 'bot', name: 'Drill Bot', icon: '🤖', desc: 'Never sleeps, never complains.', dps: 300, cost: 1.5e7, growth: 1.15 },
  { id: 'excavator', name: 'Excavator', icon: '🚜', desc: 'Heavy plant crossing.', dps: 2500, cost: 1.5e9, growth: 1.15 },
  { id: 'worm', name: 'Bore Worm', icon: '🪱', desc: 'A bio-engineered rock eater.', dps: 2.1e4, cost: 1.5e11, growth: 1.15 },
  { id: 'drone', name: 'Laser Drone', icon: '🛸', desc: 'Cuts while it hovers.', dps: 1.8e5, cost: 1.5e13, growth: 1.15 },
  { id: 'nanites', name: 'Nanite Swarm', icon: '🦠', desc: 'A trillion tiny shovels.', dps: 1.5e6, cost: 1.5e15, growth: 1.15 },
  { id: 'golem', name: 'Magma Golem', icon: '🗿', desc: 'Found it down here. It likes you.', dps: 1.2e7, cost: 1.5e17, growth: 1.15 },
  { id: 'well', name: 'Gravity Well', icon: '🌀', desc: 'Pulls the hole downwards.', dps: 1e8, cost: 1.5e19, growth: 1.15 },
  { id: 'wormhole', name: 'Wormhole Crew', icon: '🕳️', desc: 'Workers from a parallel dig.', dps: 8.7e8, cost: 1.5e21, growth: 1.15 },
  { id: 'eater', name: 'Planet Eater', icon: '🪐', desc: 'Best not to ask what it eats next.', dps: 7.3e9, cost: 1.5e23, growth: 1.15 },
  { id: 'titan', name: 'Stone Titan', icon: '🗻', desc: 'Older than the crust it is digging.', dps: 6.2e10, cost: 1.5e25, growth: 1.15 },
  { id: 'clock', name: 'Time Looper', icon: '⏳', desc: 'Already finished digging tomorrow.', dps: 5.2e11, cost: 1.5e27, growth: 1.15 },
];

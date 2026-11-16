import type { ToolDef } from './types';

// Tool tiers, in order. `power` is base damage per hit, `cost` is cash.
// Each tier is about x6.3 the power for x100 the cash.
// To add a tool: append a row. `model` picks the generated 3D model in
// src/render/tools.ts (reuse an existing model name if you don't want to build one).
export const TOOLS: ToolDef[] = [
  { id: 'spoon', name: 'Spoon', desc: 'It was in the kitchen drawer.', power: 1, cost: 0, model: 'spoon', anim: 'swing', color: 0xcfd8dc, glow: 0x000000, shake: 0.05, sound: 'thud' },
  { id: 'shovel', name: 'Shovel', desc: 'An actual digging implement.', power: 4, cost: 50, model: 'shovel', anim: 'swing', color: 0x8d6e63, glow: 0x000000, shake: 0.10, sound: 'thud' },
  { id: 'pickaxe', name: 'Pickaxe', desc: 'Rock, meet steel.', power: 25, cost: 5000, model: 'pickaxe', anim: 'swing', color: 0x90a4ae, glow: 0x000000, shake: 0.16, sound: 'clink' },
  { id: 'jackhammer', name: 'Jackhammer', desc: 'Loud. Very loud.', power: 160, cost: 5e5, model: 'jackhammer', anim: 'pound', color: 0xffb300, glow: 0x000000, shake: 0.22, sound: 'rattle' },
  { id: 'drill', name: 'Drill Rig', desc: 'Diamond-tipped and diesel-powered.', power: 1000, cost: 5e7, model: 'drill', anim: 'spin', color: 0xef5350, glow: 0x000000, shake: 0.28, sound: 'grind' },
  { id: 'borer', name: 'Tunnel Borer', desc: 'Eats mountains for breakfast.', power: 6300, cost: 5e9, model: 'borer', anim: 'spin', color: 0x26a69a, glow: 0x80cbc4, shake: 0.34, sound: 'grind' },
  { id: 'laser', name: 'Plasma Laser', desc: 'Melts a path straight down.', power: 40000, cost: 5e11, model: 'laser', anim: 'beam', color: 0x7e57c2, glow: 0xff4081, shake: 0.40, sound: 'zap' },
  { id: 'sonic', name: 'Sonic Disruptor', desc: 'Shakes rock apart at the atomic level.', power: 2.5e5, cost: 5e13, model: 'sonic', anim: 'beam', color: 0x29b6f6, glow: 0x18ffff, shake: 0.46, sound: 'zap' },
  { id: 'antimatter', name: 'Antimatter Lance', desc: 'Handle with extreme care.', power: 1.6e6, cost: 5e15, model: 'lance', anim: 'beam', color: 0xec407a, glow: 0xff80ab, shake: 0.52, sound: 'boom' },
  { id: 'graviton', name: 'Graviton Auger', desc: 'Screws a hole into spacetime itself.', power: 1e7, cost: 5e17, model: 'auger', anim: 'spin', color: 0x5c6bc0, glow: 0x8c9eff, shake: 0.58, sound: 'boom' },
  { id: 'singularity', name: 'Singularity Bore', desc: 'A pet black hole on a leash.', power: 6.3e7, cost: 5e19, model: 'singularity', anim: 'spin', color: 0x212121, glow: 0xb388ff, shake: 0.64, sound: 'boom' },
  { id: 'quantum', name: 'Quantum Unmaker', desc: 'The rock was never there.', power: 4e8, cost: 5e21, model: 'quantum', anim: 'beam', color: 0x00e676, glow: 0x69f0ae, shake: 0.70, sound: 'boom' },
  { id: 'darkmatter', name: 'Dark Matter Maw', desc: 'It is hungry, and it is not picky.', power: 2.5e9, cost: 5e23, model: 'singularity', anim: 'spin', color: 0x311b92, glow: 0xff1744, shake: 0.78, sound: 'boom' },
  { id: 'tectonic', name: 'Tectonic Splitter', desc: 'Parts continents like curtains.', power: 1.6e10, cost: 5e25, model: 'jackhammer', anim: 'pound', color: 0xbf360c, glow: 0xffab00, shake: 0.86, sound: 'boom' },
  { id: 'shear', name: 'Reality Shear', desc: 'Cuts the idea of rock out of the universe.', power: 1e11, cost: 5e27, model: 'lance', anim: 'beam', color: 0xeceff1, glow: 0x00e5ff, shake: 0.93, sound: 'boom' },
  { id: 'cracker', name: 'Planet Cracker', desc: 'The last tool you will ever need.', power: 6.3e11, cost: 5e29, model: 'cracker', anim: 'pound', color: 0xffd600, glow: 0xff6d00, shake: 1.00, sound: 'boom' },
];

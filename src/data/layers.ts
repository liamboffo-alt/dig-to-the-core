import type { LayerDef } from './types';

// The layers of the Earth, top to bottom. Depths are metres and must be contiguous.
//   hardness / hardnessEnd: damage needed to dig one metre at the top / bottom of the layer.
//             It rises smoothly in between (see BALANCE.strataPerLayer).
//   value:    cash earned per point of damage dealt in this layer
//   barrier:  the wall at the bottom of the layer. Its hp must be emptied inside
//             BALANCE.barrier.burstSeconds or it regenerates.
// To add a layer: insert a row, keep start/end contiguous, and give it ores and a look.
const std = (a: string, b: string, c: string, d: string) => [
  { id: a, weight: 60 }, { id: b, weight: 25 }, { id: c, weight: 12 }, { id: d, weight: 3 },
];

export const LAYERS: LayerDef[] = [
  {
    id: 'topsoil', name: 'Topsoil', start: 0, end: 10, hardness: 7.5e3, hardnessEnd: 7.5e3, value: 1,
    ores: std('clay', 'flint', 'copper', 'amber'),
    barrier: { name: 'The Old Root', desc: 'A tangle of ancient roots and packed stone.', hp: 5e3, color: 0x6d4c41 },
    look: { wall: 0x7a5230, wall2: 0x5d3b1e, floor: 0x8d6338, fog: 0x8fbfe8, debris: 0x9b6b3d, emissive: 0x000000, glow: 0 },
  },
  {
    id: 'bedrock', name: 'Bedrock', start: 10, end: 1_000, hardness: 1.5e4, hardnessEnd: 1.5e7, value: 1.5,
    ores: std('coal', 'iron', 'silver', 'gold'),
    barrier: { name: 'Granite Shield', desc: 'A slab of continental granite a kilometre down.', hp: 1.4e8, color: 0x90a4ae },
    look: { wall: 0x6f7b82, wall2: 0x4d5a61, floor: 0x7d8a91, fog: 0x39454d, debris: 0x9aa7ae, emissive: 0x000000, glow: 0 },
  },
  {
    id: 'crust', name: 'Crust', start: 1_000, end: 35_000, hardness: 3e7, hardnessEnd: 1.3e9, value: 2.5,
    ores: std('quartz', 'emerald', 'ruby', 'diamond'),
    barrier: { name: 'The Moho', desc: 'The Mohorovičić discontinuity: where crust ends and mantle begins.', hp: 3.7e11, color: 0x4e342e },
    look: { wall: 0x5a4a6a, wall2: 0x3c3050, floor: 0x6b5a7d, fog: 0x1d1728, debris: 0x8f7fa6, emissive: 0x1a0f2e, glow: 0.1 },
  },
  {
    id: 'upper_mantle', name: 'Upper Mantle', start: 35_000, end: 660_000, hardness: 2.5e9, hardnessEnd: 6.4e10, value: 4,
    ores: std('peridot', 'garnet', 'ringwoodite', 'moissanite'),
    barrier: { name: 'Transition Zone', desc: 'Crushing pressure turns the rock itself into something new.', hp: 3.8e14, color: 0x33691e },
    look: { wall: 0x5c7a2e, wall2: 0x8a3a12, floor: 0x7a8f35, fog: 0x2a1408, debris: 0xa5c94a, emissive: 0x5a1e00, glow: 0.3 },
  },
  {
    id: 'lower_mantle', name: 'Lower Mantle', start: 660_000, end: 2_891_000, hardness: 1.3e11, hardnessEnd: 8.6e13, value: 7,
    ores: std('bridgmanite', 'perovskite', 'firepearl', 'bluediamond'),
    barrier: { name: 'The D″ Layer', desc: 'A graveyard of sunken continents resting on the core.', hp: 1.6e18, color: 0xbf360c },
    look: { wall: 0xa3380f, wall2: 0x5c1505, floor: 0xc24a12, fog: 0x3a0b02, debris: 0xff7a33, emissive: 0xb02a00, glow: 0.55 },
  },
  {
    id: 'outer_core', name: 'Outer Core', start: 2_891_000, end: 5_150_000, hardness: 1.7e14, hardnessEnd: 4.5e17, value: 12,
    ores: std('molteniron', 'nickel', 'sunstone', 'corepearl'),
    barrier: { name: 'The Iron Snow', desc: 'Liquid metal freezing solid under three million atmospheres.', hp: 1.6e21, color: 0xffab00 },
    look: { wall: 0xff8a00, wall2: 0xd84a00, floor: 0xffb020, fog: 0x662200, debris: 0xffd54f, emissive: 0xff6a00, glow: 0.8 },
  },
  {
    id: 'inner_core', name: 'Inner Core', start: 5_150_000, end: 6_371_000, hardness: 9e17, hardnessEnd: 9e21, value: 20,
    ores: std('ironcrystal', 'osmium', 'helium3', 'heartstone'),
    barrier: { name: 'The Heart of the Earth', desc: 'The exact centre. Nothing lies beyond it.', hp: 1.5e25, color: 0xffffff },
    look: { wall: 0xfff3c4, wall2: 0xffc94d, floor: 0xffffff, fog: 0xa86a10, debris: 0xfffbe6, emissive: 0xffe9a0, glow: 1 },
  },
];

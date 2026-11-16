import type { OreDef } from './types';

// Ores and gems. `value` multiplies the cash of the hit that found it.
// Which layer drops which ore is set in layers.ts.
export const ORES: OreDef[] = [
  // Topsoil
  { id: 'clay',        name: 'Clay',            color: 0xbf8f6f, value: 3 },
  { id: 'flint',       name: 'Flint',           color: 0x78909c, value: 6 },
  { id: 'copper',      name: 'Copper',          color: 0xe07b39, value: 15 },
  { id: 'amber',       name: 'Amber',           color: 0xffb300, value: 60 },
  // Bedrock
  { id: 'coal',        name: 'Coal',            color: 0x37474f, value: 3 },
  { id: 'iron',        name: 'Iron Ore',        color: 0xb0886a, value: 6 },
  { id: 'silver',      name: 'Silver',          color: 0xe0e0e0, value: 15 },
  { id: 'gold',        name: 'Gold',            color: 0xffd54f, value: 60 },
  // Crust
  { id: 'quartz',      name: 'Quartz',          color: 0xf3e5f5, value: 3 },
  { id: 'emerald',     name: 'Emerald',         color: 0x2ecc71, value: 6 },
  { id: 'ruby',        name: 'Ruby',            color: 0xe53935, value: 15 },
  { id: 'diamond',     name: 'Diamond',         color: 0x80deea, value: 60 },
  // Upper mantle
  { id: 'peridot',     name: 'Peridot',         color: 0x9ccc65, value: 3 },
  { id: 'garnet',      name: 'Garnet',          color: 0xad1457, value: 6 },
  { id: 'ringwoodite', name: 'Ringwoodite',     color: 0x3949ab, value: 15 },
  { id: 'moissanite',  name: 'Moissanite',      color: 0xb2ebf2, value: 60 },
  // Lower mantle
  { id: 'bridgmanite', name: 'Bridgmanite',     color: 0x8d6e63, value: 3 },
  { id: 'perovskite',  name: 'Perovskite',      color: 0xff7043, value: 6 },
  { id: 'firepearl',   name: 'Fire Pearl',      color: 0xff5252, value: 15 },
  { id: 'bluediamond', name: 'Blue Diamond',    color: 0x448aff, value: 60 },
  // Outer core
  { id: 'molteniron',  name: 'Molten Iron',     color: 0xff8f00, value: 3 },
  { id: 'nickel',      name: 'Liquid Nickel',   color: 0xcfd8dc, value: 6 },
  { id: 'sunstone',    name: 'Sunstone',        color: 0xffea00, value: 15 },
  { id: 'corepearl',   name: 'Core Pearl',      color: 0xffffff, value: 60 },
  // Inner core
  { id: 'ironcrystal', name: 'Iron Crystal',    color: 0xb0bec5, value: 3 },
  { id: 'osmium',      name: 'Osmium',          color: 0x90caf9, value: 6 },
  { id: 'helium3',     name: 'Primordial Helium', color: 0xea80fc, value: 15 },
  { id: 'heartstone',  name: 'Heartstone',      color: 0xff1744, value: 60 },
];

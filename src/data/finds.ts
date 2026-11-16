import type { FindDef, FindSetDef } from './types';

// Rare finds for the collection book. Finding every item in a set grants its bonus forever.
export const FIND_SETS: FindSetDef[] = [
  { id: 'backyard', name: 'Backyard Treasures',            bonusText: '+15% cash',            bonus: { stat: 'cash', op: 'add', value: 0.15 } },
  { id: 'fossils',  name: 'Fossil Record',                 bonusText: '+25% damage',          bonus: { stat: 'damage', op: 'mult', value: 1.25 } },
  { id: 'lost',     name: 'Lost Civilisations',            bonusText: '+5% crit chance',      bonus: { stat: 'critChance', op: 'add', value: 0.05 } },
  { id: 'odd',      name: "Things That Shouldn't Be Here", bonusText: '+40% luck',            bonus: { stat: 'luck', op: 'add', value: 0.4 } },
  { id: 'dwellers', name: 'Deep Dwellers',                 bonusText: '+50% helper damage',   bonus: { stat: 'helper', op: 'mult', value: 1.5 } },
  { id: 'cosmic',   name: 'Cosmic Debris',                 bonusText: '+20% Core Shards',     bonus: { stat: 'shards', op: 'add', value: 0.2 } },
  { id: 'heart',    name: 'Heart of the World',            bonusText: 'x2 damage',            bonus: { stat: 'damage', op: 'mult', value: 2 } },
];

export const FINDS: FindDef[] = [
  { id: 'keys',      name: 'Lost House Keys',   icon: '🔑', layer: 'topsoil',      rarity: 'common',    set: 'backyard' },
  { id: 'boot',      name: 'Old Boot',          icon: '🥾', layer: 'topsoil',      rarity: 'common',    set: 'backyard' },
  { id: 'bone',      name: 'Buried Bone',       icon: '🦴', layer: 'topsoil',      rarity: 'uncommon',  set: 'backyard' },
  { id: 'capsule',   name: 'Time Capsule',      icon: '📦', layer: 'topsoil',      rarity: 'rare',      set: 'backyard' },

  { id: 'ammonite',  name: 'Ammonite',          icon: '🐚', layer: 'bedrock',      rarity: 'common',    set: 'fossils' },
  { id: 'trilobite', name: 'Trilobite',         icon: '🪲', layer: 'bedrock',      rarity: 'uncommon',  set: 'fossils' },
  { id: 'tooth',     name: 'T-Rex Tooth',       icon: '🦷', layer: 'bedrock',      rarity: 'rare',      set: 'fossils' },
  { id: 'mosquito',  name: 'Mosquito in Amber', icon: '🦟', layer: 'bedrock',      rarity: 'legendary', set: 'fossils' },

  { id: 'sword',     name: 'Bronze Sword',      icon: '🗡️', layer: 'crust',        rarity: 'common',    set: 'lost' },
  { id: 'tablet',    name: 'Stone Tablet',      icon: '📜', layer: 'crust',        rarity: 'uncommon',  set: 'lost' },
  { id: 'mask',      name: 'Golden Mask',       icon: '🎭', layer: 'crust',        rarity: 'rare',      set: 'lost' },
  { id: 'skull',     name: 'Crystal Skull',     icon: '💀', layer: 'crust',        rarity: 'legendary', set: 'lost' },

  { id: 'sock',      name: 'The Other Sock',    icon: '🧦', layer: 'upper_mantle', rarity: 'common',    set: 'odd' },
  { id: 'duck',      name: 'Rubber Duck',       icon: '🦆', layer: 'upper_mantle', rarity: 'uncommon',  set: 'odd' },
  { id: 'phone',     name: 'Ringing Telephone', icon: '☎️', layer: 'upper_mantle', rarity: 'rare',      set: 'odd' },
  { id: 'vending',   name: 'Vending Machine',   icon: '🥤', layer: 'upper_mantle', rarity: 'legendary', set: 'odd' },

  { id: 'lamp',      name: 'Lava Lamp',         icon: '🪔', layer: 'lower_mantle', rarity: 'common',    set: 'dwellers' },
  { id: 'map',       name: 'Hollow Earth Map',  icon: '🗺️', layer: 'lower_mantle', rarity: 'uncommon',  set: 'dwellers' },
  { id: 'egg',       name: 'Dragon Egg',        icon: '🥚', layer: 'lower_mantle', rarity: 'rare',      set: 'dwellers' },
  { id: 'crown',     name: "Mole King's Crown", icon: '👑', layer: 'lower_mantle', rarity: 'legendary', set: 'dwellers' },

  { id: 'meteor',    name: 'Meteor Heart',      icon: '☄️', layer: 'outer_core',   rarity: 'common',    set: 'cosmic' },
  { id: 'compass',   name: 'Void Compass',      icon: '🧭', layer: 'outer_core',   rarity: 'uncommon',  set: 'cosmic' },
  { id: 'probe',     name: 'Alien Probe',       icon: '🛰️', layer: 'outer_core',   rarity: 'rare',      set: 'cosmic' },
  { id: 'star',      name: 'Star Fragment',     icon: '⭐', layer: 'outer_core',   rarity: 'legendary', set: 'cosmic' },

  { id: 'gear',      name: 'World Engine Gear', icon: '⚙️', layer: 'inner_core',   rarity: 'common',    set: 'heart' },
  { id: 'seed',      name: 'Core Seed',         icon: '🌰', layer: 'inner_core',   rarity: 'uncommon',  set: 'heart' },
  { id: 'flame',     name: 'Primordial Flame',  icon: '🔥', layer: 'inner_core',   rarity: 'rare',      set: 'heart' },
  { id: 'atom',      name: 'The First Atom',    icon: '⚛️', layer: 'inner_core',   rarity: 'legendary', set: 'heart' },
];

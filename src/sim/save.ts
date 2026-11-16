import { createHole, createPlayer } from './sim';
import type { Hole, Player } from './types';

export const SAVE_VERSION = 1;

export interface SaveFile {
  v: number;
  savedAt: number; // epoch ms, supplied by the caller (the sim itself never reads a clock)
  player: Player;
  hole: Hole;
}

export function makeSave(player: Player, hole: Hole, savedAt: number): SaveFile {
  return { v: SAVE_VERSION, savedAt, player, hole };
}

/** Lay saved data over fresh defaults so that fields added in later versions always exist. */
function overlay<T>(defaults: T, saved: unknown): T {
  if (saved === null || saved === undefined) return defaults;
  if (Array.isArray(defaults)) return (Array.isArray(saved) ? saved : defaults) as T;
  if (typeof defaults === 'object' && defaults !== null) {
    if (typeof saved !== 'object') return defaults;
    const out: Record<string, unknown> = { ...(saved as Record<string, unknown>) };
    for (const key of Object.keys(defaults as object)) {
      out[key] = overlay((defaults as Record<string, unknown>)[key], (saved as Record<string, unknown>)[key]);
    }
    return out as T;
  }
  if (typeof defaults === 'number') return (typeof saved === 'number' && !Number.isNaN(saved) ? saved : defaults) as T;
  return (typeof saved === typeof defaults ? saved : defaults) as T;
}

/** Per-version upgrades. Add a step here whenever SAVE_VERSION goes up. */
function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  // if (raw.v === 1) { ...; raw.v = 2; }
  return raw;
}

export function restoreSave(raw: unknown): SaveFile {
  if (typeof raw !== 'object' || raw === null) throw new Error('Save is not an object');
  const data = migrate(raw as Record<string, unknown>);
  if (typeof data.v !== 'number' || data.v > SAVE_VERSION) throw new Error('Save is from a newer version of the game');
  const player = overlay(createPlayer(1), data.player);
  const hole = overlay(createHole(0, false), data.hole);
  return { v: SAVE_VERSION, savedAt: typeof data.savedAt === 'number' ? data.savedAt : 0, player, hole };
}

export function serialize(save: SaveFile): string {
  return JSON.stringify(save);
}
export function deserialize(text: string): SaveFile {
  return restoreSave(JSON.parse(text));
}

function checksum(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

/** A copy-pasteable save string: DIG1.<base64 json>.<checksum> */
export function exportSave(save: SaveFile): string {
  const body = btoa(unescape(encodeURIComponent(serialize(save))));
  return `DIG${SAVE_VERSION}.${body}.${checksum(body)}`;
}

export function importSave(text: string): SaveFile {
  const parts = text.trim().split('.');
  if (parts.length !== 3 || !parts[0].startsWith('DIG')) throw new Error('That does not look like a save string');
  if (checksum(parts[1]) !== parts[2]) throw new Error('Save string is damaged (checksum mismatch)');
  return deserialize(decodeURIComponent(escape(atob(parts[1]))));
}

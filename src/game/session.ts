// A Session is "a game in progress" as the UI and renderer see it. Solo runs the
// simulation in the page; co-op (src/game/coop.ts) mirrors one that runs on the server.

import { BALANCE } from '../data';
import {
  applyOffline, buyHelper, buyNode, buyTool, buyUpgrade, createHole, createPlayer, deserialize, exportSave,
  hit, importSave, makeSave, rebirth, serialize, tick, travel, type Hole, type Mode, type Player,
  type SaveFile, type SimEvent,
} from '../sim';

export interface Peer { id: string; name: string; tool: number; dug: number; hits: number; online: boolean; me: boolean }
export interface Leaderboards {
  room: Peer[];
  global: { code: string; depth: number; planet: number; players: number }[];
}

export interface Session {
  readonly mode: Mode;
  player: Player;
  hole: Hole;
  peers: Peer[];
  roomCode: string | null;
  leaderboards: Leaderboards | null;
  /** Human-readable connection state for co-op; empty for solo. */
  status: string;
  setHolding(on: boolean): void;
  tap(): void;
  buyTool(): boolean;
  buyUpgrade(id: string, count: number): boolean;
  buyHelper(id: string, count: number): boolean;
  buyNode(id: string): boolean;
  rebirth(): void;
  travel(): void;
  /** Advance by dt and return everything that happened. */
  update(dtMs: number): SimEvent[];
  /** Ids of partners who swung since the last call. */
  takePeerHits(): string[];
  save(): void;
  dispose(): void;
}

const SAVE_KEY = 'dig-core-save-v1';

export interface OfflineReport { seconds: number; cash: number; dug: number }

export class SoloSession implements Session {
  readonly mode = 'solo' as const;
  peers: Peer[] = [];
  roomCode = null;
  leaderboards = null;
  status = '';
  private holding = false;
  private taps = 0;
  private pending: SimEvent[] = [];
  private sinceSave = 0;

  constructor(public player: Player, public hole: Hole) {}

  /** Load the local save (or start fresh) and pay out offline earnings. */
  static load(now = Date.now()): { session: SoloSession; offline: OfflineReport | null; fresh: boolean } {
    let save: SaveFile | null = null;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) save = deserialize(raw);
    } catch (err) {
      console.warn('Could not read the save, starting fresh.', err);
    }
    if (!save) {
      const seed = (Math.random() * 0xffffffff) >>> 0;
      return { session: new SoloSession(createPlayer(seed), createHole()), offline: null, fresh: true };
    }
    const session = new SoloSession(save.player, save.hole);
    session.hole.shared = false;
    const report = applyOffline(session.player, session.hole, Math.max(0, now - save.savedAt));
    return { session, offline: report.seconds > 0 ? report : null, fresh: false };
  }

  /** The tab was hidden for a while: treat it like being away. */
  away(ms: number): OfflineReport | null {
    if (ms < BALANCE.offline.minSeconds * 1000) { tick(this.player, this.hole, ms, this.pending); return null; }
    const report = applyOffline(this.player, this.hole, ms);
    return report.seconds > 0 ? report : null;
  }

  setHolding(on: boolean): void { this.holding = on; }
  tap(): void { this.taps = Math.min(this.taps + 1, 2); }
  buyTool(): boolean { return buyTool(this.player, this.hole); }
  buyUpgrade(id: string, count: number): boolean { return buyUpgrade(this.player, this.hole, id, count) > 0; }
  buyHelper(id: string, count: number): boolean { return buyHelper(this.player, this.hole, id, count) > 0; }
  buyNode(id: string): boolean { return buyNode(this.player, id); }
  rebirth(): void { if (rebirth(this.player, this.hole, this.pending) > 0) this.save(); }
  travel(): void { if (travel(this.player, this.hole, this.pending)) this.save(); }

  update(dtMs: number): SimEvent[] {
    const events = this.pending;
    this.pending = [];
    tick(this.player, this.hole, dtMs, events);
    if (this.holding || this.taps > 0) {
      if (hit(this.player, this.hole, events) && this.taps > 0) this.taps--;
    }
    this.sinceSave += dtMs;
    if (this.sinceSave >= BALANCE.autosaveMs) this.save();
    return events;
  }

  takePeerHits(): string[] { return []; }

  save(): void {
    this.sinceSave = 0;
    try {
      localStorage.setItem(SAVE_KEY, serialize(makeSave(this.player, this.hole, Date.now())));
    } catch (err) {
      console.warn('Save failed', err);
    }
  }

  exportString(): string { return exportSave(makeSave(this.player, this.hole, Date.now())); }

  /** Replace the game with an imported save string. Throws if the string is bad. */
  static importString(text: string): SoloSession {
    const save = importSave(text);
    const session = new SoloSession(save.player, save.hole);
    session.hole.shared = false;
    session.save();
    return session;
  }

  static wipe(): void { localStorage.removeItem(SAVE_KEY); }

  dispose(): void { this.save(); }
}

// ---- settings (kept apart from the save so importing a save does not change them)

export interface Settings { sound: boolean; volume: number; shake: boolean; name: string; server: string }
const SETTINGS_KEY = 'dig-core-settings-v1';

export function loadSettings(): Settings {
  const defaults: Settings = { sound: true, volume: 0.6, shake: true, name: '', server: '' };
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') };
  } catch {
    return defaults;
  }
}
export function saveSettings(s: Settings): void {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* private mode */ }
}

// Placeholder until the co-op milestone: replaced by the real WebSocket client.
import { createHole, createPlayer, type SimEvent } from '../sim';
import type { Session } from './session';

export class CoopSession implements Session {
  readonly mode = 'coop' as const;
  player = createPlayer(1);
  hole = createHole(0, true);
  peers = [];
  roomCode = null;
  leaderboards = null;
  status = '';
  constructor(_server: string, _kind: string, _code: string, _name: string, hooks: { onJoined(): void; onClosed(reason: string): void }) {
    setTimeout(() => hooks.onClosed('Co-op arrives in milestone 5'), 0);
  }
  setHolding(): void {}
  tap(): void {}
  buyTool(): boolean { return false; }
  buyUpgrade(): boolean { return false; }
  buyHelper(): boolean { return false; }
  buyNode(): boolean { return false; }
  rebirth(): void {}
  travel(): void {}
  update(): SimEvent[] { return []; }
  takePeerHits(): string[] { return []; }
  save(): void {}
  dispose(): void {}
}

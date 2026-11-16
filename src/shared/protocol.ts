// Wire format shared by the browser client and the Node server. Plain JSON over a WebSocket.
// The client only ever sends intent ("I am holding the dig button", "buy this"); every number
// comes back from the server, which runs the simulation.

import type { Hole, Player, SimEvent } from '../sim';

export type ClientMsg =
  | { t: 'hello'; kind: 'create' | 'join'; code: string; name: string; token: string }
  | { t: 'hold'; on: boolean }
  | { t: 'tap' }
  | { t: 'buy'; k: 'tool' | 'upgrade' | 'helper' | 'node'; id?: string; n?: number }
  | { t: 'rebirth' }
  | { t: 'travel' };

export interface PeerInfo { id: string; name: string; tool: number; dug: number; hits: number; online: boolean }
export interface RoomRank { code: string; depth: number; planet: number; players: number }

export type ServerMsg =
  | { t: 'joined'; code: string; id: string; player: Player; hole: Hole }
  /** Full copy of your player: sent whenever something other than cash/combo changed. */
  | { t: 'p'; player: Player }
  /** Ten times a second: the shared hole, your fast-changing numbers, and what happened. */
  | { t: 's'; hole: Hole; cash: number; combo: number; run: Player['run']; hits: number; ev: SimEvent[]; ph: string[] }
  | { t: 'room'; peers: PeerInfo[]; global: RoomRank[] }
  | { t: 'err'; msg: string };

export const DEFAULT_PORT = 8787;
export const MAX_ROOM_PLAYERS = 8;

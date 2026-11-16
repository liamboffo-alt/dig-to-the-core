// Co-op client. The server runs the simulation; this class mirrors the state it sends back
// and forwards the player's intent. It never changes depth, cash or upgrades by itself.

import { HELPERS, PRESTIGE_NODES, UPGRADES } from '../data';
import { DEFAULT_PORT, type ClientMsg, type ServerMsg } from '../shared/protocol';
import {
  createHole, createPlayer, getStats, helperCost, nodeCost, nodeUnlocked, pendingShards, toolCost, upgradeCost,
  type Hole, type Player, type SimEvent,
} from '../sim';
import type { Leaderboards, Peer, Session } from './session';

const TOKEN_KEY = 'dig-core-token';

function playerToken(): string {
  let token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    token = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(TOKEN_KEY, token);
  }
  return token;
}

/** Where the co-op server lives: an explicit setting, a build-time URL, or the page's own host. */
export function serverUrl(override: string): string {
  const fromEnv = import.meta.env.VITE_WS_URL as string | undefined;
  if (override) return override;
  if (fromEnv) return fromEnv;
  const secure = location.protocol === 'https:';
  // In development the page comes from Vite, and the game server listens on its own port.
  const host = import.meta.env.DEV ? `${location.hostname}:${DEFAULT_PORT}` : location.host;
  return `${secure ? 'wss' : 'ws'}://${host}`;
}

export interface CoopHooks { onJoined(): void; onClosed(reason: string): void }

export class CoopSession implements Session {
  readonly mode = 'coop' as const;
  player: Player = createPlayer(1);
  hole: Hole = createHole(0, true);
  peers: Peer[] = [];
  roomCode: string | null = null;
  leaderboards: Leaderboards | null = null;
  status = 'Connecting…';
  private ws: WebSocket;
  private myId = '';
  private events: SimEvent[] = [];
  private peerHits: string[] = [];
  private joined = false;
  private closed = false;
  private holding = false;

  constructor(server: string, kind: 'create' | 'join', code: string, name: string, private hooks: CoopHooks) {
    let ws: WebSocket;
    try {
      ws = new WebSocket(serverUrl(server));
    } catch {
      ws = { close() {}, send() {}, readyState: 3 } as unknown as WebSocket;
      setTimeout(() => this.finish('Bad server address'), 0);
    }
    this.ws = ws;
    ws.onopen = () => this.send({ t: 'hello', kind, code, name, token: playerToken() });
    ws.onmessage = (e) => this.receive(JSON.parse(String(e.data)) as ServerMsg);
    ws.onerror = () => { if (!this.joined) this.finish('Could not reach the co-op server'); };
    ws.onclose = (e) => this.finish(e.reason || (this.joined ? 'Connection lost. Rejoin with the room code to carry on.' : 'Could not reach the co-op server'));
  }

  private send(msg: ClientMsg): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private finish(reason: string): void {
    if (this.closed) return;
    this.closed = true;
    this.status = reason;
    this.hooks.onClosed(reason);
  }

  private receive(msg: ServerMsg): void {
    switch (msg.t) {
      case 'joined':
        this.joined = true;
        this.myId = msg.id;
        this.roomCode = msg.code;
        this.player = msg.player;
        this.hole = msg.hole;
        this.status = '';
        this.hooks.onJoined();
        break;
      case 'p': {
        const { combo, comboTimer } = this.player;
        this.player = msg.player;
        this.player.combo = combo;
        this.player.comboTimer = comboTimer;
        break;
      }
      case 's':
        this.hole = msg.hole;
        this.player.cash = msg.cash;
        this.player.combo = msg.combo;
        this.player.run = msg.run;
        this.player.counters.hits = msg.hits;
        for (const e of msg.ev) this.events.push(e);
        for (const id of msg.ph) this.peerHits.push(id);
        break;
      case 'room':
        this.peers = msg.peers.map((p) => ({ ...p, me: p.id === this.myId }));
        this.leaderboards = { room: this.peers, global: msg.global };
        break;
      case 'err':
        this.finish(msg.msg);
        this.ws.close();
        break;
    }
  }

  setHolding(on: boolean): void {
    if (on === this.holding) return;
    this.holding = on;
    this.send({ t: 'hold', on });
  }
  tap(): void { this.send({ t: 'tap' }); }

  // Purchases are decided by the server. The return value is only a prediction for the click sound.
  buyTool(): boolean {
    this.send({ t: 'buy', k: 'tool' });
    return this.player.cash >= toolCost(this.player, getStats(this.player, this.hole.planet));
  }
  buyUpgrade(id: string, count: number): boolean {
    this.send({ t: 'buy', k: 'upgrade', id, n: count });
    const def = UPGRADES.find((u) => u.id === id);
    const level = this.player.upgrades[id] ?? 0;
    return !!def && (def.max == null || level < def.max) && this.player.cash >= upgradeCost(def, level, getStats(this.player, this.hole.planet));
  }
  buyHelper(id: string, count: number): boolean {
    this.send({ t: 'buy', k: 'helper', id, n: count });
    const def = HELPERS.find((h) => h.id === id);
    return !!def && this.player.cash >= helperCost(def, this.player.helpers[id] ?? 0, getStats(this.player, this.hole.planet));
  }
  buyNode(id: string): boolean {
    this.send({ t: 'buy', k: 'node', id });
    const def = PRESTIGE_NODES.find((n) => n.id === id);
    const level = this.player.prestige.nodes[id] ?? 0;
    return !!def && nodeUnlocked(this.player, def) && level < def.max && this.player.prestige.shards >= nodeCost(def, level);
  }
  rebirth(): void { if (pendingShards(this.player, this.hole) > 0) this.send({ t: 'rebirth' }); }
  travel(): void { this.send({ t: 'travel' }); }

  update(): SimEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }
  takePeerHits(): string[] {
    const out = this.peerHits;
    this.peerHits = [];
    return out;
  }
  save(): void { /* the server keeps co-op progress */ }
  dispose(): void {
    this.closed = true;
    this.ws.close();
  }
}

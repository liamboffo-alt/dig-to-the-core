// Co-op server: rooms joined by code, one shared hole per room, the simulation runs here.
// It also serves the built client from dist/ so a deployment is a single process.

import { createReadStream, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { WebSocketServer, type WebSocket } from 'ws';
import {
  awardCompletion, buyHelper, buyNode, buyTool, buyUpgrade, createHole, createPlayer, hit, rebirth, restoreSave,
  tickHole, tickPlayer, travel, type Hole, type Player, type SimEvent,
} from '../src/sim';
import { MAX_ROOM_PLAYERS, type ClientMsg, type PeerInfo, type RoomRank, type ServerMsg } from '../src/shared/protocol';

const TICK_MS = 50;
const SEND_EVERY = 2;        // ticks between state messages (10 per second)
const ROOM_EVERY = 20;       // ticks between room/leaderboard messages
const SAVE_EVERY_MS = 30_000;
const MAX_ROOMS = 500;
const MAX_MSGS_PER_SECOND = 60;
const ROOM_TTL_MS = 30 * 24 * 3600 * 1000;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no look-alikes
const HOLE_EVENTS = new Set(['barrierStart', 'barrierReset', 'barrierBreak', 'layer', 'core', 'planet']);

interface Member {
  id: string;
  token: string;
  name: string;
  player: Player;
  dug: number;       // metres this member has added to the shared hole
  hits: number;
  ws: WebSocket | null;
  holding: boolean;
  taps: number;
  events: SimEvent[];
  sentRev: number;
  msgs: number;
}

interface Room {
  code: string;
  hole: Hole;
  members: Map<string, Member>; // by token
  peerHits: Set<string>;
  touched: number;
}

export interface ServerOptions { port: number; dataFile?: string | null; staticDir?: string | null; quiet?: boolean }

export function startServer(opts: ServerOptions): { http: Server; close: () => Promise<void>; rooms: Map<string, Room>; save: () => void } {
  const rooms = new Map<string, Room>();
  const log = (...a: unknown[]) => { if (!opts.quiet) console.log(new Date().toISOString(), ...a); };

  // ---------------------------------------------------------------- persistence
  const dataFile = opts.dataFile ?? null;
  if (dataFile && existsSync(dataFile)) {
    try {
      const raw = JSON.parse(readFileSync(dataFile, 'utf8')) as { rooms: { code: string; hole: Hole; touched: number; members: { token: string; id: string; name: string; dug: number; hits: number; player: Player }[] }[] };
      for (const r of raw.rooms) {
        if (Date.now() - r.touched > ROOM_TTL_MS) continue;
        const room: Room = { code: r.code, hole: { ...createHole(0, true), ...r.hole, shared: true }, members: new Map(), peerHits: new Set(), touched: r.touched };
        for (const m of r.members) {
          const player = restoreSave({ v: 1, player: m.player, hole: room.hole }).player;
          room.members.set(m.token, { ...blankMember(m.token, m.name, player), id: m.id, dug: m.dug, hits: m.hits });
        }
        rooms.set(room.code, room);
      }
      log(`loaded ${rooms.size} rooms from ${dataFile}`);
    } catch (err) {
      console.error('Could not read room data, starting empty:', err);
    }
  }
  const save = () => {
    if (!dataFile) return;
    const out = {
      rooms: [...rooms.values()].map((r) => ({
        code: r.code, hole: r.hole, touched: r.touched,
        members: [...r.members.values()].map((m) => ({ token: m.token, id: m.id, name: m.name, dug: m.dug, hits: m.hits, player: m.player })),
      })),
    };
    mkdirSync(dirname(dataFile), { recursive: true });
    writeFileSync(dataFile + '.tmp', JSON.stringify(out));
    renameSync(dataFile + '.tmp', dataFile);
  };

  function blankMember(token: string, name: string, player: Player): Member {
    return { id: randomBytes(4).toString('hex'), token, name, player, dug: 0, hits: 0, ws: null, holding: false, taps: 0, events: [], sentRev: -1, msgs: 0 };
  }

  // ---------------------------------------------------------------- http (static client + health)
  const staticDir = opts.staticDir ? resolve(opts.staticDir) : null;
  const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon' };
  const http = createServer((req, res) => {
    const path = (req.url ?? '/').split('?')[0];
    if (path === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, rooms: rooms.size, online: [...rooms.values()].reduce((n, r) => n + online(r).length, 0) }));
      return;
    }
    if (!staticDir) { res.writeHead(404).end('Not found'); return; }
    let file = normalize(join(staticDir, path === '/' ? 'index.html' : path));
    if (!file.startsWith(staticDir) || !existsSync(file) || statSync(file).isDirectory()) file = join(staticDir, 'index.html');
    if (!existsSync(file)) { res.writeHead(404).end('Client not built: run "npm run build"'); return; }
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'cache-control': file.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' });
    createReadStream(file).pipe(res);
  });

  // ---------------------------------------------------------------- sockets
  const wss = new WebSocketServer({ server: http, maxPayload: 2048 });
  const send = (ws: WebSocket | null, msg: ServerMsg) => { if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg)); };
  const online = (room: Room) => [...room.members.values()].filter((m) => m.ws);
  const newCode = () => {
    for (;;) {
      let code = '';
      for (const b of randomBytes(5)) code += CODE_ALPHABET[b % CODE_ALPHABET.length];
      if (!rooms.has(code)) return code;
    }
  };
  const cleanName = (name: unknown) => (typeof name === 'string' ? name : '').replace(/[^\p{L}\p{N} _.\-]/gu, '').trim().slice(0, 14) || 'Digger';

  wss.on('connection', (ws) => {
    let room: Room | null = null;
    let me: Member | null = null;

    ws.on('message', (data) => {
      let msg: ClientMsg;
      try { msg = JSON.parse(String(data)) as ClientMsg; } catch { return; }
      if (typeof msg !== 'object' || msg === null) return;

      if (!me || !room) {
        if (msg.t !== 'hello' || typeof msg.token !== 'string' || msg.token.length < 8 || msg.token.length > 64) return;
        if (msg.kind === 'create') {
          if (rooms.size >= MAX_ROOMS) { send(ws, { t: 'err', msg: 'The server is full. Try again later.' }); return; }
          room = { code: newCode(), hole: createHole(0, true), members: new Map(), peerHits: new Set(), touched: Date.now() };
          rooms.set(room.code, room);
          log(`room ${room.code} created`);
        } else {
          room = rooms.get(String(msg.code).toUpperCase().trim()) ?? null;
          if (!room) { send(ws, { t: 'err', msg: 'No room with that code.' }); return; }
        }
        me = room.members.get(msg.token) ?? null;
        if (!me) {
          if (room.members.size >= MAX_ROOM_PLAYERS * 4 || online(room).length >= MAX_ROOM_PLAYERS) {
            send(ws, { t: 'err', msg: 'That room is full.' });
            room = null;
            return;
          }
          me = blankMember(msg.token, cleanName(msg.name), createPlayer(randomBytes(4).readUInt32LE(0)));
          room.members.set(msg.token, me);
        } else {
          me.ws?.close(4000, 'Joined from another tab');
          me.name = cleanName(msg.name);
        }
        me.ws = ws;
        me.holding = false;
        me.taps = 0;
        me.events = [];
        me.sentRev = me.player.rev;
        send(ws, { t: 'joined', code: room.code, id: me.id, player: me.player, hole: room.hole });
        sendRoom(room);
        return;
      }

      if (++me.msgs > MAX_MSGS_PER_SECOND) { ws.close(4001, 'Too many messages'); return; }
      const p = me.player, h = room.hole;
      switch (msg.t) {
        case 'hold': me.holding = msg.on === true; break;
        case 'tap': me.taps = Math.min(me.taps + 1, 2); break;
        case 'buy': {
          const n = Math.max(1, Math.min(100, Math.floor(Number(msg.n) || 1)));
          const id = typeof msg.id === 'string' ? msg.id.slice(0, 32) : '';
          if (msg.k === 'tool') buyTool(p, h);
          else if (msg.k === 'upgrade') buyUpgrade(p, h, id, n);
          else if (msg.k === 'helper') buyHelper(p, h, id, n);
          else if (msg.k === 'node') buyNode(p, id);
          break;
        }
        case 'rebirth': rebirth(p, h, me.events); break;
        case 'travel': {
          const events: SimEvent[] = [];
          if (travel(p, h, events)) for (const m of online(room)) m.events.push(...events);
          break;
        }
      }
    });

    ws.on('close', () => {
      if (me && me.ws === ws) { me.ws = null; me.holding = false; }
      if (room) sendRoom(room);
    });
    ws.on('error', () => ws.close());
  });

  function ranks(): RoomRank[] {
    return [...rooms.values()]
      .filter((r) => r.hole.depth > 0 || r.hole.planet > 0)
      .sort((a, b) => b.hole.planet - a.hole.planet || b.hole.depth - a.hole.depth)
      .slice(0, 10)
      .map((r) => ({ code: r.code, depth: r.hole.depth, planet: r.hole.planet, players: r.members.size }));
  }
  function sendRoom(room: Room): void {
    const peers: PeerInfo[] = [...room.members.values()]
      .sort((a, b) => b.dug - a.dug)
      .map((m) => ({ id: m.id, name: m.name, tool: m.player.tool, dug: m.dug, hits: m.hits, online: m.ws !== null }));
    const global = ranks();
    for (const m of online(room)) send(m.ws, { t: 'room', peers, global });
  }

  // ---------------------------------------------------------------- the simulation loop
  let tickCount = 0;
  let last = Date.now();
  const loop = setInterval(() => {
    const now = Date.now();
    const dt = Math.min(1000, now - last);
    last = now;
    tickCount++;
    for (const room of rooms.values()) {
      const players = online(room);
      if (players.length === 0) continue;
      room.touched = now;
      const shared: SimEvent[] = [];
      tickHole(room.hole, dt, shared);
      for (const m of players) {
        const before = room.hole.depth, planet = room.hole.planet;
        const own: SimEvent[] = [];
        tickPlayer(m.player, room.hole, dt, own);
        if (m.holding || m.taps > 0) {
          if (hit(m.player, room.hole, own)) {
            m.hits++;
            if (m.taps > 0) m.taps--;
            room.peerHits.add(m.id);
          }
        }
        if (room.hole.planet === planet) m.dug += Math.max(0, room.hole.depth - before);
        for (const e of own) {
          if (HOLE_EVENTS.has(e.type)) {
            shared.push(e);
            if (e.type === 'core') for (const other of room.members.values()) if (other !== m) awardCompletion(other.player, room.hole);
          } else m.events.push(e);
        }
      }
      if (shared.length) for (const m of players) m.events.push(...shared);

      if (tickCount % SEND_EVERY === 0) {
        const hitters = [...room.peerHits];
        room.peerHits.clear();
        for (const m of players) {
          const p = m.player;
          if (p.rev !== m.sentRev) { m.sentRev = p.rev; send(m.ws, { t: 'p', player: p }); }
          send(m.ws, { t: 's', hole: room.hole, cash: p.cash, combo: p.combo, run: p.run, hits: p.counters.hits, ev: m.events, ph: hitters.filter((id) => id !== m.id) });
          m.events = [];
        }
      }
      if (tickCount % ROOM_EVERY === 0) {
        sendRoom(room);
        for (const m of players) m.msgs = 0;
      }
    }
  }, TICK_MS);
  const saver = setInterval(save, SAVE_EVERY_MS);

  http.listen(opts.port, () => log(`Dig to the Earth's Core server on :${opts.port}${staticDir ? ` (serving ${staticDir})` : ''}`));

  return {
    http, rooms, save,
    close: () => new Promise<void>((done) => {
      clearInterval(loop);
      clearInterval(saver);
      save();
      for (const c of wss.clients) c.terminate();
      wss.close(() => http.close(() => done()));
    }),
  };
}

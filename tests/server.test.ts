import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { startServer } from '../server/server';
import type { ClientMsg, ServerMsg } from '../src/shared/protocol';

const PORT = 18787;
const dataFile = join(mkdtempSync(join(tmpdir(), 'dig-')), 'rooms.json');
let server: ReturnType<typeof startServer>;

beforeAll(() => { server = startServer({ port: PORT, dataFile, quiet: true }); });
afterAll(async () => { await server.close(); });

class Client {
  ws = new WebSocket(`ws://localhost:${PORT}`);
  msgs: ServerMsg[] = [];
  constructor() { this.ws.on('message', (d) => this.msgs.push(JSON.parse(String(d)) as ServerMsg)); }
  open() { return new Promise<void>((res) => this.ws.on('open', () => res())); }
  send(m: ClientMsg | Record<string, unknown>) { this.ws.send(JSON.stringify(m)); }
  async wait<T extends ServerMsg['t']>(t: T, ms = 3000): Promise<Extract<ServerMsg, { t: T }>> {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      const i = this.msgs.findIndex((m) => m.t === t);
      if (i >= 0) return this.msgs.splice(i, 1)[0] as Extract<ServerMsg, { t: T }>;
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error(`no "${t}" message`);
  }
  last<T extends ServerMsg['t']>(t: T) { return [...this.msgs].reverse().find((m) => m.t === t) as Extract<ServerMsg, { t: T }> | undefined; }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('co-op server', () => {
  it('creates a room, lets a second player join by code, and shares one hole', async () => {
    const a = new Client(), b = new Client();
    await Promise.all([a.open(), b.open()]);
    a.send({ t: 'hello', kind: 'create', code: '', name: 'Ann', token: 'token-ann-0001' });
    const ja = await a.wait('joined');
    expect(ja.code).toMatch(/^[A-Z2-9]{5}$/);
    b.send({ t: 'hello', kind: 'join', code: ja.code.toLowerCase(), name: 'Bob<script>', token: 'token-bob-0001' });
    const jb = await b.wait('joined');
    expect(jb.code).toBe(ja.code);
    expect(jb.id).not.toBe(ja.id);

    a.send({ t: 'hold', on: true });
    await sleep(1300);
    const sa = a.last('s')!, sb = b.last('s')!;
    expect(sa.hole.depth).toBeGreaterThan(0);
    expect(sb.hole.depth).toBeCloseTo(sa.hole.depth, 2);   // Bob sees Ann's digging
    expect(sa.cash).toBeGreaterThan(0);
    expect(sb.cash).toBe(0);                                // but cash is Ann's own
    expect(b.msgs.some((m) => m.t === 's' && m.ph.includes(ja.id))).toBe(true); // and sees her swing

    const room = b.last('room')!;
    expect(room.peers.map((p) => p.name).sort()).toEqual(['Ann', 'Bobscript']);
    expect(room.peers[0].name).toBe('Ann');                 // contribution leaderboard: Ann dug it all
    expect(room.peers[0].dug).toBeGreaterThan(0);
    expect(room.peers[1].dug).toBe(0);
    expect(room.global[0].code).toBe(ja.code);              // deepest-dig leaderboard
    a.ws.close(); b.ws.close();
  });

  it('is authoritative: clients cannot set depth, cash or buy what they cannot afford', async () => {
    const c = new Client();
    await c.open();
    c.send({ t: 'hello', kind: 'create', code: '', name: 'Cheat', token: 'token-cheat-001' });
    const j = await c.wait('joined');
    c.send({ t: 's', hole: { depth: 6_000_000 }, cash: 1e30 });
    c.send({ t: 'depth', value: 6_000_000 });
    c.send({ t: 'buy', k: 'tool' });
    c.send({ t: 'buy', k: 'upgrade', id: 'power', n: 1e9 });
    c.send({ t: 'buy', k: 'helper', id: '__proto__', n: 5 });
    c.send({ t: 'rebirth' });
    for (let i = 0; i < 40; i++) c.send({ t: 'tap' });      // tap spam cannot beat the swing cooldown
    await sleep(700);
    const s = c.last('s')!;
    const room = server.rooms.get(j.code)!;
    const member = [...room.members.values()][0];
    expect(s.hole.depth).toBeLessThan(0.01);
    expect(member.player.tool).toBe(0);
    expect(member.player.upgrades.power ?? 0).toBe(0);
    expect(member.player.prestige.rebirths).toBe(0);
    expect(member.hits).toBeLessThanOrEqual(4);
    c.ws.close();
  });

  it('rejects unknown rooms and keeps progress for a returning player', async () => {
    const x = new Client();
    await x.open();
    x.send({ t: 'hello', kind: 'join', code: 'ZZZZZ', name: 'X', token: 'token-x-000001' });
    expect((await x.wait('err')).msg).toMatch(/No room/);
    x.ws.close();

    const d = new Client();
    await d.open();
    d.send({ t: 'hello', kind: 'create', code: '', name: 'Dee', token: 'token-dee-0001' });
    const j = await d.wait('joined');
    d.send({ t: 'hold', on: true });
    await sleep(800);
    const cash = d.last('s')!.cash;
    d.ws.close();
    await sleep(200);
    server.save();

    const again = new Client();
    await again.open();
    again.send({ t: 'hello', kind: 'join', code: j.code, name: 'Dee', token: 'token-dee-0001' });
    const j2 = await again.wait('joined');
    expect(j2.id).toBe(j.id);
    expect(j2.player.cash).toBeGreaterThanOrEqual(cash);
    expect(j2.hole.depth).toBeGreaterThan(0);
    again.ws.close();
  });
});

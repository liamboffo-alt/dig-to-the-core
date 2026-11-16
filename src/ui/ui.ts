// HUD, panels, toasts and modals. Plain DOM over the canvas: it reads the session and
// calls its methods, and never touches simulation state directly.

import {
  ACHIEVEMENTS, BALANCE, FINDS, FIND_SETS, HELPERS, LAYERS, MILESTONES, ORES, PRESTIGE_NODES, TOOLS, UPGRADES,
} from '../data';
import type { Session, Settings } from '../game/session';
import {
  CORE_DEPTH, atBarrier, barrierMaxHp, burstMs, expectedDps, expectedIncome, formatDepth, formatNumber,
  formatPercent, formatTime, getStats, helperCost, layerIndex, layerProgress, nodeCost, nodeUnlocked,
  pendingShards, planetAt, progressDepth, shardsForDepth, toolCost, upgradeCost,
} from '../sim';
import './style.css';

export interface UIDeps {
  session: () => Session;
  settings: Settings;
  onSettings: () => void;
  sound: { buy(): void; buyTool(): void; deny(): void; click(): void };
  exportSave: () => string | null;
  importSave: (text: string) => string | null; // returns an error message, or null on success
  resetSave: () => void;
  coopConnect: (kind: 'create' | 'join', code: string, name: string) => void;
  coopLeave: () => void;
}

const money = (n: number) => '$' + formatNumber(n);
const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

type TabId = 'shop' | 'crew' | 'book' | 'rebirth' | 'more';
const TABS: { id: TabId; icon: string; label: string }[] = [
  { id: 'shop', icon: '⛏️', label: 'Upgrade' },
  { id: 'crew', icon: '👷', label: 'Helpers' },
  { id: 'book', icon: '📖', label: 'Book' },
  { id: 'rebirth', icon: '♻️', label: 'Rebirth' },
  { id: 'more', icon: '⚙️', label: 'More' },
];

export class UI {
  readonly stage: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  private el: Record<string, HTMLElement> = {};
  private text = new Map<HTMLElement, string>();
  private floaters: HTMLElement[] = [];
  private floaterNext = 0;
  private tab: TabId | null = null;
  private updaters: (() => void)[] = [];
  private panelKey = '';
  private refreshIn = 0;
  private amount = 1;
  private bookTab = 'finds';
  private selectedNode = 'might';
  private repeat: number | null = null;
  private wide = false;
  private hintShown = true;
  private comboShown = 0;
  /** Where floating numbers appear, in stage pixels. main.ts keeps this current. */
  anchor = { x: 200, y: 300 };

  constructor(root: HTMLElement, private deps: UIDeps) {
    root.innerHTML = `
      <div id="stage">
        <canvas id="gl"></canvas>
        <div id="floaters"></div>
        <div id="hud">
          <div class="top">
            <div class="card depthbox">
              <div class="layerline"><span id="layer-name"></span><span id="planet-name"></span></div>
              <div id="depth"></div>
              <div class="progress"><div class="bar"><i id="pbar"></i></div><span id="pct"></span><span>to the core</span></div>
              <div id="next"></div>
            </div>
            <div class="card wallet">
              <div id="cash"></div>
              <div class="rate"><span id="rate"></span>/s</div>
              <div id="shards-wrap" hidden>◆ <span id="shards"></span></div>
            </div>
          </div>
          <div id="meter">${LAYERS.map((l) => `<i style="background:${hex(l.look.wall)}"></i>`).join('')}<div id="meter-mark"></div></div>
          <div id="boss" hidden>
            <div id="boss-name"></div><div id="boss-sub"></div>
            <div class="bossbar"><i id="boss-hp"></i></div>
            <div class="timebar"><i id="boss-time"></i></div>
            <div id="boss-need"></div>
          </div>
          <div id="combo"></div>
          <div id="hint">👆 Tap or hold to dig</div>
          <div id="room" class="card" hidden></div>
          <div id="banner"><b></b><span></span></div>
        </div>
        <div id="toasts"></div>
        <div id="flash"></div>
      </div>
      <div id="dock">
        <nav id="tabs">${TABS.map((t) => `<button data-tab="${t.id}"><span>${t.icon}</span>${t.label}</button>`).join('')}</nav>
        <section id="panel"></section>
      </div>
      <div id="modal" hidden></div>`;
    this.stage = $('#stage');
    this.canvas = $<HTMLCanvasElement>('#gl');
    for (const id of ['layer-name', 'planet-name', 'depth', 'pbar', 'pct', 'next', 'cash', 'rate', 'shards-wrap', 'shards',
      'meter-mark', 'boss', 'boss-name', 'boss-sub', 'boss-hp', 'boss-time', 'boss-need', 'combo', 'hint', 'room',
      'banner', 'toasts', 'flash', 'floaters', 'panel', 'dock', 'tabs', 'modal']) this.el[id] = $('#' + id);
    for (let i = 0; i < 26; i++) {
      const f = document.createElement('div');
      f.className = 'floater';
      this.el.floaters.appendChild(f);
      this.floaters.push(f);
    }

    this.el.tabs.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button[data-tab]') as HTMLElement | null;
      if (!b) return;
      deps.sound.click();
      const id = b.dataset.tab as TabId;
      this.openTab(this.tab === id && !this.wide ? null : id);
    });
    const panel = this.el.panel;
    panel.addEventListener('pointerdown', (e) => {
      const b = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
      if (!b) return;
      const act = b.dataset.act!;
      this.act(act);
      this.stopRepeat();
      if (/^(upgrade|helper):/.test(act)) {
        this.repeat = window.setTimeout(() => {
          this.repeat = window.setInterval(() => this.act(act), 90);
        }, 380);
      }
    });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) panel.addEventListener(ev, () => this.stopRepeat());

    const mq = matchMedia('(min-width: 900px) and (min-aspect-ratio: 1/1)');
    const onMq = () => { this.wide = mq.matches; if (this.wide && !this.tab) this.openTab('shop'); };
    mq.addEventListener('change', onMq);
    onMq();
  }

  private stopRepeat(): void {
    if (this.repeat != null) { clearTimeout(this.repeat); clearInterval(this.repeat); this.repeat = null; }
  }

  private set(el: HTMLElement, value: string): void {
    if (this.text.get(el) !== value) { this.text.set(el, value); el.textContent = value; }
  }

  // ------------------------------------------------------------ feedback

  floater(text: string, kind: '' | 'crit' | 'cash' = '', color = ''): void {
    const f = this.floaters[this.floaterNext++ % this.floaters.length];
    f.className = 'floater ' + kind;
    f.textContent = text;
    f.style.color = color;
    f.style.setProperty('--x', `${this.anchor.x + (Math.random() - 0.5) * 120 - 30}px`);
    f.style.setProperty('--y', `${this.anchor.y - 30 + (Math.random() - 0.5) * 50}px`);
    f.style.setProperty('--dx', `${(Math.random() - 0.5) * 70}px`);
    void f.offsetWidth; // restart the animation
    f.classList.add('go');
  }

  toast(icon: string, title: string, sub = ''): void {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<span class="ic">${icon}</span><div><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
    this.el.toasts.appendChild(t);
    while (this.el.toasts.children.length > 3) this.el.toasts.firstElementChild!.remove();
    setTimeout(() => t.remove(), 3500);
  }

  banner(title: string, sub = ''): void {
    const b = this.el.banner;
    b.firstElementChild!.textContent = title;
    b.lastElementChild!.textContent = sub;
    b.classList.remove('go');
    void b.offsetWidth;
    b.classList.add('go');
  }

  flash(color = '#fff', strength = 0.8): void {
    const f = this.el.flash;
    f.style.transition = 'none';
    f.style.background = color;
    f.style.opacity = String(strength);
    void f.offsetWidth;
    f.style.transition = 'opacity .7s ease-out';
    f.style.opacity = '0';
  }

  modal(html: string, actions: Record<string, () => void> = {}): void {
    const m = this.el.modal;
    m.innerHTML = `<div class="sheet">${html}</div>`;
    m.hidden = false;
    m.onclick = (e) => {
      const b = (e.target as HTMLElement).closest('[data-do]') as HTMLElement | null;
      if (!b) return;
      this.deps.sound.click();
      m.hidden = true;
      actions[b.dataset.do!]?.();
    };
  }
  get modalOpen(): boolean { return !this.el.modal.hidden; }

  showOffline(report: { seconds: number; cash: number; dug: number }): void {
    this.modal(`<h2>Welcome back!</h2>
      <p>Your helpers kept digging for <b>${formatTime(report.seconds)}</b> while you were away.</p>
      <div class="stat">+${money(report.cash)}</div>
      <p>${report.dug > 0 ? `and dug ${formatDepth(report.dug)} deeper` : 'They are stuck at a barrier: only you can break it.'}</p>
      <button class="big gold" data-do="ok">Back to work</button>`);
  }

  showEnding(shards: number, onTravel: () => void): void {
    const s = this.deps.session();
    const c = s.player.counters;
    const planet = planetAt(s.hole.planet);
    const next = planetAt(s.hole.planet + 1);
    this.modal(`<h2>🌍 You reached the centre of ${esc(planet.name)}!</h2>
      <p>${formatDepth(CORE_DEPTH)} straight down. It started with a spoon.</p>
      <div class="stat s">+◆ ${formatNumber(shards)} Core Shards</div>
      <div class="kv">
        <div><b>${formatTime(c.playSeconds)}</b>time played</div><div><b>${formatNumber(c.hits)}</b>swings</div>
        <div><b>${c.rebirths}</b>rebirths</div><div><b>${money(c.cashEarned)}</b>earned</div>
        <div><b>${c.barriers}</b>barriers broken</div><div><b>${c.uniqueFinds}/${FINDS.length}</b>rare finds</div>
      </div>
      <p><b>${esc(next.name)}</b> is now unlocked. ${esc(next.desc)} You keep your shards, prestige tree and collection.</p>
      <button class="big gold" data-do="travel">🚀 Travel to ${esc(next.name)}</button>
      <button class="btn" data-do="stay">Stay and admire the core</button>`, { travel: onTravel });
  }

  // ------------------------------------------------------------ per-frame HUD

  update(dtMs: number): void {
    const s = this.deps.session();
    const p = s.player, h = s.hole, e = this.el;
    const stats = getStats(p, h.planet);
    const li = layerIndex(h);

    this.set(e['layer-name'], LAYERS[li].name);
    this.set(e['planet-name'], h.planet > 0 ? planetAt(h.planet).name : '');
    this.set(e.depth, formatDepth(h.depth));
    const frac = h.depth / CORE_DEPTH;
    this.set(e.pct, formatPercent(frac));
    e.pbar.style.width = (frac * 100).toFixed(3) + '%';
    e['meter-mark'].style.top = `calc(${(layerProgress(h.depth) / LAYERS.length) * 100}% - 2px)`;

    const mine = progressDepth(p, h);
    const ms = MILESTONES[p.run.milestone];
    if (h.complete) this.set(e.next, 'You are at the centre of the planet.');
    else if (ms) this.set(e.next, `Next: ${ms.name} in ${formatDepth(Math.max(0, ms.depth - Math.max(mine, p.run.maxDepth)))}`);
    else this.set(e.next, `Core in ${formatDepth(CORE_DEPTH - h.depth)}`);

    this.set(e.cash, money(p.cash));
    this.set(e.rate, money(expectedIncome(p, h)));
    const hasShards = p.prestige.totalShards > 0;
    if (e['shards-wrap'].hidden === hasShards) e['shards-wrap'].hidden = !hasShards;
    if (hasShards) this.set(e.shards, formatNumber(p.prestige.shards));

    // Barrier
    const blocked = atBarrier(h);
    if (e.boss.hidden === blocked) e.boss.hidden = !blocked;
    if (blocked) {
      const max = barrierMaxHp(h.planet, li);
      const hp = h.barrierHp < 0 ? max : h.barrierHp;
      this.set(e['boss-name'], '🧱 ' + LAYERS[li].barrier.name);
      this.set(e['boss-sub'], `${formatNumber(hp)} / ${formatNumber(max)}`);
      e['boss-hp'].style.width = (hp / max) * 100 + '%';
      e['boss-time'].style.width = (h.barrierTimer > 0 ? (h.barrierTimer / burstMs(h.planet)) * 100 : 100) + '%';
      const burst = (expectedDps(stats) * stats.boss * burstMs(h.planet)) / 1000;
      this.set(e['boss-need'], burst >= max
        ? `Break it within ${burstMs(h.planet) / 1000}s. Keep digging!`
        : `Too tough: your ${burstMs(h.planet) / 1000}s burst is ~${formatNumber(burst)}. Upgrade${pendingShards(p, h) > 0 ? ' or rebirth' : ''}.`);
    }

    // Combo
    const combo = p.combo;
    if (combo >= 5) {
      if (combo !== this.comboShown) {
        this.comboShown = combo;
        e.combo.innerHTML = `x${combo}<small>${combo >= stats.comboMax ? 'MAX COMBO' : 'COMBO'}</small>`;
        e.combo.style.opacity = '1';
        e.combo.style.transform = `scale(${1 + Math.min(0.5, combo / 120)})`;
        e.combo.style.color = combo >= stats.comboMax ? '#ff7043' : '';
      }
    } else if (this.comboShown) { this.comboShown = 0; e.combo.style.opacity = '0'; }

    if (this.hintShown && p.counters.hits > 3) { this.hintShown = false; e.hint.hidden = true; }

    // Co-op strip
    const roomText = s.mode === 'coop' ? `${s.roomCode ? 'Room ' + s.roomCode + ' · ' : ''}${s.status || s.peers.length + ' digging'}` : '';
    if (e.room.hidden === (roomText !== '')) e.room.hidden = roomText === '';
    if (roomText) this.set(e.room, roomText);

    // Panel + tab badges, five times a second
    this.refreshIn -= dtMs;
    if (this.refreshIn <= 0) {
      this.refreshIn = 200;
      const key = `${this.tab}|${s.mode}|${p.tool}|${p.prestige.rebirths}|${h.planet}|${this.bookTab}|${this.tab === 'book' || this.tab === 'more' ? p.rev : 0}|${s.roomCode}|${s.status}`;
      if (key !== this.panelKey) { this.panelKey = key; this.buildPanel(); }
      for (const u of this.updaters) u();
      const tabs = e.tabs.children;
      tabs[0].classList.toggle('badge', p.cash >= toolCost(p, stats));
      tabs[3].classList.toggle('badge', pendingShards(p, h) > 0 && (h.complete || blocked && h.barrierHp < 0)
        || PRESTIGE_NODES.some((n) => nodeUnlocked(p, n) && (p.prestige.nodes[n.id] ?? 0) < n.max && nodeCost(n, p.prestige.nodes[n.id] ?? 0) <= p.prestige.shards));
    }
  }

  // ------------------------------------------------------------ panels

  openTab(id: TabId | null): void {
    this.tab = id;
    this.el.dock.classList.toggle('open', id !== null);
    [...this.el.tabs.children].forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.tab === id));
    this.panelKey = '';
    this.refreshIn = 0;
    this.el.panel.scrollTop = 0;
  }

  private act(act: string): void {
    const s = this.deps.session();
    const [kind, id] = act.split(':');
    const snd = this.deps.sound;
    const count = this.amount;
    let ok: boolean | null = null;
    if (kind === 'tool') { ok = s.buyTool(); if (ok) { snd.buyTool(); return; } }
    else if (kind === 'upgrade') ok = s.buyUpgrade(id, count);
    else if (kind === 'helper') ok = s.buyHelper(id, count);
    else if (kind === 'node') {
      if (this.selectedNode !== id) { this.selectedNode = id; snd.click(); this.panelKey = ''; this.refreshIn = 0; return; }
      ok = s.buyNode(id);
    }
    else if (kind === 'buynode') ok = s.buyNode(this.selectedNode);
    else if (kind === 'amount') { this.amount = Number(id); snd.click(); this.panelKey = ''; this.refreshIn = 0; return; }
    else if (kind === 'book') { this.bookTab = id; snd.click(); this.refreshIn = 0; return; }
    else if (kind === 'rebirth') { this.confirmRebirth(); return; }
    else if (kind === 'travel') { snd.click(); s.travel(); return; }
    else this.moreAction(kind);
    if (ok === true) snd.buy();
    else if (ok === false) { snd.deny(); this.stopRepeat(); }
    for (const u of this.updaters) u();
  }

  private confirmRebirth(): void {
    const s = this.deps.session();
    const gain = pendingShards(s.player, s.hole);
    if (gain < 1) { this.deps.sound.deny(); return; }
    const now = getStats(s.player, s.hole.planet).rebirthMult;
    const after = 1 + BALANCE.rebirth.multPerShard * Math.pow(s.player.prestige.totalShards + gain, BALANCE.rebirth.multExp);
    this.modal(`<h2>♻️ Rebirth?</h2>
      <p>You go back to the surface with ${s.mode === 'coop' ? 'your cash, tools, upgrades and helpers reset (the shared hole stays)' : 'depth, cash, tools, upgrades and helpers reset'}.</p>
      <div class="stat s">+◆ ${formatNumber(gain)} Core Shards</div>
      <p>Permanent damage multiplier <b>x${formatNumber(now, 2)}</b> → <b>x${formatNumber(after, 2)}</b>, plus shards to spend in the tree.<br>You keep your collection, achievements and prestige upgrades.</p>
      <button class="big" data-do="go">Rebirth</button><button class="btn" data-do="no">Keep digging</button>`,
      { go: () => s.rebirth() });
  }

  private row(act: string, icon: string, name: string, desc: string, cls = ''): string {
    return `<button class="row ${cls}" data-act="${act}"><span class="ic">${icon}</span><span class="tx"><b>${name}<i></i></b><small>${desc}</small></span><span class="cost"></span></button>`;
  }

  private buildPanel(): void {
    const panel = this.el.panel;
    this.updaters = [];
    if (!this.tab) { panel.innerHTML = ''; return; }
    const s = this.deps.session();
    const p = s.player, h = s.hole;
    const stat = () => getStats(s.player, s.hole.planet);
    const seg = `<div class="seg">${[1, 10, 100].map((n) => `<button data-act="amount:${n}" class="${this.amount === n ? 'on' : ''}">Buy x${n}</button>`).join('')}</div>`;
    const q = (act: string) => $(`[data-act="${act}"]`, panel);

    if (this.tab === 'shop') {
      const next = TOOLS[p.tool + 1];
      const cur = TOOLS[p.tool];
      let html = '<h3>Tool</h3>';
      html += next
        ? `<button class="row tool" data-act="tool"><span class="ic" style="background:${hex(next.color)}"></span><span class="tx"><b>${next.name}</b><small>${next.desc}</small><small>Power ${formatNumber(cur.power)} → ${formatNumber(next.power)} (x${formatNumber(next.power / cur.power, 1)})</small></span><span class="cost"></span></button>`
        : `<div class="note">You hold the <b>${cur.name}</b>: the best tool there is.</div>`;
      html += `<div class="note">Now: <b>${cur.name}</b> · <span id="s-hit"></span> per hit · <span id="s-dps"></span> damage/s</div><h3>Upgrades</h3>${seg}`;
      html += UPGRADES.map((u) => this.row('upgrade:' + u.id, u.icon, u.name, u.desc)).join('');
      panel.innerHTML = html;
      if (next) {
        const b = q('tool'), cost = $('.cost', b);
        this.updaters.push(() => {
          const c = toolCost(s.player, stat());
          this.set(cost, money(c));
          b.classList.toggle('cant', s.player.cash < c);
        });
      }
      const hitEl = $('#s-hit', panel), dpsEl = $('#s-dps', panel);
      this.updaters.push(() => { this.set(hitEl, formatNumber(stat().hitDamage, 1)); this.set(dpsEl, formatNumber(expectedDps(stat()), 1)); });
      for (const u of UPGRADES) {
        const b = q('upgrade:' + u.id), lv = $('b i', b), cost = $('.cost', b);
        this.updaters.push(() => {
          const level = s.player.upgrades[u.id] ?? 0;
          const maxed = u.max != null && level >= u.max;
          this.set(lv, `Lv ${level}${u.max ? '/' + u.max : ''}`);
          const c = upgradeCost(u, level, stat());
          this.set(cost, maxed ? 'MAX' : money(c));
          b.classList.toggle('max', maxed);
          b.classList.toggle('cant', !maxed && s.player.cash < c);
        });
      }
    } else if (this.tab === 'crew') {
      panel.innerHTML = `<div class="note">Helpers dig on their own, even while the game is closed (<span id="c-off"></span>). They cannot break barriers without you.<br>Crew output: <b id="c-dps"></b> damage/s</div>${seg}`
        + HELPERS.map((d) => this.row('helper:' + d.id, d.icon, d.name, d.desc)).join('');
      const dps = $('#c-dps', panel), off = $('#c-off', panel);
      this.updaters.push(() => {
        const st = stat();
        this.set(dps, formatNumber(st.helperDps, 1));
        this.set(off, s.mode === 'coop' ? 'solo only' : `${Math.round(st.offlineEff * 100)}% speed, up to ${st.offlineCapH}h`);
      });
      HELPERS.forEach((d, i) => {
        const b = q('helper:' + d.id), lv = $('b i', b), cost = $('.cost', b), small = $('small', b);
        this.updaters.push(() => {
          const st = stat();
          const owned = s.player.helpers[d.id] ?? 0;
          // Only show a helper once the one before it is owned or it is nearly affordable.
          const visible = i === 0 || owned > 0 || (s.player.helpers[HELPERS[i - 1].id] ?? 0) > 0 || s.player.cash >= d.cost * 0.2;
          b.style.display = visible ? '' : 'none';
          if (!visible) return;
          const c = helperCost(d, owned, st);
          this.set(lv, owned ? `x${owned}` : '');
          this.set(small, `${formatNumber(d.dps * st.helper * st.damage, 1)} damage/s each · ${d.desc}`);
          this.set(cost, money(c));
          b.classList.toggle('cant', s.player.cash < c);
        });
      });
    } else if (this.tab === 'book') {
      const tabs = [['finds', 'Finds'], ['ores', 'Ores'], ['ach', 'Awards'], ['miles', 'Depths']];
      let html = `<div class="seg">${tabs.map(([id, n]) => `<button data-act="book:${id}" class="${this.bookTab === id ? 'on' : ''}">${n}</button>`).join('')}</div>`;
      if (this.bookTab === 'finds') {
        html += `<div class="note">Rare things turn up as you dig. Complete a set for a permanent bonus. Found <b>${p.counters.uniqueFinds}/${FINDS.length}</b>.</div>`;
        for (const set of FIND_SETS) {
          const items = FINDS.filter((f) => f.set === set.id);
          const got = items.filter((f) => p.finds[f.id]).length;
          html += `<div class="setline ${got === items.length ? 'done' : ''}"><span>${set.name} ${got}/${items.length}</span><em>${got === items.length ? '✔ ' : ''}${set.bonusText}</em></div><div class="grid">`;
          html += items.map((f) => p.finds[f.id]
            ? `<div class="cell ${f.rarity}"><span>${f.icon}</span>${f.name}${p.finds[f.id] > 1 ? ' x' + p.finds[f.id] : ''}</div>`
            : `<div class="cell unknown"><span>❔</span>${f.rarity}</div>`).join('');
          html += '</div>';
        }
      } else if (this.bookTab === 'ores') {
        html += '<div class="note">Ores and gems found so far. Each one pays a multiple of the hit that uncovered it.</div>';
        LAYERS.forEach((L, i) => {
          html += `<h3>${L.name}</h3>`;
          for (const o of L.ores) {
            const ore = ORES.find((x) => x.id === o.id)!;
            const n = p.ores[o.id] ?? 0;
            html += `<div class="li ${n ? '' : 'off'}"><span class="ic"><span class="dot" style="background:${hex(ore.color)}"></span></span><div>${n || i <= layerIndex(h) ? ore.name : '???'}<small>x${ore.value} cash</small></div><span class="r">${formatNumber(n)}</span></div>`;
          }
        });
      } else if (this.bookTab === 'ach') {
        html += `<div class="note">Awards give small permanent bonuses. Unlocked <b>${Object.keys(p.achievements).length}/${ACHIEVEMENTS.length}</b>.</div>`;
        html += ACHIEVEMENTS.map((a) => `<div class="li ${p.achievements[a.id] ? '' : 'off'}"><span class="ic">${p.achievements[a.id] ? '🏆' : '🔒'}</span><div>${a.name}<small>${a.desc}</small></div><span class="r">+${Math.round(a.reward.value * 100)}% ${a.reward.stat === 'cash' ? 'cash' : 'dmg'}</span></div>`).join('');
      } else {
        html += `<div class="note">Each depth pays cash every run. The first time ever also adds <b>+${BALANCE.milestones.damagePerMilestone * 100}% damage</b> for good.</div>`;
        html += MILESTONES.map((m, i) => `<div class="li ${i < p.milestonesEver ? '' : 'off'}"><span class="ic">${i < p.run.milestone ? '✅' : i < p.milestonesEver ? '☑️' : '🏁'}</span><div>${m.name}<small>${formatDepth(m.depth)}</small></div><span class="r">${m.shards ? '◆ ' + formatNumber(m.shards) : ''}</span></div>`).join('');
      }
      panel.innerHTML = html;
    } else if (this.tab === 'rebirth') {
      const CW = 68, CH = 86;
      const pos = (n: { pos: [number, number] }) => ({ x: n.pos[0] * CW + 4, y: n.pos[1] * CH + 4 });
      let lines = '';
      for (const n of PRESTIGE_NODES) for (const r of n.requires) {
        const a = pos(PRESTIGE_NODES.find((x) => x.id === r)!), b = pos(n);
        lines += `<line x1="${a.x + 30}" y1="${a.y + 36}" x2="${b.x + 30}" y2="${b.y + 36}" stroke="#4a413a" stroke-width="3"/>`;
      }
      panel.innerHTML = `<div class="note">Rebirth resets this run and pays <b>Core Shards</b> for how deep you got. Every shard ever earned raises your permanent damage multiplier, and shards buy upgrades below.<br>
          Multiplier <b id="r-mult"></b> · Shards <b style="color:var(--shard)">◆ <span id="r-shards"></span></b></div>
        <button class="big" data-act="rebirth" id="r-btn"></button>
        <div class="note" id="r-hint"></div>
        ${h.complete ? `<button class="big gold" data-act="travel">🚀 Travel to ${esc(planetAt(h.planet + 1).name)}</button>` : ''}
        <h3>Prestige tree</h3>
        <div class="card" id="node-info" style="margin-bottom:8px"></div>
        <div class="tree"><svg>${lines}</svg>${PRESTIGE_NODES.map((n) => { const a = pos(n); return `<button class="node" data-act="node:${n.id}" style="left:${a.x}px;top:${a.y}px"><span>${n.icon}</span><i></i><em></em></button>`; }).join('')}</div>`;
      const mult = $('#r-mult', panel), sh = $('#r-shards', panel), btn = $('#r-btn', panel), hint = $('#r-hint', panel), info = $('#node-info', panel);
      this.updaters.push(() => {
        const pl = s.player, st = stat();
        const gain = pendingShards(pl, s.hole);
        this.set(mult, 'x' + formatNumber(st.rebirthMult, 2));
        this.set(sh, formatNumber(pl.prestige.shards));
        this.set(btn, gain > 0 ? `♻️ Rebirth for ◆ ${formatNumber(gain)}` : `Rebirth unlocks at ${formatDepth(BALANCE.rebirth.minDepth)}`);
        btn.classList.toggle('cant', gain < 1);
        if (gain > 0) {
          // How much deeper for 25% more shards?
          let lo = pl.run.maxDepth, hi = CORE_DEPTH;
          const want = Math.max(gain + 1, Math.ceil(gain * 1.25));
          for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (shardsForDepth(mid, st.shards) >= want) hi = mid; else lo = mid; }
          this.set(hint, shardsForDepth(CORE_DEPTH, st.shards) >= want ? `Reach ${formatDepth(hi)} for ◆ ${formatNumber(want)}. Deeper layers pay far more.` : 'This is as many shards as one run can pay.');
        } else this.set(hint, `You have dug ${formatDepth(pl.run.maxDepth)} this run.`);
        const sel = PRESTIGE_NODES.find((n) => n.id === this.selectedNode)!;
        const lvl = pl.prestige.nodes[sel.id] ?? 0;
        const html = `<b>${sel.icon} ${sel.name}</b> <span style="color:var(--muted)">Lv ${lvl}/${sel.max}</span><div class="note" style="margin:2px 0 6px">${sel.desc}${nodeUnlocked(pl, sel) ? '' : ' · <b>Locked:</b> needs ' + sel.requires.map((r) => PRESTIGE_NODES.find((x) => x.id === r)!.name).join(', ')}</div>`
          + (lvl >= sel.max ? '<span style="color:var(--accent);font-weight:800">Maxed</span>' : `<button class="btn" data-act="buynode" style="${nodeUnlocked(pl, sel) && pl.prestige.shards >= nodeCost(sel, lvl) ? 'border-color:var(--shard);color:var(--shard)' : 'opacity:.5'}">Buy for ◆ ${formatNumber(nodeCost(sel, lvl))}</button>`);
        if (this.text.get(info) !== html) { this.text.set(info, html); info.innerHTML = html; }
      });
      for (const n of PRESTIGE_NODES) {
        const b = q('node:' + n.id), lv = $('i', b), cost = $('em', b);
        this.updaters.push(() => {
          const pl = s.player;
          const level = pl.prestige.nodes[n.id] ?? 0;
          const open = nodeUnlocked(pl, n);
          this.set(lv, `${level}/${n.max}`);
          this.set(cost, level >= n.max ? 'MAX' : '◆' + formatNumber(nodeCost(n, level)));
          b.className = 'node' + (open ? '' : ' locked') + (level >= n.max ? ' maxed' : open && pl.prestige.shards >= nodeCost(n, level) ? ' can' : '') + (this.selectedNode === n.id ? ' sel' : '');
        });
      }
    } else {
      this.buildMore(panel, s);
    }
  }

  private buildMore(panel: HTMLElement, s: Session): void {
    const set = this.deps.settings;
    const c = s.player.counters;
    let coop: string;
    if (s.mode === 'coop') {
      const lb = s.leaderboards;
      coop = `<div class="note">Room code <b style="font-size:18px;letter-spacing:.15em">${esc(s.roomCode ?? '…')}</b> · ${esc(s.status || 'connected')}<br>Everyone here digs the same hole. Cash and upgrades are your own. Progress in this room is stored on the server, separate from your solo save.</div>
        <h3>This room: metres dug</h3><div id="lb-room"></div>
        <h3>Deepest rooms</h3><div id="lb-global"></div>
        <div class="btns" style="margin-top:10px"><button class="btn danger" data-act="leave">Leave room (back to solo)</button></div>`;
      void lb;
    } else {
      coop = `<div class="note">Dig one shared hole with friends. Rooms keep their own progress on the server, separate from your solo save.${s.status ? `<br><b style="color:var(--bad)">${esc(s.status)}</b>` : ''}</div>
        <input type="text" id="co-name" maxlength="14" placeholder="Your name" value="${esc(set.name)}">
        <div class="btns"><button class="btn" data-act="create">Create a room</button></div>
        <input type="text" id="co-code" maxlength="6" placeholder="Room code" style="text-transform:uppercase">
        <div class="btns"><button class="btn" data-act="join">Join room</button></div>`;
    }
    panel.innerHTML = `<h3>Co-op</h3>${coop}
      <h3>Settings</h3>
      <label class="opt">Sound<input type="checkbox" id="set-sound" ${set.sound ? 'checked' : ''}></label>
      <label class="opt">Volume<input type="range" id="set-vol" min="0" max="1" step="0.05" value="${set.volume}"></label>
      <label class="opt">Screen shake<input type="checkbox" id="set-shake" ${set.shake ? 'checked' : ''}></label>
      ${s.mode === 'solo' ? `<h3>Save</h3>
      <div class="note">The game saves itself every ${BALANCE.autosaveMs / 1000} seconds in this browser. Export a save string to back it up or move it to another device.</div>
      <div class="btns"><button class="btn" data-act="export">Export</button><button class="btn" data-act="import">Import</button><button class="btn danger" data-act="reset">Reset everything</button></div>
      <textarea id="save-text" placeholder="Save string appears here. Paste one and press Import to load it."></textarea>` : ''}
      <h3>Stats</h3>
      <div id="stats"></div>`;
    const stats = $('#stats', panel);
    this.updaters.push(() => {
      const st = getStats(s.player, s.hole.planet);
      const rows: [string, string][] = [
        ['Damage per hit', formatNumber(st.hitDamage, 1)], ['Hits per second', st.speed.toFixed(2)],
        ['Crit', `${Math.round(st.critChance * 100)}% for x${st.critMult.toFixed(1)}`], ['Max combo', `${st.comboMax} (+${Math.round(st.comboMax * BALANCE.combo.damagePerCombo * 100)}%)`],
        ['Damage multiplier', 'x' + formatNumber(st.damage, 2)], ['Cash multiplier', 'x' + formatNumber(st.cash, 2)],
        ['Luck', 'x' + st.luck.toFixed(2)], ['Swings', formatNumber(c.hits)], ['Crits', formatNumber(c.crits)],
        ['Cash earned', money(c.cashEarned)], ['Deepest ever', formatDepth(c.maxDepth)], ['Rebirths', String(c.rebirths)],
        ['Barriers broken', String(c.barriers)], ['Planets finished', String(c.planets)], ['Time played', formatTime(c.playSeconds)],
      ];
      const html = rows.map(([k, v]) => `<div class="li"><div>${k}</div><span class="r">${v}</span></div>`).join('');
      if (this.text.get(stats) !== html) { this.text.set(stats, html); stats.innerHTML = html; }
    });
    if (s.mode === 'coop') {
      const room = $('#lb-room', panel), global = $('#lb-global', panel);
      this.updaters.push(() => {
        const lb = s.leaderboards;
        const total = (lb?.room ?? []).reduce((a, b) => a + b.dug, 0) || 1;
        const a = (lb?.room ?? []).map((r, i) => `<div class="li ${r.online ? '' : 'off'}"><span class="ic">${['🥇', '🥈', '🥉'][i] ?? i + 1}</span><div>${esc(r.name)}${r.me ? ' (you)' : ''}<small>${TOOLS[r.tool]?.name ?? ''} · ${formatNumber(r.hits)} swings</small></div><span class="r">${formatDepth(r.dug)} · ${Math.round((r.dug / total) * 100)}%</span></div>`).join('') || '<div class="note">Nobody has dug yet.</div>';
        const b = (lb?.global ?? []).map((r, i) => `<div class="li"><span class="ic">${i + 1}</span><div>Room ${esc(r.code)}${r.code === s.roomCode ? ' (this one)' : ''}<small>${r.players} digger${r.players === 1 ? '' : 's'}${r.planet > 0 ? ' · ' + planetAt(r.planet).name : ''}</small></div><span class="r">${formatDepth(r.depth)}</span></div>`).join('') || '<div class="note">No rooms yet.</div>';
        if (this.text.get(room) !== a) { this.text.set(room, a); room.innerHTML = a; }
        if (this.text.get(global) !== b) { this.text.set(global, b); global.innerHTML = b; }
      });
    }
    const apply = () => {
      set.sound = $<HTMLInputElement>('#set-sound', panel).checked;
      set.volume = Number($<HTMLInputElement>('#set-vol', panel).value);
      set.shake = $<HTMLInputElement>('#set-shake', panel).checked;
      this.deps.onSettings();
    };
    for (const id of ['#set-sound', '#set-vol', '#set-shake']) $(id, panel).addEventListener('input', apply);
  }

  private moreAction(kind: string): void {
    const panel = this.el.panel;
    const snd = this.deps.sound;
    const area = panel.querySelector('#save-text') as HTMLTextAreaElement | null;
    const name = () => {
      const n = ($<HTMLInputElement>('#co-name', panel)?.value ?? '').trim() || 'Digger';
      this.deps.settings.name = n;
      this.deps.onSettings();
      return n;
    };
    if (kind === 'export' && area) {
      area.value = this.deps.exportSave() ?? '';
      area.select();
      void navigator.clipboard?.writeText(area.value).then(() => this.toast('📋', 'Save string copied'), () => {});
      snd.click();
    } else if (kind === 'import' && area) {
      const err = this.deps.importSave(area.value);
      if (err) { snd.deny(); this.toast('⚠️', 'Import failed', err); } else { this.toast('✅', 'Save loaded'); this.panelKey = ''; }
    } else if (kind === 'reset') {
      this.modal(`<h2>Reset everything?</h2><p>This deletes your solo save for good: depth, shards, collection, all of it.</p>
        <button class="big" style="background:var(--bad)" data-do="yes">Delete my save</button><button class="btn" data-do="no">Cancel</button>`,
        { yes: () => { this.deps.resetSave(); this.panelKey = ''; } });
    } else if (kind === 'create') { snd.click(); this.deps.coopConnect('create', '', name()); }
    else if (kind === 'join') {
      const code = $<HTMLInputElement>('#co-code', panel).value.trim().toUpperCase();
      if (code.length < 4) { snd.deny(); this.toast('⚠️', 'Enter the room code first'); return; }
      snd.click();
      this.deps.coopConnect('join', code, name());
    } else if (kind === 'leave') { snd.click(); this.deps.coopLeave(); }
  }
}

import { Sfx } from './audio/sfx';
import { ACHIEVEMENTS, FINDS, FIND_SETS, LAYERS, MILESTONES, ORES, TOOLS } from './data';
import { SoloSession, loadSettings, saveSettings, type Session } from './game/session';
import { GameScene, pickQuality } from './render/scene';
import {
  atBarrier, barrierMaxHp, formatNumber, getStats, layerIndex, planetAt, type SimEvent,
} from './sim';
import { UI } from './ui/ui';

const settings = loadSettings();
const sfx = new Sfx();
sfx.setVolume(settings.volume, settings.sound);

const loaded = SoloSession.load();
let solo = loaded.session;
let session: Session = solo;

const ui = new UI(document.getElementById('app')!, {
  session: () => session,
  settings,
  onSettings: () => {
    saveSettings(settings);
    sfx.setVolume(settings.volume, settings.sound);
    scene.shakeScale = settings.shake ? 1 : 0;
  },
  sound: sfx,
  exportSave: () => solo.exportString(),
  importSave: (text) => {
    try {
      solo = SoloSession.importString(text);
      session = solo;
      scene.endFinale();
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Unknown error';
    }
  },
  resetSave: () => {
    SoloSession.wipe();
    solo = SoloSession.load().session;
    session = solo;
    scene.endFinale();
  },
  coopConnect: (kind, code, name) => { void connectCoop(kind, code, name); },
  coopLeave: () => leaveCoop(),
});

const scene = new GameScene(ui.canvas, pickQuality());
scene.shakeScale = settings.shake ? 1 : 0;

// ---------------------------------------------------------------- co-op (loaded on demand)

async function connectCoop(kind: 'create' | 'join', code: string, name: string): Promise<void> {
  const { CoopSession } = await import('./game/coop');
  solo.save();
  solo.status = '';
  const coop = new CoopSession(settings.server, kind, code, name, {
    onJoined: () => {
      session = coop;
      scene.endFinale();
      ui.toast('🤝', `Joined room ${coop.roomCode}`, 'Share the code so friends can dig with you');
    },
    onClosed: (reason) => {
      if (session === coop) { session = solo; scene.endFinale(); }
      solo.status = reason;
      ui.toast('🔌', 'Co-op disconnected', reason);
    },
  });
}
function leaveCoop(): void {
  if (session.mode !== 'coop') return;
  const old = session;
  session = solo;
  old.dispose();
  scene.endFinale();
}

// ---------------------------------------------------------------- input

function resize(): void {
  const r = ui.stage.getBoundingClientRect();
  scene.resize(Math.max(1, Math.floor(r.width)), Math.max(1, Math.floor(r.height)));
  ui.anchor = scene.hitPoint();
}
new ResizeObserver(resize).observe(ui.stage);
resize();

let pointers = 0;
let keyHeld = false;
ui.stage.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  sfx.unlock();
  pointers++;
  session.setHolding(true);
  session.tap();
});
const release = () => {
  pointers = Math.max(0, pointers - 1);
  if (pointers === 0 && !keyHeld) session.setHolding(false);
};
window.addEventListener('pointerup', release);
window.addEventListener('pointercancel', release);
window.addEventListener('pointerdown', () => sfx.unlock(), { capture: true });
ui.stage.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('keydown', (e) => {
  const tag = (e.target as HTMLElement).tagName;
  if (e.code !== 'Space' || e.repeat || tag === 'INPUT' || tag === 'TEXTAREA') return;
  e.preventDefault();
  sfx.unlock();
  keyHeld = true;
  session.setHolding(true);
  session.tap();
});
window.addEventListener('keyup', (e) => {
  if (e.code !== 'Space') return;
  keyHeld = false;
  if (pointers === 0) session.setHolding(false);
});
window.addEventListener('blur', () => { pointers = 0; keyHeld = false; session.setHolding(false); });

// ---------------------------------------------------------------- events -> juice

const cssColor = (c: number) => '#' + c.toString(16).padStart(6, '0');

function react(events: SimEvent[]): void {
  const p = session.player;
  const stats = getStats(p, session.hole.planet);
  for (const e of events) {
    switch (e.type) {
      case 'hit': {
        const tool = TOOLS[p.tool];
        scene.hit(e.crit, e.barrier);
        sfx.hit(tool.sound, e.combo, stats.comboMax, e.crit);
        ui.floater((e.crit ? 'CRIT ' : '') + formatNumber(e.damage, 1), e.crit ? 'crit' : '');
        if (e.crit && settings.shake) navigator.vibrate?.(12);
        break;
      }
      case 'ore': {
        const ore = ORES.find((o) => o.id === e.id)!;
        scene.ore(ore.color);
        sfx.ore(Math.min(3, Math.log10(ore.value)));
        ui.floater(`+$${formatNumber(e.cash, 1)} ${ore.name}`, 'cash', cssColor(ore.color));
        break;
      }
      case 'find': {
        const f = FINDS.find((x) => x.id === e.id)!;
        scene.find();
        sfx.find(e.isNew);
        ui.toast(f.icon, e.isNew ? `New find: ${f.name}` : `Found another ${f.name}`,
          `+$${formatNumber(e.cash)}${e.isNew ? ' · added to your Book' : ''}`);
        break;
      }
      case 'setComplete': {
        const set = FIND_SETS.find((x) => x.id === e.id)!;
        sfx.achievement();
        ui.toast('📚', `Set complete: ${set.name}`, set.bonusText + ' forever');
        break;
      }
      case 'milestone': {
        const m = MILESTONES[e.index];
        sfx.milestone();
        ui.toast('🏁', m.name,
          `+$${formatNumber(e.cash)}${e.first ? ' · +3% damage forever' : ''}${e.shards ? ` · +◆ ${formatNumber(e.shards)}` : ''}`);
        break;
      }
      case 'achievement': {
        const a = ACHIEVEMENTS.find((x) => x.id === e.id)!;
        sfx.achievement();
        ui.toast('🏆', a.name, `${a.desc} · +${Math.round(a.reward.value * 100)}% ${a.reward.stat === 'cash' ? 'cash' : 'damage'}`);
        break;
      }
      case 'barrierStart':
        sfx.barrierStart();
        break;
      case 'barrierReset':
        sfx.barrierReset();
        ui.toast('🧱', 'The barrier healed', 'Empty its health bar before the timer runs out');
        break;
      case 'barrierBreak':
        scene.barrierBreak(LAYERS[e.index].barrier.color);
        sfx.barrierBreak();
        ui.flash('#fff', 0.85);
        if (settings.shake) navigator.vibrate?.([30, 40, 80]);
        break;
      case 'layer':
        ui.banner('BREAKTHROUGH!', `Entering the ${LAYERS[e.index].name}`);
        break;
      case 'core': {
        scene.coreFinale();
        sfx.core();
        ui.flash('#fff3b0', 1);
        ui.banner('THE CORE!', `You reached the centre of ${planetAt(session.hole.planet).name}`);
        const shards = Math.floor(planetAt(session.hole.planet).completionShards * stats.shards);
        setTimeout(() => ui.showEnding(shards, () => session.travel()), 4200);
        break;
      }
      case 'rebirth':
        scene.rebirth();
        sfx.rebirth();
        ui.flash('#80d8ff', 0.9);
        ui.banner('REBIRTH', `+◆ ${formatNumber(e.shards)} Core Shards`);
        ui.openTab('rebirth');
        break;
      case 'planet':
        scene.rebirth();
        sfx.rebirth();
        ui.flash('#fff', 1);
        ui.banner(planetAt(e.index).name.toUpperCase(), 'A new world to dig through');
        break;
    }
  }
}

// ---------------------------------------------------------------- loop

let last = performance.now();
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenAt = Date.now();
    session.setHolding(false);
    solo.save();
  } else {
    last = performance.now();
    if (hiddenAt && session === solo) {
      const report = solo.away(Date.now() - hiddenAt);
      if (report) ui.showOffline(report);
    }
    hiddenAt = 0;
  }
});
window.addEventListener('pagehide', () => solo.save());

function frame(now: number): void {
  const dt = Math.min(250, now - last);
  last = now;
  const s = session;
  react(s.update(dt));
  for (const id of s.takePeerHits()) scene.peerHit(id);

  const h = s.hole, p = s.player;
  const li = layerIndex(h);
  const blocked = atBarrier(h);
  scene.setState({
    layer: li,
    tool: p.tool,
    speed: getStats(p, h.planet).speed,
    atBarrier: blocked,
    barrierFrac: blocked && h.barrierHp >= 0 ? h.barrierHp / barrierMaxHp(h.planet, li) : 1,
    helpers: p.helpers,
    peers: s.peers.filter((x) => !x.me && x.online),
    complete: h.complete,
    planetTint: planetAt(h.planet).tint,
  });
  if (h.complete) scene.coreFinale();
  scene.update(dt / 1000);
  scene.render();
  ui.update(dt);
  requestAnimationFrame(frame);
}

if (loaded.offline) ui.showOffline(loaded.offline);
requestAnimationFrame(frame);

// Handy for debugging and for the automated browser checks.
(window as unknown as Record<string, unknown>).__dig = { get session() { return session; }, scene, ui };

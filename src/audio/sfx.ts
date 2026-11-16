// Every sound is synthesised with the Web Audio API: no audio files.

type ToolSound = 'thud' | 'clink' | 'rattle' | 'grind' | 'zap' | 'boom';

export class Sfx {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private noise!: AudioBuffer;
  private lastHit = 0;
  enabled = true;
  volume = 0.6;

  /** Browsers only allow audio after a gesture: call this from the first pointer/key event. */
  unlock(): void {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    this.master = ctx.createGain();
    this.master.gain.value = this.enabled ? this.volume : 0;
    this.master.connect(comp).connect(ctx.destination);
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  setVolume(volume: number, enabled: boolean): void {
    this.volume = volume;
    this.enabled = enabled;
    if (this.ctx) this.master.gain.setTargetAtTime(enabled ? volume : 0, this.ctx.currentTime, 0.02);
  }

  private tone(type: OscillatorType, from: number, to: number, dur: number, gain: number, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.enabled) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, from), t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private burst(freq: number, q: number, dur: number, gain: number, delay = 0, type: BiquadFilterType = 'bandpass'): void {
    const ctx = this.ctx;
    if (!ctx || !this.enabled) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  /** A dig hit. Pitch climbs with the combo; each tool family has its own voice. */
  hit(sound: ToolSound, combo: number, comboMax: number, crit: boolean, quiet = false): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (ctx.currentTime - this.lastHit < 0.045) return; // never stack hits into mush
    this.lastHit = ctx.currentTime;
    const pitch = 1 + Math.min(1, combo / Math.max(1, comboMax)) * 0.9;
    const v = quiet ? 0.35 : 1;
    switch (sound) {
      case 'thud':
        this.tone('sine', 150 * pitch, 55, 0.12, 0.5 * v);
        this.burst(900 * pitch, 0.8, 0.07, 0.25 * v);
        break;
      case 'clink':
        this.tone('triangle', 1250 * pitch, 900 * pitch, 0.09, 0.22 * v);
        this.tone('sine', 170 * pitch, 60, 0.1, 0.4 * v);
        this.burst(2600, 1.2, 0.05, 0.2 * v);
        break;
      case 'rattle':
        for (let i = 0; i < 3; i++) this.tone('square', 95 * pitch, 60, 0.035, 0.18 * v, i * 0.035);
        this.burst(1400 * pitch, 0.7, 0.11, 0.25 * v);
        break;
      case 'grind':
        this.tone('sawtooth', 110 * pitch, 190 * pitch, 0.14, 0.2 * v);
        this.burst(700 * pitch, 2.5, 0.14, 0.35 * v);
        break;
      case 'zap':
        this.tone('sawtooth', 1500 * pitch, 240 * pitch, 0.13, 0.17 * v);
        this.tone('square', 760 * pitch, 120, 0.1, 0.08 * v);
        this.burst(4200, 0.9, 0.06, 0.12 * v);
        break;
      case 'boom':
        this.tone('sine', 120 * pitch, 32, 0.24, 0.6 * v);
        this.tone('triangle', 640 * pitch, 320 * pitch, 0.1, 0.14 * v);
        this.burst(380, 0.6, 0.2, 0.32 * v, 0, 'lowpass');
        break;
    }
    if (crit) {
      this.tone('triangle', 1320 * pitch, 1980 * pitch, 0.16, 0.2 * v);
      this.tone('sine', 1760 * pitch, 2640 * pitch, 0.2, 0.14 * v, 0.04);
      this.burst(5200, 0.7, 0.12, 0.18 * v);
    }
  }

  ore(rarity: number): void {
    const base = 880 + rarity * 180;
    this.tone('triangle', base, base, 0.07, 0.16);
    this.tone('triangle', base * 1.5, base * 1.5, 0.11, 0.16, 0.06);
  }

  private arp(notes: number[], step: number, type: OscillatorType, gain: number, dur = 0.16): void {
    notes.forEach((n, i) => this.tone(type, n, n, dur, gain, i * step));
  }

  buy(): void { this.arp([523, 784], 0.05, 'triangle', 0.18, 0.1); }
  buyTool(): void { this.arp([392, 523, 659, 1047], 0.07, 'square', 0.12, 0.2); this.burst(3000, 0.6, 0.3, 0.1, 0.2); }
  deny(): void { this.tone('square', 130, 100, 0.09, 0.1); }
  click(): void { this.tone('sine', 660, 620, 0.04, 0.1); }
  find(isNew: boolean): void {
    this.arp(isNew ? [659, 880, 1109, 1319, 1760] : [659, 880, 1109], 0.07, 'triangle', 0.2, 0.25);
  }
  milestone(): void { this.arp([523, 659, 784, 1047], 0.09, 'triangle', 0.2, 0.3); }
  achievement(): void { this.arp([784, 988, 1175, 1568], 0.08, 'sine', 0.2, 0.3); }
  barrierStart(): void { this.tone('sawtooth', 70, 110, 0.5, 0.25); this.burst(200, 1, 0.5, 0.2, 0, 'lowpass'); }
  barrierReset(): void { this.tone('sawtooth', 220, 70, 0.4, 0.18); }
  barrierBreak(): void {
    this.tone('sine', 160, 24, 0.9, 0.8);
    this.burst(500, 0.4, 0.9, 0.55, 0, 'lowpass');
    this.burst(3000, 0.5, 0.35, 0.25, 0.03);
    this.arp([392, 523, 659, 784, 1047], 0.08, 'triangle', 0.18, 0.4);
  }
  rebirth(): void {
    this.tone('sawtooth', 80, 1600, 1.1, 0.16);
    this.tone('sine', 160, 3200, 1.1, 0.12);
    this.arp([523, 659, 784, 1047, 1319, 1568], 0.1, 'triangle', 0.2, 0.6);
    this.burst(6000, 0.4, 1.2, 0.12, 0.2, 'highpass');
  }
  core(): void {
    this.tone('sine', 55, 28, 2.5, 0.8);
    this.burst(300, 0.4, 2.2, 0.5, 0, 'lowpass');
    [262, 330, 392, 523, 659, 784, 1047].forEach((n, i) => {
      this.tone('triangle', n, n, 2.6 - i * 0.2, 0.14, 0.3 + i * 0.16);
      this.tone('sine', n * 2, n * 2, 2.2 - i * 0.2, 0.06, 0.3 + i * 0.16);
    });
  }
}

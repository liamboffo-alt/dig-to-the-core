// Derives layer hardness and barrier hp from the pacing you want.   npm run autotune
//
// It plays the scripted player on a fixed schedule (run lengths and where each run should
// end, below) and fits the layers to it:
//   hardness / hardnessEnd  so that each run's damage carries it to its scheduled depth
//   barrier hp              so that breaking it needs a fraction of that run's dps at that moment
// Nothing is written to disk: paste the printed numbers into src/data/layers.ts, then
// run `npm run balance` to see how the stall-based player actually fares.

import { BALANCE, LAYERS } from '../src/data';
import { expectedDps, getStats, type Hole, type Player } from '../src/sim';
import { simulate } from './simPlayer';

// ---- the pacing targets ----
const RUN_MINUTES = Number(process.env.RUN_MIN ?? 21);   // length of a normal run
const FIRST_RUN_MINUTES = Number(process.env.FIRST_MIN ?? 24);
/** Where each run (1-based) should end, in layers cleared: 1.6 = 60% of the way through bedrock. */
const RUN_ENDS = (process.env.ENDS ?? '1.59,2.07,2.55,3.03,3.55,4.03,4.55,5.03,5.55,6.03,6.4,6.75,7').split(',').map(Number);
/** A run that clears a layer should break through this far into the run. */
const BREAK_AT = Number(process.env.BREAK_AT ?? 0.6);
/** The last run should finish the planet this far into the run. */
const FINAL_AT = 0.92;
const BARRIER_FRACTION = Number(process.env.BARRIER ?? 0.3); // of 20 s of expected dps
const SEEDS = [11, 22];
const PASSES = Number(process.env.PASSES ?? 8);
const JUMP = Number(process.env.JUMP ?? 2); // each layer starts this much harder than the last one ended

const N = BALANCE.strataPerLayer;
const runLength = (run: number) => (run === 1 ? FIRST_RUN_MINUTES : RUN_MINUTES) * 60_000;
const depthOf = (lp: number) => {
  const i = Math.min(Math.floor(lp), LAYERS.length - 1), f = lp - i, L = LAYERS[i];
  return L.start > 0 ? L.start * Math.pow(L.end / L.start, f) : L.end * f;
};
/** The run that breaks out of each layer. */
const BREAK_RUN = LAYERS.map((_, i) => RUN_ENDS.findIndex((lp) => lp >= i + 1) + 1);

interface Sample { endDamage: number[]; breakDamage: number[]; breakDps: number[] }

/** Play the fixed schedule. Shards are paid for the scheduled depth, so the result barely depends on hardness. */
function measure(): Sample {
  const runs = RUN_ENDS.length;
  const out: Sample = { endDamage: RUN_ENDS.map(() => 0), breakDamage: LAYERS.map(() => 0), breakDps: LAYERS.map(() => 0) };
  for (const seed of SEEDS) {
    const got = LAYERS.map(() => false);
    let finished = false;
    simulate(seed, 12, false, {
      forceRebirth: (r, time, p) => {
        if (time < runLength(r)) return false;
        out.endDamage[r - 1] += p.run.damage / SEEDS.length;
        if (r >= runs) { finished = true; return false; }
        p.run.maxDepth = depthOf(RUN_ENDS[r - 1]);
        return true;
      },
      probeEveryMs: 5000,
      probe: (_t: number, p: Player, h: Hole) => {
        const run = p.prestige.rebirths + 1;
        LAYERS.forEach((_, i) => {
          const at = (i === LAYERS.length - 1 ? FINAL_AT : i === 0 ? 3.6 / FIRST_RUN_MINUTES : BREAK_AT) * runLength(BREAK_RUN[i]);
          if (!got[i] && run === BREAK_RUN[i] && p.run.timeMs >= at) {
            got[i] = true;
            out.breakDamage[i] += p.run.damage / SEEDS.length;
            out.breakDps[i] += expectedDps(getStats(p, h.planet)) / SEEDS.length;
          }
        });
      },
      stopWhen: () => finished,
      ignoreComplete: true,
    });
  }
  return out;
}

const edge = (i: number, j: number) => {
  const L = LAYERS[i];
  return j <= 0 ? L.start : j >= N ? L.end : L.start > 0 ? L.start * Math.pow(L.end / L.start, j / N) : (L.end * j) / N;
};
/** Work from the top of layer i down to `depth`, for a profile rising from 1 to `ratio`. */
function unitWork(i: number, ratio: number, depth: number): number {
  let work = 0;
  for (let k = 0; k < N; k++) {
    const a = edge(i, k), b = Math.min(edge(i, k + 1), depth);
    if (b > a) work += (b - a) * Math.pow(ratio, k / (N - 1));
  }
  return work;
}

const blend = (oldV: number, newV: number, w: number) => (oldV > 1e200 ? newV : Math.exp(Math.log(oldV) * (1 - w) + Math.log(newV) * w));

for (let pass = 0; pass < PASSES; pass++) {
  const m = measure();
  const weight = pass === 0 ? 1 : 0.5; // damping: the schedule and the hardness feed back on each other
  let top = 0; // cumulative work at the top of the current layer
  let prevEnd = 0;
  LAYERS.forEach((L, i) => {
    const total = Math.max(m.breakDamage[i] - top, m.breakDamage[i] * 0.3);
    // Start each layer a little harder than the last one ended (no cliff after a breakthrough),
    // then let hardness rise through the layer by whatever makes the total work come out right.
    let ratio = 1;
    const start = i > 0 ? prevEnd * JUMP : 0;
    if (i > 0 && start * unitWork(i, 1, L.end) < total) {
      let lo = 1, hi = 1e12;
      for (let it = 0; it < 80; it++) {
        const mid = Math.sqrt(lo * hi);
        if (start * unitWork(i, mid, L.end) < total) lo = mid; else hi = mid;
      }
      ratio = lo;
    }
    const h = total / unitWork(i, ratio, L.end);
    L.hardness = blend(L.hardness, h, weight);
    L.hardnessEnd = blend(L.hardnessEnd, h * ratio, weight);
    L.barrier.hp = blend(L.barrier.hp, m.breakDps[i] * 20 * BARRIER_FRACTION, weight);
    top += total;
    prevEnd = h * ratio;
  });
  if (pass === PASSES - 1 || process.env.VERBOSE) {
    console.log(`pass ${pass + 1}`);
    for (const L of LAYERS) console.log(`  ${L.id.padEnd(13)} hardness: ${L.hardness.toPrecision(2).padEnd(8)} hardnessEnd: ${L.hardnessEnd.toPrecision(2).padEnd(8)} barrier hp: ${L.barrier.hp.toPrecision(2)}`);
  }
}

// Headless balance check: plays the real simulation with a scripted "reasonable player"
// (see scripts/simPlayer.ts) and prints when each milestone is reached.
//   npm run balance            npm run balance -- --seed 7 --verbose --hours 20

import { formatDepth, formatNumber, formatTime, getStats } from '../src/sim';
import { simulate } from './simPlayer';

const args = process.argv.slice(2);
const argNum = (name: string, fallback: number) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const SEED = argNum('seed', 12345);
const { log, runs, player: p, hole: h, timeMs: t, firstBuy, longestGap, gapAt } = simulate(SEED, argNum('hours', 16), args.includes('--verbose'));

const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
console.log(`\nDig to the Earth's Core: balance simulation (seed ${SEED})\n`);
console.log('  time     event');
console.log('  -------  ------------------------------------------------------------');
for (const [time, text] of log) console.log(`  ${clock(time)}  ${text}`);
console.log('\n  run  started  length   reached        shards  tool at end        dps at end');
console.log('  ---  -------  -------  -------------  ------  -----------------  ----------');
for (const r of runs) {
  console.log(`  ${String(r.n).padStart(3)}  ${clock(r.start)}  ${formatTime((r.end - r.start) / 1000).padEnd(7)}  ${formatDepth(r.depth).padEnd(13)}  ${String(r.shards || '-').padStart(6)}  ${r.tool.padEnd(17)}  ${formatNumber(r.dps)}`);
}
const firstLayer = log.find(([, x]) => x.startsWith('New layer'));
const firstRebirth = log.find(([, x]) => x.startsWith('Rebirth #1 '));
console.log('\n  Targets');
console.log(`    first upgrade  < 0:30       ${clock(firstBuy)}`);
console.log(`    first layer    < 5:00       ${firstLayer ? clock(firstLayer[0]) : 'never'}`);
console.log(`    first rebirth  20-30 min    ${firstRebirth ? clock(firstRebirth[0]) : 'never'}`);
console.log(`    core finish    several h    ${h.complete ? clock(t) : 'not reached'}  (${p.prestige.rebirths} rebirths)`);
console.log(`    longest wait with nothing new to buy or unlock: ${formatTime(longestGap / 1000)} (ending at ${clock(gapAt)})`);
console.log(`    total shards ${p.prestige.totalShards}, rebirth multiplier x${formatNumber(getStats(p, h.planet).rebirthMult, 1)}, rare finds ${p.counters.uniqueFinds}/28, achievements ${Object.keys(p.achievements).length}\n`);

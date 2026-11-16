import { BALANCE, LAYERS, PLANETS, type LayerDef, type PlanetDef } from '../data';
import type { Hole } from './types';

/** Planet definition for any index. Past the end of the table the last planet repeats, scaled up. */
export function planetAt(index: number): PlanetDef {
  if (index < PLANETS.length) return PLANETS[index];
  const last = PLANETS[PLANETS.length - 1];
  const extra = index - PLANETS.length + 1;
  const scale = Math.pow(BALANCE.endlessPlanetScale, extra);
  return {
    ...last,
    id: `${last.id}+${extra}`,
    name: `${last.name} +${extra}`,
    hardnessMult: last.hardnessMult * scale,
    barrierMult: last.barrierMult * scale,
    valueMult: last.valueMult * Math.pow(Math.sqrt(BALANCE.endlessPlanetScale), extra),
    completionShards: last.completionShards * Math.pow(4, extra),
  };
}

export const LAST_LAYER = LAYERS.length - 1;
export const CORE_DEPTH = LAYERS[LAST_LAYER].end;

/** The layer being dug. You cannot pass a boundary without breaking its barrier, so this is exact. */
export function layerIndex(hole: Hole): number {
  return Math.min(hole.barriersBroken, LAST_LAYER);
}
export function layerOf(hole: Hole): LayerDef {
  return LAYERS[layerIndex(hole)];
}
export function layerIndexAtDepth(depth: number): number {
  for (let i = 0; i < LAYERS.length; i++) if (depth < LAYERS[i].end) return i;
  return LAST_LAYER;
}

/** Position inside a layer, 0 at the top to 1 at the bottom. Logarithmic in depth, so the first
 *  metres of a huge layer still register (linear for the layer that starts at the surface). */
export function layerFraction(layer: number, depth: number): number {
  const L = LAYERS[layer];
  if (depth <= L.start) return 0;
  if (depth >= L.end) return 1;
  return L.start > 0 ? Math.log(depth / L.start) / Math.log(L.end / L.start) : depth / L.end;
}

export interface Stratum { layer: number; start: number; end: number; hardness: number }

/** Layers cut into strata of constant hardness (before planet multipliers). Rebuilt if layer data changes. */
let strataCache: Stratum[] | null = null;
let strataKey = '';
export function strata(): Stratum[] {
  const key = LAYERS.map((l) => `${l.hardness}:${l.hardnessEnd}`).join('|');
  if (strataCache && key === strataKey) return strataCache;
  const n = BALANCE.strataPerLayer;
  const out: Stratum[] = [];
  LAYERS.forEach((L, layer) => {
    const edge = (k: number) => (k <= 0 ? L.start : k >= n ? L.end
      : L.start > 0 ? L.start * Math.pow(L.end / L.start, k / n) : (L.end * k) / n);
    for (let k = 0; k < n; k++) {
      const t = n > 1 ? k / (n - 1) : 0;
      out.push({ layer, start: edge(k), end: edge(k + 1), hardness: L.hardness * Math.pow(L.hardnessEnd / L.hardness, t) });
    }
  });
  strataCache = out;
  strataKey = key;
  return out;
}

/** Index of the stratum containing `depth` within `layer` (the last one if depth is at the layer's end). */
export function stratumIndex(layer: number, depth: number): number {
  const n = BALANCE.strataPerLayer;
  const all = strata();
  const base = layer * n;
  for (let k = 0; k < n; k++) if (depth < all[base + k].end) return base + k;
  return base + n - 1;
}

/** Damage needed per metre at a depth inside a layer. */
export function hardnessAt(planet: number, layer: number, depth: number): number {
  return strata()[stratumIndex(layer, depth)].hardness * planetAt(planet).hardnessMult;
}
export function valueOf(planet: number, layer: number): number {
  return LAYERS[layer].value * planetAt(planet).valueMult;
}
export function barrierMaxHp(planet: number, layer: number): number {
  return LAYERS[layer].barrier.hp * planetAt(planet).barrierMult;
}
export function burstMs(planet: number): number {
  return BALANCE.barrier.burstSeconds * 1000 * (planetAt(planet).rules.burstSecondsMult ?? 1);
}

/** True when the hole is resting on an unbroken barrier. */
export function atBarrier(hole: Hole): boolean {
  return !hole.complete && hole.depth >= layerOf(hole).end;
}

/** How deep a given amount of damage would get you digging alone from the surface (barriers ignored). */
export function workToDepth(planet: number, damage: number): number {
  const mult = planetAt(planet).hardnessMult;
  let left = damage;
  for (const s of strata()) {
    const h = s.hardness * mult;
    const work = (s.end - s.start) * h;
    if (left < work) return s.start + left / h;
    left -= work;
  }
  return CORE_DEPTH;
}

/** Inverse of workToDepth. */
export function depthToWork(planet: number, depth: number): number {
  const mult = planetAt(planet).hardnessMult;
  let work = 0;
  for (const s of strata()) {
    const h = s.hardness * mult;
    if (depth <= s.end) return work + Math.max(0, depth - s.start) * h;
    work += (s.end - s.start) * h;
  }
  return work;
}

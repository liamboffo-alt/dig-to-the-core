// Generated low-poly tool models. Every tool is built from primitives: no assets.
// A tool is either held by the digger ('hand': it points along +Y from the grip)
// or stands on the dig spot ('machine': origin on the floor, +Y up).

import * as THREE from 'three';
import type { ToolDef } from '../data';

export interface ToolModel {
  group: THREE.Group;
  kind: 'hand' | 'machine';
  /** swing: 1 at the moment of a hit, easing back to 0. */
  update(dt: number, swing: number, time: number): void;
}

const mats = new Map<string, THREE.Material>();
export function mat(color: number, emissive = 0x000000, emissiveIntensity = 1): THREE.MeshLambertMaterial {
  const key = `${color}:${emissive}:${emissiveIntensity}`;
  let m = mats.get(key);
  if (!m) { m = new THREE.MeshLambertMaterial({ color, emissive, emissiveIntensity, flatShading: true }); mats.set(key, m); }
  return m as THREE.MeshLambertMaterial;
}
export function glowMat(color: number, opacity = 1): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
}

const STEEL = 0xb0bec5, DARK = 0x37474f, WOOD = 0x8d5a34;

function add(parent: THREE.Object3D, geo: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt: number, rb: number, h: number, seg = 8) => new THREE.CylinderGeometry(rt, rb, h, seg);
const cone = (r: number, h: number, seg = 6) => new THREE.ConeGeometry(r, h, seg);
const ball = (r: number, detail = 0) => new THREE.IcosahedronGeometry(r, detail);
const torus = (r: number, tube: number, seg = 14) => new THREE.TorusGeometry(r, tube, 5, seg);

/** A column of light from `height` down to the floor, shown while swing > 0. */
function beam(parent: THREE.Object3D, color: number, height: number, radius: number) {
  const b = add(parent, cyl(radius, radius * 1.6, height, 8), glowMat(color, 0.9), 0, height / 2, 0);
  const core = add(parent, cyl(radius * 0.4, radius * 0.6, height, 6), glowMat(0xffffff, 0.9), 0, height / 2, 0);
  const pool = add(parent, new THREE.CircleGeometry(radius * 5, 16), glowMat(color, 0.7), 0, 0.06, 0);
  pool.rotation.x = -Math.PI / 2;
  return (swing: number, time: number) => {
    const s = Math.max(0.04, swing);
    b.scale.set(s, 1, s); core.scale.set(s, 1, s);
    (b.material as THREE.MeshBasicMaterial).opacity = 0.25 + swing * 0.7;
    const p = 0.5 + swing * 0.9 + Math.sin(time * 20) * 0.05;
    pool.scale.set(p, p, p);
    (pool.material as THREE.MeshBasicMaterial).opacity = 0.2 + swing * 0.6;
  };
}

type Builder = (def: ToolDef, g: THREE.Group) => ToolModel['update'];

const hand: Record<string, Builder> = {
  spoon: (def, g) => {
    add(g, cyl(0.022, 0.022, 0.34, 6), mat(def.color), 0, 0.17, 0);
    const bowl = add(g, ball(0.075, 1), mat(def.color), 0, 0.4, 0);
    bowl.scale.set(0.85, 1.15, 0.3);
    return () => {};
  },
  shovel: (def, g) => {
    add(g, cyl(0.035, 0.035, 1.15, 6), mat(WOOD), 0, 0.5, 0);
    add(g, box(0.2, 0.06, 0.06), mat(DARK), 0, -0.08, 0);
    const blade = add(g, box(0.3, 0.38, 0.035), mat(STEEL), 0, 1.24, 0.01);
    blade.rotation.x = 0.12;
    add(g, cone(0.15, 0.14, 4), mat(STEEL), 0, 1.5, 0.02).rotation.y = Math.PI / 4;
    return () => {};
  },
  pickaxe: (def, g) => {
    add(g, cyl(0.04, 0.045, 1.2, 6), mat(WOOD), 0, 0.55, 0);
    add(g, box(0.16, 0.14, 0.12), mat(def.color), 0, 1.15, 0);
    add(g, cone(0.07, 0.5, 5), mat(def.color), 0.3, 1.15, 0).rotation.z = -Math.PI / 2;
    add(g, cone(0.07, 0.5, 5), mat(def.color), -0.3, 1.15, 0).rotation.z = Math.PI / 2;
    return () => {};
  },
  jackhammer: (def, g) => {
    add(g, box(0.26, 0.55, 0.24), mat(def.color), 0, 0.42, 0);
    add(g, box(0.3, 0.1, 0.28), mat(DARK), 0, 0.72, 0);
    add(g, cyl(0.035, 0.035, 0.62, 6), mat(DARK), 0, 0.1, 0).rotation.z = Math.PI / 2;
    const bit = add(g, cyl(0.05, 0.02, 0.7, 6), mat(STEEL), 0, 1.05, 0);
    return (_dt, swing, time) => { bit.position.y = 1.05 + Math.sin(time * 70) * 0.03 * (0.3 + swing); };
  },
};

const machine: Record<string, Builder> = {
  drill: (def, g) => {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      const leg = add(g, cyl(0.06, 0.08, 3.1, 5), mat(DARK), Math.cos(a) * 0.75, 1.4, Math.sin(a) * 0.75);
      leg.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    }
    add(g, box(0.7, 0.6, 0.7), mat(def.color), 0, 2.5, 0);
    add(g, cyl(0.16, 0.16, 0.5, 6), mat(DARK), 0, 3.0, 0);
    const bit = new THREE.Group();
    g.add(bit);
    add(bit, cone(0.38, 1.9, 6), mat(STEEL), 0, 1.05, 0).rotation.x = Math.PI;
    for (let i = 0; i < 4; i++) add(bit, torus(0.3 - i * 0.065, 0.04, 6), mat(DARK), 0, 1.7 - i * 0.4, 0).rotation.set(Math.PI / 2 + 0.25, 0, i);
    return (dt, swing) => { bit.rotation.y += dt * (5 + swing * 40); bit.position.y = -swing * 0.14; };
  },
  borer: (def, g) => {
    for (const [x, z] of [[1.5, 1.2], [-1.5, 1.2], [1.5, -1.2], [-1.5, -1.2]]) add(g, cyl(0.09, 0.11, 2.6, 5), mat(DARK), x, 1.3, z);
    add(g, box(3.4, 0.3, 2.8), mat(def.color), 0, 2.7, 0);
    add(g, box(1.2, 0.7, 1.2), mat(DARK), 0, 3.15, 0);
    const head = new THREE.Group();
    g.add(head);
    add(head, cyl(0.25, 0.25, 2.0, 6), mat(STEEL), 0, 1.6, 0);
    add(head, cyl(1.35, 1.2, 0.4, 10), mat(def.color), 0, 0.6, 0);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2, r = i % 2 ? 1.05 : 0.55;
      add(head, cone(0.13, 0.36, 4), mat(def.glow || STEEL, def.glow, 0.5), Math.cos(a) * r, 0.25, Math.sin(a) * r).rotation.x = Math.PI;
    }
    return (dt, swing) => { head.rotation.y += dt * (3 + swing * 30); head.position.y = -swing * 0.12; };
  },
  laser: (def, g) => {
    for (const x of [-1.7, 1.7]) add(g, box(0.22, 3.4, 0.22), mat(DARK), x, 1.7, 0);
    add(g, box(3.8, 0.28, 0.5), mat(def.color), 0, 3.4, 0);
    const emitter = new THREE.Group();
    emitter.position.y = 2.75;
    g.add(emitter);
    add(emitter, cyl(0.42, 0.42, 0.8, 8), mat(def.color), 0, 0.2, 0);
    add(emitter, cone(0.3, 0.5, 8), mat(DARK), 0, -0.4, 0).rotation.x = Math.PI;
    const core = add(emitter, ball(0.16, 1), glowMat(def.glow), 0, -0.62, 0);
    const fire = beam(g, def.glow, 2.1, 0.11);
    return (_dt, swing, time) => {
      fire(swing, time);
      emitter.position.y = 2.75 + swing * 0.1;
      core.scale.setScalar(1 + swing * 1.5 + Math.sin(time * 9) * 0.1);
    };
  },
  sonic: (def, g) => {
    const dish = new THREE.Group();
    dish.position.y = 2.7;
    g.add(dish);
    add(dish, new THREE.ConeGeometry(1.1, 0.7, 10, 1, true), new THREE.MeshLambertMaterial({ color: def.color, flatShading: true, side: THREE.DoubleSide }), 0, 0, 0);
    add(dish, ball(0.22, 1), glowMat(def.glow), 0, -0.25, 0);
    add(dish, cyl(0.1, 0.1, 0.9, 6), mat(DARK), 0, 0.75, 0);
    for (let i = 0; i < 3; i++) add(dish, box(0.5, 0.08, 0.12), mat(DARK), Math.cos(i * 2.1) * 0.6, 1.2, Math.sin(i * 2.1) * 0.6).rotation.y = -i * 2.1;
    const rings = [0, 1, 2].map(() => add(g, torus(0.5, 0.05, 18), glowMat(def.glow, 0.8), 0, 2, 0));
    rings.forEach((r) => { r.rotation.x = Math.PI / 2; });
    let phase = 0;
    return (dt, swing, time) => {
      phase = (phase + dt * (0.6 + swing * 3)) % 1;
      rings.forEach((r, i) => {
        const p = (phase + i / 3) % 1;
        r.position.y = 2.3 - p * 2.2;
        r.scale.setScalar(0.5 + p * 2.2);
        (r.material as THREE.MeshBasicMaterial).opacity = (1 - p) * (0.25 + swing * 0.7);
      });
      dish.position.y = 2.7 + Math.sin(time * 2.4) * 0.08 + swing * 0.12;
      dish.rotation.y += dt * 0.8;
    };
  },
  lance: (def, g) => {
    add(g, cyl(0.5, 0.7, 0.3, 8), mat(DARK), 0, 0.15, 0).position.set(1.6, 0.15, 0);
    add(g, box(0.16, 3.6, 0.16), mat(DARK), 1.6, 1.9, 0);
    add(g, box(1.7, 0.16, 0.16), mat(DARK), 0.8, 3.6, 0);
    const spear = new THREE.Group();
    g.add(spear);
    add(spear, cyl(0.1, 0.03, 3.0, 6), mat(def.color, def.glow, 0.8), 0, 2.0, 0);
    add(spear, cone(0.2, 0.5, 6), glowMat(def.glow), 0, 0.42, 0).rotation.x = Math.PI;
    const r1 = add(spear, torus(0.55, 0.05), glowMat(def.glow, 0.9), 0, 2.7, 0);
    const r2 = add(spear, torus(0.4, 0.04), glowMat(def.glow, 0.9), 0, 1.7, 0);
    const fire = beam(g, def.glow, 0.5, 0.2);
    return (dt, swing, time) => {
      fire(swing, time);
      r1.rotation.x += dt * 3; r1.rotation.y += dt * 2;
      r2.rotation.x -= dt * 4; r2.rotation.z += dt * 2.5;
      spear.position.y = 0.25 + Math.sin(time * 3) * 0.06 - swing * 0.3;
    };
  },
  auger: (def, g) => {
    const screw = new THREE.Group();
    g.add(screw);
    add(screw, cyl(0.22, 0.22, 3.2, 6), mat(DARK), 0, 2.0, 0);
    for (let i = 0; i < 9; i++) {
      const b = add(screw, box(1.5 - i * 0.1, 0.09, 0.42), mat(def.color), 0, 3.3 - i * 0.33, 0);
      b.rotation.set(0.25, i * 0.7, 0);
    }
    add(screw, cone(0.3, 0.6, 6), glowMat(def.glow), 0, 0.3, 0).rotation.x = Math.PI;
    const halo = add(g, torus(1.5, 0.05, 20), glowMat(def.glow, 0.7), 0, 3.6, 0);
    halo.rotation.x = Math.PI / 2;
    return (dt, swing, time) => {
      screw.rotation.y += dt * (4 + swing * 34);
      screw.position.y = Math.sin(time * 2) * 0.05 - swing * 0.2;
      halo.scale.setScalar(1 + swing * 0.3);
      halo.rotation.z -= dt;
    };
  },
  singularity: (def, g) => {
    const hole = new THREE.Group();
    hole.position.y = 2.0;
    g.add(hole);
    add(hole, ball(0.6, 2), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    const halo = add(hole, ball(0.72, 2), glowMat(def.glow, 0.35));
    const d1 = add(hole, torus(1.05, 0.09, 24), glowMat(def.glow, 0.95));
    const d2 = add(hole, torus(1.45, 0.04, 24), glowMat(0xffffff, 0.5));
    d1.rotation.x = 1.25; d2.rotation.x = 1.4;
    const bits = [0, 1, 2, 3, 4].map((i) => add(hole, ball(0.08), mat(def.color, def.glow, 1), 0, 0, 0));
    const fire = beam(g, def.glow, 1.5, 0.07);
    return (dt, swing, time) => {
      fire(swing, time);
      d1.rotation.z += dt * (2 + swing * 10); d2.rotation.z -= dt * 1.3;
      hole.position.y = 2.0 + Math.sin(time * 1.7) * 0.1;
      hole.scale.setScalar(1 + swing * 0.25);
      halo.scale.setScalar(1 + Math.sin(time * 6) * 0.05 + swing * 0.3);
      bits.forEach((b, i) => {
        const a = time * (1.5 + i * 0.3) + i * 1.3, r = 1.2 + 0.25 * Math.sin(time + i);
        b.position.set(Math.cos(a) * r, Math.sin(a * 1.3) * 0.25, Math.sin(a) * r);
      });
    };
  },
  quantum: (def, g) => {
    const lattice = new THREE.Group();
    lattice.position.y = 2.1;
    g.add(lattice);
    const cubes: THREE.Mesh[] = [];
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
      if ((Math.abs(x) + Math.abs(y) + Math.abs(z)) % 2 === 0) continue;
      cubes.push(add(lattice, box(0.26, 0.26, 0.26), mat(def.color, def.glow, 0.7), x * 0.5, y * 0.5, z * 0.5));
    }
    add(lattice, ball(0.3, 1), glowMat(def.glow));
    const fire = beam(g, def.glow, 1.3, 0.09);
    return (dt, swing, time) => {
      fire(swing, time);
      lattice.rotation.x += dt * (0.8 + swing * 6); lattice.rotation.y += dt * (1.1 + swing * 8);
      lattice.position.y = 2.1 + Math.sin(time * 2.2) * 0.08;
      cubes.forEach((c, i) => {
        const k = 1 + swing * 0.5 + (Math.sin(time * 13 + i * 2.4) > 0.86 ? 0.5 : 0);
        c.position.setLength(0.55 * k + (i % 3) * 0.08);
      });
    };
  },
  cracker: (def, g) => {
    for (const x of [-1.9, 1.9]) {
      add(g, box(0.5, 4.2, 0.9), mat(DARK), x, 2.1, 0);
      add(g, box(0.12, 3.8, 0.94), mat(def.glow, def.glow, 0.9), x * 0.86, 2.1, 0);
    }
    add(g, box(4.6, 0.6, 1.2), mat(def.color), 0, 4.4, 0);
    const ram = new THREE.Group();
    g.add(ram);
    add(ram, box(2.6, 1.3, 1.5), mat(def.color), 0, 0.65, 0);
    add(ram, box(2.7, 0.18, 1.6), mat(def.glow, def.glow, 1), 0, 0.3, 0);
    add(ram, cyl(0.3, 0.3, 3, 6), mat(STEEL), 0, 2.6, 0);
    for (let i = 0; i < 5; i++) add(ram, cone(0.22, 0.4, 4), mat(STEEL), -1 + i * 0.5, -0.18, 0).rotation.x = Math.PI;
    const flash = add(g, new THREE.CircleGeometry(2.4, 18), glowMat(def.glow, 0.6), 0, 0.07, 0);
    flash.rotation.x = -Math.PI / 2;
    return (_dt, swing) => {
      // swing 1 -> slammed into the floor, 0 -> raised
      ram.position.y = 0.4 + (1 - swing * swing) * 2.0;
      flash.scale.setScalar(0.3 + swing * 1.1);
      (flash.material as THREE.MeshBasicMaterial).opacity = swing * 0.8;
    };
  },
};

export function buildTool(def: ToolDef, tier: number): ToolModel {
  const group = new THREE.Group();
  const isHand = def.model in hand;
  const builder = hand[def.model] ?? machine[def.model] ?? machine.drill;
  const update = builder(def, group);
  if (!isHand) group.scale.setScalar(Math.min(1.25, 0.9 + tier * 0.022));
  return { group, kind: isHand ? 'hand' : 'machine', update };
}

export function disposeTool(model: ToolModel): void {
  model.group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.geometry.dispose();
      if (m.material instanceof THREE.MeshBasicMaterial) m.material.dispose();
    }
  });
}

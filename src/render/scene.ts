// The 3D view: a low-poly shaft seen from a third-person camera, with the digger at the bottom.
// This file only draws. It reads game state it is handed and never changes it.

import * as THREE from 'three';
import { HELPERS, LAYERS, ORES, TOOLS } from '../data';
import { Digger, nameSprite } from './digger';
import { glowMat, mat } from './tools';

const R = 9;               // shaft radius
const WALL_H = 64;
const TEX_REPEAT_Y = 6;

export interface ViewState {
  layer: number;
  tool: number;
  speed: number;
  atBarrier: boolean;
  /** Barrier hp left, 0..1 (1 when not engaged). */
  barrierFrac: number;
  helpers: Record<string, number>;
  peers: { id: string; name: string; tool: number }[];
  complete: boolean;
  planetTint: number;
}

export interface Quality { pixelRatio: number; particles: number; antialias: boolean }

export function pickQuality(): Quality {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const dpr = window.devicePixelRatio || 1;
  return coarse
    ? { pixelRatio: Math.min(dpr, 1.5), particles: 220, antialias: false }
    : { pixelRatio: Math.min(dpr, 2), particles: 420, antialias: true };
}

function strataTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = '#b4b4b4';
  g.fillRect(0, 0, 256, 512);
  let y = 0, seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  while (y < 512) {
    const h = 10 + rnd() * 46;
    const v = Math.floor(120 + rnd() * 135);
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= 256; x += 32) g.lineTo(x, y + Math.sin((x / 256) * Math.PI * 2 * (1 + Math.floor(rnd() * 2))) * 5);
    g.lineTo(256, y + h + 6); g.lineTo(0, y + h + 6);
    g.fill();
    y += h;
  }
  for (let i = 0; i < 260; i++) {
    const v = rnd() > 0.5 ? 255 : 60;
    g.fillStyle = `rgba(${v},${v},${v},${0.12 + rnd() * 0.25})`;
    const s = 2 + rnd() * 7;
    g.fillRect(rnd() * 256, rnd() * 512, s, s * (0.5 + rnd()));
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, TEX_REPEAT_Y);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

class Particles {
  readonly mesh: THREE.InstancedMesh;
  private n = 0;
  private data: Float32Array; // x y z vx vy vz life maxLife size spin
  private dummy = new THREE.Object3D();
  private color = new THREE.Color();
  private colors: Float32Array;
  constructor(private max: number) {
    this.mesh = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.16), new THREE.MeshBasicMaterial(), max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.data = new Float32Array(max * 10);
    this.colors = new Float32Array(max * 3);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(this.colors, 3);
  }
  spawn(count: number, x: number, y: number, z: number, color: number, speed: number, size = 1, spread = 1): void {
    for (let i = 0; i < count; i++) {
      if (this.n >= this.max) return;
      const o = this.n * 10, a = Math.random() * Math.PI * 2, r = (0.3 + Math.random() * 0.7) * speed * spread;
      const d = this.data;
      d[o] = x + (Math.random() - 0.5) * 0.4; d[o + 1] = y; d[o + 2] = z + (Math.random() - 0.5) * 0.4;
      d[o + 3] = Math.cos(a) * r; d[o + 4] = (0.6 + Math.random() * 0.9) * speed; d[o + 5] = Math.sin(a) * r;
      d[o + 6] = d[o + 7] = 0.5 + Math.random() * 0.6;
      d[o + 8] = size * (0.5 + Math.random());
      d[o + 9] = Math.random() * 10;
      this.color.setHex(color).multiplyScalar(0.7 + Math.random() * 0.6);
      this.colors[this.n * 3] = this.color.r; this.colors[this.n * 3 + 1] = this.color.g; this.colors[this.n * 3 + 2] = this.color.b;
      this.n++;
    }
  }
  update(dt: number): void {
    const d = this.data;
    let i = 0;
    while (i < this.n) {
      const o = i * 10;
      d[o + 6] -= dt;
      if (d[o + 6] <= 0) { // swap-remove
        const last = (this.n - 1) * 10;
        for (let k = 0; k < 10; k++) d[o + k] = d[last + k];
        for (let k = 0; k < 3; k++) this.colors[i * 3 + k] = this.colors[(this.n - 1) * 3 + k];
        this.n--;
        continue;
      }
      d[o + 4] -= 22 * dt;
      d[o] += d[o + 3] * dt; d[o + 1] += d[o + 4] * dt; d[o + 2] += d[o + 5] * dt;
      if (d[o + 1] < 0.08 && d[o + 4] < 0) { d[o + 1] = 0.08; d[o + 4] *= -0.35; d[o + 3] *= 0.6; d[o + 5] *= 0.6; }
      const life = d[o + 6] / d[o + 7];
      this.dummy.position.set(d[o], d[o + 1], d[o + 2]);
      this.dummy.rotation.set(d[o + 9] + d[o + 6] * 7, d[o + 9] * 2 + d[o + 6] * 5, 0);
      this.dummy.scale.setScalar(d[o + 8] * Math.min(1, life * 2.5));
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      i++;
    }
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor!.needsUpdate = true;
  }
}

export class GameScene {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(50, 1, 0.1, 120);
  private wall: THREE.Mesh;
  private wallMat: THREE.MeshLambertMaterial;
  private wallTex: THREE.CanvasTexture;
  private floorGroup = new THREE.Group();
  private floorMat: THREE.MeshLambertMaterial;
  private rubbleMat: THREE.MeshLambertMaterial;
  private gems: THREE.InstancedMesh;
  private gemData: { a: number; y: number; s: number }[] = [];
  private barrier = new THREE.Group();
  private barrierMat = new THREE.MeshLambertMaterial({ flatShading: true });
  private cracks: THREE.Mesh[] = [];
  private hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.1);
  private sun = new THREE.DirectionalLight(0xffffff, 1.5);
  private glowLight = new THREE.PointLight(0xff6600, 0, 40, 1.2);
  private flashLight = new THREE.PointLight(0xffffff, 0, 16, 1.5);
  private particles: Particles;
  private rings: { mesh: THREE.Mesh; t: number }[] = [];
  private digger = new Digger();
  private machineSlot = new THREE.Group();
  private helperGroup = new THREE.Group();
  private helperKey = '';
  private helperMeshes: THREE.Object3D[] = [];
  private peers = new Map<string, { digger: Digger; label: THREE.Sprite; tool: number }>();
  private peerGroup = new THREE.Group();
  private core: THREE.Mesh | null = null;

  private time = 0;
  private scrollVel = 0;
  private trauma = 0;
  private floorDrop = 0;
  private flash = 0;
  private finale = 0;
  private layer = -1;
  private toolTier = -1;
  private state: ViewState | null = null;
  private target = { wall: new THREE.Color(), floor: new THREE.Color(), fog: new THREE.Color(), emissive: new THREE.Color(), glow: 0 };
  private glow = 0;
  private barrierShown = 0;
  shakeScale = 1;

  constructor(canvas: HTMLCanvasElement, private quality: Quality) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: quality.antialias, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(quality.pixelRatio);
    this.scene.fog = new THREE.Fog(0x000000, 14, 46);
    this.scene.background = new THREE.Color(0x000000);

    // Shaft wall: we stand inside it and see its inner face.
    this.wallTex = strataTexture();
    this.wallMat = new THREE.MeshLambertMaterial({ map: this.wallTex, emissiveMap: this.wallTex, side: THREE.BackSide, flatShading: true });
    this.wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R, WALL_H, 14, 1, true), this.wallMat);
    this.wall.position.y = WALL_H / 2 - 12;
    this.scene.add(this.wall);

    // Gems studded in the wall. They ride up with the strata as we descend.
    this.gems = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.26), new THREE.MeshBasicMaterial(), 34);
    for (let i = 0; i < 34; i++) this.gemData.push({ a: Math.random() * Math.PI * 2, y: -2 + Math.random() * 26, s: 0.6 + Math.random() * 0.9 });
    this.gems.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(34 * 3), 3);
    this.scene.add(this.gems);

    // Floor: a rough faceted disc plus loose rubble.
    const plane = new THREE.PlaneGeometry(R * 2.3, R * 2.3, 12, 12).toNonIndexed();
    plane.rotateX(-Math.PI / 2);
    const pos = plane.attributes.position;
    const heights = new Map<string, number>();
    for (let i = 0; i < pos.count; i++) {
      const key = `${pos.getX(i).toFixed(2)},${pos.getZ(i).toFixed(2)}`;
      const dist = Math.hypot(pos.getX(i), pos.getZ(i));
      if (!heights.has(key)) heights.set(key, dist < 2.4 ? -0.05 : (Math.random() - 0.4) * 0.45 * Math.min(1, dist / 6));
      pos.setY(i, heights.get(key)!);
    }
    plane.computeVertexNormals();
    this.floorMat = new THREE.MeshLambertMaterial({ flatShading: true });
    this.floorGroup.add(new THREE.Mesh(plane, this.floorMat));
    this.rubbleMat = new THREE.MeshLambertMaterial({ flatShading: true });
    const rubble = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.34, 0), this.rubbleMat, 18);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 5.2;
      dummy.position.set(Math.cos(a) * r, 0.12, Math.sin(a) * r);
      dummy.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      dummy.scale.setScalar(0.5 + Math.random() * 1.3);
      dummy.updateMatrix();
      rubble.setMatrixAt(i, dummy.matrix);
    }
    this.floorGroup.add(rubble);
    this.scene.add(this.floorGroup);

    // Barrier slab, shown when a layer boundary blocks the way.
    const slab = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.8, 0.45, 9), this.barrierMat);
    slab.position.y = 0.2;
    this.barrier.add(slab);
    for (let i = 0; i < 7; i++) {
      const crack = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 3.2), glowMat(0xffe082, 0.95));
      crack.position.y = 0.47;
      crack.rotation.y = (i / 7) * Math.PI + Math.random() * 0.3;
      this.cracks.push(crack);
      this.barrier.add(crack);
    }
    this.barrier.visible = false;
    this.floorGroup.add(this.barrier);

    this.sun.position.set(3, 12, 7);
    this.glowLight.position.set(0, 2.5, 0);
    this.flashLight.position.set(0, 1.2, 0.5);
    this.scene.add(this.hemi, this.sun, this.glowLight, this.flashLight);

    this.particles = new Particles(quality.particles);
    this.scene.add(this.particles.mesh);
    for (let i = 0; i < 4; i++) {
      const mesh = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 28), glowMat(0xffffff, 0));
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.1;
      mesh.visible = false;
      this.rings.push({ mesh, t: 1 });
      this.scene.add(mesh);
    }

    this.floorGroup.add(this.digger.group, this.machineSlot, this.helperGroup, this.peerGroup);
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.fov = this.camera.aspect < 0.8 ? 66 : this.camera.aspect < 1.3 ? 56 : 46;
    this.camera.updateProjectionMatrix();
  }

  /** Where the tool meets the ground, in CSS pixels relative to the canvas. */
  hitPoint(): { x: number; y: number } {
    const v = new THREE.Vector3(0, 0.9, 0).project(this.camera);
    const el = this.renderer.domElement;
    return { x: (v.x * 0.5 + 0.5) * el.clientWidth, y: (-v.y * 0.5 + 0.5) * el.clientHeight };
  }

  setState(s: ViewState): void {
    this.state = s;
    if (s.layer !== this.layer) {
      const first = this.layer < 0;
      this.layer = s.layer;
      const look = LAYERS[s.layer].look;
      this.target.wall.setHex(look.wall);
      this.target.floor.setHex(look.floor);
      this.target.fog.setHex(look.fog);
      this.target.emissive.setHex(look.emissive);
      this.target.glow = look.glow;
      const colors = LAYERS[s.layer].ores.map((o) => new THREE.Color(ORES.find((x) => x.id === o.id)?.color ?? 0xffffff));
      const attr = this.gems.instanceColor!;
      for (let i = 0; i < this.gemData.length; i++) {
        const c = colors[i % 7 === 0 ? 3 : i % 4 === 0 ? 2 : i % 2];
        attr.setXYZ(i, c.r, c.g, c.b);
      }
      attr.needsUpdate = true;
      this.barrierMat.color.setHex(LAYERS[s.layer].barrier.color);
      if (first) {
        this.wallMat.color.copy(this.target.wall);
        this.floorMat.color.copy(this.target.floor);
        (this.scene.background as THREE.Color).copy(this.target.fog);
        this.wallMat.emissive.copy(this.target.emissive);
        this.glow = this.target.glow;
      }
    }
    if (s.tool !== this.toolTier) {
      this.toolTier = s.tool;
      this.machineSlot.clear();
      this.digger.setTool(s.tool);
      const machine = this.digger.machine;
      if (machine) {
        this.machineSlot.add(machine.group);
        this.digger.group.position.set(-2.1, 0, 1.6);
        this.digger.group.rotation.y = 1.25;
      } else {
        const reach = TOOLS[s.tool].model === 'spoon' ? 0.75 : TOOLS[s.tool].anim === 'pound' ? 0.55 : 1.3;
        this.digger.group.position.set(-reach * 0.98, 0, reach * 0.18);
        this.digger.group.rotation.y = 1.75;
      }
    }
    this.syncHelpers(s.helpers);
    this.syncPeers(s.peers);
  }

  private syncHelpers(helpers: Record<string, number>): void {
    const owned = HELPERS.filter((h) => (helpers[h.id] ?? 0) > 0);
    const key = owned.map((h) => h.id).join(',');
    if (key === this.helperKey) return;
    this.helperKey = key;
    this.helperGroup.clear();
    this.helperMeshes = [];
    const show = owned.slice(-9);
    show.forEach((h, i) => {
      const index = HELPERS.indexOf(h);
      const g = new THREE.Group();
      const color = new THREE.Color().setHSL((index * 0.13 + 0.05) % 1, 0.65, 0.55).getHex();
      const kind = index % 5;
      if (kind === 0) { // critter
        const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38, 0), mat(color));
        body.position.y = 0.36; body.scale.set(1, 0.85, 1.25);
        const nose = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 5), mat(0xffab91));
        nose.position.set(0, 0.34, 0.5); nose.rotation.x = Math.PI / 2;
        g.add(body, nose);
      } else if (kind === 1) { // four-legged
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.36, 0.8), mat(color));
        body.position.y = 0.45;
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.3, 0.32), mat(color));
        head.position.set(0, 0.68, 0.45);
        g.add(body, head);
        for (const [x, z] of [[-0.14, 0.28], [0.14, 0.28], [-0.14, -0.28], [0.14, -0.28]]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.28, 0.1), mat(0x5d4037));
          leg.position.set(x, 0.14, z);
          g.add(leg);
        }
      } else if (kind === 2) { // small worker
        const d = new Digger(color, 0xeeeeee, true);
        d.setTool(2);
        d.group.scale.setScalar(0.62);
        g.add(d.group);
        g.userData.digger = d;
      } else if (kind === 3) { // robot
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.5), mat(color));
        body.position.y = 0.55;
        const eye = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.05), glowMat(0x80deea));
        eye.position.set(0, 0.65, 0.27);
        const drill = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 5), mat(0xb0bec5));
        drill.position.set(0, 0.2, 0.42); drill.rotation.x = 2.2;
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.2, 0.7), mat(0x37474f));
        base.position.y = 0.12;
        g.add(body, eye, drill, base);
      } else { // floating gizmo
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.09, 5, 12), mat(color, color, 0.5));
        ring.position.y = 1.2;
        const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), glowMat(0xffffff));
        orb.position.y = 1.2;
        const ray = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.06, 1.1, 5), glowMat(color, 0.6));
        ray.position.y = 0.6;
        g.add(ring, orb, ray);
        g.userData.spin = ring;
      }
      const a = Math.PI * (1.08 + (i / Math.max(1, show.length - 1 || 1)) * 0.84) + (show.length === 1 ? 0.4 : 0);
      const r = 4.6 + (i % 2) * 1.5;
      g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      g.lookAt(0, 0, 0);
      g.userData.phase = i * 1.7;
      const scale = 0.9 + Math.min(0.9, index * 0.07);
      g.scale.setScalar(scale);
      this.helperGroup.add(g);
      this.helperMeshes.push(g);
    });
  }

  private syncPeers(list: ViewState['peers']): void {
    const seen = new Set<string>();
    list.slice(0, 8).forEach((p, i) => {
      seen.add(p.id);
      let peer = this.peers.get(p.id);
      if (!peer) {
        const hue = (i * 0.17 + 0.55) % 1;
        const digger = new Digger(new THREE.Color().setHSL(hue, 0.7, 0.55).getHex(), new THREE.Color().setHSL(hue, 0.8, 0.7).getHex(), true);
        const label = nameSprite(p.name);
        label.position.y = 2.25;
        digger.group.add(label);
        this.peerGroup.add(digger.group);
        peer = { digger, label, tool: -1 };
        this.peers.set(p.id, peer);
      }
      if (peer.tool !== p.tool) { peer.tool = p.tool; peer.digger.setTool(p.tool); }
      // Fan partners out across the back of the pit, alternating right and left of centre.
      const a = -Math.PI / 2 + Math.ceil((i + 1) / 2) * 0.5 * (i % 2 ? -1 : 1);
      const r = 2.9 + (i > 3 ? 1.2 : 0);
      peer.digger.group.position.set(Math.cos(a) * r + 0.6, 0, Math.sin(a) * r);
      peer.digger.group.rotation.y = Math.atan2(-peer.digger.group.position.x, -peer.digger.group.position.z);
    });
    for (const [id, peer] of this.peers) {
      if (!seen.has(id)) { this.peerGroup.remove(peer.digger.group); peer.digger.dispose(); this.peers.delete(id); }
    }
  }

  // ------------------------------------------------------------ feedback

  /** Your own hit landed. strength 0..1 follows the tool tier. */
  hit(crit: boolean, onBarrier: boolean): void {
    const def = TOOLS[Math.max(0, this.toolTier)];
    const look = LAYERS[Math.max(0, this.layer)].look;
    this.digger.swing();
    this.machineSwing = 1;
    this.trauma = Math.min(1, this.trauma + def.shake * (crit ? 1.9 : 0.75) + (crit ? 0.12 : 0.02));
    this.scrollVel += onBarrier ? 0 : 0.5 + def.shake * 3.2 * (crit ? 1.6 : 1);
    const color = onBarrier ? LAYERS[this.layer].barrier.color : look.debris;
    const n = Math.round((4 + def.shake * 9) * (crit ? 2.4 : 1));
    this.particles.spawn(n, 0, 0.15, 0, color, 4.2 + def.shake * 5 + (crit ? 2.5 : 0), 0.8 + def.shake * 0.9);
    if (def.glow) this.particles.spawn(Math.round(n / 3), 0, 0.3, 0, def.glow, 6 + def.shake * 4, 0.5);
    if (crit) { this.ring(0xffffff, 1); this.flash = Math.max(this.flash, 1); this.flashLight.color.setHex(def.glow || 0xfff3c0); }
    else this.flash = Math.max(this.flash, 0.25 + def.shake * 0.4);
    this.floorDrop = Math.max(this.floorDrop, 0.03 + def.shake * 0.1);
  }
  private machineSwing = 0;

  peerHit(id: string): void {
    const peer = this.peers.get(id);
    if (!peer) return;
    peer.digger.swing();
    const p = peer.digger.group.position;
    this.particles.spawn(3, p.x * 0.6, 0.15, p.z * 0.6, LAYERS[Math.max(0, this.layer)].look.debris, 3.5, 0.7);
  }

  ore(color: number): void { this.particles.spawn(7, 0, 0.4, 0, color, 6.5, 0.9, 0.7); }
  find(): void { this.particles.spawn(26, 0, 0.5, 0, 0xffe082, 8, 1); this.ring(0xffd54f, 1.4); }

  private ring(color: number, size: number): void {
    const r = this.rings.reduce((a, b) => (a.t > b.t ? a : b));
    r.t = 0;
    r.mesh.visible = true;
    r.mesh.userData.size = size;
    (r.mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
  }

  barrierBreak(color: number): void {
    this.particles.spawn(140, 0, 0.4, 0, color, 11, 2.2, 1.2);
    this.particles.spawn(50, 0, 0.6, 0, 0xffffff, 13, 0.8, 1.3);
    this.ring(0xffffff, 3);
    this.ring(color, 2);
    this.trauma = 1;
    this.flash = 2.2;
    this.flashLight.color.setHex(0xffffff);
    this.scrollVel += 55;
    this.floorDrop = 2.2;
  }

  rebirth(): void {
    this.scrollVel = -160;
    this.flash = 3;
    this.flashLight.color.setHex(0x80d8ff);
    this.trauma = 0.6;
    this.particles.spawn(120, 0, 0.3, 0, 0x80d8ff, 14, 1.2, 0.8);
    this.endFinale();
  }

  coreFinale(): void {
    if (this.core) return;
    this.core = new THREE.Mesh(new THREE.IcosahedronGeometry(2.4, 1), glowMat(0xfff3b0, 0.95));
    this.core.position.y = -3;
    const halo = new THREE.Mesh(new THREE.IcosahedronGeometry(3.4, 1), glowMat(0xffb300, 0.3));
    this.core.add(halo);
    this.floorGroup.add(this.core);
    this.finale = 0.001;
    this.barrierBreak(0xffffff);
  }
  endFinale(): void {
    if (this.core) { this.floorGroup.remove(this.core); this.core = null; }
    this.finale = 0;
  }

  // ------------------------------------------------------------ frame

  update(dt: number): void {
    const s = this.state;
    if (!s) return;
    this.time += dt;
    const k = 1 - Math.exp(-dt * 3);

    // Layer colours ease from one look to the next.
    this.wallMat.color.lerp(this.target.wall, k);
    this.floorMat.color.lerp(this.target.floor, k);
    this.rubbleMat.color.copy(this.floorMat.color).multiplyScalar(0.72);
    const bg = this.scene.background as THREE.Color;
    bg.lerp(this.target.fog, k);
    (this.scene.fog as THREE.Fog).color.copy(bg);
    this.wallMat.emissive.lerp(this.target.emissive, k);
    this.glow += (this.target.glow - this.glow) * k;
    this.wallMat.emissiveIntensity = this.glow * (0.85 + Math.sin(this.time * 1.7) * 0.15);
    this.floorMat.emissive.copy(this.wallMat.emissive);
    this.floorMat.emissiveIntensity = this.glow * 0.3;
    this.hemi.color.copy(bg).lerp(new THREE.Color(0xffffff), 0.55);
    this.hemi.groundColor.copy(this.floorMat.color).multiplyScalar(0.5);
    this.hemi.intensity = 1.25 - this.glow * 0.55;
    this.sun.intensity = 1.7 - this.glow * 0.9;
    this.glowLight.color.copy(this.target.emissive);
    this.glowLight.intensity = this.glow * 60;

    // Wall scroll: every hit kicks it, friction slows it. Helpers keep a slow drift going.
    const drift = Object.keys(s.helpers).length > 0 && !s.atBarrier && !s.complete ? 0.35 : 0;
    this.scrollVel += (drift - this.scrollVel) * (1 - Math.exp(-dt * 5.5));
    const dy = this.scrollVel * dt;
    this.wallTex.offset.y -= dy / (WALL_H / TEX_REPEAT_Y);
    const dummy = this.gemDummy;
    for (let i = 0; i < this.gemData.length; i++) {
      const g = this.gemData[i];
      g.y += dy;
      if (g.y > 24) { g.y -= 26; g.a = Math.random() * Math.PI * 2; }
      if (g.y < -2) g.y += 26;
      dummy.position.set(Math.cos(g.a) * (R - 0.12), g.y, Math.sin(g.a) * (R - 0.12));
      dummy.rotation.set(g.a, g.y, this.time * 0.4 + i);
      dummy.scale.setScalar(g.s * (g.y < 0.3 ? 0 : 1));
      dummy.updateMatrix();
      this.gems.setMatrixAt(i, dummy.matrix);
    }
    this.gems.instanceMatrix.needsUpdate = true;

    // Floor recoil and the drop after a breakthrough.
    this.floorDrop *= Math.exp(-dt * (this.floorDrop > 0.5 ? 3 : 14));
    this.floorGroup.position.y = -this.floorDrop;

    // Barrier slab
    const want = s.atBarrier ? 1 : 0;
    this.barrierShown += (want - this.barrierShown) * (1 - Math.exp(-dt * 10));
    this.barrier.visible = this.barrierShown > 0.02;
    if (this.barrier.visible) {
      this.barrier.scale.set(1, Math.max(0.05, this.barrierShown), 1);
      const dmg = 1 - s.barrierFrac;
      this.barrierMat.emissive.setHex(0xff7a1a);
      this.barrierMat.emissiveIntensity = dmg * 0.9;
      this.cracks.forEach((c, i) => { c.visible = dmg > i / this.cracks.length * 0.95 + 0.02; c.scale.z = 0.3 + dmg * 0.9; });
      this.barrier.position.x = dmg > 0 ? (Math.random() - 0.5) * 0.05 * dmg : 0;
    }

    // Digger, machine, helpers, partners
    this.digger.update(dt, this.time, s.speed);
    this.machineSwing = Math.max(0, this.machineSwing - dt * Math.max(4, s.speed * 1.4));
    this.digger.machine?.update(dt, this.machineSwing, this.time);
    for (const g of this.helperMeshes) {
      const ph = g.userData.phase as number;
      const hop = Math.abs(Math.sin(this.time * 4 + ph));
      g.position.y = hop * 0.14;
      g.rotation.z = Math.sin(this.time * 8 + ph) * 0.05;
      if (g.userData.spin) (g.userData.spin as THREE.Object3D).rotation.y += dt * 3;
      const d = g.userData.digger as Digger | undefined;
      if (d) { if (Math.sin(this.time * 5 + ph) > 0.97) d.swing(); d.update(dt, this.time); }
      if (hop > 0.995 && Math.random() < 0.3) this.particles.spawn(1, g.position.x * 0.9, 0.1, g.position.z * 0.9, LAYERS[this.layer].look.debris, 2.5, 0.6);
    }
    for (const peer of this.peers.values()) peer.digger.update(dt, this.time);

    // Rings, flash, particles
    for (const r of this.rings) {
      if (!r.mesh.visible) continue;
      r.t += dt * 2.2;
      const size = (r.mesh.userData.size as number) ?? 1;
      r.mesh.scale.setScalar((0.6 + r.t * 6) * size);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 - r.t);
      if (r.t >= 1) r.mesh.visible = false;
    }
    this.flash = Math.max(0, this.flash - dt * 5);
    this.flashLight.intensity = this.flash * 45;
    this.particles.update(dt);

    // Finale: the core rises and the camera circles it.
    if (this.finale > 0 && this.core) {
      this.finale += dt;
      this.core.position.y = Math.min(2.6, -3 + this.finale * 2.2);
      this.core.rotation.y += dt * 0.5;
      this.core.scale.setScalar(1 + Math.sin(this.time * 2.5) * 0.06);
      if (Math.random() < 0.6) this.particles.spawn(2, 0, 2.6, 0, Math.random() < 0.5 ? 0xfff3b0 : 0xffb300, 9, 1, 1.4);
      this.glowLight.intensity = 220;
      this.glowLight.color.setHex(0xfff3b0);
    }

    // Camera: fixed third-person view with trauma-based shake.
    this.trauma = Math.max(0, this.trauma - dt * 1.9);
    const shake = this.trauma * this.trauma * this.shakeScale;
    const t = this.time * 38;
    const machine = this.digger.machine ? 1 : 0;
    const orbit = this.finale > 0 ? this.finale * 0.25 : Math.sin(this.time * 0.25) * 0.05;
    const portrait = this.camera.aspect < 0.8;
    const dist = (portrait ? 6.4 : 7.7) + machine * (portrait ? 4.2 : 1.6);
    this.camera.position.set(
      Math.sin(orbit) * dist + Math.sin(t * 1.3) * shake * 0.5,
      (portrait ? 5.0 : 6.0) + machine * (portrait ? 2.6 : 1.0) + Math.sin(t * 1.7 + 1) * shake * 0.5,
      Math.cos(orbit) * dist + Math.sin(t) * shake * 0.3,
    );
    this.camera.lookAt(Math.sin(t * 0.9) * shake * 0.25, (portrait ? 0.2 : 0.9) + machine * (portrait ? 1.0 : 0.7) - this.floorDrop * 0.5, 0);
    this.camera.rotation.z += Math.sin(t * 1.1) * shake * 0.035;
  }
  private gemDummy = new THREE.Object3D();

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}

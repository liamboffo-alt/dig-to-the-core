import * as THREE from 'three';
import { TOOLS } from '../data';
import { buildTool, disposeTool, glowMat, mat, type ToolModel } from './tools';

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);

/** The little low-poly person. Used for you and for co-op partners. Local forward is +Z. */
export class Digger {
  readonly group = new THREE.Group();
  private upper = new THREE.Group();     // bends at the hips
  private arms = new THREE.Group();      // swings at the shoulders
  private mount = new THREE.Group();     // where a hand tool sits
  private tool: ToolModel | null = null;
  private toolTier = -1;
  private swingT = 0;
  private bend = 0;
  private raised = -2.3;
  private strike = -0.75;
  private anim = 'swing';
  /** Machines stand on the dig spot rather than in the hands; the scene owns those. */
  machine: ToolModel | null = null;

  constructor(shirt = 0xff7043, helmet = 0xffc400, private handOnly = false) {
    const g = this.group;
    const legs = mat(0x3949ab), skin = mat(0xffcc99);
    for (const x of [-0.15, 0.15]) {
      const leg = new THREE.Mesh(box(0.2, 0.6, 0.24), legs);
      leg.position.set(x, 0.3, 0);
      g.add(leg);
      const boot = new THREE.Mesh(box(0.22, 0.12, 0.34), mat(0x4e342e));
      boot.position.set(x, 0.06, 0.05);
      g.add(boot);
    }
    this.upper.position.y = 0.6;
    g.add(this.upper);
    const torso = new THREE.Mesh(box(0.58, 0.62, 0.36), mat(shirt));
    torso.position.y = 0.33;
    const strap = new THREE.Mesh(box(0.6, 0.3, 0.38), legs);
    strap.position.y = 0.13;
    const head = new THREE.Mesh(box(0.38, 0.34, 0.36), skin);
    head.position.y = 0.84;
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.27, 0.17, 8), mat(helmet));
    hat.position.y = 1.07;
    const brim = new THREE.Mesh(box(0.46, 0.04, 0.3), mat(helmet));
    brim.position.set(0, 1.0, 0.16);
    const lamp = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), glowMat(0xfff59d));
    lamp.position.set(0, 1.09, 0.26);
    this.upper.add(torso, strap, head, hat, brim, lamp);
    for (const x of [-0.09, 0.09]) {
      const eye = new THREE.Mesh(box(0.05, 0.07, 0.02), mat(0x212121));
      eye.position.set(x, 0.87, 0.185);
      this.upper.add(eye);
    }
    this.arms.position.y = 0.56;
    this.upper.add(this.arms);
    for (const x of [-0.37, 0.37]) {
      const arm = new THREE.Mesh(box(0.15, 0.62, 0.15), mat(shirt));
      arm.position.set(x * 0.8, -0.28, 0);
      arm.rotation.z = x > 0 ? -0.28 : 0.28;
      const handMesh = new THREE.Mesh(box(0.16, 0.14, 0.16), skin);
      handMesh.position.set(x * 0.42, -0.58, 0);
      this.arms.add(arm, handMesh);
    }
    this.mount.position.set(0, -0.58, 0);
    this.arms.add(this.mount);
  }

  setTool(tier: number): void {
    if (tier === this.toolTier) return;
    this.toolTier = tier;
    if (this.tool) { this.mount.remove(this.tool.group); disposeTool(this.tool); this.tool = null; }
    if (this.machine) { disposeTool(this.machine); this.machine = null; }
    let def = TOOLS[Math.min(tier, TOOLS.length - 1)];
    let model = buildTool(def, tier);
    if (model.kind === 'machine' && this.handOnly) {
      // Partners carry a recoloured jackhammer instead of crowding the pit with machines.
      disposeTool(model);
      def = { ...def, model: 'jackhammer', anim: 'pound', color: def.glow || def.color };
      model = buildTool(def, tier);
    }
    this.anim = model.kind === 'machine' ? 'operate' : def.anim;
    if (model.kind === 'hand') {
      this.tool = model;
      this.mount.add(model.group);
      if (def.model === 'spoon') {
        this.bend = 0.95; this.raised = -1.0; this.strike = -0.35;
        this.mount.rotation.set(Math.PI, 0, 0);
      } else if (def.anim === 'pound') {
        this.bend = 0.12; this.raised = -0.95; this.strike = -0.8;
        this.mount.rotation.set(Math.PI + 0.85, 0, 0);
      } else {
        this.bend = 0.25; this.raised = -2.45; this.strike = -0.7;
        this.mount.rotation.set(Math.PI, 0, 0);
      }
    } else {
      this.machine = model;
      this.bend = 0.1; this.raised = -1.35; this.strike = -1.15;
    }
  }

  swing(): void { this.swingT = 1; }

  update(dt: number, time: number, speed = 3): void {
    this.swingT = Math.max(0, this.swingT - dt * Math.max(4.5, speed * 1.5));
    const s = this.swingT * this.swingT;
    this.arms.rotation.x = this.raised + (this.strike - this.raised) * s;
    this.upper.rotation.x = this.bend + s * 0.22;
    if (this.anim === 'pound') this.group.position.y = Math.sin(time * 60) * 0.012 * (0.4 + s);
    else this.group.position.y = this.anim === 'operate' ? Math.abs(Math.sin(time * 3)) * 0.03 : 0;
    this.tool?.update(dt, this.swingT, time);
  }

  dispose(): void {
    if (this.tool) disposeTool(this.tool);
    if (this.machine) disposeTool(this.machine);
  }
}

/** A floating name tag for co-op partners. */
export function nameSprite(text: string, color = '#ffffff'): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const c = canvas.getContext('2d')!;
  c.font = '700 30px system-ui, sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineWidth = 6; c.strokeStyle = 'rgba(0,0,0,0.75)';
  c.strokeText(text.slice(0, 14), 128, 32);
  c.fillStyle = color;
  c.fillText(text.slice(0, 14), 128, 32);
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, fog: false }));
  sprite.scale.set(2.2, 0.55, 1);
  return sprite;
}

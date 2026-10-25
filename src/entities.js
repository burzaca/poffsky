// Creatures and things: poffs (the balloon-creatures), snapwraiths, loose
// items (down / plumes / fruit), and a small particle pool.

import * as THREE from '../vendor/three.module.js';
import { CFG } from './config.js';
import { Content } from './content.js';
import { toonMaterial } from './look.js';
import { clamp, damp, TAU, angleLerp, mulberry32, hashString } from './util.js';

const POFF_SCALE = 0.62;
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();

export function buildPoffMesh(species) {
  const g = new THREE.Group();
  const col = new THREE.Color(species.color), acc = new THREE.Color(species.accent);
  const id = String(species.id);

  // ---- deterministic silhouette from the species id (never per-instance) ----
  const hash = hashString(id);
  const rnd = mulberry32(hash);
  const jit = (amt) => (rnd() * 2 - 1) * amt;
  // archetypes: [maxRadius, top, widestY, bottomExp, topExp]
  const ARCH = [
    [1.00, 0.80, -0.10, 2.6, 2.1],   // round and low
    [0.84, 1.05, -0.15, 2.4, 2.0],   // tall and thin
    [1.00, 0.95, -0.40, 2.7, 1.6],   // pear
    [0.94, 1.03, -0.30, 2.2, 1.35],  // teardrop
    [1.00, 0.70, -0.22, 3.3, 2.5],   // wide and squat
    [0.93, 0.96, 0.12, 1.9, 2.3],    // egg / top-heavy
    [0.97, 0.86, -0.55, 3.6, 1.8],   // gumdrop: heavy flat base, domed peak
    [0.90, 0.92, -0.05, 1.6, 1.7],   // lemon: tapered at both ends
  ];
  // High bits + fixed salt: FNV-1a's low bits are weak, and this salt gives
  // each of the 8 shipped species its own archetype (new ids still hash in).
  const a0 = ARCH[(hashString('silhouette492:' + id) >>> 16) % ARCH.length];
  const P = {
    w: clamp(a0[0] + jit(0.03), 0.8, 1.0),
    top: clamp(a0[1] + jit(0.04), 0.66, 1.08),
    bot: -0.92,                                    // keep the old footprint / foot line
    yw: a0[2] + jit(0.05),
    pb: a0[3] + jit(0.2),
    pt: a0[4] + jit(0.15),
  };
  // superellipse halves joined at the widest ring (zero slope there -> smooth)
  const sp = (c, e) => Math.sign(c) * Math.pow(Math.abs(c), 2 / e);
  const profile = [];
  const N = 16;
  for (let i = 0; i <= N; i++) {                   // bottom pole -> widest ring
    const th = -Math.PI / 2 + (i / N) * (Math.PI / 2);
    profile.push(new THREE.Vector2(P.w * sp(Math.cos(th), P.pb), P.yw + (P.yw - P.bot) * sp(Math.sin(th), P.pb)));
  }
  for (let i = 1; i <= N; i++) {                   // widest ring -> top pole
    const th = (i / N) * (Math.PI / 2);
    profile.push(new THREE.Vector2(P.w * sp(Math.cos(th), P.pt), P.yw + (P.top - P.yw) * sp(Math.sin(th), P.pt)));
  }
  profile[0].x = 0; profile[profile.length - 1].x = 0;
  // body radius at height y (profile y is monotonic)
  const surfR = (y) => {
    if (y <= P.bot || y >= P.top) return 0;
    for (let i = 1; i < profile.length; i++) {
      const p0 = profile[i - 1], p1 = profile[i];
      if (y <= p1.y) return p0.x + (p1.x - p0.x) * ((y - p0.y) / Math.max(1e-6, p1.y - p0.y));
    }
    return 0;
  };
  // point on the body surface at height y, yaw a (0 = facing +Z), pushed out by d
  const onSurf = (y, a, d = 0) => { const r = surfR(y) + d; return new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r); };
  const sphere = (r, sx = 1, sy = 1, sz = 1, ws = 24, hs = 16) => {
    const geo = new THREE.SphereGeometry(r, ws, hs); geo.scale(sx, sy, sz); return geo;
  };

  // ---- body ----
  const bodyMat = toonMaterial({ color: col, sway: 0.05 });
  const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 24), bodyMat);
  body.castShadow = true;
  g.add(body);

  // belly patch: offset copy of the body profile, front arc only
  const bLo = P.bot + 0.12, bHi = Math.min(P.yw + 0.42, P.top - 0.25);
  const bellyPts = [];
  for (let i = 0; i <= 14; i++) {
    const y = bLo + (bHi - bLo) * (i / 14);
    bellyPts.push(new THREE.Vector2(surfR(y) + 0.012, y));
  }
  const bellyArc = Math.PI * 0.62;
  const belly = new THREE.Mesh(new THREE.LatheGeometry(bellyPts, 20, -bellyArc / 2, bellyArc), toonMaterial({ color: acc, sway: 0.05 }));
  g.add(belly);

  // ---- eyes: flattened sclera, pupil + specular, thin upper lid ----
  const eyeG = new THREE.Group();
  const eyeY = clamp(0.22 + (P.top - 0.9) * 0.4, 0.1, 0.32);
  const rEye = surfR(eyeY);
  const eyeA = Math.asin(clamp(0.34 / Math.max(rEye, 0.4), 0, 0.9));
  const scleraMat = toonMaterial({ color: 0xffffff });
  const pupilMat = toonMaterial({ color: 0x1a1a24 });
  const glintMat = toonMaterial({ color: 0xffffff, emissive: 0xffffff });
  const lidMat = toonMaterial({ color: col.clone().multiplyScalar(0.82) });
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(sphere(0.19, 1, 1.08, 0.55, 28, 18), scleraMat);
    e.position.copy(onSurf(eyeY, sx * eyeA, -0.035));
    e.rotation.set(-0.12, sx * eyeA, 0);
    // pupil: animation drives its position at local z = 0.11
    const p = new THREE.Mesh(sphere(0.095, 1, 1.1, 0.45, 24, 16), pupilMat);
    p.position.set(0, 0, 0.11);
    const glint = new THREE.Mesh(sphere(0.03, 1, 1, 1, 16, 12), glintMat);
    glint.position.set(0.035 * -sx + 0.01, 0.04, 0.035);
    p.add(glint);
    e.add(p); e.userData.pupil = p;
    // upper lid: thin cap over the top of the sclera
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.205, 28, 10, 0, TAU, 0, Math.PI * 0.36), lidMat);
    lid.geometry.scale(1, 1.08, 0.62);
    lid.rotation.x = 0.32;
    e.add(lid);
    eyeG.add(e);
  }
  g.add(eyeG);
  g.userData.eyes = eyeG;

  // mouth: small soft smile on the surface
  const mouthY = eyeY - 0.34;
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.03, 10, 20, Math.PI), toonMaterial({ color: 0x2a2233 }));
  mouth.position.copy(onSurf(mouthY, 0, -0.012)); mouth.rotation.z = Math.PI; mouth.rotation.x = -0.15;
  g.add(mouth);

  // ---- ears or head tuft ----
  const hasTopDeco = id.includes('soot') || species.gloom || id === 'bumbleaf' || id === 'dandle' || id === 'marmalump' || id === 'toastmallow';
  const tuftStyle = !hasTopDeco && ((hash >>> 8) & 1) === 1;
  const furMat = toonMaterial({ color: col, sway: 0.05 });
  if (tuftStyle) {
    const tuftPts = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      tuftPts.push(new THREE.Vector2(0.11 * Math.sin(Math.PI * Math.pow(t, 0.7)) * (1 - t * 0.6), t * 0.36));
    }
    tuftPts[tuftPts.length - 1].x = 0;
    const tuftGeo = new THREE.LatheGeometry(tuftPts, 20);
    for (const [lean, s] of [[-0.5, 0.75], [0, 1], [0.5, 0.8]]) {
      const t = new THREE.Mesh(tuftGeo, furMat);
      t.position.set(lean * 0.12, P.top - 0.06, 0.02);
      t.rotation.z = -lean * 0.9; t.scale.setScalar(s);
      g.add(t);
    }
  } else {
    const earY = P.yw + (P.top - P.yw) * 0.62;
    const earMat = toonMaterial({ color: acc.clone().lerp(col, 0.4) });
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(sphere(0.2, 0.9, 1.45, 0.5), furMat);
      ear.position.copy(onSurf(earY, sx * 1.05, -0.06));
      ear.position.y += 0.1;
      ear.rotation.set(0, sx * 1.05, -sx * 0.45);
      const inner = new THREE.Mesh(sphere(0.12, 0.85, 1.4, 0.4), earMat);
      inner.position.set(0, -0.02, 0.06);
      ear.add(inner);
      g.add(ear);
    }
  }

  // ---- arm nubs + tail nub ----
  const armY = Math.min(P.yw + 0.08, eyeY - 0.3);
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(sphere(0.15, 0.85, 0.7, 1.15), furMat);
    arm.position.copy(onSurf(armY, sx * 1.3, -0.04));
    arm.rotation.set(0.3, sx * 1.3, -sx * 0.5);
    g.add(arm);
  }
  const tailY = P.bot + (P.yw - P.bot) * 0.5;
  const tail = new THREE.Mesh(sphere(0.17, 1, 0.95, 0.9), toonMaterial({ color: acc, sway: 0.05 }));
  tail.position.copy(onSurf(tailY, Math.PI, -0.03));
  g.add(tail);

  // ---- feet with toe bumps ----
  const feet = [];
  const footMat = toonMaterial({ color: acc.clone().multiplyScalar(0.85) });
  for (const sx of [-1, 1]) {
    const f = new THREE.Mesh(sphere(0.2, 1, 0.55, 1.3), footMat);
    f.position.set(0.36 * sx, -0.93, 0.08);
    f.rotation.y = sx * 0.18;
    for (const tx of [-1, 0, 1]) {
      const toe = new THREE.Mesh(sphere(0.06, 1, 0.8, 1, 16, 12), footMat);
      toe.position.set(tx * 0.1, -0.01, 0.22 - Math.abs(tx) * 0.04);
      f.add(toe);
    }
    g.add(f); feet.push(f);
  }
  g.userData.feet = feet;

  // ---- species decoration ----
  const deco = new THREE.Group();
  const facet = (geo) => { const n = geo.toNonIndexed(); n.computeVertexNormals(); geo.dispose(); return n; };
  if (id.includes('soot') || species.gloom) {
    // curved, tapered horn
    const hornPts = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      hornPts.push(new THREE.Vector2(0.17 * Math.pow(1 - t, 0.85) + 0.012, t * 0.55));
    }
    hornPts.push(new THREE.Vector2(0, 0.56));
    const hornGeo = new THREE.LatheGeometry(hornPts, 20);
    const pos = hornGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); pos.setZ(i, pos.getZ(i) + y * y * 0.35); }
    hornGeo.computeVertexNormals();
    const h = new THREE.Mesh(hornGeo, toonMaterial({ color: acc }));
    h.position.set(0, P.top - 0.08, 0.02); h.rotation.x = 0.15;
    deco.add(h);
  }
  if (id === 'flurrin' || id === 'sherbetto') {
    const crystalPts = [new THREE.Vector2(0, -0.2), new THREE.Vector2(0.09, -0.08), new THREE.Vector2(0.1, 0.08), new THREE.Vector2(0, 0.26)];
    const cGeo = facet(new THREE.LatheGeometry(crystalPts, 6));
    const cMat = toonMaterial({ color: 0xdff3ff, emissive: 0x1b2a3a });
    const cy = P.yw + (P.top - P.yw) * 0.55;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU + 0.5;
      const cl = new THREE.Group();
      cl.position.copy(onSurf(cy, a, -0.05));
      cl.rotation.set(0, a, 0);
      const big = new THREE.Mesh(cGeo, cMat); big.rotation.x = 0.7; cl.add(big);
      const small = new THREE.Mesh(cGeo, cMat); small.scale.setScalar(0.55); small.position.set(0.09, -0.04, 0); small.rotation.set(0.5, 0, -0.6); cl.add(small);
      deco.add(cl);
    }
  }
  if (id === 'bumbleaf' || id === 'dandle') {
    const leafPts = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; leafPts.push(new THREE.Vector2(0.15 * Math.sin(Math.PI * Math.pow(t, 0.8)), t * 0.5)); }
    leafPts[leafPts.length - 1].x = 0;
    const leafGeo = new THREE.LatheGeometry(leafPts, 20); leafGeo.scale(1, 1, 0.28);
    const leafMat = toonMaterial({ color: 0x63c46f, sway: 0.08 });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.16, 10), toonMaterial({ color: 0x4a8f45 }));
    stem.position.set(0, P.top + 0.02, 0); deco.add(stem);
    for (const [rz, s] of [[-0.6, 1], [0.75, 0.72]]) {
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.set(0, P.top + 0.08, 0); leaf.rotation.set(0, 0.4, rz); leaf.scale.setScalar(s);
      deco.add(leaf);
    }
  }
  if (id === 'marmalump' || id === 'toastmallow') {
    const swirl = new THREE.Mesh(new THREE.TorusKnotGeometry(0.2, 0.065, 96, 12, 2, 3), toonMaterial({ color: acc }));
    swirl.position.set(0, P.top + 0.06, 0); swirl.rotation.x = Math.PI / 2; swirl.scale.set(1, 1, 0.6);
    deco.add(swirl);
  }
  if (species.gloom) {
    const cloud = new THREE.Group();
    const cMat = toonMaterial({ color: 0x2b2440 });
    for (const [x, y, z, r] of [[0, 0, 0, 0.3], [-0.28, -0.05, 0.02, 0.22], [0.28, -0.04, -0.02, 0.24], [0.1, 0.16, -0.05, 0.2], [-0.12, 0.12, 0.08, 0.18]]) {
      const puff = new THREE.Mesh(sphere(r, 1, 0.85, 1), cMat);
      puff.position.set(x, y, z); cloud.add(puff);
    }
    cloud.position.set(0, P.top + 0.25, -0.1);
    deco.add(cloud);
  }
  g.add(deco);

  // Ground contact shadow: consumed and parented by the update loop (never added to g).
  const blob = new THREE.Mesh(new THREE.CircleGeometry(1, 14), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.09 }));
  blob.rotation.x = -Math.PI / 2;
  g.userData.body = body; g.userData.blob = blob; g.userData.deco = deco;
  const s = species.size * POFF_SCALE;   // world scale: a poff is a beach ball, not a barn
  g.scale.setScalar(s);
  return g;
}

export class Creatures {
  constructor(world, scene, seed = CFG.seed) {
    this.world = world; this.scene = scene;
    this.rng = mulberry32(hashString('creatures:' + seed));
    this.poffs = []; this.items = []; this.wraiths = [];
    this.group = new THREE.Group(); this.group.name = 'creatures'; scene.add(this.group);
    this.fx = new FX(scene);
    this.stats = { bred: 0, wraithsShooed: 0, photos: {}, lost: 0 };
    this.maxPoffs = 46;
  }

  // ---------- spawning ----------
  populate() {
    for (const sp of Content.poffs) {
      if (sp.hybrid_of || sp.gloom) continue;
      const isl = this.world.byId.get(sp.island) || this.world.islands[0];
      const n = sp.id === 'dandle' ? 7 : 5;
      for (let i = 0; i < n; i++) this.spawnPoff(sp.id, isl);
    }
    // a couple of strays on neighbouring islands so the world feels alive
    for (const id of ['dandle', 'dandle', 'marmalump', 'bumbleaf']) {
      const isl = this.world.islands[1 + (this.rng() * (this.world.islands.length - 1)) | 0];
      this.spawnPoff(id, isl);
    }
  }

  spawnPoff(speciesId, isl, at = null) {
    const sp = Content.byId.get(speciesId); if (!sp) return null;
    if (this.poffs.length >= this.maxPoffs) return null;
    let x, z, y;
    if (at) { x = at.x; z = at.z; y = this.world.heightAt(x, z) ?? isl.y; }
    else {
      const a = this.rng() * TAU, r = Math.sqrt(this.rng()) * (isl.r - 6);
      x = isl.x + Math.cos(a) * r; z = isl.z + Math.sin(a) * r;
      y = this.world.heightAt(x, z) ?? isl.y;
    }
    const mesh = buildPoffMesh(sp);
    mesh.position.set(x, y + sp.size * POFF_SCALE, z);
    this.group.add(mesh);
    const p = {
      kind: 'poff', species: sp, id: 'pf' + (this._n = (this._n || 0) + 1),
      pos: new THREE.Vector3(x, y + sp.size * POFF_SCALE, z), vel: new THREE.Vector3(),
      mesh, state: 'wander', timer: 0, downTimer: this.rng() * CFG.poff.downEvery,
      happy: 0, target: new THREE.Vector3(x, 0, z), homeIsland: isl.id,
      corral: null, bob: this.rng() * TAU, mass: 0.8 + sp.size * 0.7,
      stunned: 0, blinks: this.rng() * 4, hop: 0, heldBy: null, grounded: true,
      lastFed: null, born: performance.now(),
    };
    this.poffs.push(p);
    return p;
  }

  spawnWraith(isl) {
    const a = this.rng() * TAU, r = Math.sqrt(this.rng()) * isl.r;
    const x = isl.x + Math.cos(a) * r, z = isl.z + Math.sin(a) * r;
    const y = (this.world.heightAt(x, z) ?? isl.y) + 2.5 + this.rng() * 3;
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 1), toonMaterial({ color: 0x2b2f52, transparent: true, opacity: 0.85, flatShading: true }));
    g.add(core);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.6, 6), toonMaterial({ color: 0x3b3f6b, transparent: true, opacity: 0.6, flatShading: true }));
    tail.position.y = -1.0; tail.rotation.x = Math.PI; g.add(tail);
    for (const sx of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffe98a }));
      e.position.set(0.26 * sx, 0.18, 0.6); g.add(e);
    }
    g.position.set(x, y, z);
    this.group.add(g);
    const w = { kind: 'wraith', id: 'wr' + (this._w = (this._w || 0) + 1), pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(),
      mesh: g, life: CFG.wraith.life, scared: 0, bob: this.rng() * TAU, mass: 1.0, carrying: 0 };
    this.wraiths.push(w);
    return w;
  }

  spawnItem(type, x, y, z, opts = {}) {
    let mesh;
    if (type === 'down') {
      mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), toonMaterial({ color: 0xf3f6ff, flatShading: true }));
    } else if (type === 'plume') {
      mesh = new THREE.Group();
      const feather = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.0, 5), toonMaterial({ color: opts.color || 0xffe98a, flatShading: true }));
      feather.rotation.z = 0.3; mesh.add(feather);
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.3, 6, 5), new THREE.MeshBasicMaterial({ color: opts.color || 0xffe98a, transparent: true, opacity: 0.35 }));
      mesh.add(glow);
    } else {
      const f = Content.fruitById.get(type);
      mesh = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6), toonMaterial({ color: new THREE.Color(f ? f.color : '#ffffff'), flatShading: true }));
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 4), toonMaterial({ color: 0x5c8f4a }));
      stem.position.y = 0.34; mesh.add(stem);
    }
    mesh.position.set(x, y, z);
    this.group.add(mesh);
    const it = { kind: 'item', type, id: 'it' + (this._i = (this._i || 0) + 1), pos: new THREE.Vector3(x, y, z),
      vel: new THREE.Vector3(opts.vx || 0, opts.vy || 2.5, opts.vz || 0), mesh, age: 0, life: opts.life || 240,
      mass: type === 'fruit' ? 0.9 : 0.5, value: opts.value || 0, species: opts.species || null, held: null, bob: Math.random() * TAU };
    this.items.push(it);
    return it;
  }

  removeItem(it) {
    const i = this.items.indexOf(it); if (i >= 0) this.items.splice(i, 1);
    this.group.remove(it.mesh);
  }

  removePoff(p) {
    const i = this.poffs.indexOf(p); if (i >= 0) this.poffs.splice(i, 1);
    this.group.remove(p.mesh);
  }

  // ---------- queries ----------
  near(x, z, r, kinds = ['poff']) {
    const out = [];
    const r2 = r * r;
    for (const k of kinds) {
      const list = k === 'poff' ? this.poffs : k === 'item' ? this.items : this.wraiths;
      for (const o of list) {
        const dx = o.pos.x - x, dz = o.pos.z - z;
        if (dx * dx + dz * dz <= r2) out.push(o);
      }
    }
    return out;
  }

  // ---------- update ----------
  update(dt, ctx) {
    const { player, storm, night, time } = ctx;
    for (let i = this.poffs.length - 1; i >= 0; i--) {
      const p = this.poffs[i];
      this.updatePoff(p, dt, ctx);
      if (p.pos.y < CFG.world.fallRespawn) {
        // a poff that falls off the world just floats back up (they are balloons)
        const isl = this.world.byId.get(p.homeIsland) || this.world.islands[0];
        const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * (isl.r - 6);
        p.pos.set(isl.x + Math.cos(a) * r, isl.y + 2, isl.z + Math.sin(a) * r);
        p.vel.set(0, 0, 0); p.state = 'wander'; p.corral = null;
        this.stats.lost++;
        this.fx.puff(p.pos, 0xbfe9ff, 12);
      }
    }
    for (let i = this.wraiths.length - 1; i >= 0; i--) {
      const w = this.wraiths[i];
      this.updateWraith(w, dt, ctx);
      w.life -= dt;
      if (w.life <= 0 || (!night && w.life < CFG.wraith.life - 2)) {
        this.fx.puff(w.pos, 0x6b6fff, 14);
        this.group.remove(w.mesh); this.wraiths.splice(i, 1);
      }
    }
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      this.updateItem(it, dt, ctx);
      it.age += dt;
      if (it.age > it.life) { this.removeItem(it); }
    }
    this.fx.update(dt);
  }

  updatePoff(p, dt, ctx) {
    const { player, storm } = ctx;
    const sp = p.species;
    const size = sp.size;
    p.bob += dt * (1.4 + sp.drift);
    p.blinkst = (p.blinks -= dt) <= 0 ? (p.blinks = 2 + Math.random() * 4, 0.14) : Math.max(0, (p.blinkst || 0) - dt);
    p.happy = Math.max(0, p.happy - dt);
    p.stunned = Math.max(0, p.stunned - dt);

    if (p.heldBy) {
      // held in the bellows: position handled by the tool
      this.applyVisual(p, dt, ctx);
      return;
    }

    const ground = this.world.heightAt(p.pos.x, p.pos.z);
    const isl = this.world.islandAt(p.pos.x, p.pos.z);

    // steering
    let desired = _v.set(0, 0, 0);
    if (p.corral) {
      const c = p.corral;
      const dx = c.x - p.pos.x, dz = c.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > c.r - 1.2) desired.set(dx / d, 0, dz / d).multiplyScalar(2.6);
      else {
        // gentle idle inside the pen
        p.timer -= dt;
        if (p.timer <= 0) { p.timer = 2 + Math.random() * 3; p.target.set(c.x + (Math.random() - 0.5) * c.r, 0, c.z + (Math.random() - 0.5) * c.r); }
        const tx = p.target.x - p.pos.x, tz = p.target.z - p.pos.z, td = Math.hypot(tx, tz);
        if (td > 0.6) desired.set(tx / td, 0, tz / td).multiplyScalar(1.1);
      }
    } else if (p.state === 'flee') {
      const dx = p.pos.x - ctx.player.pos.x, dz = p.pos.z - ctx.player.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      desired.set(dx / d, 0, dz / d).multiplyScalar(CFG.poff.fleeSpeed * (0.6 + sp.spook));
      p.timer -= dt;
      if (p.timer <= 0) p.state = 'wander';
    } else {
      p.timer -= dt;
      if (p.timer <= 0) {
        p.timer = 3 + Math.random() * 5;
        const home = this.world.byId.get(p.homeIsland) || this.world.islands[0];
        const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * Math.min(home.r - 5, CFG.poff.wanderRadius);
        p.target.set(home.x + Math.cos(a) * r, 0, home.z + Math.sin(a) * r);
      }
      const tx = p.target.x - p.pos.x, tz = p.target.z - p.pos.z, td = Math.hypot(tx, tz);
      if (td > 1) desired.set(tx / td, 0, tz / td).multiplyScalar(1.6 + sp.drift);
      // curious ones drift toward the player if they hold a snack
      if (ctx.holdingFruit && sp.personality.includes('snack')) {
        const dx = player.pos.x - p.pos.x, dz = player.pos.z - p.pos.z, d = Math.hypot(dx, dz);
        if (d < 12 && d > 2) desired.add(_v2.set(dx / d, 0, dz / d).multiplyScalar(1.4));
      }
      // spook
      const pd = Math.hypot(player.pos.x - p.pos.x, player.pos.z - p.pos.z);
      if (pd < CFG.poff.spookRadius * (0.6 + sp.spook) && ctx.playerSpeed > 8) {
        p.state = 'flee'; p.timer = 1.2 + sp.spook;
      }
    }

    // keep them on their island: strong inward pull near the edge
    if (isl) {
      const dx = p.pos.x - isl.x, dz = p.pos.z - isl.z, d = Math.hypot(dx, dz);
      if (d > isl.r - 4) desired.add(_v2.set(-dx / d, 0, -dz / d).multiplyScalar(4.5));
    } else {
      const home = this.world.byId.get(p.homeIsland) || this.world.islands[0];
      const dx = home.x - p.pos.x, dz = home.z - p.pos.z, d = Math.hypot(dx, dz) || 1;
      desired.add(_v2.set(dx / d, 0, dz / d).multiplyScalar(7));
    }

    // storm pushes the loose ones around
    if (storm && !p.corral) {
      desired.add(_v2.set(storm.wx, 0, storm.wz).multiplyScalar(3.5 * (0.4 + sp.drift)));
    }

    const speed = clamp(desired.length(), 0, CFG.poff.fleeSpeed);
    if (speed > 0) desired.normalize().multiplyScalar(speed);
    p.vel.x = damp(p.vel.x, desired.x, 3.2, dt);
    p.vel.z = damp(p.vel.z, desired.z, 3.2, dt);

    // vertical: balloons hover above the grass
    if (ground !== null) {
      const ws = size * POFF_SCALE;
      const hover = ground + ws + 0.35 + Math.sin(p.bob) * 0.28 + sp.drift * 0.7;
      const err = hover - p.pos.y;
      p.vel.y = damp(p.vel.y, clamp(err * 2.2, -3.5, 3.5), 3.0, dt);
      if (p.pos.y <= ground + size * POFF_SCALE * 0.9 && p.hop <= 0 && Math.random() < dt * 0.5) { p.hop = 0.6; p.vel.y = 3.2 * (0.5 + sp.drift); }
      p.hop = Math.max(0, p.hop - dt);
    } else {
      p.vel.y = damp(p.vel.y, 1.2, 1.5, dt); // floating: rise slowly
    }

    p.pos.addScaledVector(p.vel, dt);
    this.applyVisual(p, dt, ctx);

    // production
    const content = p.corral ? 1 : 0.45;
    p.downTimer -= dt * (p.happy > 0 ? 2.4 : 1) * content;
    if (p.downTimer <= 0) {
      p.downTimer = p.happy > 0 ? CFG.poff.plumeEvery : CFG.poff.downEvery;
      const type = p.happy > 0 ? 'plume' : 'down';
      const val = p.happy > 0 ? Math.round(sp.value * 0.55) : Math.max(1, sp.down_value);
      const it = this.spawnItem(type, p.pos.x, p.pos.y - size * POFF_SCALE * 0.5, p.pos.z, { value: val, species: sp.id, color: sp.accent });
      it.vel.set((Math.random() - 0.5) * 1.6, 1.2, (Math.random() - 0.5) * 1.6);
      if (p.corral) it.life = 999; // penned produce stays in the pen until you collect it
    }
  }

  applyVisual(p, dt, ctx) {
    const m = p.mesh, sp = p.species, size = sp.size;
    m.position.copy(p.pos);
    // face the player when close, else travel direction
    const dx = ctx.player.pos.x - p.pos.x, dz = ctx.player.pos.z - p.pos.z;
    const near = Math.hypot(dx, dz) < 14;
    let yaw;
    if (near) yaw = Math.atan2(dx, dz);
    else if (p.vel.lengthSq() > 0.2) yaw = Math.atan2(p.vel.x, p.vel.z);
    else yaw = m.rotation.y;
    m.rotation.y = angleLerp(m.rotation.y, yaw, 1 - Math.exp(-6 * dt));
    // squash & stretch
    const stretch = clamp(p.vel.y * 0.035, -0.14, 0.18);
    const breathe = Math.sin(p.bob * 2) * 0.025;
    const ws = size * POFF_SCALE;
    m.scale.set(ws * (1 - stretch * 0.6 + breathe), ws * (1 + stretch + breathe), ws * (1 - stretch * 0.6 + breathe));
    // eyes follow the player
    if (m.userData.eyes) for (const e of m.userData.eyes.children) {
      const pu = e.userData.pupil;
      if (pu) pu.position.set(Math.sin(p.bob * 0.7) * 0.04, (p.blinkst ? -0.06 : 0), 0.11);
      e.scale.y = p.blinkst ? 0.15 : 1;
    }
    // blob shadow on the ground below
    const blob = m.userData.blob;
    if (blob) {
      if (!blob._added) { blob._added = true; }
      const g = this.world.heightAt(p.pos.x, p.pos.z);
      if (g !== null) {
        if (!blob.parent) this.group.add(blob);
        blob.renderOrder = 1;
        blob.visible = true;
        blob.position.set(p.pos.x, g + 0.03, p.pos.z);
        const h = p.pos.y - g;
        const s = clamp(size * POFF_SCALE * (1.2 - h * 0.03), 0.12, size * POFF_SCALE * 1.4);
        blob.scale.set(s, s, s);
        blob.material.opacity = clamp(0.22 - h * 0.006, 0.03, 0.22);
      } else blob.visible = false;
    }
  }

  updateWraith(w, dt, ctx) {
    w.bob += dt * 2;
    w.scared = Math.max(0, w.scared - dt);
    let target = null, best = 1e9;
    for (const it of this.items) {
      if (it.type !== 'down' || it.held) continue;
      const d = it.pos.distanceToSquared(w.pos);
      if (d < best) { best = d; target = it; }
    }
    const dp = w.pos.distanceTo(ctx.player.pos);
    if (w.scared > 0) {
      const dx = w.pos.x - ctx.player.pos.x, dz = w.pos.z - ctx.player.pos.z, d = Math.hypot(dx, dz) || 1;
      w.vel.x = damp(w.vel.x, (dx / d) * CFG.wraith.speed * 1.6, 3, dt);
      w.vel.z = damp(w.vel.z, (dz / d) * CFG.wraith.speed * 1.6, 3, dt);
      w.vel.y = damp(w.vel.y, 2.5, 3, dt);
    } else if (target) {
      const d = target.pos.clone().sub(w.pos); const len = d.length() || 1;
      d.multiplyScalar(CFG.wraith.speed / len);
      w.vel.x = damp(w.vel.x, d.x, 2.2, dt); w.vel.z = damp(w.vel.z, d.z, 2.2, dt);
      w.vel.y = damp(w.vel.y, d.y, 2.2, dt);
      if (len < 1.3) { this.removeItem(target); w.carrying++; w.life -= 6; this.fx.puff(target.pos, 0x8b7bff, 8); }
    } else {
      const dx = ctx.player.pos.x - w.pos.x, dz = ctx.player.pos.z - w.pos.z;
      w.vel.x = damp(w.vel.x, (dx / (Math.hypot(dx, dz) || 1)) * CFG.wraith.speed * 0.5, 1.5, dt);
      w.vel.z = damp(w.vel.z, (dz / (Math.hypot(dx, dz) || 1)) * CFG.wraith.speed * 0.5, 1.5, dt);
      w.vel.y = damp(w.vel.y, Math.sin(w.bob) * 1.2, 2, dt);
    }
    w.pos.addScaledVector(w.vel, dt);
    w.mesh.position.copy(w.pos);
    w.mesh.rotation.y = Math.atan2(w.vel.x, w.vel.z);
    w.mesh.scale.setScalar(1 + Math.sin(w.bob * 3) * 0.06);
    if (ctx.repelWraiths && dp < 8) w.scared = Math.max(w.scared, 0.6);
  }

  updateItem(it, dt, ctx) {
    if (it.held) { it.mesh.position.copy(it.pos); it.mesh.rotation.y += dt * 3; return; }
    const g = this.world.heightAt(it.pos.x, it.pos.z);
    it.vel.y -= CFG.world.gravity * 0.55 * dt;
    // magnet toward the player
    const d = ctx.player.pos.clone().sub(it.pos);
    const len = d.length();
    const magnet = ctx.magnetRadius || 2.6;
    if (len < magnet) {
      const pull = (1 - len / magnet) * 26;
      it.vel.addScaledVector(d.clone().multiplyScalar(1 / (len || 1)), pull * dt);
    }
    it.pos.addScaledVector(it.vel, dt);
    if (g !== null && it.pos.y < g + 0.3) {
      it.pos.y = g + 0.3;
      it.vel.y = Math.abs(it.vel.y) * 0.35;
      if (Math.abs(it.vel.y) < 0.6) it.vel.y = 0;
      it.vel.x *= 0.82; it.vel.z *= 0.82;
    }
    if (it.type === 'down' || it.type === 'plume') it.pos.y += Math.sin((it.age + it.bob) * 2.2) * 0.004;
    it.mesh.position.copy(it.pos);
    it.mesh.rotation.y += dt * 1.6;
    it.mesh.rotation.x = Math.sin(it.age * 2) * 0.2;
  }

  // feed a poff with a fruit; returns info about what happened
  feed(p, fruitId) {
    const sp = p.species;
    const child = this.tryBreed(p, fruitId);
    if (fruitId === sp.favourite_fruit) {
      p.happy = 26;
      this.fx.hearts(p.pos, sp.accent);
      return { liked: true, bred: child };
    }
    this.fx.puff(p.pos, 0x9aa0b5, 6);
    return { liked: false, bred: child };
  }

  tryBreed(p, fruitId) {
    // need another poff of the other parent species nearby
    const other = Content.poffs.find(h => h.hybrid_of && h.hybrid_of.includes(p.species.id) && h.favourite_fruit === fruitId);
    if (!other) return null;
    const partners = this.poffs.filter(q => q !== p && other.hybrid_of.includes(q.species.id));
    const partner = partners.find(q => q.pos.distanceTo(p.pos) < 6);
    if (!partner) return null;
    const child = this.spawnPoff(other.id, this.world.islandAt(p.pos.x, p.pos.z) || this.world.islands[0],
      { x: p.pos.x + (Math.random() - 0.5) * 2, z: p.pos.z + (Math.random() - 0.5) * 2 });
    if (!child) return null;
    child.homeIsland = p.homeIsland;
    this.stats.bred++;
    this.fx.burst(child.pos, other.accent, 26);
    return other;
  }
}

// ---------- particles ----------
class FX {
  constructor(scene) {
    this.pool = [];
    this.geo = new THREE.SphereGeometry(0.14, 4, 3);
    this.group = new THREE.Group(); scene.add(this.group);
  }
  get(matColor) {
    for (const m of this.pool) if (!m.alive) { m.material.color.set(matColor); return m; }
    const m = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ transparent: true }));
    this.group.add(m); this.pool.push(m); return m;
  }
  emit(pos, color, n, spread = 3, up = 2, size = 1, life = 0.7) {
    for (let i = 0; i < n; i++) {
      const m = this.get(color);
      m.alive = true; m.life = life * (0.6 + Math.random() * 0.8); m.t = 0;
      m.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.6, Math.random() * 0.4, (Math.random() - 0.5) * 0.6));
      m.vel = new THREE.Vector3((Math.random() - 0.5) * spread, Math.random() * up, (Math.random() - 0.5) * spread);
      m.scale.setScalar(size * (0.5 + Math.random()));
      m.material.opacity = 1;
    }
  }
  puff(pos, color, n = 10) { this.emit(pos, color, n, 3.5, 1.6, 0.9, 0.55); }
  burst(pos, color, n = 20) { this.emit(pos, color, n, 7, 4, 1.1, 0.9); }
  hearts(pos, color) { this.emit(pos, color, 6, 2, 3, 0.8, 1.1); }
  // Debris thrown along the wind, so a gust is something you can see rather
  // than something a number says. Long-lived and low, so it reads as leaves
  // and dust skimming the ground, not as smoke.
  gust(pos, wx, wz, color, n = 3) {
    for (let i = 0; i < n; i++) {
      const m = this.get(color);
      m.alive = true; m.life = 1.4 + Math.random() * 1.2; m.t = 0;
      m.position.copy(pos);
      m.vel = new THREE.Vector3(wx * (10 + Math.random() * 8), (Math.random() - 0.4) * 1.6, wz * (10 + Math.random() * 8));
      m.scale.setScalar(0.35 + Math.random() * 0.5);
      m.material.opacity = 0.85;
    }
  }
  update(dt) {
    for (const m of this.pool) {
      if (!m.alive) continue;
      m.t += dt;
      if (m.t > m.life) { m.alive = false; m.visible = false; continue; }
      m.visible = true;
      m.vel.y -= 4 * dt;
      m.position.addScaledVector(m.vel, dt);
      m.material.opacity = 1 - m.t / m.life;
      m.scale.multiplyScalar(1 - dt * 0.6);
    }
  }
}

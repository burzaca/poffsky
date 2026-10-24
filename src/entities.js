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
  const bodyMat = toonMaterial({ color: col, flatShading: true, sway: 0.05 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), bodyMat);
  body.scale.set(1, 0.92, 1);
  body.castShadow = true;
  g.add(body);
  // belly highlight
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.72, 10, 8), toonMaterial({ color: acc, flatShading: true, sway: 0.05 }));
  belly.position.set(0, -0.34, 0.18); belly.scale.set(1, 0.6, 1); g.add(belly);
  // eyes
  const eyeG = new THREE.Group();
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.19, 8, 6), toonMaterial({ color: 0xffffff }));
    e.position.set(0.34 * sx, 0.22, 0.82);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.095, 6, 5), new THREE.MeshBasicMaterial({ color: 0x1a1a24 }));
    p.position.set(0, 0, 0.11);
    e.add(p); e.userData.pupil = p; eyeG.add(e); g.add(e);
  }
  g.userData.eyes = eyeG;
  // mouth
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 4, 8, Math.PI), new THREE.MeshBasicMaterial({ color: 0x2a2233 }));
  mouth.position.set(0, -0.12, 0.92); mouth.rotation.z = Math.PI; g.add(mouth);
  // little feet
  const feet = [];
  for (const sx of [-1, 1]) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 5), toonMaterial({ color: acc.clone().multiplyScalar(0.85), flatShading: true }));
    f.position.set(0.36 * sx, -0.95, 0); f.rotation.x = Math.PI; g.add(f); feet.push(f);
  }
  g.userData.feet = feet;
  // species decoration
  const deco = new THREE.Group();
  if (species.id.includes('soot') || species.gloom) {
    const h = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 5), toonMaterial({ color: acc, flatShading: true }));
    h.position.set(0, 1.05, 0); deco.add(h);
  }
  if (species.id === 'flurrin' || species.id === 'sherbetto') {
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), toonMaterial({ color: 0xdff3ff, flatShading: true }));
      const a = (i / 3) * TAU; c.position.set(Math.cos(a) * 0.95, 0.55, Math.sin(a) * 0.95); deco.add(c);
    }
  }
  if (species.id === 'bumbleaf' || species.id === 'dandle') {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 4), toonMaterial({ color: 0x63c46f, flatShading: true }));
    leaf.position.set(0.1, 1.02, 0); leaf.rotation.z = -0.35; deco.add(leaf);
  }
  if (species.id === 'marmalump' || species.id === 'toastmallow') {
    const swirl = new THREE.Mesh(new THREE.TorusKnotGeometry(0.24, 0.07, 24, 4), toonMaterial({ color: acc, flatShading: true }));
    swirl.position.set(0, 1.0, 0); deco.add(swirl);
  }
  if (species.gloom) {
    const cloud = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), toonMaterial({ color: 0x2b2440, flatShading: true }));
    cloud.position.set(0, 1.15, -0.1); deco.add(cloud);
  }
  g.add(deco);
  // blob shadow (fake, cheap)
  const blob = new THREE.Mesh(new THREE.CircleGeometry(1, 14), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18 }));
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

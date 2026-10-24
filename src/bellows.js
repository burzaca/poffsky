// The Bellows: the one tool the whole game hangs on. Hold to suck, release to
// blow. Blowing with nothing held still pushes the world — herding by air.

import * as THREE from '../vendor/three.module.js';
import { CFG } from './config.js';
import { clamp, TAU } from './util.js';

export class Bellows {
  constructor(world, creatures, player, scene) {
    this.world = world; this.cr = creatures; this.player = player; this.scene = scene;
    this.held = null; this.heldKind = null;   // 'poff' | 'item' | 'wraith'
    this.tank = 1; this.sucking = false; this.target = null;
    this.stats = { sucked: 0, blown: 0, penned: 0 };
    this.up = { range: 0, force: 0, tank: 0 };

    // suction cone visual
    const coneGeo = new THREE.ConeGeometry(1.5, CFG.bellows.range, 12, 1, true);
    coneGeo.rotateX(-Math.PI / 2);
    coneGeo.translate(0, 0, -CFG.bellows.range / 2);
    this.cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({
      color: 0xbfe9ff, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false,
    }));
    this.cone.renderOrder = 3;
    scene.add(this.cone);

    // stream particles
    const N = 40;
    const pg = new THREE.BufferGeometry();
    this.streamPos = new Float32Array(N * 3);
    pg.setAttribute('position', new THREE.BufferAttribute(this.streamPos, 3));
    this.stream = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xeaf7ff, size: 0.22, transparent: true, opacity: 0, depthWrite: false }));
    this.stream.frustumCulled = false;
    this.streamSeeds = Array.from({ length: N }, () => ({ t: Math.random(), a: Math.random() * TAU, r: 0.3 + Math.random() * 1.1 }));
    scene.add(this.stream);

    // shockwave ring for blows
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.9, 24), new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    this.ringVisible = false; this.ringT = 0;
    scene.add(this.ring);
  }

  nozzle() {
    const p = this.player;
    const yaw = p.cam.yaw;
    const cp = Math.cos(p.cam.pitch), sp = Math.sin(p.cam.pitch);
    const dir = new THREE.Vector3(Math.sin(yaw) * cp, sp, Math.cos(yaw) * cp);
    const origin = p.pos.clone().add(new THREE.Vector3(0, 0.35, 0)).addScaledVector(dir, 0.8);
    return { origin, dir };
  }

  range() { return CFG.bellows.range + this.up.range; }
  forceMul() { return 1 + this.up.force; }
  tankMax() { return 1 + this.up.tank * 0.5; }

  canLift(o) {
    if (o.kind === 'poff') return o.species.gloom ? o.mass * 1.3 <= CFG.bellows.maxMass + this.up.tank : o.mass <= CFG.bellows.maxMass + this.up.tank;
    return true;
  }

  update(dt, input, ctx) {
    const { origin, dir } = this.nozzle();
    const range = this.range();
    this.tank = clamp(this.tank + (input.hold ? -CFG.bellows.tankSuckRate : CFG.bellows.tankRegen) * dt, 0, this.tankMax());

    // ---- acquire ----
    if (input.hold && !this.held && this.tank > 0.02) {
      const cands = this.cr.near(this.player.pos.x, this.player.pos.z, range, ['poff', 'item', 'wraith']);
      let best = null, bestD = range;
      for (const o of cands) {
        if (o.held || o.heldBy) continue;
        if (o.kind === 'poff' && o.corral && !input.force) continue;
        if (!this.canLift(o)) continue;
        const v = o.pos.clone().sub(origin);
        const d = v.length();
        if (d > range) continue;
        const ang = Math.acos(clamp(v.normalize().dot(dir), -1, 1));
        if (ang > CFG.bellows.blastCone + 0.35 * (1 - d / range)) continue;
        if (d < bestD) { bestD = d; best = o; }
      }
      if (best) {
        this.held = best;
        this.stats.sucked++;
        if (best.kind === 'poff') { best.heldBy = this; best.state = 'held'; }
        else { best.held = this; }
        this.sfx && this.sfx.grab();
      }
    }

    // ---- hold ----
    if (this.held) {
      const holdPoint = origin.clone().addScaledVector(dir, 1.9);
      const o = this.held;
      const to = holdPoint.clone().sub(o.pos);
      const d = to.length();
      if (d > 0.02) {
        const pull = clamp(d * 14, 0, 40);
        o.vel.addScaledVector(to.normalize(), pull * dt);
        o.pos.addScaledVector(o.vel, dt * 0.35);
        o.vel.multiplyScalar(0.82);
      }
      if (o.kind === 'poff') { o.pos.lerp(holdPoint, 1 - Math.exp(-12 * dt)); o.vel.set(0, 0, 0); }
      else { o.pos.lerp(holdPoint, 1 - Math.exp(-18 * dt)); o.vel.set(0, 0, 0); }
      this.sucking = true;
    } else this.sucking = false;

    // ---- release / blow ----
    if (input.release) {
      input.release = false;
      if (this.held) {
        const o = this.held;
        const power = (o.kind === 'poff' ? CFG.bellows.blowForce * 0.85 : CFG.bellows.blowForce) * this.forceMul();
        o.vel.copy(dir).multiplyScalar(power);
        if (o.kind === 'item' && o.type === 'fruit') o.vel.y += 2;
        if (o.kind === 'poff') { o.heldBy = null; o.state = 'wander'; o.stunned = 0.5; }
        else { o.held = null; }
        this.held = null;
        this.stats.blown++;
        this.showRing(origin.clone().addScaledVector(dir, 1.2), dir);
        this.sfx && this.sfx.blow();
        ctx.onBlow && ctx.onBlow(o, dir);
      } else {
        // air blast: push everything in a cone
        const cands = this.cr.near(this.player.pos.x, this.player.pos.z, range * 0.7, ['poff', 'item', 'wraith']);
        let hit = 0;
        for (const o of cands) {
          const v = o.pos.clone().sub(origin); const d = v.length();
          if (d > range * 0.7) continue;
          if (Math.acos(clamp(v.normalize().dot(dir), -1, 1)) > 0.75) continue;
          const power = (1 - d / (range * 0.7)) * 14 * this.forceMul();
          o.vel.addScaledVector(dir, power);
          if (o.kind === 'poff') { o.stunned = 0.35; o.state = 'flee'; o.timer = 0.6; }
          if (o.kind === 'wraith') { o.scared = 2.2; hit++; ctx.onShoo && ctx.onShoo(o); }
        }
        this.showRing(origin.clone().addScaledVector(dir, 1.0), dir);
        this.sfx && this.sfx.blow();
        ctx.onAirBlow && ctx.onAirBlow(hit);
      }
    }

    // ---- visuals ----
    const coneOn = this.sucking || (input.hold && this.tank > 0.02);
    this.cone.material.opacity = THREE.MathUtils.damp(this.cone.material.opacity, coneOn ? 0.13 : 0, 12, dt);
    this.cone.visible = this.cone.material.opacity > 0.005;
    this.cone.position.copy(origin);
    this.cone.lookAt(origin.clone().addScaledVector(dir, 1));
    this.cone.scale.setScalar(clamp(this.tank, 0.15, 1));

    const streamOn = this.sucking ? 0.75 : coneOn ? 0.25 : 0;
    this.stream.material.opacity = THREE.MathUtils.damp(this.stream.material.opacity, streamOn, 10, dt);
    this.stream.visible = this.stream.material.opacity > 0.01;
    if (this.stream.visible) {
      const L = range * 0.8;
      const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
      const up = new THREE.Vector3().crossVectors(right, dir).normalize();
      for (let i = 0; i < this.streamSeeds.length; i++) {
        const s = this.streamSeeds[i];
        s.t -= dt * 0.9; if (s.t < 0) { s.t = 1; s.a = Math.random() * TAU; s.r = 0.3 + Math.random() * 1.1; }
        const dist = s.t * L;
        const rr = s.r * (1 - s.t) * 0.9;
        const p = origin.clone().addScaledVector(dir, dist)
          .addScaledVector(right, Math.cos(s.a + this.tank * 6) * rr)
          .addScaledVector(up, Math.sin(s.a + this.tank * 6) * rr);
        this.streamPos[i * 3] = p.x; this.streamPos[i * 3 + 1] = p.y; this.streamPos[i * 3 + 2] = p.z;
      }
      this.stream.geometry.attributes.position.needsUpdate = true;
    }

    if (this.ringVisible) {
      this.ringT += dt;
      const t = this.ringT / 0.35;
      if (t >= 1) { this.ringVisible = false; this.ring.material.opacity = 0; }
      else {
        this.ring.scale.setScalar(0.5 + t * 4.5);
        this.ring.material.opacity = (1 - t) * 0.7;
      }
    }
  }

  showRing(pos, dir) {
    this.ring.position.copy(pos);
    this.ring.lookAt(pos.clone().addScaledVector(dir, 1));
    this.ringVisible = true; this.ringT = 0;
  }

  drop() {
    if (!this.held) return;
    const o = this.held;
    o.vel.set(0, 1.5, 0);
    if (o.kind === 'poff') { o.heldBy = null; o.state = 'wander'; } else o.held = null;
    this.held = null;
  }
}

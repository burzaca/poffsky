// The player: a courier-rancher with a Bellows. Third-person controller with
// run / dash / double-jump / glide / self-blast, plus a procedural character
// rig and a follow camera.

import * as THREE from '../vendor/three.module.js';
import { CFG } from './config.js';
import { clamp, damp, dampVec, TAU, angleLerp } from './util.js';
import { toonMaterial } from './look.js';

export function buildHero() {
  const g = new THREE.Group();
  const skin = toonMaterial({ color: 0xf0c8a0, flatShading: true });
  const coat = toonMaterial({ color: 0x2f6f8f, flatShading: true });
  const coat2 = toonMaterial({ color: 0x255a76, flatShading: true });
  const dark = toonMaterial({ color: 0x2b2f3a, flatShading: true });
  const accent = toonMaterial({ color: 0xffb347, flatShading: true });

  const body = new THREE.Group(); g.add(body);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.5, 3, 8), coat);
  torso.position.y = 0.95; torso.castShadow = true; body.add(torso);
  const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.62, 8), coat2);
  skirt.position.y = 0.66; skirt.castShadow = true; body.add(skirt);
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.09, 5, 10), accent);
  scarf.position.y = 1.28; scarf.rotation.x = Math.PI / 2; body.add(scarf);
  const scarfTail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 0.05), accent);
  scarfTail.position.set(0.18, 1.1, 0.22); scarfTail.rotation.z = -0.3; body.add(scarfTail);

  const head = new THREE.Group(); head.position.y = 1.5; body.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), skin);
  skull.castShadow = true; head.add(skull);
  const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 12), toonMaterial({ color: 0x8a5a3a, flatShading: true }));
  hatBrim.position.y = 0.2; head.add(hatBrim);
  const hatTop = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.26, 12), toonMaterial({ color: 0x9a6a45, flatShading: true }));
  hatTop.position.y = 0.34; hatTop.castShadow = true; head.add(hatTop);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.305, 0.305, 0.07, 12), accent);
  band.position.y = 0.23; head.add(band);
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), new THREE.MeshBasicMaterial({ color: 0x1a1a24 }));
    e.position.set(0.11 * sx, 0.03, 0.26); head.add(e);
  }
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.26), toonMaterial({ color: 0x7a5638, flatShading: true }));
  pack.position.set(0, 1.0, -0.36); pack.castShadow = true; body.add(pack);
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.44, 8), accent);
  roll.rotation.z = Math.PI / 2; roll.position.set(0, 1.24, -0.36); body.add(roll);

  const legL = new THREE.Group(), legR = new THREE.Group();
  for (const [grp, sx] of [[legL, -1], [legR, 1]]) {
    grp.position.set(0.16 * sx, 0.62, 0); body.add(grp);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.4, 2, 6), dark);
    leg.position.y = -0.3; leg.castShadow = true; grp.add(leg);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.3), toonMaterial({ color: 0x5a3f2a, flatShading: true }));
    boot.position.set(0, -0.6, 0.05); grp.add(boot);
  }
  const armL = new THREE.Group(), armR = new THREE.Group();
  for (const [grp, sx] of [[armL, -1], [armR, 1]]) {
    grp.position.set(0.38 * sx, 1.2, 0); body.add(grp);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.36, 2, 6), coat);
    arm.position.y = -0.26; arm.castShadow = true; grp.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), skin);
    hand.position.y = -0.5; grp.add(hand);
  }

  // the Bellows, held in the right hand
  const bellows = new THREE.Group();
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 0.72, 8), toonMaterial({ color: 0xd8d3c8, flatShading: true }));
  barrel.rotation.x = Math.PI / 2; bellows.add(barrel);
  const bellowsBag = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), toonMaterial({ color: 0xff8a5c, flatShading: true }));
  bellowsBag.scale.set(1, 1, 0.8); bellowsBag.position.z = -0.28; bellows.add(bellowsBag);
  const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.13, 0.16, 8), toonMaterial({ color: 0xffb347, flatShading: true }));
  muzzle.rotation.x = Math.PI / 2; muzzle.position.z = 0.42; bellows.add(muzzle);
  bellows.position.set(0, -0.5, 0.12);
  armR.add(bellows);

  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 }));
  blob.rotation.x = -Math.PI / 2;

  // glider cloth (hidden until unlocked)
  const glider = new THREE.Mesh(new THREE.ConeGeometry(1.1, 0.9, 6, 1, true), toonMaterial({ color: 0xff9e6b, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
  glider.position.y = 1.1; glider.visible = false; body.add(glider);

  g.userData = { body, torso, head, legL, legR, armL, armR, bellows, blob, glider, scarfTail, hatTop };
  return g;
}

export class Player {
  constructor(world, scene, spawn) {
    this.world = world;
    this.pos = new THREE.Vector3(spawn.x, spawn.y + 2, spawn.z);
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.moveYaw = 0;
    this.grounded = false; this.jumps = 0; this.dashT = 0; this.dashCd = 0;
    this.blastCd = 0; this.airTime = 0; this.speed = 0; this.gliding = false;
    this.up = { hops: 1, glider: false, selfBlast: false, jumpMul: 1, gustRide: 1 };
    this.mesh = buildHero();
    scene.add(this.mesh);
    scene.add(this.mesh.userData.blob);
    this.input = { f: 0, b: 0, l: 0, r: 0, sprint: false, jump: false, dash: false, blast: false };
    this.jumpQueued = false;
    this.cam = { yaw: 0, pitch: 0.32, dist: CFG.camera.distance, shake: 0 };
    this.toe = 0;
    this.alive = true;
    this.lastGround = spawn;
  }

  queueJump() { this.jumpQueued = true; }

  groundAt(x, z) { return this.world.heightAt(x, z); }

  update(dt, ctx) {
    const inp = this.input;
    const maxJumps = 1 + this.up.hops;
    // ---- desired movement ----
    let mx = (inp.r - inp.l), mz = (inp.b - inp.f);
    const mag = Math.hypot(mx, mz);
    if (mag > 0) { mx /= mag; mz /= mag; }
    const camYaw = this.cam.yaw;
    const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
    const wx = mx * cos - mz * sin;
    const wz = mx * sin + mz * cos;

    const sprinting = inp.sprint && mag > 0;
    const topSpeed = (sprinting ? CFG.player.sprint : CFG.player.speed) * (ctx.storm ? 0.94 : 1);
    const accel = this.grounded ? CFG.player.accel : CFG.player.airAccel;

    if (this.dashT > 0) {
      this.dashT -= dt;
      this.vel.x = this.dashDir.x; this.vel.z = this.dashDir.z;
    } else if (mag > 0) {
      this.moveYaw = Math.atan2(wx, wz);
      const tx = wx * topSpeed, tz = wz * topSpeed;
      this.vel.x = damp(this.vel.x, tx, accel / topSpeed, dt);
      this.vel.z = damp(this.vel.z, tz, accel / topSpeed, dt);
    } else if (this.grounded) {
      this.vel.x = damp(this.vel.x, 0, CFG.player.friction, dt);
      this.vel.z = damp(this.vel.z, 0, CFG.player.friction, dt);
    }

    if (inp.dash && this.dashCd <= 0 && mag > 0) {
      this.dashT = CFG.player.dashTime; this.dashCd = CFG.player.dashCooldown;
      this.dashDir = new THREE.Vector3(wx * CFG.player.dashSpeed, 0, wz * CFG.player.dashSpeed);
      ctx.onDash && ctx.onDash();
    }
    this.dashCd -= dt;

    // ---- jump / glide ----
    if (this.jumpQueued) {
      this.jumpQueued = false;
      if (this.grounded) {
        this.vel.y = CFG.player.jump * this.up.jumpMul;
        this.grounded = false; this.jumps = 1; ctx.onJump && ctx.onJump();
      } else if (this.jumps < maxJumps) {
        this.vel.y = CFG.player.doubleJump * this.up.jumpMul;
        this.jumps++; ctx.onDoubleJump && ctx.onDoubleJump();
      }
    }

    // self-blast: point down, leave the ground
    this.blastCd -= dt;
    if (inp.blast && this.up.selfBlast && this.blastCd <= 0) {
      this.vel.y = Math.max(this.vel.y, CFG.player.selfBlast);
      this.blastCd = CFG.player.selfBlastCooldown;
      this.jumps = Math.max(this.jumps, 1);
      ctx.onBlast && ctx.onBlast(this.pos);
      inp.blast = false;
    }

    let grav = CFG.world.gravity;
    this.gliding = false;
    if (this.up.glider && !this.grounded && this.vel.y < 0 && (inp.f || inp.b || inp.l || inp.r)) {
      grav = CFG.world.gravity * 0.22;
      this.vel.y = Math.max(this.vel.y, -CFG.player.glideFall);
      this.gliding = true;
    }
    this.vel.y -= grav * dt;

    // ---- world forces: ribbons, geysers, storm ----
    for (const rb of this.world.ribbons) {
      const d = this.ribbonDist(rb);
      if (d !== null) {
        const k = rb.speed * this.up.gustRide;
        this.vel.x = damp(this.vel.x, rb.nx * k, 4, dt);
        this.vel.z = damp(this.vel.z, rb.nz * k, 4, dt);
        this.vel.y = damp(this.vel.y, rb.lift * 1.4, 3, dt);
        ctx.onRibbon && ctx.onRibbon(rb);
      }
    }
    for (const gy of this.world.geysers) {
      const dx = this.pos.x - gy.x, dz = this.pos.z - gy.z;
      const d = Math.hypot(dx, dz);
      const g = this.groundAt(gy.x, gy.z);
      if (d < gy.r && g !== null && this.pos.y < g + 3.5) {
        this.vel.y = gy.power;
        this.jumps = Math.max(this.jumps, 1);
        ctx.onGeyser && ctx.onGeyser(gy);
      }
    }
    if (ctx.storm) {
      this.vel.x += ctx.storm.wx * 4 * dt;
      this.vel.z += ctx.storm.wz * 4 * dt;
    }

    // ---- integrate + collide ----
    this.pos.addScaledVector(this.vel, dt);
    const g = this.groundAt(this.pos.x, this.pos.z);
    const R = CFG.player.radius;
    if (g !== null) {
      if (this.pos.y <= g + R) {
        if (this.vel.y < -12) ctx.onHardLand && ctx.onHardLand(this.pos, this.vel.y);
        this.pos.y = g + R;
        this.vel.y = 0;
        if (!this.grounded) { this.jumps = 0; ctx.onLand && ctx.onLand(this.pos); }
        this.grounded = true;
        this.lastGround = { x: this.pos.x, z: this.pos.z, y: g };
      } else {
        this.grounded = false;
      }
      // wall at the island rim: if the ground drops away steeply just ahead, push back
      const aheadX = this.pos.x + this.vel.x * dt * 1.5, aheadZ = this.pos.z + this.vel.z * dt * 1.5;
      const ga = this.groundAt(aheadX, aheadZ);
      if (ga !== null && ga - (g) > 1.6 && this.pos.y < g + 1.2) {
        const isl = this.world.islandAt(this.pos.x, this.pos.z);
        if (isl) {
          const nx = (this.pos.x - isl.x), nz = (this.pos.z - isl.z), nl = Math.hypot(nx, nz) || 1;
          this.vel.x -= (nx / nl) * 12 * dt * 6;
          this.vel.z -= (nz / nl) * 12 * dt * 6;
        }
      }
    } else {
      this.grounded = false;
    }

    // jelly pads bounce
    for (const p of this.world.props) {
      if (p.kind !== 'jellyPad') continue;
      const dx = this.pos.x - p.x, dz = this.pos.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < p.s && this.pos.y < p.y + p.s * 0.7 && this.pos.y > p.y - 1.5 && this.vel.y < 0) {
        this.vel.y = Math.max(12, -this.vel.y * 1.15);
        this.jumps = Math.max(this.jumps, 1);
        ctx.onBounce && ctx.onBounce(p);
      }
    }

    this.speed = Math.hypot(this.vel.x, this.vel.z);

    // fell into the cloud sea
    if (this.pos.y < CFG.world.fallRespawn) {
      ctx.onFall && ctx.onFall();
      const home = this.world.byId.get('thistledown');
      this.pos.set(home.x, home.y + 6, home.z + 8);
      this.vel.set(0, 0, 0);
      this.cam.shake = 1;
    }

    this.animate(dt, ctx);
  }

  ribbonDist(rb) {
    const px = this.pos.x - rb.ax, pz = this.pos.z - rb.az;
    const along = px * rb.nx + pz * rb.nz;
    if (along < 0 || along > rb.len) return null;
    const side = Math.abs(px * -rb.nz + pz * rb.nx);
    if (side > rb.width * 0.5) return null;
    const y = rb.y;
    if (this.pos.y < y - 4 || this.pos.y > y + 7) return null;
    return side;
  }

  animate(dt, ctx) {
    const m = this.mesh, u = m.userData;
    m.position.copy(this.pos).sub(new THREE.Vector3(0, CFG.player.radius, 0));
    // face movement direction while moving, else camera yaw
    let target = this.yaw;
    if (this.speed > 0.6) target = this.moveYaw;
    else if (Math.abs(this.input.f || this.input.b || this.input.l || this.input.r ? 1 : 0)) target = this.moveYaw;
    this.yaw = angleLerp(this.yaw, target, 1 - Math.exp(-14 * dt));
    u.body.rotation.y = this.yaw;

    const moving = this.speed > 0.6 && this.grounded;
    this.toe += dt * (moving ? clamp(this.speed * 1.5, 4, 16) : 2);
    const swing = moving ? Math.sin(this.toe) * clamp(this.speed / CFG.player.sprint, 0.2, 1) * 0.85 : Math.sin(this.toe) * 0.05;
    u.legL.rotation.x = swing; u.legR.rotation.x = -swing;
    u.armL.rotation.x = -swing * 0.7;
    // right arm holds the bellows: aims where the camera aims
    u.armR.rotation.x = -0.5 - this.cam.pitch * 0.8;
    u.armR.rotation.z = 0.12;

    // body lean into movement + jump pose
    const lean = clamp(this.speed / CFG.player.sprint, 0, 1) * 0.22;
    u.body.rotation.x = this.grounded ? lean : (this.vel.y > 0 ? -0.12 : 0.08);
    u.body.position.y = this.grounded ? Math.abs(Math.sin(this.toe)) * 0.04 * clamp(this.speed / 6, 0, 1) : 0;
    if (!this.grounded) {
      u.legL.rotation.x = -0.5; u.legR.rotation.x = 0.35;
    }
    u.glider.visible = this.gliding;
    if (this.gliding) u.glider.rotation.y += dt * 2;
    u.scarfTail.rotation.z = -0.3 - clamp(this.speed / CFG.player.sprint, 0, 1) * 0.9;

    // blob shadow
    const g = this.world.heightAt(this.pos.x, this.pos.z);
    if (g !== null) {
      u.blob.visible = true;
      u.blob.position.set(this.pos.x, g + 0.02, this.pos.z);
      const h = this.pos.y - g;
      const s = clamp(1 - h * 0.04, 0.25, 1);
      u.blob.scale.set(s, s, s);
      u.blob.material.opacity = 0.22 * s;
    } else u.blob.visible = false;
  }

  // ---- camera ----
  updateCamera(dt, camera) {
    const c = this.cam;
    c.shake = Math.max(0, c.shake - dt * 2.2);
    const target = new THREE.Vector3(this.pos.x, this.pos.y + CFG.camera.height * 0.55, this.pos.z);
    const cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
    const off = new THREE.Vector3(
      -Math.sin(c.yaw) * cp,
      -sp,
      -Math.cos(c.yaw) * cp
    ).multiplyScalar(c.dist);
    const want = target.clone().add(off);
    // keep the camera out of the terrain
    const g = this.world.heightAt(want.x, want.z);
    if (g !== null && want.y < g + 0.8) want.y = g + 0.8;
    const k = 1 - Math.exp(-14 * dt);
    camera.position.lerp(want, k);
    if (c.shake > 0) {
      camera.position.x += (Math.random() - 0.5) * c.shake * 0.35;
      camera.position.y += (Math.random() - 0.5) * c.shake * 0.35;
    }
    camera.lookAt(target);
  }
}

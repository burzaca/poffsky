// The player: a courier-rancher with a Bellows. Third-person controller with
// run / dash / double-jump / glide / self-blast, plus a procedural character
// rig and a follow camera.

import * as THREE from '../vendor/three.module.js';
import { CFG } from './config.js';

// Camera-relative movement. The camera sits at
//   target + dist * (-sin yaw, -sin pitch, -cos yaw)
// so it looks along (sin yaw, ..., cos yaw). That vector is "forward". The
// screen-right vector is up x forward = (-cos yaw, ..., sin yaw) -- note the
// sign; getting it backwards is the "D strafes left" bug, and getting the
// forward basis wrong is the "W moves me left" bug. Both are invisible in a
// screenshot, so this is a pure function with a test, not inline arithmetic.
export function moveBasis(yaw, inp) {
  const sin = Math.sin(yaw), cos = Math.cos(yaw);
  let mx = (inp.r || 0) - (inp.l || 0);
  let mz = (inp.f || 0) - (inp.b || 0);          // +1 forward, -1 back
  const mag = Math.hypot(mx, mz);
  if (mag > 0) { mx /= mag; mz /= mag; }
  // right = up x forward = (-cos yaw, 0, sin yaw)
  return {
    wx: mz * sin - mx * cos,
    wz: mz * cos + mx * sin,
    mag: Math.min(mag, 1),
  };
}
import { clamp, damp, dampVec, TAU, angleLerp } from './util.js';
import { toonMaterial } from './look.js';

// A lathe profile: revolve a smooth outline. This is what separates a model
// from a stack of primitives - a coat that tapers, a brim that curves, a boot
// that rounds off. Points are [radius, height]; the first point should sit on
// the axis (radius 0) if you want a closed bottom.
export function lathe(points, segments = 24, arc = Math.PI * 2) {
  return new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y)), segments, arc);
}

// A smooth, slightly tapered limb. Capsules read as cylinders with caps; a
// lathe lets the shoulder be wider than the wrist, which is what a sleeve does.
export function limb(topR, botR, len, seg = 14) {
  const pts = [];
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r = topR + (botR - topR) * t;
    // round the ends so nothing terminates in a hard ring
    const cap = Math.sin(Math.min(1, Math.min(t, 1 - t) * 4.5) * Math.PI * 0.5);
    pts.push([Math.max(0.001, r * (0.72 + 0.28 * cap)), len * (0.5 - t)]);
  }
  return lathe(pts, seg);
}

export function buildHero() {
  const g = new THREE.Group();
  // Smooth shading throughout. flatShading on low-segment primitives is exactly
  // what made this read as a Roblox avatar.
  const skin = toonMaterial({ color: 0xf2c9a4 });
  const coat = toonMaterial({ color: 0x2f6f8f });
  const coat2 = toonMaterial({ color: 0x24587a });
  const dark = toonMaterial({ color: 0x2b2f3a });
  const accent = toonMaterial({ color: 0xffb347 });
  const leather = toonMaterial({ color: 0x6b4a2c });
  const hairMat = toonMaterial({ color: 0x3a2a20 });

  const body = new THREE.Group(); g.add(body);

  // Torso: a coat that is narrow at the chest, cinched at the belt and flares
  // over the hips, instead of a capsule with a cone stuck under it.
  const torso = new THREE.Mesh(lathe([
    [0.001, 0.00], [0.34, 0.02], [0.37, 0.14], [0.33, 0.30],
    [0.28, 0.44], [0.30, 0.56], [0.27, 0.66], [0.20, 0.74], [0.10, 0.79], [0.001, 0.81],
  ]), coat);
  torso.position.y = 0.62; torso.castShadow = true; body.add(torso);

  // Coat hem: a separate skirt band so the flare reads as cloth, not a cone.
  const hem = new THREE.Mesh(lathe([
    [0.001, 0.00], [0.36, 0.01], [0.42, 0.10], [0.44, 0.22], [0.38, 0.30], [0.001, 0.31],
  ]), coat2);
  hem.position.y = 0.50; hem.castShadow = true; body.add(hem);

  // Belt and buckle give the silhouette a waist, which the old rig lacked.
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.315, 0.045, 8, 22), leather);
  belt.position.y = 1.06; belt.rotation.x = Math.PI / 2; body.add(belt);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.05), accent);
  buckle.position.set(0, 1.06, 0.32); body.add(buckle);

  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.075, 10, 20), accent);
  scarf.position.y = 1.40; scarf.rotation.x = Math.PI / 2; body.add(scarf);
  const scarfTail = new THREE.Mesh(lathe([
    [0.001, 0.00], [0.09, 0.02], [0.10, 0.20], [0.07, 0.36], [0.001, 0.38],
  ]), accent);
  scarfTail.position.set(0.16, 1.16, 0.20); scarfTail.rotation.z = -0.3; body.add(scarfTail);

  const head = new THREE.Group(); head.position.y = 1.62; body.add(head);
  // Head is slightly ovoid rather than a sphere, with a flattened face plane.
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.235, 32, 24), skin);
  skull.scale.set(1, 1.06, 0.96); skull.castShadow = true; head.add(skull);

  // Hair: a cap over the crown plus a soft fringe, so the hat sits on hair.
  const hair = new THREE.Mesh(lathe([
    [0.001, 0.00], [0.16, 0.02], [0.235, 0.10], [0.245, 0.20], [0.20, 0.26], [0.001, 0.27],
  ]), hairMat);
  hair.position.y = 0.02; head.add(hair);
  const fringe = new THREE.Mesh(new THREE.SphereGeometry(0.10, 16, 12), hairMat);
  fringe.scale.set(1.9, 0.45, 0.7); fringe.position.set(0, 0.16, 0.17); head.add(fringe);

  // Eyes: flattened sclera, pupil, and a specular highlight. Googly stickers
  // with no highlight are a large part of the toy look.
  for (const sx of [-1, 1]) {
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 12), toonMaterial({ color: 0xf7f7fa }));
    white.scale.set(1, 1.15, 0.55); white.position.set(0.098 * sx, 0.015, 0.205); head.add(white);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 10), new THREE.MeshBasicMaterial({ color: 0x1a1a24 }));
    pupil.position.set(0.098 * sx, 0.012, 0.243); head.add(pupil);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.010, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    glint.position.set(0.098 * sx + 0.012, 0.032, 0.256); head.add(glint);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.014, 0.02), hairMat);
    brow.position.set(0.098 * sx, 0.075, 0.212); brow.rotation.z = -0.12 * sx; head.add(brow);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 6, 12, Math.PI), new THREE.MeshBasicMaterial({ color: 0x6b3f2c }));
  mouth.position.set(0, -0.075, 0.215); mouth.rotation.z = Math.PI; head.add(mouth);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 10), skin);
  nose.scale.set(0.8, 0.9, 1.1); nose.position.set(0, -0.02, 0.235); head.add(nose);

  // Hat: a curved brim (lathe) instead of a flat cylinder disc.
  const hatBrim = new THREE.Mesh(lathe([
    [0.001, 0.16], [0.19, 0.15], [0.26, 0.11], [0.34, 0.05], [0.40, 0.00], [0.41, -0.02], [0.34, -0.03], [0.001, -0.04],
  ]), leather);
  hatBrim.position.y = 0.20; hatBrim.castShadow = true; head.add(hatBrim);
  const hatTop = new THREE.Mesh(lathe([
    [0.001, 0.00], [0.24, 0.01], [0.26, 0.10], [0.25, 0.22], [0.20, 0.30], [0.10, 0.34], [0.001, 0.35],
  ]), toonMaterial({ color: 0x8a5a3a }));
  hatTop.position.y = 0.24; hatTop.castShadow = true; head.add(hatTop);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.028, 8, 22), accent);
  band.position.y = 0.30; band.rotation.x = Math.PI / 2; head.add(band);

  // Pack: rounded, with a bedroll and straps, not a box behind the shoulders.
  const pack = new THREE.Mesh(lathe([
    [0.001, 0.00], [0.16, 0.02], [0.20, 0.14], [0.20, 0.34], [0.15, 0.44], [0.001, 0.46],
  ]), leather);
  pack.scale.set(1.5, 1, 0.75); pack.position.set(0, 0.86, -0.34); pack.castShadow = true; body.add(pack);
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.42, 16), accent);
  roll.rotation.z = Math.PI / 2; roll.position.set(0, 1.24, -0.34); body.add(roll);
  for (const sx of [-1, 1]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.34, 0.03), leather);
    strap.position.set(0.15 * sx, 1.16, -0.28); strap.rotation.x = 0.12; body.add(strap);
  }

  const legL = new THREE.Group(), legR = new THREE.Group();
  for (const [grp, sx] of [[legL, -1], [legR, 1]]) {
    grp.position.set(0.15 * sx, 0.62, 0); body.add(grp);
    const leg = new THREE.Mesh(limb(0.125, 0.095, 0.52), dark);
    leg.position.y = -0.28; leg.castShadow = true; grp.add(leg);
    // Boot: a rounded lathe with a sole, instead of a box.
    const boot = new THREE.Mesh(lathe([
      [0.001, 0.00], [0.13, 0.01], [0.15, 0.08], [0.14, 0.18], [0.11, 0.22], [0.001, 0.23],
    ]), leather);
    boot.scale.set(1, 1, 1.35); boot.position.set(0, -0.60, 0.04); boot.castShadow = true; grp.add(boot);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.045, 0.40), dark);
    sole.position.set(0, -0.615, 0.05); grp.add(sole);
  }
  const armL = new THREE.Group(), armR = new THREE.Group();
  for (const [grp, sx] of [[armL, -1], [armR, 1]]) {
    grp.position.set(0.36 * sx, 1.30, 0); body.add(grp);
    const arm = new THREE.Mesh(limb(0.115, 0.075, 0.46), coat);
    arm.position.y = -0.24; arm.castShadow = true; grp.add(arm);
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.022, 8, 16), coat2);
    cuff.position.y = -0.44; cuff.rotation.x = Math.PI / 2; grp.add(cuff);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 12), skin);
    hand.scale.set(1, 1.15, 0.85); hand.position.y = -0.52; grp.add(hand);
  }

  // the Bellows, held in the right hand
  const bellows = new THREE.Group();
  const barrel = new THREE.Mesh(lathe([
    [0.001, 0.00], [0.10, 0.02], [0.13, 0.18], [0.155, 0.42], [0.165, 0.62], [0.12, 0.70], [0.001, 0.72],
  ]), toonMaterial({ color: 0xd8d3c8 }));
  barrel.rotation.x = Math.PI / 2; bellows.add(barrel);
  const bellowsBag = new THREE.Mesh(new THREE.SphereGeometry(0.19, 24, 18), toonMaterial({ color: 0xff8a5c }));
  bellowsBag.scale.set(1, 1, 0.78); bellowsBag.position.z = -0.26; bellows.add(bellowsBag);
  const muzzle = new THREE.Mesh(lathe([
    [0.001, 0.00], [0.18, 0.01], [0.15, 0.08], [0.12, 0.14], [0.001, 0.15],
  ]), toonMaterial({ color: 0xffb347 }));
  muzzle.rotation.x = Math.PI / 2; muzzle.position.z = 0.42; bellows.add(muzzle);
  const grip = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.02, 8, 16), leather);
  grip.position.set(0, -0.12, 0.02); bellows.add(grip);
  bellows.position.set(0, -0.5, 0.12);
  armR.add(bellows);

  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 }));
  blob.rotation.x = -Math.PI / 2;

  // glider cloth (hidden until unlocked)
  const glider = new THREE.Mesh(new THREE.ConeGeometry(1.1, 0.9, 24, 1, true), toonMaterial({ color: 0xff9e6b, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
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

    // A lantern. Nights are the scariest part of the Drift and the player
    // should never be blind in them. On by default; [L] toggles it.
    // Wide penumbra and a gentle falloff: a torch pool with a hard rim reads
    // as a decal, not as light.
    this.lantern = new THREE.SpotLight(0xffd2a0, 0, 30, 0.85, 0.95, 1.35);
    this.lantern.castShadow = false;
    this.lanternTarget = new THREE.Object3D();
    scene.add(this.lantern); scene.add(this.lanternTarget);
    this.lantern.target = this.lanternTarget;
    this.lanternOn = true;
    this.input = { f: 0, b: 0, l: 0, r: 0, sprint: false, jump: false, dash: false, blast: false };
    this.jumpQueued = false;
    this.cam = { yaw: 0, pitch: 0.32, dist: CFG.camera.distance, shake: 0 };
    this.toe = 0;
    this.alive = true;
    this.lastGround = spawn;
  }

  queueJump() { this.jumpQueued = true; }

  groundAt(x, z) { return this.world.heightAt(x, z); }

  setLantern(on, intensity) {
    this.lanternOn = !!on;
    this.lantern.intensity = on ? intensity : 0;
  }

  update(dt, ctx) {
    const inp = this.input;
    const maxJumps = 1 + this.up.hops;
    // ---- desired movement ----
    // camera-relative basis; see moveBasis() — the same maths the tests assert on
    const { wx, wz, mag } = moveBasis(this.cam.yaw, inp);
    if (mag > 0) this.moveYaw = Math.atan2(wx, wz);

    const sprinting = inp.sprint && mag > 0;
    const topSpeed = (sprinting ? CFG.player.sprint : CFG.player.speed) * (ctx.storm ? 0.94 : 1);
    const accel = this.grounded ? CFG.player.accel : CFG.player.airAccel;

    if (this.dashT > 0) {
      this.dashT -= dt;
      this.vel.x = this.dashDir.x; this.vel.z = this.dashDir.z;
    } else if (mag > 0) {
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
    // A gust is drift, not velocity: writing into vel directly fights the
    // movement damping above, so a walking player cancels the wind and a
    // falling player outruns the lift. Drift is added to the position instead.
    this.driftX = 0; this.driftZ = 0;
    for (const rb of this.world.ribbons) {
      const d = this.ribbonDist(rb);
      if (d !== null) {
        this.driftX = rb.nx * rb.speed * this.up.gustRide;
        this.driftZ = rb.nz * rb.speed * this.up.gustRide;
        // A gust must actually hold you up. Gravity is 26 and lift is ~2, so
        // without cancelling gravity here, a player who walks off a shore just
        // falls through their own ride home.
        grav = CFG.world.gravity * 0.12;
        this.vel.y = damp(this.vel.y, rb.lift, 4, dt);
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
    this.pos.x += this.driftX * dt; this.pos.z += this.driftZ * dt;
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
      // A soft nudge away from the rim, not a wall. It used to be strong
      // enough to cancel the walk speed, which meant a player could never
      // step off an island on purpose - and the gust lanes start at the rim.
      const aheadX = this.pos.x + this.vel.x * dt * 1.5, aheadZ = this.pos.z + this.vel.z * dt * 1.5;
      const ga = this.groundAt(aheadX, aheadZ);
      if (ga !== null && ga - (g) > 1.6 && this.pos.y < g + 1.2) {
        const isl = this.world.islandAt(this.pos.x, this.pos.z);
        if (isl) {
          const nx = (this.pos.x - isl.x), nz = (this.pos.z - isl.z), nl = Math.hypot(nx, nz) || 1;
          this.vel.x -= (nx / nl) * 12 * dt * 1.2;
          this.vel.z -= (nz / nl) * 12 * dt * 1.2;
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
    // only the stretch between the two shores is a wind corridor
    if (along < (rb.start ?? 0) || along > (rb.end ?? rb.len)) return null;
    const side = Math.abs(px * -rb.nz + pz * rb.nx);
    if (side > rb.width * 0.5) return null;
    const y = rb.y;
    // The corridor must also catch anyone who has walked off the shore and is
    // falling into the gap - that is the whole reason it exists.
    if (this.pos.y < y - 26 || this.pos.y > y + 8) return null;
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
    // the lantern rides with us and shines where we are looking
    if (this.lanternOn) {
      this.lantern.position.set(this.pos.x, this.pos.y + 1.3, this.pos.z);
      const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
      this.lanternTarget.position.set(
        this.pos.x + fx * 11, this.pos.y - 2.2 - Math.sin(c.pitch) * 6, this.pos.z + fz * 11);
    }
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

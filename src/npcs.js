// NPCs: procedurally assembled villagers with distinctive hats, idle life,
// dialogue, and shops.

import * as THREE from '../vendor/three.module.js';
import { Content } from './content.js';
import { TAU, clamp, angleLerp, mulberry32, hashString } from './util.js';
import { toonMaterial } from './look.js';
import { lathe, limb } from './player.js';

function hatFor(id, accent) {
  const g = new THREE.Group();
  const mat = toonMaterial({ color: accent });
  if (id === 'pip') {
    const crown = new THREE.Mesh(lathe([
      [0.001, 0.00], [0.28, 0.01], [0.275, 0.10], [0.265, 0.19], [0.24, 0.21], [0.001, 0.22],
    ]), toonMaterial({ color: 0x2b3f6b }));
    crown.position.y = 0.22; g.add(crown);
    const brim = new THREE.Mesh(lathe([
      [0.001, 0.00], [0.30, 0.005], [0.30, 0.035], [0.001, 0.04],
    ]), toonMaterial({ color: 0x22304f }));
    brim.scale.set(1, 1, 0.72); brim.position.set(0, 0.20, 0.10); g.add(brim);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.272, 0.028, 8, 24), toonMaterial({ color: 0xffcb52 }));
    band.position.y = 0.26; band.rotation.x = Math.PI / 2; g.add(band);
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), toonMaterial({ color: 0xffcb52 }));
    bell.scale.set(1, 1.2, 1); bell.position.set(0, 0.30, 0.27); g.add(bell);
  } else if (id === 'marlow') {
    const brim = new THREE.Mesh(lathe([
      [0.001, 0.00], [0.52, 0.012], [0.50, 0.045], [0.30, 0.06], [0.001, 0.065],
    ]), toonMaterial({ color: 0xd8b25a }));
    brim.position.y = 0.23; g.add(brim);
    const crown = new THREE.Mesh(lathe([
      [0.001, 0.00], [0.285, 0.01], [0.275, 0.14], [0.255, 0.24], [0.20, 0.27], [0.001, 0.28],
    ]), toonMaterial({ color: 0xe0c06a }));
    crown.position.y = 0.36; g.add(crown);
    const patch = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.14), toonMaterial({ color: 0x9a7a3a }));
    patch.position.set(0.2, 0.27, 0.2); patch.rotation.y = 0.5; g.add(patch);
  } else if (id === 'tilda') {
    const bucket = new THREE.Mesh(lathe([
      [0.001, 0.00], [0.26, 0.01], [0.30, 0.14], [0.335, 0.28], [0.30, 0.31], [0.001, 0.32],
    ]), toonMaterial({ color: 0x3fb98f }));
    bucket.position.y = 0.24; g.add(bucket);
    const brim = new THREE.Mesh(lathe([
      [0.001, 0.00], [0.42, 0.01], [0.41, 0.038], [0.001, 0.042],
    ]), toonMaterial({ color: 0x35a37e }));
    brim.position.y = 0.22; g.add(brim);
    for (let i = 0; i < 4; i++) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, 0.09), toonMaterial({ color: [0xffcb52, 0xff7ab6, 0x8fd3ff, 0xffffff][i] }));
      const a = i * 1.6; st.position.set(Math.cos(a) * 0.24, 0.4, Math.sin(a) * 0.24); g.add(st);
    }
  } else if (id === 'bellwright') {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 6, 0, TAU, 0, Math.PI * 0.55), toonMaterial({ color: 0x6b5540 }));
    cap.position.y = 0.26; g.add(cap);
    for (const sx of [-1, 1]) {
      const lens = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.03, 5, 10), toonMaterial({ color: 0xc9a24a }));
      lens.position.set(0.14 * sx, 0.3, 0.24); g.add(lens);
    }
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 5, 12), toonMaterial({ color: 0x4a3a2a }));
    strap.rotation.x = Math.PI / 2; strap.position.y = 0.26; g.add(strap);
  } else {
    const tall = new THREE.Mesh(lathe([
      [0.001, 0.00], [0.265, 0.01], [0.255, 0.22], [0.245, 0.46], [0.20, 0.50], [0.001, 0.51],
    ]), toonMaterial({ color: 0x2b2340 }));
    tall.position.y = 0.48; g.add(tall);
    const brim = new THREE.Mesh(lathe([
      [0.001, 0.00], [0.44, 0.01], [0.43, 0.038], [0.001, 0.042],
    ]), toonMaterial({ color: 0x3a2f55 }));
    brim.position.y = 0.22; g.add(brim);
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.1, 7, 6), new THREE.MeshBasicMaterial({ color: 0xffe98a }));
    lantern.position.set(0.3, 0.35, 0.16); g.add(lantern);
    g.userData.lantern = lantern;
  }
  return g;
}

export function buildNPC(def) {
  const g = new THREE.Group();
  // Smooth shading and lathe profiles: the villagers were capsules, boxes and
  // spheres with flatShading, which is what made them read as Roblox props.
  const skin = toonMaterial({ color: 0xf2c9a4 });
  const cloth = toonMaterial({ color: new THREE.Color(def.color) });
  const cloth2 = toonMaterial({ color: new THREE.Color(def.color).multiplyScalar(0.72) });
  const dark = toonMaterial({ color: 0x2b2f3a });
  const leather = toonMaterial({ color: 0x6b4a2c });

  const body = new THREE.Group(); g.add(body);

  // Silhouette and hair vary per villager so five people are not five copies.
  const build = ({ pip: 'slim', marlow: 'large', tilda: 'stocky', bellwright: 'slim' })[def.id] || 'stocky';
  const hairCol = ({ pip: '#4a3524', marlow: '#8a7040', tilda: '#2b1c14', bellwright: '#5a4030' })[def.id] || '#3a2a20';
  const hairMat = toonMaterial({ color: new THREE.Color(hairCol) });
  const chestR = build === 'slim' ? 0.26 : build === 'large' ? 0.40 : 0.32;
  const hipR = build === 'slim' ? 0.28 : build === 'large' ? 0.44 : 0.36;

  const torso = new THREE.Mesh(lathe([
    [0.001, 0.00], [hipR, 0.02], [hipR * 1.06, 0.12], [chestR * 0.94, 0.28],
    [chestR, 0.44], [chestR * 0.92, 0.58], [chestR * 0.70, 0.70], [chestR * 0.40, 0.76], [0.001, 0.78],
  ]), cloth);
  torso.position.y = 0.66; torso.castShadow = true; body.add(torso);

  // Apron: a front panel only. Wrapping the whole torso made every villager
  // look like they were wearing a bib-shaped shell.
  const apronCol = ({ tilda: 0x9fe3c2, marlow: 0xd9c48a, bellwright: 0x8a7f6d })[def.id] || 0xf0e6d0;
  // A flat panel pinned to the front of the torso. A lathed shell around the
  // body - even a partial one - reads as a skirt, not an apron.
  const apron = new THREE.Mesh(new THREE.BoxGeometry(chestR * 1.5, 0.72, 0.045), toonMaterial({ color: apronCol }));
  apron.position.set(0, 1.02, chestR * 0.92); body.add(apron);
  const bib = new THREE.Mesh(new THREE.BoxGeometry(chestR * 0.95, 0.26, 0.04), toonMaterial({ color: apronCol }));
  bib.position.set(0, 1.34, chestR * 0.86); body.add(bib);
  for (const sx of [-1, 1]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.30, 0.026), toonMaterial({ color: apronCol }));
    strap.position.set(chestR * 0.42 * sx, 1.42, chestR * 0.80); strap.rotation.x = -0.16; body.add(strap);
  }
  const belt = new THREE.Mesh(new THREE.TorusGeometry(hipR * 1.02, 0.042, 8, 22), leather);
  belt.position.y = 1.02; belt.rotation.x = Math.PI / 2; body.add(belt);

  const head = new THREE.Group(); head.position.y = 1.56; body.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.235, 32, 24), skin);
  skull.scale.set(1, 1.05, 0.96); skull.castShadow = true; head.add(skull);
  const hair = new THREE.Mesh(lathe([
    [0.001, 0.00], [0.17, 0.02], [0.238, 0.10], [0.246, 0.20], [0.20, 0.26], [0.001, 0.27],
  ]), hairMat);
  hair.position.y = 0.01; head.add(hair);

  for (const sx of [-1, 1]) {
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), toonMaterial({ color: 0xf7f7fa }));
    white.scale.set(1, 1.15, 0.55); white.position.set(0.096 * sx, 0.015, 0.205); head.add(white);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 10), new THREE.MeshBasicMaterial({ color: 0x1a1a24 }));
    pupil.position.set(0.096 * sx, 0.012, 0.242); head.add(pupil);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    glint.position.set(0.096 * sx + 0.011, 0.031, 0.254); head.add(glint);
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), skin);
    ear.scale.set(0.5, 1, 0.8); ear.position.set(0.225 * sx, -0.01, 0.02); head.add(ear);
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 10), skin);
  nose.scale.set(0.8, 0.9, 1.15); nose.position.set(0, -0.02, 0.235); head.add(nose);
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.009, 8, 16, Math.PI), new THREE.MeshBasicMaterial({ color: 0x6b3f2c }));
  smile.position.set(0, -0.075, 0.212); smile.rotation.z = Math.PI; head.add(smile);

  const hat = hatFor(def.id, new THREE.Color(def.color).getHex());
  head.add(hat);

  const armL = new THREE.Group(), armR = new THREE.Group();
  for (const [grp, sx] of [[armL, -1], [armR, 1]]) {
    grp.position.set((chestR + 0.06) * sx, 1.28, 0); body.add(grp);
    // Arms hang with a slight outward set; straight down clips into the torso,
    // and the old T-pose stance was part of the toy look.
    grp.rotation.z = 0.13 * sx; grp.rotation.x = 0.06;
    const arm = new THREE.Mesh(limb(0.11, 0.072, 0.44), cloth);
    arm.position.y = -0.23; arm.castShadow = true; grp.add(arm);
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.079, 0.02, 8, 16), cloth2);
    cuff.position.y = -0.43; cuff.rotation.x = Math.PI / 2; grp.add(cuff);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.082, 16, 12), skin);
    hand.scale.set(1, 1.15, 0.85); hand.position.y = -0.51; grp.add(hand);
  }
  const legL = new THREE.Group(), legR = new THREE.Group();
  for (const [grp, sx] of [[legL, -1], [legR, 1]]) {
    grp.position.set(0.15 * sx, 0.66, 0); body.add(grp);
    const leg = new THREE.Mesh(limb(0.12, 0.09, 0.5), dark);
    leg.position.y = -0.27; leg.castShadow = true; grp.add(leg);
    const boot = new THREE.Mesh(lathe([
      [0.001, 0.00], [0.125, 0.01], [0.145, 0.08], [0.135, 0.17], [0.105, 0.21], [0.001, 0.22],
    ]), leather);
    boot.scale.set(1, 1, 1.3); boot.position.set(0, -0.57, 0.04); boot.castShadow = true; grp.add(boot);
  }
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.5, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2 }));
  blob.rotation.x = -Math.PI / 2;
  g.userData = { body, head, hat, armL, armR, legL, legR, blob };
  return g;
}


export class NPCs {
  constructor(world, scene, onTalk) {
    this.world = world; this.scene = scene; this.onTalk = onTalk;
    this.list = [];
    this.group = new THREE.Group(); scene.add(this.group);
    const rng = mulberry32(hashString('npcs:' + world.seed));
    const spots = {
      pip: { x: -22, z: -15 },
      marlow: { x: 8, z: 14 },
      tilda: null, bellwright: null, sable: null,
    };
    for (const def of Content.npcs) {
      let spot = spots[def.id];
      if (!spot) {
        const isl = world.byId.get(def.island) || world.islands[0];
        const a = rng() * TAU, r = isl.r * 0.35;
        spot = { x: isl.x + Math.cos(a) * r, z: isl.z + Math.sin(a) * r };
      }
      const y = world.heightAt(spot.x, spot.z);
      if (y === null) continue;
      const mesh = buildNPC(def);
      mesh.position.set(spot.x, y, spot.z);
      this.group.add(mesh);
      const blob = mesh.userData.blob;
      blob.position.set(spot.x, y + 0.02, spot.z);
      this.group.add(blob);
      this.list.push({ def, mesh, home: { x: spot.x, z: spot.z, y }, blob, yaw: 0, t: rng() * 10, wanderT: 0, target: null, lineIdx: 0 });
    }
  }

  nearest(pos, r = 3.4) {
    let best = null, bd = r;
    for (const n of this.list) {
      const d = Math.hypot(n.mesh.position.x - pos.x, n.mesh.position.z - pos.z);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }

  update(dt, ctx) {
    for (const n of this.list) {
      n.t += dt;
      const u = n.mesh.userData;
      // idle life: sway, look around, occasionally take a few steps
      n.wanderT -= dt;
      if (n.wanderT <= 0) {
        n.wanderT = 6 + Math.random() * 10;
        if (Math.random() < 0.5) {
          const a = Math.random() * TAU, r = 2 + Math.random() * 4;
          const x = n.home.x + Math.cos(a) * r, z = n.home.z + Math.sin(a) * r;
          const y = this.world.heightAt(x, z);
          if (y !== null) n.target = { x, z, y };
        } else n.target = null;
      }
      if (n.target) {
        const dx = n.target.x - n.mesh.position.x, dz = n.target.z - n.mesh.position.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.3) {
          n.mesh.position.x += (dx / d) * 1.1 * dt;
          n.mesh.position.z += (dz / d) * 1.1 * dt;
          n.mesh.position.y = n.target.y;
          n.yaw = Math.atan2(dx, dz);
          u.legL.rotation.x = Math.sin(n.t * 8) * 0.4;
          u.legR.rotation.x = -Math.sin(n.t * 8) * 0.4;
        } else { u.legL.rotation.x = 0; u.legR.rotation.x = 0; }
      } else {
        u.legL.rotation.x = 0; u.legR.rotation.x = 0;
      }
      // face the player when close
      const dp = Math.hypot(ctx.player.pos.x - n.mesh.position.x, ctx.player.pos.z - n.mesh.position.z);
      if (dp < 8) n.yaw = Math.atan2(ctx.player.pos.x - n.mesh.position.x, ctx.player.pos.z - n.mesh.position.z);
      n.mesh.rotation.y = angleLerp(n.mesh.rotation.y, n.yaw, 1 - Math.exp(-5 * dt));
      u.body.position.y = Math.sin(n.t * 1.6) * 0.03;
      u.head.rotation.y = Math.sin(n.t * 0.7) * 0.25;
      u.armL.rotation.x = Math.sin(n.t * 1.2) * 0.12;
      if (u.hat.userData.lantern) u.hat.userData.lantern.material.color.setHex(ctx.night ? 0xffe98a : 0x8a7a4a);
      n.blob.position.set(n.mesh.position.x, (this.world.heightAt(n.mesh.position.x, n.mesh.position.z) ?? n.home.y) + 0.02, n.mesh.position.z);
    }
  }

  talk(n, ctx) {
    const lines = n.def.lines || ['...'];
    const line = lines[n.lineIdx % lines.length];
    n.lineIdx++;
    this.onTalk(n, line, ctx);
  }
}

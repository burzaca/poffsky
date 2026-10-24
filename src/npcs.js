// NPCs: procedurally assembled villagers with distinctive hats, idle life,
// dialogue, and shops.

import * as THREE from '../vendor/three.module.js';
import { Content } from './content.js';
import { TAU, clamp, angleLerp, mulberry32, hashString } from './util.js';
import { toonMaterial } from './look.js';

function hatFor(id, accent) {
  const g = new THREE.Group();
  const mat = toonMaterial({ color: accent, flatShading: true });
  if (id === 'pip') {
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.2, 10), toonMaterial({ color: 0x2b3f6b, flatShading: true }));
    crown.position.y = 0.32; g.add(crown);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.04, 0.4), toonMaterial({ color: 0x22304f }));
    brim.position.set(0, 0.22, 0.12); g.add(brim);
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), toonMaterial({ color: 0xffcb52 }));
    bell.position.set(0, 0.3, 0.3); g.add(bell);
  } else if (id === 'marlow') {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.05, 12), toonMaterial({ color: 0xd8b25a, flatShading: true }));
    brim.position.y = 0.24; g.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.24, 10), toonMaterial({ color: 0xe0c06a, flatShading: true }));
    crown.position.y = 0.36; g.add(crown);
    const patch = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.14), toonMaterial({ color: 0x9a7a3a }));
    patch.position.set(0.2, 0.27, 0.2); patch.rotation.y = 0.5; g.add(patch);
  } else if (id === 'tilda') {
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.26, 0.3, 9), toonMaterial({ color: 0x3fb98f, flatShading: true }));
    bucket.position.y = 0.34; g.add(bucket);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 10), toonMaterial({ color: 0x35a37e }));
    brim.position.y = 0.22; g.add(brim);
    for (let i = 0; i < 4; i++) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, 0.09), toonMaterial({ color: [0xffcb52, 0xff7ab6, 0x8fd3ff, 0xffffff][i] }));
      const a = i * 1.6; st.position.set(Math.cos(a) * 0.24, 0.4, Math.sin(a) * 0.24); g.add(st);
    }
  } else if (id === 'bellwright') {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 6, 0, TAU, 0, Math.PI * 0.55), toonMaterial({ color: 0x6b5540, flatShading: true }));
    cap.position.y = 0.26; g.add(cap);
    for (const sx of [-1, 1]) {
      const lens = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.03, 5, 10), toonMaterial({ color: 0xc9a24a }));
      lens.position.set(0.14 * sx, 0.3, 0.24); g.add(lens);
    }
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 5, 12), toonMaterial({ color: 0x4a3a2a }));
    strap.rotation.x = Math.PI / 2; strap.position.y = 0.26; g.add(strap);
  } else {
    const tall = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.55, 10), toonMaterial({ color: 0x2b2340, flatShading: true }));
    tall.position.y = 0.48; g.add(tall);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.04, 12), toonMaterial({ color: 0x3a2f55 }));
    brim.position.y = 0.22; g.add(brim);
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.1, 7, 6), new THREE.MeshBasicMaterial({ color: 0xffe98a }));
    lantern.position.set(0.3, 0.35, 0.16); g.add(lantern);
    g.userData.lantern = lantern;
  }
  return g;
}

export function buildNPC(def) {
  const g = new THREE.Group();
  const skin = toonMaterial({ color: 0xf0c8a0, flatShading: true });
  const cloth = toonMaterial({ color: new THREE.Color(def.color), flatShading: true });
  const dark = toonMaterial({ color: 0x2b2f3a, flatShading: true });

  const body = new THREE.Group(); g.add(body);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.55, 3, 8), cloth);
  torso.position.y = 1.0; torso.castShadow = true; body.add(torso);
  const apron = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.7, 0.1), toonMaterial({ color: 0xf0e6d0, flatShading: true }));
  apron.position.set(0, 0.85, 0.3); body.add(apron);
  const head = new THREE.Group(); head.position.y = 1.58; body.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), skin);
  skull.castShadow = true; head.add(skull);
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), new THREE.MeshBasicMaterial({ color: 0x1a1a24 }));
    e.position.set(0.12 * sx, 0.03, 0.28); head.add(e);
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 4, 8, Math.PI), new THREE.MeshBasicMaterial({ color: 0x2a2233 }));
  smile.position.set(0, -0.08, 0.29); smile.rotation.z = Math.PI; head.add(smile);
  const hat = hatFor(def.id, new THREE.Color(def.color).getHex());
  head.add(hat);
  const armL = new THREE.Group(), armR = new THREE.Group();
  for (const [grp, sx] of [[armL, -1], [armR, 1]]) {
    grp.position.set(0.4 * sx, 1.25, 0); body.add(grp);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.38, 2, 6), cloth);
    arm.position.y = -0.28; arm.castShadow = true; grp.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), skin); hand.position.y = -0.52; grp.add(hand);
  }
  const legL = new THREE.Group(), legR = new THREE.Group();
  for (const [grp, sx] of [[legL, -1], [legR, 1]]) {
    grp.position.set(0.16 * sx, 0.66, 0); body.add(grp);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.4, 2, 6), dark);
    leg.position.y = -0.3; grp.add(leg);
  }
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.5, 14), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2 }));
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

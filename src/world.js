// POFFSKY world: floating sky islands, heightfield terrain, procedural props,
// structures, wind ribbons and geysers. Pure generation — no game logic here.

import * as THREE from '../vendor/three.module.js';
import { CFG, } from './config.js';
import { Content } from './content.js';
import { toonMaterial, addInstancePhase, bakeAO, bakeLook, PALETTE } from './look.js';
import { mulberry32, hashString, fbm, clamp, TAU, valueNoise2 } from './util.js';

// which fruit grows in which biome (derived from content at build time)
let FRUIT_BY_BIOME = {};
function refreshFruitMap() {
  FRUIT_BY_BIOME = {};
  for (const f of Content.fruits) if (f.grows_on) FRUIT_BY_BIOME[f.grows_on] = f.id;
}

// Every material in the world goes through the one look recipe (see look.js / LOOK.md).
const L = (o) => toonMaterial(o);

export const BIOMES = {
  home:    { grass: 0x86d16a, grass2: 0x5fb457, dirt: 0x8a6a44, rock: 0x6f6558, trees: 0x4fae5e, trunk: 0x7a5638, flowers: [0xff8fb3, 0xffe07a, 0xffffff], density: 1.0 },
  orchard: { grass: 0x9ad86a, grass2: 0x6cbf55, dirt: 0x8f6f45, rock: 0x77685a, trees: 0x3f9f57, trunk: 0x6f4c30, flowers: [0xffd23f, 0xff9e6b], density: 1.2 },
  ember:   { grass: 0xc98a5b, grass2: 0xa9654a, dirt: 0x6e4433, rock: 0x4c3b34, trees: 0x8f4f3a, trunk: 0x53372b, flowers: [0xff6b4a, 0xffb347], density: 0.5 },
  frost:   { grass: 0xd6ecf7, grass2: 0xa9cfe6, dirt: 0x8fa6bd, rock: 0x93a7bb, trees: 0x7fb6c9, trunk: 0x5d7285, flowers: [0xbfe9ff, 0xffffff], density: 0.6 },
  bloom:   { grass: 0x9be38a, grass2: 0x63c46f, dirt: 0x7f6a48, rock: 0x6d6a5c, trees: 0x59b06a, trunk: 0x6b4a33, flowers: [0xff7ab6, 0xffd6f2, 0xfff27a, 0xb38cff], density: 1.8 },
  ruins:   { grass: 0x7fb98f, grass2: 0x5c9a76, dirt: 0x6f6a58, rock: 0x8b8577, trees: 0x4f8f6a, trunk: 0x5c4a38, flowers: [0xc0c0ff], density: 0.5 },
  geyser:  { grass: 0xb6d9c2, grass2: 0x8fb9a4, dirt: 0x74836f, rock: 0x6a7a72, trees: 0x6fae8a, trunk: 0x5f5340, flowers: [0xa8f0ff], density: 0.5 },
};

// The archipelago. Positions are world XZ; y is the island's top surface base.
export const ISLANDS = [
  { id: 'thistledown', name: 'Thistledown', biome: 'home',    x: 0,   z: 0,   r: 46, y: 0,   note: 'ranch + skyport' },
  { id: 'orchardreach', name: 'Orchardreach', biome: 'orchard', x: 104, z: -26, r: 34, y: 3,  note: 'fruit' },
  { id: 'bloommeadow', name: 'Bloommeadow', biome: 'bloom',   x: -104, z: 34, r: 38, y: 2,  note: 'nectar' },
  { id: 'emberscar', name: 'Emberscar', biome: 'ember',       x: 44,  z: 122, r: 30, y: 7,  note: 'warm, geysers' },
  { id: 'frosthold', name: 'Frosthold', biome: 'frost',       x: -58, z: -122, r: 30, y: 6,  note: 'cold' },
  { id: 'geyserisles', name: 'Geyser Isles', biome: 'geyser', x: 168, z: 52,  r: 24, y: 10, note: 'launch pads' },
  { id: 'theruins', name: 'The Hollow Ruins', biome: 'ruins', x: -172, z: -62, r: 32, y: 5,  note: 'wraiths' },
  { id: 'windward', name: 'Windward', biome: 'home',          x: 226, z: -58, r: 22, y: 12, note: 'far lookout' },
];

// Gust ribbons: visible wind roads that push you between islands.
export const RIBBONS = [
  { from: 'thistledown', to: 'orchardreach', dir: [1, 0.06], speed: 13, lift: 4.5 },
  { from: 'thistledown', to: 'bloommeadow', dir: [-1, 0.32], speed: 13, lift: 4.5 },
  { from: 'orchardreach', to: 'geyserisles', dir: [0.62, 0.78], speed: 15, lift: 4.5 },
  { from: 'bloommeadow', to: 'theruins', dir: [-0.72, -0.68], speed: 15, lift: 4.5 },
  { from: 'thistledown', to: 'emberscar', dir: [0.3, 0.95], speed: 14, lift: 4.5 },
  { from: 'thistledown', to: 'frosthold', dir: [-0.4, -0.91], speed: 14, lift: 4.5 },
  { from: 'geyserisles', to: 'windward', dir: [0.42, -0.9], speed: 16, lift: 4.5 },
];

export class World {
  constructor(seed = CFG.seed) {
    this.seed = seed;
    this.rng = mulberry32(hashString('world:' + seed));
    this.islands = ISLANDS.map(i => ({ ...i, hf: new Map(), ring: [] }));
    this.byId = new Map(this.islands.map(i => [i.id, i]));
    this.props = [];      // {kind, x, y, z, s, rot, color, data}
    this.fruits = [];     // spawn points {fruitId, x, y, z}
    this.geysers = [];    // {x,z,r,power}
    this.corrals = [];    // {id,x,z,r,unlocked}
    this.structures = [];
    const fwd = RIBBONS.map(r => {
      const a = this.byId.get(r.from), b = this.byId.get(r.to);
      const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
      // The corridor runs island-centre to island-centre, but it must only
      // PUSH in the gap between them. Starting it at the island edge is what
      // stops the ranch on Thistledown from being wind-blasted.
      const start = a.r - 2, end = len - (b.r - 2);
      return { ...r, ax: a.x, az: a.z, bx: b.x, bz: b.z, len, nx: dx / len, nz: dz / len,
        start, end, width: 7.5, yTop: Math.max(a.y, b.y) + 6 };
    });
    // A one-way corridor strands you: you ride out, then the same wind pushes
    // you back. Every corridor gets a paired return lane over the same gap,
    // so travel between islands is a round trip and not a gamble.
    const back = fwd.map(r => {
      // Offset the return lane sideways. Two lanes on the same line cancel
      // each other out and the rider stands still in the middle of the gap.
      const off = r.width * 0.6;
      const px = -r.nz * off, pz = r.nx * off;
      return { ...r, from: r.to, to: r.from, reverse: true,
        ax: r.bx + px, az: r.bz + pz, bx: r.ax + px, bz: r.az + pz,
        nx: -r.nx, nz: -r.nz,
        start: r.len - r.end, end: r.len - r.start };
    });
    this.ribbons = fwd.concat(back);
    refreshFruitMap();
    this.build();
  }

  // ---------- terrain ----------
  surfaceAt(isl, x, z) {
    const dx = x - isl.x, dz = z - isl.z;
    const d = Math.hypot(dx, dz);
    if (d > isl.r) return null;
    const edge = clamp((isl.r - d) / 7, 0, 1);
    const bump = (fbm(x * 0.035, z * 0.035, 3, hashString(isl.id + ':' + this.seed)) - 0.5) * 3.4;
    return isl.y + bump * edge - (1 - edge) * 1.2;
  }

  hfGet(isl, x, z) {
    const c = CFG.world.cell;
    const gx = Math.round(x / c), gz = Math.round(z / c);
    const k = gx + ',' + gz;
    let v = isl.hf.get(k);
    if (v === undefined) { v = this.surfaceAt(isl, gx * c, gz * c); isl.hf.set(k, v); }
    return v;
  }

  islandAt(x, z) {
    for (const isl of this.islands) {
      const dx = x - isl.x, dz = z - isl.z;
      if (dx * dx + dz * dz <= isl.r * isl.r) return isl;
    }
    return null;
  }

  heightAt(x, z) {
    const isl = this.islandAt(x, z);
    if (!isl) return null;
    return this.hfGet(isl, x, z);
  }

  // ---------- generation ----------
  build() {
    const rng = this.rng;
    // home island layout first
    this.corrals = [
      { id: 'pen1', x: 14, z: 12, r: CFG.poff.penRadius, unlocked: true },
      { id: 'pen2', x: -16, z: 16, r: CFG.poff.penRadius, unlocked: true },
      { id: 'pen3', x: 0, z: 30, r: CFG.poff.penRadius, unlocked: false },
      { id: 'pen4', x: -30, z: -6, r: CFG.poff.penRadius, unlocked: false },
    ];
    this.structures = [
      { kind: 'skyport', x: -22, z: -18, rot: 0.7, label: 'Skyport Market' },
      { kind: 'hut', x: 20, z: -6, rot: -0.4, label: 'Ranch hut' },
      { kind: 'board', x: -6, z: -4, rot: 0.0, label: 'Notice board' },
      { kind: 'stall', x: 6, z: -14, rot: 2.2, label: 'Bellwright stall' },
      { kind: 'flag', x: -30, z: 4 },
      { kind: 'flag', x: 30, z: 22 },
    ];

    for (const isl of this.islands) {
      const B = BIOMES[isl.biome];
      const rng2 = mulberry32(hashString('props:' + isl.id + ':' + this.seed));
      const area = isl.r * isl.r;

      // trees
      const treeN = Math.floor(area * 0.0042 * B.density * (isl.biome === 'orchard' ? 1.6 : 1));
      for (let i = 0; i < treeN; i++) {
        const p = this.scatter(isl, rng2, 6);
        if (!p) continue;
        const fruitForBiome = FRUIT_BY_BIOME[isl.biome];
        const fruiting = !!fruitForBiome;
        this.props.push({ kind: 'tree', x: p.x, y: p.y, z: p.z, s: 0.85 + rng2() * 0.6, rot: rng2() * TAU, color: B.trees, biome: isl.biome, fruiting });
        if (fruiting) {
          this.fruits.push({ fruitId: fruitForBiome, x: p.x + (rng2() - 0.5) * 2.2, y: p.y + 1.1, z: p.z + (rng2() - 0.5) * 2.2 });
        }
      }
      // rocks
      const rockN = Math.floor(area * 0.0012 * (isl.biome === 'ruins' ? 3 : 1));
      for (let i = 0; i < rockN; i++) {
        const p = this.scatter(isl, rng2, 3);
        if (!p) continue;
        this.props.push({ kind: 'rock', x: p.x, y: p.y, z: p.z, s: 0.5 + rng2() * 1.5, rot: rng2() * TAU, color: B.rock, biome: isl.biome });
      }
      // ruins extras
      if (isl.biome === 'ruins') {
        for (let i = 0; i < 14; i++) {
          const p = this.scatter(isl, rng2, 5);
          if (!p) continue;
          this.props.push({ kind: 'pillar', x: p.x, y: p.y, z: p.z, s: 1.4 + rng2() * 3.2, rot: rng2() * TAU, color: 0x9a9384, biome: isl.biome });
        }
      }
      // geysers
      if (isl.biome === 'ember' || isl.biome === 'geyser') {
        const n = isl.biome === 'geyser' ? 5 : 3;
        for (let i = 0; i < n; i++) {
          const p = this.scatter(isl, rng2, 8);
          if (!p) continue;
          this.geysers.push({ x: p.x, z: p.z, r: 3.2, power: 20 + rng2() * 6, phase: rng2() * TAU });
          this.props.push({ kind: 'geyserRim', x: p.x, y: p.y, z: p.z, s: 3.2, rot: 0, color: 0x55483f, biome: isl.biome });
        }
      }
      // grass + flowers (instanced)
      const grassN = Math.floor(area * 0.09 * B.density);
      isl.grassPts = [];
      for (let i = 0; i < grassN; i++) {
        const p = this.scatter(isl, rng2, 0.6);
        if (!p) continue;
        const flower = rng2() < 0.09;
        isl.grassPts.push({ x: p.x, y: p.y, z: p.z, s: 0.5 + rng2() * 0.9, rot: rng2() * TAU, flower, color: flower ? B.flowers[(rng2() * B.flowers.length) | 0] : 0xffffff });
      }
      // skyjellies over the gaps near this island
      for (const rb of this.ribbons) {
        if (rb.from !== isl.id) continue;
        const b = this.byId.get(rb.to);
        const centre = Math.hypot(b.x - isl.x, b.z - isl.z);
        const gap = centre - isl.r - b.r;
        if (gap < 26) continue;
        // pads belong in the gap, not on the island: step out from the shore
        const steps = Math.min(3, Math.floor(gap / 26));
        for (let s = 1; s <= steps; s++) {
          const along = isl.r + (gap * s) / (steps + 1);
          const x = isl.x + (b.x - isl.x) * (along / centre);
          const z = isl.z + (b.z - isl.z) * (along / centre);
          const y = Math.max(isl.y, b.y) - 2 - s * 0.4;
          this.props.push({ kind: 'jellyPad', x, y, z, s: 4.6 + rng2() * 1.6, rot: 0, color: 0x8fe6ff, ribbon: rb });
        }
      }
    }
  }

  scatter(isl, rng, pad) {
    const a = rng() * TAU, rr = Math.sqrt(rng()) * (isl.r - pad - 1.5);
    const x = isl.x + Math.cos(a) * rr, z = isl.z + Math.sin(a) * rr;
    const y = this.surfaceAt(isl, x, z);
    return y === null ? null : { x, y, z };
  }

  // ---------- mesh building ----------
  buildMeshes(scene) {
    const group = new THREE.Group();
    group.name = 'world';
    for (const isl of this.islands) group.add(this.islandMesh(isl));
    group.add(this.propMeshes());
    group.add(this.ribbonMeshes());
    group.add(this.corralMeshes());
    group.add(this.structureMeshes());
    scene.add(group);
    this.group = group;
    return group;
  }

  islandMesh(isl) {
    const B = BIOMES[isl.biome];
    const SEG = 44, RINGS = 10;
    const pos = [], col = [], idx = [];
    const c1 = new THREE.Color(B.grass), c2 = new THREE.Color(B.grass2);
    const mix2 = 0.55; // calm ground: gentle variation, not confetti
    // centre vertex
    const cy = this.surfaceAt(isl, isl.x, isl.z) ?? isl.y;
    pos.push(isl.x, cy, isl.z); col.push(c1.r, c1.g, c1.b);
    for (let r = 1; r <= RINGS; r++) {
      const rad = (r / RINGS) * isl.r;
      for (let s = 0; s < SEG; s++) {
        const a = (s / SEG) * TAU;
        const x = isl.x + Math.cos(a) * rad, z = isl.z + Math.sin(a) * rad;
        let y = this.surfaceAt(isl, x, z);
        let cc = c1.clone().lerp(c2, (r / RINGS) * mix2 + (valueNoise2(x * 0.05, z * 0.05, 3) - 0.5) * 0.12);
        if (r === RINGS) { y = isl.y - 0.4; }
        pos.push(x, y, z); col.push(cc.r, cc.g, cc.b);
      }
    }
    for (let r = 1; r <= RINGS; r++) {
      const a0 = r === 1 ? 0 : 1 + (r - 2) * SEG;
      const a1 = 1 + (r - 1) * SEG;
      for (let s = 0; s < SEG; s++) {
        const p0 = a0 + s, p1 = a0 + ((s + 1) % SEG), q0 = a1 + s, q1 = a1 + ((s + 1) % SEG);
        if (r === 1) { idx.push(p0, q1, q0); }
        else { idx.push(p0, q1, q0); idx.push(p0, p1, q1); }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    // the one look recipe: poster banding baked into the vertex colours we just
    // painted, so the ground reads as three clean light levels under any sky
    bakeLook(geo, [1, 1, 1], { reuse: true });
    const top = new THREE.Mesh(geo, toonMaterial({ vertexColors: true, flatShading: true }));
    top.receiveShadow = true;
    top.userData.island = isl.id;

    // skirt + underside
    const sp = [], sc = [], si = [];
    const cd = new THREE.Color(B.dirt), cr = new THREE.Color(B.rock);
    const rim = [];
    for (let s = 0; s < SEG; s++) {
      const a = (s / SEG) * TAU;
      rim.push([isl.x + Math.cos(a) * isl.r, isl.y - 0.4, isl.z + Math.sin(a) * isl.r]);
    }
    const depth = 8 + isl.r * 0.22;
    for (let s = 0; s < SEG; s++) {
      const a = (s / SEG) * TAU;
      const x = isl.x + Math.cos(a) * isl.r, z = isl.z + Math.sin(a) * isl.r;
      sp.push(x, isl.y - 0.4, z, x, isl.y - depth, z);
      sc.push(cd.r, cd.g, cd.b, cr.r, cr.g, cr.b);
    }
    for (let s = 0; s < SEG; s++) {
      const n = (s + 1) % SEG;
      si.push(s * 2, n * 2, s * 2 + 1, n * 2, n * 2 + 1, s * 2 + 1);
    }
    // pointy underside
    const apex = isl.y - depth - isl.r * 0.55;
    const base = sp.length / 3;
    for (let s = 0; s < SEG; s++) {
      const a = (s / SEG) * TAU;
      sp.push(isl.x + Math.cos(a) * isl.r, isl.y - depth, isl.z + Math.sin(a) * isl.r);
      sc.push(cr.r, cr.g, cr.b);
    }
    sp.push(isl.x, apex, isl.z); sc.push(cr.r * 0.7, cr.g * 0.7, cr.b * 0.7);
    const apexI = sp.length / 3 - 1;
    for (let s = 0; s < SEG; s++) si.push(base + s, apexI, base + ((s + 1) % SEG));
    const sgeo = new THREE.BufferGeometry();
    sgeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    sgeo.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3));
    sgeo.setIndex(si);
    sgeo.computeVertexNormals();
    bakeAO(sgeo, 0.45, isl.y - depth - isl.r * 0.55, depth + isl.r * 0.55);
    bakeLook(sgeo, [1, 1, 1], { reuse: true });
    const skirt = new THREE.Mesh(sgeo, toonMaterial({ vertexColors: true, flatShading: true }));
    skirt.castShadow = false;

    const g = new THREE.Group();
    g.add(top, skirt);
    g.name = 'island:' + isl.id;
    isl.mesh = g;
    return g;
  }

  propMeshes() {
    const g = new THREE.Group();
    const byKind = new Map();
    for (const p of this.props) {
      if (!byKind.has(p.kind)) byKind.set(p.kind, []);
      byKind.get(p.kind).push(p);
    }
    const mk = (geo, mat, list, tune, phase = false) => {
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      if (phase) addInstancePhase(im, list.length, mulberry32(hashString('phase' + list.length)));
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), v = new THREE.Vector3();
      const col = new THREE.Color();
      list.forEach((p, i) => {
        const t = tune ? tune(p) : { pos: [p.x, p.y, p.z], scale: [p.s, p.s, p.s], rot: [0, p.rot, 0], color: p.color };
        v.set(...t.pos); s.set(...t.scale); e.set(...t.rot); q.setFromEuler(e);
        m.compose(v, q, s); im.setMatrixAt(i, m);
        col.set(t.color === undefined ? 0xffffff : t.color); im.setColorAt(i, col);
      });
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.castShadow = true; im.receiveShadow = true;
      return im;
    };


    // NOTE: instanceColor multiplies material.color, so keep material.color white.
    if (byKind.get('tree')) {
      const trees = byKind.get('tree');
      g.add(mk(new THREE.CylinderGeometry(0.22, 0.34, 3.2, 6), L({ color: 0x7a5638, flatShading: true, sway: 0.02 }), trees,
        p => ({ pos: [p.x, p.y + 1.6 * p.s, p.z], scale: [p.s, p.s, p.s], rot: [0, p.rot, 0], color: 0xffffff })));
      g.add(mk(new THREE.IcosahedronGeometry(1.7, 0), L({ color: 0xffffff, flatShading: true, sway: 0.14, instancedPhase: true }), trees,
        p => ({ pos: [p.x, p.y + 3.6 * p.s, p.z], scale: [p.s * 1.15, p.s * 0.95, p.s * 1.15], rot: [0, p.rot, 0], color: p.color }), true));
      const fruiting = trees.filter(t => t.fruiting);
      if (fruiting.length) {
        g.add(mk(new THREE.IcosahedronGeometry(0.55, 0), L({ color: 0xffffff, flatShading: true }), fruiting,
          p => ({ pos: [p.x, p.y + 3.4 * p.s, p.z], scale: [p.s, p.s, p.s], rot: [0, p.rot, 0], color: 0xffd23f })));
      }
    }
    if (byKind.get('rock')) {
      g.add(mk(new THREE.DodecahedronGeometry(1, 0), L({ color: 0xffffff, flatShading: true }), byKind.get('rock'),
        p => ({ pos: [p.x, p.y + p.s * 0.35, p.z], scale: [p.s, p.s * 0.8, p.s], rot: [p.rot * 0.3, p.rot, p.rot * 0.2], color: p.color })));
    }
    if (byKind.get('pillar')) {
      g.add(mk(new THREE.CylinderGeometry(0.7, 0.9, 1, 6), L({ color: 0xffffff, flatShading: true }), byKind.get('pillar'),
        p => ({ pos: [p.x, p.y + p.s * 0.5, p.z], scale: [p.s, p.s, p.s], rot: [0, p.rot, 0], color: p.color })));
    }
    if (byKind.get('geyserRim')) {
      g.add(mk(new THREE.TorusGeometry(3.0, 0.55, 6, 12), L({ color: 0xffffff, flatShading: true }), byKind.get('geyserRim'),
        p => ({ pos: [p.x, p.y + 0.25, p.z], scale: [1, 1, 1], rot: [Math.PI / 2, 0, 0], color: p.color })));
    }
    if (byKind.get('jellyPad')) {
      // A skyjelly launch pad: a low cushion with its flat face up. As a dome
      // it read as a white disc pasted on the grass, which is not what it is.
      const mats = L({ color: 0x8fe6ff, transparent: true, opacity: 0.75, flatShading: true, sway: 0.08 });
      g.add(mk(new THREE.SphereGeometry(1, 10, 6, 0, TAU, 0, Math.PI * 0.55), mats, byKind.get('jellyPad'),
        p => ({ pos: [p.x, p.y - p.s * 0.18, p.z], scale: [p.s, p.s * 0.55, p.s], rot: [Math.PI, 0, 0], color: 0x6fd0e8 })));
    }
    // grass tufts + flowers
    const tufts = [];
    for (const isl of this.islands) for (const gp of isl.grassPts || []) tufts.push(gp);
    if (tufts.length) {
      const cone = new THREE.ConeGeometry(0.16, 0.9, 4, 1, true);
      cone.translate(0, 0.45, 0);

      const im = new THREE.InstancedMesh(cone, L({ color: 0xffffff, flatShading: true, side: THREE.DoubleSide, sway: 0.22, instancedPhase: true }), tufts.length);
      addInstancePhase(im, tufts.length, Math.random);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), v = new THREE.Vector3();
      const col = new THREE.Color();
      const gc = new THREE.Color(0x74c85e), gc2 = new THREE.Color(0x57a84a);
      tufts.forEach((t, i) => {
        v.set(t.x, t.y, t.z); s.set(t.s, t.s * (t.flower ? 1.2 : 1), t.s); e.set(0, t.rot, (Math.random() - 0.5) * 0.2);
        q.setFromEuler(e); m.compose(v, q, s); im.setMatrixAt(i, m);
        col.set(t.flower ? t.color : gc.clone().lerp(gc2, Math.random())); im.setColorAt(i, col);
      });
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      g.add(im);
      this.grassMesh = im;
    }
    return g;
  }

  ribbonMeshes() {
    const g = new THREE.Group();
    for (const rb of this.ribbons) {
      const len = rb.len;
      // The visible ribbon must span only the corridor between the shores.
      // Drawn centre-to-centre it lay across the island like a grey disc -
      // the single most-reported visual bug.
      const span = Math.max(1, rb.end - rb.start);
      const geo = new THREE.PlaneGeometry(span, rb.width, Math.max(4, Math.floor(span / 6)), 3);
      geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.16, depthWrite: false });
      const mesh = new THREE.Mesh(geo, mat);
      const mx = rb.ax + rb.nx * (rb.start + rb.end) / 2, mz = rb.az + rb.nz * (rb.start + rb.end) / 2;
      const ya = (this.byId.get(rb.from).y + this.byId.get(rb.to).y) / 2 + 2.2;
      mesh.position.set(mx, ya, mz);
      mesh.rotation.y = -Math.atan2(rb.nz, rb.nx);
      mesh.renderOrder = 2;
      g.add(mesh);
      rb.mesh = mesh; rb.y = ya;
      // streak particles
      const N = 60, sp = [], col = [];
      const rng = mulberry32(hashString(rb.from + rb.to));
      for (let i = 0; i < N; i++) {
        sp.push({ t: rng(), off: (rng() - 0.5) * rb.width * 0.85, h: rng() * 2.2, s: 0.6 + rng() * 0.8 });
      }
      const pg = new THREE.BufferGeometry();
      const pos = new Float32Array(N * 3);
      pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const pts = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xeaf7ff, size: 0.5, transparent: true, opacity: 0.7, depthWrite: false }));
      pts.frustumCulled = false;
      g.add(pts);
      rb.points = pts; rb.streaks = sp; rb.posAttr = pg.getAttribute('position');
    }
    return g;
  }

  corralMeshes() {
    const g = new THREE.Group();
    for (const c of this.corrals) {
      const isl = this.islandAt(c.x, c.z);
      c.y = this.heightAt(c.x, c.z) ?? (isl ? isl.y : 0);
      const post = new THREE.Group();
      const mat = L({ color: 0xc9a06a, flatShading: true });
      const N = 22;
      for (let i = 0; i < N; i++) {
        const a = (i / N) * TAU;
        const x = c.x + Math.cos(a) * c.r, z = c.z + Math.sin(a) * c.r;
        const y = this.heightAt(x, z) ?? c.y;
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.1, 5), mat);
        p.position.set(x, y + 0.55, z); p.castShadow = true; post.add(p);
        const nx = c.x + Math.cos(a + TAU / N) * c.r, nz = c.z + Math.sin(a + TAU / N) * c.r;
        const ny = this.heightAt(nx, nz) ?? c.y;
        const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, Math.hypot(nx - x, nz - z), 4), mat);
        rail.position.set((x + nx) / 2, (y + ny) / 2 + 0.85, (z + nz) / 2);
        rail.rotation.z = Math.PI / 2;
        rail.rotation.y = -Math.atan2(nz - z, nx - x);
        post.add(rail);
      }
      // No floor disc: a flat circle cannot follow the bumpy heightfield, so it
      // poked through the grass as a grey disc. The fence already reads as a pen.
      post.visible = c.unlocked;
      c.mesh = post; c.padMesh = null;
      g.add(post);
    }
    return g;
  }

  structureMeshes() {
    const g = new THREE.Group();
    for (const s of this.structures) {
      const y = this.heightAt(s.x, s.z) ?? 0;
      s.y = y;
      const grp = new THREE.Group();
      grp.position.set(s.x, y, s.z);
      grp.rotation.y = s.rot || 0;
      if (s.kind === 'skyport') {
        const floor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.4, 8), L({ color: 0xb98a55, flatShading: true }));
        floor.position.y = 0.2; floor.castShadow = floor.receiveShadow = true; grp.add(floor);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(12, 0.35, 9), L({ color: 0xd9563f, flatShading: true }));
        roof.position.y = 3.6; roof.castShadow = true; grp.add(roof);
        for (const [px, pz] of [[-5, -3.5], [5, -3.5], [-5, 3.5], [5, 3.5]]) {
          const p = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3.4, 6), L({ color: 0x8a6a44 }));
          p.position.set(px, 1.9, pz); grp.add(p);
        }
        const counter = new THREE.Mesh(new THREE.BoxGeometry(4, 1.1, 1.2), L({ color: 0xe8c48a, flatShading: true }));
        counter.position.set(0, 0.95, 0); counter.castShadow = true; grp.add(counter);
        s.counterWorld = new THREE.Vector3(s.x, y + 1.2, s.z);
      } else if (s.kind === 'hut') {
        const body = new THREE.Mesh(new THREE.BoxGeometry(7, 3.2, 6), L({ color: 0xc08a52, flatShading: true }));
        body.position.y = 1.6; body.castShadow = true; grp.add(body);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(5.6, 2.4, 4), L({ color: 0x8f4f3a, flatShading: true }));
        roof.position.y = 4.3; roof.rotation.y = Math.PI / 4; roof.castShadow = true; grp.add(roof);
        const door = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.1, 0.2), L({ color: 0x6b4a2c }));
        door.position.set(0, 1.05, 3.05); grp.add(door);
      } else if (s.kind === 'board') {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.4, 6), L({ color: 0x8a6a44 }));
        post.position.y = 1.2; grp.add(post);
        const sheet = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 0.12), L({ color: 0xf2e6c8, flatShading: true }));
        sheet.position.y = 2.2; sheet.castShadow = true; grp.add(sheet);
        s.marker = new THREE.Vector3(s.x, y + 1.4, s.z);
      } else if (s.kind === 'stall') {
        const base = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.3, 3.2), L({ color: 0x9a7a4a }));
        base.position.y = 0.15; grp.add(base);
        const awning = new THREE.Mesh(new THREE.BoxGeometry(5, 0.25, 4), L({ color: 0x59b0c9, flatShading: true }));
        awning.position.y = 2.9; grp.add(awning);
        for (const [px, pz] of [[-2, -1.5], [2, -1.5], [-2, 1.5], [2, 1.5]]) {
          const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.8, 5), L({ color: 0x7a5638 }));
          p.position.set(px, 1.4, pz); grp.add(p);
        }
      } else if (s.kind === 'flag') {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 6, 5), L({ color: 0xdad7cf }));
        pole.position.y = 3; grp.add(pole);
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.3), L({ color: 0xffb347, side: THREE.DoubleSide }));
        flag.position.set(1.15, 5.2, 0); grp.add(flag);
        s.flagMesh = flag;
      }
      s.mesh = grp;
      g.add(grp);
    }
    return g;
  }
}

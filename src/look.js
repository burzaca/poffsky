// POFFSKY LOOK RECIPE — the single visual recipe every object goes through.
// See LOOK.md. Do not hand-tune individual materials; change the recipe here.
//
// Why this is baked: an earlier version of this file post-graded every fragment
// (banded light + rim) through onBeforeCompile. It looked right in isolation and
// wrong in the scene, and it was almost impossible to debug — three.js reuses
// compiled programs by a cache key we do not control, and a patched shader that
// silently disagrees with that key produces washed-out or black geometry with no
// error anywhere. So the recipe is now computed once, on the CPU, into vertex
// colours, where it can be inspected and unit-tested. Only the parts that must
// move (grass sway, day/night tint) stay on the GPU, and they only touch the
// vertex stage or the material colour — never the fragment pipeline.
//
// The recipe, in order:
//   1. base colour per surface (from the biome palette)
//   2. contact darkening (ambient occlusion) near the base of a shape
//   3. three-band poster light from the sun direction — the "printed" look
//   4. a small saturation push so it reads bright on any screen

import * as THREE from '../vendor/three.module.js';

export const PALETTE = {
  skyHigh:   '#3f86e0', skyLow: '#dff1ff',
  grass1:    '#7fc35a', grass2: '#5da247',
  dirt:      '#8a6a44', rock: '#6f6558',
  rim:       '#ffd9a0',
  hero:      '#2f6f8f', heroAccent: '#ffb347',
};

export const LOOK = {
  // three readable light levels; the sun-facing band is 1.0 so colours stay true
  bands: [0.55, 0.78, 1.00],
  satBoost: 1.08,
  aoStrength: 0.35,
  // the direction the baked light comes from (matches the scene sun at midday)
  lightDir: [0.55, 0.70, 0.45],
};

// ---- the maths, kept pure so tests/engine.test.js can assert on it ----------

export function bandValue(nd) {
  if (nd <= 0) return LOOK.bands[0];
  if (nd >= 1) return LOOK.bands[2];
  const t = nd * 2;
  const a = Math.floor(t), f = t - a;
  // segment 0 ramps band0 -> band1, segment 1 ramps band1 -> band2
  const lo = a === 0 ? LOOK.bands[0] : LOOK.bands[1];
  const hi = a === 0 ? LOOK.bands[1] : LOOK.bands[2];
  return lo + (hi - lo) * f;
}
function lerp3(a, b, t) { return a + (b - a) * t; }

export function saturate(rgb, boost) {
  const [r, g, b] = rgb;
  const l = r * 0.2126 + g * 0.7152 + b * 0.0722;
  return [
    clamp01(l + (r - l) * boost),
    clamp01(l + (g - l) * boost),
    clamp01(l + (b - l) * boost),
  ];
}
const clamp01 = (x) => Math.min(1, Math.max(0, x));

// Bake the recipe into a geometry's colour attribute.
//   geometry  – must already have position; colour is created if missing
//   base      – THREE.Color or [r,g,b] the surface starts from
//   opts.variate – per-vertex colour jitter amount (0..1)
//   opts.ao    – {strength, baseY, height} contact darkening
//   opts.normalAttr – use an existing normal instead of the geometry's
export function bakeLook(geometry, base, opts = {}) {
  const pos = geometry.getAttribute('position');
  if (!pos) return geometry;
  const n = pos.count;
  const rng = opts.rng || Math.random;
  const variate = opts.variate ?? 0;
  const ao = opts.ao || null;
  const baseRGB = base.isColor ? [base.r, base.g, base.b] : base;
  const L = norm(LOOK.lightDir);

  let col = geometry.getAttribute('color');
  if (!col || col.count !== n) {
    col = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
    geometry.setAttribute('color', col);
    for (let i = 0; i < n; i++) col.setXYZ(i, baseRGB[0], baseRGB[1], baseRGB[2]);
  }
  // opts.reuse === true: the caller already painted per-vertex colours; the
  // recipe composes on top of them instead of replacing them.
  const reuse = opts.reuse && baseRGB[0] === 1 && baseRGB[1] === 1 && baseRGB[2] === 1;
  const nrm = opts.normalAttr || geometry.getAttribute('normal');

  for (let i = 0; i < n; i++) {
    let r = col.getX(i), g = col.getY(i), b = col.getZ(i);
    if (!reuse) { [r, g, b] = baseRGB; }
    if (variate > 0) {
      const j = 1 + (rng() - 0.5) * variate;
      r *= j; g *= j; b *= j;
    }
    if (ao) {
      const y = pos.getY(i);
      const t = Math.min(1, Math.max(0, (y - ao.baseY) / ao.height));
      const k = 1 - ao.strength * (1 - t);
      r *= k; g *= k; b *= k;
    }
    let nx = 0, ny = 1, nz = 0;
    if (nrm) { nx = nrm.getX(i); ny = nrm.getY(i); nz = nrm.getZ(i); }
    const nl = Math.hypot(nx, ny, nz) || 1;
    const nd = (nx * L[0] + ny * L[1] + nz * L[2]) / nl;
    const m = bandValue(nd);
    [r, g, b] = saturate([r * m, g * m, b * m], LOOK.satBoost);
    col.setXYZ(i, clamp01(r), clamp01(g), clamp01(b));
  }
  col.needsUpdate = true;
  return geometry;
}

const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

// ---- materials -------------------------------------------------------------

// The world material: vertex colours carry the recipe, the scene light carries
// the time of day. `sway` is a vertex-stage wind wobble for grass and leaves.
export function toonMaterial(opts = {}) {
  const { color = 0xffffff, vertexColors = true, sway = 0, flatShading = false,
    transparent, opacity, side, emissive = 0x000000, instancedPhase = false } = opts;
  const mat = new THREE.MeshLambertMaterial({ color, vertexColors, flatShading, emissive });
  // Only pass the optional keys when given: three.js warns on undefined values.
  if (transparent !== undefined) mat.transparent = transparent;
  if (opacity !== undefined) mat.opacity = opacity;
  if (side !== undefined) mat.side = side;
  // `sway` may be given as a bare amount (0.22) or as { amount, ... }
  const swayAmount = typeof sway === 'number' ? sway : (sway && sway.amount) || 0;
  if (!swayAmount) return mat;
  const key = ['poffsky-sway-v5', swayAmount.toFixed(3), instancedPhase ? 'phase' : 'nophase'].join('-');
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = 'uniform float uTime;\nattribute float instancePhase;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', [
      '#include <begin_vertex>',
      '{',
      `  float ph = transformed.y * 1.4${instancedPhase ? ' + instancePhase' : ''};`,
      `  float amp = ${swayAmount.toFixed(3)} * smoothstep(0.05, 1.0, transformed.y);`,
      '  transformed.x += sin(uTime * 1.3 + ph) * amp;',
      '  transformed.z += cos(uTime * 1.1 + ph * 1.3) * amp * 0.7;',
      '}',
    ].join('\n'));
    mat.userData.shader = shader;
  };
  mat.customProgramCacheKey = () => key;
  return mat;
}

// One pass over the finished scene: every mesh that has no colour attribute
// gets the recipe baked from its own material colour. This is what keeps the
// promise at the top of this file — there is no second, hand-painted look.
export function applyLookPass(root, rng = Math.random) {
  let n = 0;
  root.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    const m = o.material;
    if (!m || !m.isMeshLambertMaterial) return;
    if (m.map || m.emissiveMap) return;              // textured things keep their texture
    if (m.transparent && m.opacity < 0.35) return;   // haze, glows, cones
    if (o.geometry.getAttribute('color')) return;    // already baked
    const base = [m.color.r, m.color.g, m.color.b];
    bakeLook(o.geometry, base, { rng, variate: 0.05 });
    m.vertexColors = true;
    n++;
  });
  return n;
}

export const uniforms = { uTime: { value: 0 } };
export function tickLook(t) { uniforms.uTime.value = t; }

export function addInstancePhase(instancedMesh, count, rng = Math.random) {
  const arr = new Float32Array(count);
  for (let i = 0; i < count; i++) arr[i] = rng() * Math.PI * 2;
  instancedMesh.geometry.setAttribute('instancePhase', new THREE.InstancedBufferAttribute(arr, 1));
}

// Kept for call sites that used the old name.
export function bakeAO(geometry, strength = LOOK.aoStrength, baseY = 0, height = 1) {
  const pos = geometry.getAttribute('position');
  const col = geometry.getAttribute('color');
  if (!pos || !col) return geometry;
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, Math.max(0, (pos.getY(i) - baseY) / height));
    const k = 1 - strength * (1 - t);
    col.setXYZ(i, col.getX(i) * k, col.getY(i) * k, col.getZ(i) * k);
  }
  return geometry;
}

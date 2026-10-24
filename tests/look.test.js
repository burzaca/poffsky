// The look recipe is pure maths on vertex colours, so it is testable without a
// browser. This matters: the recipe used to live in a patched fragment shader,
// where a silent program-cache mismatch made the whole world render pale grey
// with no error anywhere. Baked, it can be asserted on.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';

import { bandValue, saturate, bakeLook, applyLookPass, LOOK } from '../src/look.js';

test('look: band value is monotonic and lands on the three poster levels', () => {
  assert.ok(bandValue(0) < bandValue(0.5));
  assert.ok(bandValue(0.5) < bandValue(1));
  assert.equal(bandValue(1), LOOK.bands[2]);
  assert.equal(bandValue(0), LOOK.bands[0]);
  // never outside the declared range
  for (let nd = -1; nd <= 2; nd += 0.1) {
    const v = bandValue(nd);
    assert.ok(v >= LOOK.bands[0] - 1e-9 && v <= LOOK.bands[2] + 1e-9);
  }
});

test('look: saturate pushes colour away from grey and clamps', () => {
  const out = saturate([0.5, 0.5, 0.5], 1.5);
  assert.deepEqual(out, [0.5, 0.5, 0.5], 'grey must stay grey');
  const green = saturate([0.2, 0.6, 0.1], 1.2);
  assert.ok(green[1] > 0.6, 'the dominant channel gets more dominant');
  assert.ok(green.every(c => c >= 0 && c <= 1));
});

test('look: bakeLook writes a colour attribute that follows the surface normal', () => {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.deleteAttribute('color');
  bakeLook(geo, [0.8, 0.2, 0.2]);
  const col = geo.getAttribute('color');
  const nrm = geo.getAttribute('normal');
  assert.equal(col.count, geo.getAttribute('position').count);
  let up = -1, down = 1;
  for (let i = 0; i < col.count; i++) {
    const nd = nrm.getX(i) * LOOK.lightDir[0] + nrm.getY(i) * LOOK.lightDir[1] + nrm.getZ(i) * LOOK.lightDir[2];
    const lum = col.getX(i) + col.getY(i) + col.getZ(i);
    if (nd > 0.5) up = Math.max(up, lum);
    if (nd < -0.5) down = Math.min(down, lum);
  }
  assert.ok(up > down, 'faces toward the light must be brighter than faces away');
});

test('look: reuse composes on top of painted colours instead of replacing them', () => {
  const geo = new THREE.PlaneGeometry(1, 1, 1, 1);
  const n = geo.getAttribute('position').count;
  const painted = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { painted[i * 3] = 0.2; painted[i * 3 + 1] = 0.7; painted[i * 3 + 2] = 0.1; }
  geo.setAttribute('color', new THREE.BufferAttribute(painted, 3));
  bakeLook(geo, [1, 1, 1], { reuse: true });
  const col = geo.getAttribute('color');
  // green must survive: the green channel stays dominant over red
  assert.ok(col.getY(0) > col.getX(0), 'painted hue is preserved');
});

test('look: applyLookPass gives un-painted meshes the recipe instead of black', () => {
  const root = new THREE.Object3D();
  const plain = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial({ color: 0x3366aa }));
  root.add(plain);
  const baked = applyLookPass(root);
  assert.equal(baked, 1);
  assert.ok(plain.geometry.getAttribute('color'), 'a colour attribute was created');
  assert.equal(plain.material.vertexColors, true);
  const c = plain.geometry.getAttribute('color');
  assert.ok(c.getZ(0) > 0, 'the material colour carried through, not black');
  // running it twice must not double-bake
  assert.equal(applyLookPass(root), 0);
});

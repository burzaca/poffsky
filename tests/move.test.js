// Camera-relative movement. The "W moves me left" class of bug is a quarter
// turn in a rotation matrix, which is invisible in a screenshot and obvious in
// the hands — so it lives here instead.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { moveBasis } from '../src/player.js';

const near = (a, b) => Math.abs(a - b) < 1e-6;

test('move: W walks along the direction the camera is looking', () => {
  // camera yaw 0 means the camera sits at -Z and looks toward +Z
  const at0 = moveBasis(0, { f: 1 });
  assert.ok(near(at0.wx, 0) && near(at0.wz, 1), 'yaw 0: forward is +Z');

  // yaw pi/2: the camera sits at -X and looks toward +X
  const at90 = moveBasis(Math.PI / 2, { f: 1 });
  assert.ok(near(at90.wx, 1) && near(at90.wz, 0), 'yaw 90: forward is +X');

  // and the camera position formula from player.updateCamera must agree
  const yaw = 0.7;
  const camOffset = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
  const fwd = moveBasis(yaw, { f: 1 });
  const dot = camOffset.x * fwd.wx + camOffset.z * fwd.wz;
  assert.ok(dot < -0.99, 'forward points away from the camera, i.e. where it looks');
});

test('move: D strafes to the player-visible right, A to the left', () => {
  // The camera's own right vector, derived the same way three.js does it:
  // the camera sits at target + dist * (-sin yaw, ., -cos yaw) and looks at
  // the target, so view = (sin yaw, 0, cos yaw) and right = up x view.
  const cameraRight = (yaw) => ({ x: -Math.cos(yaw), z: Math.sin(yaw) });
  for (const yaw of [0, 0.4, 1.1, 2.5, -2.9]) {
    const d = moveBasis(yaw, { r: 1 }), a = moveBasis(yaw, { l: 1 });
    const cr = cameraRight(yaw);
    assert.ok(d.wx * cr.x + d.wz * cr.z > 0.999, 'D moves screen-right at yaw ' + yaw);
    assert.ok(a.wx * cr.x + a.wz * cr.z < -0.999, 'A moves screen-left at yaw ' + yaw);
  }
});

test('move: diagonals are normalised and S reverses W', () => {
  const diag = moveBasis(0.3, { f: 1, r: 1 });
  assert.ok(Math.abs(Math.hypot(diag.wx, diag.wz) - 1) < 1e-6, 'no diagonal speed boost');
  const back = moveBasis(1.2, { b: 1 });
  const fwd = moveBasis(1.2, { f: 1 });
  assert.ok(near(back.wx, -fwd.wx) && near(back.wz, -fwd.wz));
});

test('move: no input produces no movement', () => {
  const still = moveBasis(2.1, {});
  assert.ok(near(still.wx, 0) && near(still.wz, 0));
});

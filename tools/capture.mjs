#!/usr/bin/env node
// POFFSKY shot manifest. Prints a JSON list of fixed camera shots for the
// review loop (see LOOK.md). This is a manifest generator, NOT a screenshotter:
// it opens no browser and writes no images. Whoever drives the browser loads
// each `url`, waits for `settleMs`, and saves a screenshot to `file`.
//
// Usage:
//   node tools/capture.mjs                      all shots, default base URL
//   node tools/capture.mjs --base http://host:port/
//   node tools/capture.mjs --shot pen_view      one shot
//   node tools/capture.mjs --round 2            changes output file names
//
// Conventions (world units, +y up):
//   yaw   = atan2(target.x - pos.x, target.z - pos.z), radians, 0 looks down +z
//   pitch = atan2(target.y - pos.y, horizontal distance), radians, + looks up
//   t     = seconds into the day cycle (dayLen 210 + nightLen 105 = 315).
//           dawn 0-17, morning 17-88, midday 88-151, dusk 151-210, night 210-315.
// The page is expected to read ?shot=<name>&t=<seconds>, place the camera at
// `pos` looking at `target`, freeze the clock at `t`, and hide the HUD.

const SHOTS = [
  { name: 'hero_close', t: 120, fov: 50,
    pos: [3.2, 2.2, 4.4], target: [0, 1.1, 0],
    checks: 'Rook silhouette reads at a glance; rim light visible; face/Bellows not lost in grass.' },
  { name: 'ranch_wide', t: 100, fov: 55,
    pos: [36, 18, 42], target: [0, 1, 6],
    checks: 'Ground is calm; pens, hut, skyport readable as shapes; one bright thing.' },
  { name: 'pen_view', t: 110, fov: 50,
    pos: [24, 5, 22], target: [14, 0.8, 12],
    checks: 'Poffs pop against grass; fence does not hide them; sway and bob visible across frames.' },
  { name: 'island_edge', t: 130, fov: 55,
    pos: [0, 6, 60], target: [0, -4, 40],
    checks: 'Island edge silhouette against cloud sea; underside not a black hole; fog blend smooth.' },
  { name: 'sky_ride', t: 140, fov: 60,
    pos: [52, 10, -10], target: [104, 5, -26],
    checks: 'Gust ribbon to Orchardreach is legible; distant island readable through fog.' },
  { name: 'night_mood', t: 260, fov: 50,
    pos: [24, 6, 26], target: [14, 1, 12],
    checks: 'Still readable at night; poffs and paths visible; one warm light source draws the eye.' },
];

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const r3 = (x) => Math.round(x * 1000) / 1000;

function pose(s) {
  const dx = s.target[0] - s.pos[0], dy = s.target[1] - s.pos[1], dz = s.target[2] - s.pos[2];
  return { yaw: r3(Math.atan2(dx, dz)), pitch: r3(Math.atan2(dy, Math.hypot(dx, dz))) };
}

const base = arg('base', 'http://localhost:8000/');
const only = arg('shot', null);
const round = Number(arg('round', 1));

const list = only ? SHOTS.filter((s) => s.name === only) : SHOTS;
if (!list.length) {
  process.stderr.write('unknown shot: ' + only + '\nknown: ' + SHOTS.map((s) => s.name).join(', ') + '\n');
  process.exit(1);
}

const manifest = {
  generator: 'tools/capture.mjs',
  note: 'manifest only; no screenshots are taken by this script',
  viewport: { width: 1280, height: 720 },
  settleMs: 1500,
  round,
  shots: list.map((s) => {
    const url = new URL(base);
    url.searchParams.set('shot', s.name);
    url.searchParams.set('t', String(s.t));
    return {
      name: s.name,
      pos: s.pos,
      target: s.target,
      ...pose(s),
      fov: s.fov,
      t: s.t,
      query: url.search,
      url: url.toString(),
      file: `captures/r${round}_${s.name}.png`,
      checks: s.checks,
    };
  }),
};

process.stdout.write(JSON.stringify(manifest, null, 2) + '\n');

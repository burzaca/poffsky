// Normalised silhouette space for poff profiles.
//   - total height ≈ 1.8 units (varies per species for visual distinction)
//   - max radius ≈ 1.0  (varies per species)
//   - widest point sits slightly below vertical centre
// The caller scales the result by species.size.
// All 8 silhouettes are keyed off species.id deterministically; no Math.random.
// Traits (spook, drift) modulate the base shape so a spookier poff gets a
// pointed crown and a driftier one gets a teardrop swell.

import { clamp } from './util.js';

// 10 interior radii per species, sampled along normalised height.
// Each set reflects the creature's name, personality and spook/drift values.
const SILHOUETTES = {
  // dandle — small, plump, food-motivated bobber; dozes when full.
  dandle:      [0.70, 0.85, 0.93, 0.95, 0.90, 0.82, 0.70, 0.52, 0.25, 0.08],

  // marmalump — heavy and round; rolls downhill, bumps friends. Short + wide.
  marmalump:   [0.75, 0.90, 0.98, 0.99, 1.00, 0.92, 0.80, 0.62, 0.35, 0.10],

  // sootling — skittish, spooky (spook 0.7); tall, narrow, pointed crown.
  sootling:    [0.40, 0.48, 0.54, 0.60, 0.56, 0.48, 0.40, 0.32, 0.20, 0.08],

  // flurrin — dreamy floater, highest drift (0.8); teardrop, swells mid-body.
  flurrin:     [0.35, 0.50, 0.65, 0.78, 0.85, 0.80, 0.70, 0.55, 0.30, 0.10],

  // bumbleaf — largest (size 1.2), slow & gentle; very wide, leaf-like.
  bumbleaf:    [0.65, 0.85, 0.98, 1.02, 1.05, 0.98, 0.85, 0.65, 0.32, 0.08],

  // toastmallow — warm & cuddly; plump with a rounded dome top.
  toastmallow: [0.72, 0.86, 0.90, 0.92, 0.87, 0.80, 0.70, 0.52, 0.28, 0.10],

  // sherbetto — bubbly show-off, spins & shimmers; conical swell from base.
  sherbetto:   [0.28, 0.48, 0.65, 0.78, 0.90, 0.84, 0.74, 0.58, 0.32, 0.12],

  // grumblenimbus — grumpy raincloud (gloom); wide cloud-base, bulbous mid.
  grumblenimbus:[0.78, 0.86, 0.95, 0.99, 1.02, 0.94, 0.78, 0.58, 0.30, 0.10],
};

// Total height per species — deliberately varied so every silhouette is
// distinct even before radius is considered.
const HEIGHTS = {
  dandle:       1.80,
  marmalump:    1.55,
  sootling:     1.95,
  flurrin:      1.85,
  bumbleaf:     1.75,
  toastmallow:  1.70,
  sherbetto:    1.78,
  grumblenimbus: 1.82,
};

function makeProfile(widths, height) {
  const pts = [[0.001, 0]]; // closed bottom (radius ~0)
  const n = widths.length;
  for (let i = 0; i < n; i++) {
    const t = (i + 1) / (n + 1);
    pts.push([clamp(widths[i], 0.001, 2), t * height]);
  }
  pts.push([0.001, height]); // closed top (radius ~0)
  return pts;
}

export function poffProfile(species) {
  const id = species.id || 'dandle';
  const spook = species.spook ?? 0.4;
  const drift = species.drift ?? 0.4;
  const widths = (SILHOUETTES[id] || SILHOUETTES.dandle).slice();
  const height = HEIGHTS[id] || 1.80;

  // Deterministic trait modulation:
  //  - drift swells the mid-body (teardrop tendency, indices ~0.25–0.75)
  //  - spook narrows the upper crown (pointed top, t > 0.55)
  const n = widths.length;
  for (let i = 0; i < n; i++) {
    const t = (i + 1) / (n + 1);
    if (t > 0.25 && t < 0.75) widths[i] *= 1 + drift * 0.06;
    if (t > 0.55) widths[i] *= 1 - spook * 0.12 * ((t - 0.55) / 0.45);
  }

  return makeProfile(widths, height);
}

// A shorter, forward-offset profile that traces the lower belly curve.
// Used for a belly patch that follows the body curvature beneath the midline.
export function bellyProfile(species) {
  const body = poffProfile(species);
  const pts = [[0.001, 0]];
  for (let i = 2; i <= 7; i++) {
    const b = body[i];
    pts.push([b[0] * 0.6, b[1]]);
  }
  pts.push([0.001, body[7][1]]);
  return pts;
}

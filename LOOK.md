# POFFSKY look recipe

One recipe for every asset. The source of truth is `src/look.js`; this file
explains it and sets the rules. If the two disagree, fix whichever is wrong in
the same change.

## 1. The one rule

Every lit mesh uses `toonMaterial()` from `src/look.js`. No material may be
hand-tuned outside `look.js`: no per-object band, rim, saturation or AO values,
no raw `MeshStandardMaterial` / `MeshLambertMaterial` for world objects. If
something looks wrong, change the recipe (or its input colour) and re-capture
everything, not just the shot that looked wrong.

Allowed exceptions, all unlit by nature: the sky dome, sun/moon discs, stars,
particles, UI. They take their colours from the palette below or from
`src/sky.js` palettes.

## 2. Palette (`PALETTE` in look.js)

| key        | hex       | use                              |
|------------|-----------|----------------------------------|
| skyHigh    | `#3f86e0` | sky zenith (midday)              |
| skyLow     | `#dff1ff` | sky horizon (midday)             |
| grass1     | `#7fc35a` | main ground                      |
| grass2     | `#5da247` | ground variation                 |
| grassDark  | `#417a3a` | shade, island rims               |
| dirt       | `#8a6a44` | paths, island underside          |
| rock       | `#6f6558` | rocks, cliffs                    |
| rim        | `#ffd9a0` | warm rim light colour            |
| hero       | `#2f6f8f` | Rook body                        |
| heroAccent | `#ffb347` | Rook accent, Bellows             |
| ui         | `#fff7e8` | UI panels and text backing       |

New colours go into `PALETTE` with a name, not inline in a mesh builder.

## 3. The recipe (`LOOK` / `bakeLook` in look.js)

The recipe is computed on the CPU into vertex colours, not in a fragment
shader. Order:

1. Base colour (palette, or the colours a builder already painted when
   `reuse: true`).
2. Contact darkening toward the base of a shape (`ao`, `aoStrength = 0.35`).
3. Banded poster light: `N.L` against `LOOK.lightDir` mapped to three levels
   `[0.55, 0.78, 1.00]` — the sun-facing band is 1.0 so hues stay true.
4. Saturation push, `satBoost = 1.08`.

**Why baked.** An earlier version post-graded every fragment through
`onBeforeCompile`. It rendered the whole world pale grey with no error
anywhere: three.js reuses compiled programs by a cache key we do not control,
and a patched shader that disagrees with that key silently drops `USE_COLOR`.
Two days of debugging produced nothing but screenshots of grey grass. Baked,
the recipe is pure maths — `tests/look.test.js` asserts on it, and a wrong
recipe fails a test instead of shipping a grey world.

`applyLookPass(scene)` runs once after the scene is built and bakes any mesh
that has no colour attribute of its own, from its material colour. That is
what enforces "one look": there is no second, hand-painted path.

Only two things stay on the GPU, and neither touches the fragment pipeline:
foliage sway (a vertex-stage wobble, `sway: amp`, desynchronised per instance
via `addInstancePhase`) and the day/night tint (the scene lights, which
multiply the baked colours).

## 4. Lighting values (`src/sky.js`)

Hemisphere light + one shadow-casting directional sun; values blend between
phases.

| phase   | sun colour | sun I | hemi sky  | hemi ground | hemi I | fog       |
|---------|------------|-------|-----------|-------------|--------|-----------|
| dawn    | `#ffd9a0`  | 1.05  | `#8fa8e0` | `#6a7a55`   | 0.55   | `#c9a9c4` |
| morning | `#fff4d0`  | 1.35  | `#a8d4f5` | `#7ba05e`   | 0.75   | `#cfe4f5` |
| midday  | `#ffffff`  | 1.50  | `#b8e0ff` | `#89ad68`   | 0.85   | `#dceaf7` |
| dusk    | `#ff9a5a`  | 0.90  | `#8d7fb8` | `#5d5a48`   | 0.50   | `#a58aa8` |
| night   | `#9fb4ff`  | 0.35  | `#39456f` | `#2a3040`   | 0.30   | `#232a4a` |
| storm   | `#d8dee8`  | 0.70  | `#7f8ba0` | `#5a6152`   | 0.60   | `#7c8798` |

Fog range 90-620. Shadow map 2048, frustum +-60 around the player.
Note: the shader's band direction is currently a fixed vector
`(0.55, 0.75, 0.35)`, not the live sun direction.

## 5. Readability before looks

Check these before any polish. A shot that fails one is not done.

- Calm ground. Ground is low-contrast and low-detail; grass tufts and flowers
  stay sparse near paths and pens. Texture noise must never compete with
  creatures.
- Readable silhouettes. Rook, every poff species, NPCs and pickups are
  identifiable from silhouette alone at gameplay distance (about 8 m). Fix
  shape before colour.
- One bright thing per view. Each fixed shot has a single highest-value,
  most-saturated focal point (Rook's accent, a plume, a lit window at night).
  If two things compete, dim one.
- Value separation. Creatures differ from the ground behind them in value, not
  just hue. Test with the saturation dropped to zero.
- Night is still playable: paths, poffs and pens remain visible.

## 6. Motion: small, for life

Motion is subtle and constant; nothing in a resting view is fully still.

- Sway: foliage and grass via the `sway` option, amplitude rising with height,
  desynchronised per instance.
- Squash-stretch: on jump, land, hop, suck-in and blow-out. Volume roughly
  preserved; short (0.1-0.25 s), springy return.
- Idle breathing: poffs, NPCs and Rook scale gently (about 2-4 %) on a slow
  loop with per-entity phase offsets.
- No large camera shake. Small FOV kick on dash only.

## 7. Review loop

Screenshots are in the loop. Do not judge the look from code.

1. Capture: `node tools/capture.mjs --round N` prints the shot manifest
   (6 shots: hero_close, ranch_wide, pen_view, island_edge, sky_ride,
   night_mood). Load each `url` at 1280x720, wait `settleMs`, save to `file`.
2. Compare: check each shot against its `checks` line and section 5, and
   against the previous round.
3. Fix the top 2 problems only, in `look.js` (or the palette / geometry
   feeding it). Readability problems outrank beauty problems.
4. Capture again and confirm the fix did not break another shot.

Maximum 2 rounds per change. Anything still wrong after round 2 gets written
down as a known issue instead of another round.

# POFFSKY

A cozy 3D sandbox in the browser. You are Rook, a courier-rancher in the
Drift, a sky archipelago above an endless cloud sea. Your tool is the Bellows:
it sucks things up and blows them away with force. Catch floating poffs, pen
them, feed them, sell their down, upgrade, repeat.

Vanilla JS + three.js (vendored). No build step, no external assets: geometry,
textures and sound are all procedural.

## The one-minute loop

Feed -> herd -> harvest -> sell -> upgrade.

1. Pick fruit and feed poffs. Their favourite fruit makes a premium plume;
   another species' fruit makes a hybrid.
2. Suck up poffs and blow them into a corral. Penned poffs shed down.
3. Collect the down and plumes.
4. Sell at the Skyport (Pip). Prices drift during the day.
5. Buy upgrades from Pip and the Bellwright, take contracts from the notice
   board, then explore further islands by riding gusts.

Failing costs time and a few coins, never progress. Falling off the world
wakes you up at the Skyport.

## Controls

| action                    | keyboard / mouse          |
|---------------------------|---------------------------|
| move                      | WASD or arrow keys        |
| sprint                    | Shift                     |
| dash                      | Ctrl or G                 |
| jump / double jump        | Space                     |
| look                      | click and drag (pointer lock) |
| Bellows: suck (hold)      | right mouse or E          |
| Bellows: blow             | release right mouse or E  |
| self-blast (movement)     | R                         |
| drop held object          | T                         |
| describe held object      | C                         |
| talk / interact           | F                         |
| contract board            | M                         |
| photograph                | P                         |
| help                      | H                         |
| pause                     | Esc                       |

Touch devices get an on-screen joystick and buttons.

## Run it

```
python3 -m http.server 8000
```

Then open http://localhost:8000/. It has to be served over HTTP because
ES modules do not load from `file://`.

## Tests

```
node --test 'tests/*.test.js'
```

Headless tests read the same tuning numbers as the game (`src/config.js`).

## Layout

- `src/` game code; `src/look.js` is the single visual recipe.
- `src/config.js` all gameplay tuning in one place.
- `content/` JSON content: poffs, fruits, NPCs, contracts.
- `vendor/` three.js.
- `tools/capture.mjs` shot manifest for the review loop.
- `DESIGN.md` design brief. `LOOK.md` look recipe and visual rules.

## Look and review loop

Every lit object goes through one recipe in `src/look.js` (banded light, warm
rim, slight saturation push, baked AO). Materials are never tuned per object.
See `LOOK.md`.

Visual changes are judged from screenshots, not from code:

1. `node tools/capture.mjs --round 1` prints a JSON manifest of 6 fixed shots
   (hero_close, ranch_wide, pen_view, island_edge, sky_ride, night_mood), each
   with a camera pose, a time of day and a URL of the form
   `?shot=<name>&t=<seconds>`. The script does not take screenshots; a browser
   driver (human or agent) loads each URL and saves the image.
2. Compare the shots against the readability rules in `LOOK.md`.
3. Fix the top 2 problems in `look.js`.
4. Capture again. At most 2 rounds per change.

## Credits

Built autonomously by Anakin (Hermes agent) for muha7a, with content written
by Claude.

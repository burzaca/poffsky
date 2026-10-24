# POFFSKY — design brief (shared context for all contributors)

A fast-paced, cozy 3D open-world sandbox game built in the browser with vanilla
JS + three.js (vendored, no build step, no external assets — everything
procedural: geometry from primitives, textures from canvas, sound from WebAudio).

## Design pillars (from research on Slime Rancher / cozy sandboxes)
1. **A fun one-minute loop.** Feed -> herd -> harvest -> sell -> upgrade. The
   collection TOOL is the game: a "Bellows" gun that sucks things up and blows
   them away with force. Blowing is as fun as grabbing.
2. **Low stress.** Failure costs time and a few coins, never progress. Death is
   a gentle wake-up at the Skyport.
3. **Bright, joyful read.** Saturated pastel palette, soft shapes, bouncy
   animation, big eyes on every creature.
4. **Depth under the cute.** Species hybrids, market prices, contracts, a
   day/night rhythm, a storm that scatters your herd.

## The world
The Drift: a sky archipelago of floating grass islands above an endless cloud
sea. Home island "Thistledown" has a ranch with corrals. Other islands have
their own biome flavour (orchard, ember, frost, bloom, ruins, geyser fields).
Everything is reachable by running, dashing, double-jumping and riding gusts.

## The player
"Rook", a courier-rancher with a Bellows. Run, dash, double-jump, glide.
Bellows: hold to suck (range ~9m, one object at a time, capacity by size),
release + aim to blow it away with force. Blowing a poff into a corral scores.
Blowing yourself off a ledge with a downward blast = a fun movement tech.

## Creatures (the "mobs")
**Poffs** — static-charged balloon-creatures. They slowly drift upward, so they
must be hobbled and penned. They shed "down" (fluff) which is the currency.
Each species has a favourite fruit; feeding one produces a premium "plume".
Feeding a poff the fruit of ANOTHER species makes a hybrid (rarer, richer).
Gloom poffs (from a bad hybrid) are grumpy and steal down — the gentle hazard.
**Snapwraiths** — night-only wisps that snatch loose down and spook poffs.
**Skyjellies** — bouncy, harmless, push you if you fall on them.

## NPCs (on the islands, with dialogue)
- **Pip** — Skyport clerk. Buys down, sells upgrades, deadpan, kind.
- **Marlow** — old ranch foreman on Thistledown. Teaches, gives contracts.
- **Tilda** — a kid with a hand-drawn map and big opinions.
- **The Bellwright** — tinkerer who upgrades the Bellows.
- **Sable** — wandering trader at night, sells rare seeds.

## Systems to implement
Corrals (pen poffs, they produce down over time), feeding, hybrid mutation,
market with drifting prices, contracts/quests, day-night cycle, storm event,
upgrades (tank, hop boots, glider, corral expansion, gust sails), save/load.

## Deliverable format for content files
Pure JSON in `content/`, schema-documented, no comments, ASCII-safe, values
tuned for a 3-5 minute first session. Keep names whimsical but short.

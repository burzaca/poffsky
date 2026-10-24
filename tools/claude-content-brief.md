You are the content designer for POFFSKY, a cozy fast-paced 3D browser game
(three.js, zero external assets). Read /home/hermes/projects/poffsky/DESIGN.md
first — it is the source of truth for tone and systems.

YOUR JOB: write four content files. Write the files FIRST, then explain.
Do not touch any other file. Do not create code. Pure JSON, no comments,
ASCII-safe (no smart quotes, no emoji).

1. /home/hermes/projects/poffsky/content/poffs.json
   Array of 8 poff species. Schema per entry:
   { "id": "snake_case", "name": "Cute Name", "color": "#rrggbb",
     "accent": "#rrggbb", "size": 0.6-1.4, "drift": 0.0-1.0,
     "spook": 0.0-1.0, "value": int_coins, "down_value": int,
     "favourite_fruit": "fruit_id", "island": "biome_id",
     "personality": "one short line for the AI behaviour",
     "hybrid_of": ["parent_id","parent_id"] or null,
     "gloom": true|false, "call": "short onomatopoeia" }
   5 base species, 3 hybrids (one of them the grumpy gloom one).
   Values must form a sensible economy: base down_value 3-8, hybrid 15-40.

2. /home/hermes/projects/poffsky/content/fruits.json
   Array of 6 fruits: { "id", "name", "color", "grows_on": "biome_id",
   "price": int, "feed_score": int }

3. /home/hermes/projects/poffsky/content/npcs.json
   Array of 5 NPCs from the brief. Schema:
   { "id", "name", "role", "island": "biome_id", "color", "hat": "description
     of a distinctive hat so I can build it from primitives",
     "lines": [ 8 short dialogue strings, each under 140 chars, in the
     character's voice, varied: greeting, shop, lore, joke, weather, night,
     when the player is rich, when the player is broke ],
     "shop": [ { "id", "name", "cost", "kind": "upgrade|seed", "effect":
     "machine-readable one-liner like 'bellows.tank+1'" } ] }
   Voices must be distinct and warm, never sarcastic-cruel. Pip is deadpan.
   Marlow is gruff and proud. Tilda is a hyper kid. The Bellwright speaks in
   short technical bursts. Sable is a smooth night merchant.

4. /home/hermes/projects/poffsky/content/contracts.json
   Array of 10 contracts (quests) forming a gentle difficulty ramp:
   { "id", "title", "giver": "npc_id", "type": "collect|deliver|pen|feed|
     photograph|survive", "target": { machine-readable params }, "reward": int,
   "reward_unlock": "optional unlock id", "text": "one warm sentence",
   "hint": "one sentence" }
   Contract 1 must be teach-the-basics. Contract 10 must be the finale
   (weather the Great Gust). No contract may require more than 5 minutes.

Make the writing genuinely charming — this is the soul of the game. Invent,
do not copy Slime Rancher names. When done, print a one-paragraph summary of
the tone choices you made.

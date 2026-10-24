// Content: species, fruits, NPCs, contracts. Built-in defaults keep the game
// playable with zero network; content/*.json (if present) overrides them.

export const DEFAULTS = {
  poffs: [
  {
    "id": "dandle",
    "name": "Dandle",
    "color": "#fff4f8",
    "accent": "#ffb3cf",
    "size": 0.8,
    "drift": 0.35,
    "spook": 0.3,
    "value": 12,
    "down_value": 3,
    "favourite_fruit": "puffberry",
    "island": "thistledown",
    "personality": "Bobs toward anyone holding a snack and dozes mid-air when full.",
    "hybrid_of": null,
    "gloom": false,
    "call": "pff!"
  },
  {
    "id": "marmalump",
    "name": "Marmalump",
    "color": "#ffb35c",
    "accent": "#ff7a3d",
    "size": 1.0,
    "drift": 0.2,
    "spook": 0.2,
    "value": 16,
    "down_value": 4,
    "favourite_fruit": "sunplum",
    "island": "orchard",
    "personality": "Heavy and content; rolls downhill on purpose and bumps friends affectionately.",
    "hybrid_of": null,
    "gloom": false,
    "call": "mrrlump"
  },
  {
    "id": "sootling",
    "name": "Sootling",
    "color": "#4a4458",
    "accent": "#ff9a3c",
    "size": 0.7,
    "drift": 0.6,
    "spook": 0.7,
    "value": 22,
    "down_value": 6,
    "favourite_fruit": "emberfig",
    "island": "ember",
    "personality": "Skittish and quick; zips away from loud blasts, then sneaks back to watch you.",
    "hybrid_of": null,
    "gloom": false,
    "call": "fwip-fwip"
  },
  {
    "id": "flurrin",
    "name": "Flurrin",
    "color": "#bfe8ff",
    "accent": "#7fb8ff",
    "size": 0.9,
    "drift": 0.8,
    "spook": 0.4,
    "value": 26,
    "down_value": 7,
    "favourite_fruit": "rimegrape",
    "island": "frost",
    "personality": "Dreamy floater; drifts highest of all and hums whenever it catches a snowflake.",
    "hybrid_of": null,
    "gloom": false,
    "call": "tinkle-oo"
  },
  {
    "id": "bumbleaf",
    "name": "Bumbleaf",
    "color": "#ffc3e6",
    "accent": "#8fdc7a",
    "size": 1.2,
    "drift": 0.15,
    "spook": 0.15,
    "value": 30,
    "down_value": 8,
    "favourite_fruit": "honeyhusk",
    "island": "bloom",
    "personality": "Slow, gentle and nosy; follows flowers around and likes to sit on your boots.",
    "hybrid_of": null,
    "gloom": false,
    "call": "bzzoomf"
  },
  {
    "id": "toastmallow",
    "name": "Toastmallow",
    "color": "#ffe2b8",
    "accent": "#c8743a",
    "size": 1.0,
    "drift": 0.4,
    "spook": 0.35,
    "value": 110,
    "down_value": 18,
    "favourite_fruit": "fizzleberry",
    "island": "ember",
    "personality": "Warm and cuddly; huddles close to other poffs at night and keeps the corral cozy.",
    "hybrid_of": [
      "dandle",
      "sootling"
    ],
    "gloom": false,
    "call": "toof!"
  },
  {
    "id": "sherbetto",
    "name": "Sherbetto",
    "color": "#ffd1a8",
    "accent": "#a8e4ff",
    "size": 1.1,
    "drift": 0.55,
    "spook": 0.3,
    "value": 150,
    "down_value": 26,
    "favourite_fruit": "honeyhusk",
    "island": "orchard",
    "personality": "Bubbly show-off; spins in slow circles and shimmers brighter when you look at it.",
    "hybrid_of": [
      "marmalump",
      "flurrin"
    ],
    "gloom": false,
    "call": "swirrrl"
  },
  {
    "id": "grumblenimbus",
    "name": "Grumblenimbus",
    "color": "#6b6f8f",
    "accent": "#c9d1ff",
    "size": 1.4,
    "drift": 0.5,
    "spook": 0.1,
    "value": 70,
    "down_value": 32,
    "favourite_fruit": "sunplum",
    "island": "ruins",
    "personality": "Grumpy little raincloud; sneaks up to pinch loose down, but purrs when fed a sunplum.",
    "hybrid_of": [
      "sootling",
      "flurrin"
    ],
    "gloom": true,
    "call": "hrrmph"
  }
],
  fruits: [
  {
    "id": "puffberry",
    "name": "Puffberry",
    "color": "#ff8fb1",
    "grows_on": "thistledown",
    "price": 2,
    "feed_score": 1
  },
  {
    "id": "sunplum",
    "name": "Sunplum",
    "color": "#ffc04a",
    "grows_on": "orchard",
    "price": 3,
    "feed_score": 2
  },
  {
    "id": "emberfig",
    "name": "Emberfig",
    "color": "#ff6a3d",
    "grows_on": "ember",
    "price": 5,
    "feed_score": 2
  },
  {
    "id": "rimegrape",
    "name": "Rimegrape",
    "color": "#9fd8ff",
    "grows_on": "frost",
    "price": 6,
    "feed_score": 3
  },
  {
    "id": "honeyhusk",
    "name": "Honeyhusk",
    "color": "#ffe07a",
    "grows_on": "bloom",
    "price": 7,
    "feed_score": 3
  },
  {
    "id": "fizzleberry",
    "name": "Fizzleberry",
    "color": "#b48cff",
    "grows_on": "geyser",
    "price": 12,
    "feed_score": 5
  }
],
  npcs: [
  {
    "id": "pip",
    "name": "Pip",
    "role": "Skyport clerk",
    "island": "thistledown",
    "color": "#7a9cff",
    "hat": "Tall flat-topped navy postal cap: a short cylinder crown on a stiff half-disc brim (thin flattened box), with a tiny brass bell (small gold sphere) pinned to the front.",
    "lines": [
      "Welcome to the Skyport. I am Pip. I have been Pip all day.",
      "Down in, coins out. Upgrades are on the shelf. The shelf is not for sale. I checked.",
      "The islands float because the clouds underneath are very polite. That is the official explanation. I wrote it.",
      "Why did the poff fail its exam? Too much drift. I will see myself out. I am already at my desk.",
      "Forecast says breezy. Forecast always says breezy. I suspect the forecast is a poff.",
      "We are open at night. I am also open at night. Mostly my eyes.",
      "That is a lot of down. I am stamping it with my most enthusiastic stamp. You cannot tell, but it is.",
      "Zero coins. A clean slate. Try the Dandles out back. They shed when they giggle."
    ],
    "shop": [
      {
        "id": "hop_boots",
        "name": "Hop Boots",
        "cost": 90,
        "kind": "upgrade",
        "effect": "player.jump+0.25"
      },
      {
        "id": "glider",
        "name": "Patchwork Glider",
        "cost": 150,
        "kind": "upgrade",
        "effect": "player.glider=true"
      },
      {
        "id": "gust_sails",
        "name": "Gust Sails",
        "cost": 200,
        "kind": "upgrade",
        "effect": "player.gust_ride+0.5"
      },
      {
        "id": "fluff_scale",
        "name": "Honest Fluff Scale",
        "cost": 120,
        "kind": "upgrade",
        "effect": "market.sell_bonus+0.1"
      }
    ]
  },
  {
    "id": "marlow",
    "name": "Marlow",
    "role": "Ranch foreman",
    "island": "thistledown",
    "color": "#a0663c",
    "hat": "Wide sun-faded straw hat: broad flat brim (thin wide cylinder), low rounded crown (squashed sphere), red band (torus) and one grey poff feather (stretched cone) tucked in the band.",
    "lines": [
      "There you are, Rook. Forty years I've kept poffs on the ground. Today you help. Grab that Bellows.",
      "Fence, feed and fixings. Built every post on this ranch myself. Lean on 'em. They'll hold.",
      "My granddad tied the first poff to a fencepost with his bootlace. Lost the boot. Kept the poff.",
      "Poff walks into a barn. No it don't. Floats in. Bonks the rafters. Every time. Heh.",
      "Wind's turning. Smell that? Check your gates and count the herd twice.",
      "Snapwraiths come out after dark. Sweep the loose down, light the lanterns, then off to bed with ya.",
      "Look at that purse. Hmph. Proud of ya, kid. Don't let it go to your hat.",
      "Empty pockets? No shame in it. Feed 'em, pen 'em, wait. Ranch pays the patient."
    ],
    "shop": [
      {
        "id": "corral_post",
        "name": "Sturdy Corral Post",
        "cost": 120,
        "kind": "upgrade",
        "effect": "corral.slots+1"
      },
      {
        "id": "hobble_ribbons",
        "name": "Hobble Ribbons",
        "cost": 70,
        "kind": "upgrade",
        "effect": "corral.escape_chance-0.25"
      },
      {
        "id": "puffberry_seed",
        "name": "Puffberry Seeds",
        "cost": 8,
        "kind": "seed",
        "effect": "plot.plant=puffberry"
      }
    ]
  },
  {
    "id": "tilda",
    "name": "Tilda",
    "role": "Self-appointed map maker",
    "island": "orchard",
    "color": "#ff7fb0",
    "hat": "Paper pirate hat folded from her own map (flattened triangular wedge, cream with doodles), a yellow pencil (thin cylinder with pink sphere eraser) stuck through the side and a crooked star sticker on the front.",
    "lines": [
      "HI! You're Rook! I know because I drew you on my map. You're the little smudge. Hi again!",
      "Map pins are three coins. Map pins with GLITTER are also three coins, but I like you more if you pick those.",
      "There's an island past the ruins that only shows up on Tuesdays. Probably. I drew it just in case.",
      "What do you call a poff with no fluff? A BALD BALLOON! Ha! Write that down! No, on the map!",
      "Big clouds today! That one's a whale. That one's a whale too. They're ALL whales. Best weather ever.",
      "I'm not sleepy. I'm resting my map eyes. Wake me up if a snapwraith does something cool.",
      "You're RICH?? Can you buy a castle? Can I have a tower? Just a small tower. A medium tower.",
      "No coins? That's okay. You can pay me in rocks. Rocks are basically coins. I decided."
    ],
    "shop": [
      {
        "id": "glitter_pins",
        "name": "Glitter Map Pins",
        "cost": 3,
        "kind": "upgrade",
        "effect": "map.pins+3"
      },
      {
        "id": "sticker_compass",
        "name": "Sticker Compass",
        "cost": 30,
        "kind": "upgrade",
        "effect": "hud.compass=true"
      },
      {
        "id": "secret_gust_map",
        "name": "Secret Gust Map",
        "cost": 45,
        "kind": "upgrade",
        "effect": "map.reveal=gusts"
      },
      {
        "id": "sunplum_seed",
        "name": "Sunplum Pits",
        "cost": 12,
        "kind": "seed",
        "effect": "plot.plant=sunplum"
      }
    ]
  },
  {
    "id": "bellwright",
    "name": "The Bellwright",
    "role": "Bellows tinkerer",
    "island": "ember",
    "color": "#d9a441",
    "hat": "Dented copper welding helmet: half-sphere dome, flip-up visor (thin box hinged at the brow), two round goggle lenses (short cylinders) and a tiny chimney pipe (narrow cylinder) on top that puffs smoke.",
    "lines": [
      "Rook. Bellows. Here. Hm. Seal's good. Nozzle's good. You're good. Next.",
      "Bigger tank. Longer reach. Harder blast. Pick one. Pick two. Pay me.",
      "First Bellows: accordion, teakettle, stubbornness. Mine. Still works. Mostly.",
      "Joke. Right. Why's the Bellows sad? Low pressure. ...That was it. Calibrated it myself.",
      "Pressure's dropping. Gusts rising. Lean in. Blast down. Jump. Free height.",
      "Night. Cold metal. Tight seals. Best tuning hours. Leave it. Back by dawn.",
      "Coins. Plenty. Good. Got a prototype. Experimental. Wonderful. Interested?",
      "No coin. Fine. Bring emberfigs. Forge loves 'em. I'll owe you a tweak."
    ],
    "shop": [
      {
        "id": "tank_coil_1",
        "name": "Tank Coil",
        "cost": 80,
        "kind": "upgrade",
        "effect": "bellows.tank+1"
      },
      {
        "id": "long_nozzle",
        "name": "Long Nozzle",
        "cost": 110,
        "kind": "upgrade",
        "effect": "bellows.range+2"
      },
      {
        "id": "big_lungs",
        "name": "Big Lungs Blaster",
        "cost": 140,
        "kind": "upgrade",
        "effect": "bellows.force+0.25"
      },
      {
        "id": "tank_coil_2",
        "name": "Tank Coil II",
        "cost": 200,
        "kind": "upgrade",
        "effect": "bellows.tank+1"
      }
    ]
  },
  {
    "id": "sable",
    "name": "Sable",
    "role": "Night trader",
    "island": "ruins",
    "color": "#3b2f6b",
    "hat": "Tall midnight-purple top hat (cylinder on a thin wide disc) ringed with tiny glowing lanterns (small emissive spheres) and a crescent moon charm (half-torus) dangling from the brim.",
    "lines": [
      "Good evening, little courier. The stars are out, and so, at last, am I.",
      "Seeds from islands that aren't on any map. Not even the small one's map. Especially not hers.",
      "The Great Gust isn't angry, darling. It's only the sky stretching. Hold on to what you love.",
      "A snapwraith once asked me for a discount. I told it, for you, everything is a steal.",
      "Clear nights carry far. You can hear a fizzleberry ripening three islands away. Listen.",
      "Ah, my hour. The moon sets the prices. I merely read them aloud.",
      "Your purse has such a lovely weight to it. I have something lovely to lighten it. Shall we?",
      "Empty-handed? Then take this for free: snapwraiths fear lantern light. Come back fuller, dear."
    ],
    "shop": [
      {
        "id": "emberfig_seed",
        "name": "Emberfig Cuttings",
        "cost": 25,
        "kind": "seed",
        "effect": "plot.plant=emberfig"
      },
      {
        "id": "rimegrape_seed",
        "name": "Rimegrape Pips",
        "cost": 30,
        "kind": "seed",
        "effect": "plot.plant=rimegrape"
      },
      {
        "id": "honeyhusk_seed",
        "name": "Honeyhusk Kernels",
        "cost": 35,
        "kind": "seed",
        "effect": "plot.plant=honeyhusk"
      },
      {
        "id": "fizzleberry_seed",
        "name": "Fizzleberry Spores",
        "cost": 60,
        "kind": "seed",
        "effect": "plot.plant=fizzleberry"
      },
      {
        "id": "moonlantern",
        "name": "Moonlantern",
        "cost": 75,
        "kind": "upgrade",
        "effect": "corral.wraith_guard=true"
      }
    ]
  }
],
  contracts: [
  {
    "id": "c01_feet_on_ground",
    "title": "Feet on the Ground",
    "giver": "marlow",
    "type": "pen",
    "target": {
      "species": "dandle",
      "count": 3,
      "corral": "home"
    },
    "reward": 25,
    "reward_unlock": "shop.marlow",
    "text": "Three Dandles are bobbing off toward the clouds, so suck 'em up and puff 'em into the corral, there's a good rancher.",
    "hint": "Hold to suck, release to blow, and aim a little high because poffs always float."
  },
  {
    "id": "c02_pillow_drive",
    "title": "The Pillow Drive",
    "giver": "pip",
    "type": "collect",
    "target": {
      "item": "down",
      "species": "any",
      "count": 15
    },
    "reward": 30,
    "reward_unlock": null,
    "text": "The Skyport needs fifteen tufts of down for its annual pillow drive; it is just pillows, nobody drives anywhere.",
    "hint": "Penned poffs shed down over time, so vacuum the fluff off the corral floor."
  },
  {
    "id": "c03_snack_time",
    "title": "Snack Time",
    "giver": "marlow",
    "type": "feed",
    "target": {
      "species": "dandle",
      "fruit": "puffberry",
      "count": 3,
      "yield": "plume"
    },
    "reward": 40,
    "reward_unlock": "shop.marlow.seeds",
    "text": "A fed poff is a happy poff, and a happy poff sheds the good stuff, so give my Dandles a treat.",
    "hint": "Puffberries grow on the bushes by the barn; blow one over the fence and the Dandles do the rest."
  },
  {
    "id": "c04_say_jelly",
    "title": "Say Jelly!",
    "giver": "tilda",
    "type": "photograph",
    "target": {
      "subject": "skyjelly",
      "count": 2,
      "island": "geyser"
    },
    "reward": 45,
    "reward_unlock": "map.geyser",
    "text": "My map has a big blank bit where the jellies live and I need TWO pictures for it, please and thank you!",
    "hint": "Ride the gust off the orchard's edge; skyjellies bob just above the geyser vents."
  },
  {
    "id": "c05_forge_food",
    "title": "Fuel for the Forge",
    "giver": "bellwright",
    "type": "deliver",
    "target": {
      "item": "emberfig",
      "count": 4,
      "to": "bellwright"
    },
    "reward": 60,
    "reward_unlock": "shop.bellwright.tank_coil_2",
    "text": "Forge is hungry. Four emberfigs. Fresh. Warm. Thank you. Go.",
    "hint": "Emberfigs glow along the ember ridges, and the Bellows can carry one per tank slot."
  },
  {
    "id": "c06_something_toasty",
    "title": "Something Toasty",
    "giver": "marlow",
    "type": "feed",
    "target": {
      "species": "dandle",
      "fruit": "emberfig",
      "count": 1,
      "result": "toastmallow"
    },
    "reward": 75,
    "reward_unlock": "poff.toastmallow",
    "text": "Old tale says a Dandle that eats an emberfig turns into somethin' warm and sweet, so let's find out if the tale's true.",
    "hint": "Feeding a poff another species' favourite fruit can make a hybrid; keep the pair in the same corral."
  },
  {
    "id": "c07_lantern_hours",
    "title": "Lantern Hours",
    "giver": "sable",
    "type": "photograph",
    "target": {
      "subject": "snapwraith",
      "count": 3,
      "time": "night"
    },
    "reward": 90,
    "reward_unlock": "shop.sable.fizzleberry_seed",
    "text": "Three portraits of snapwraiths for my collection, darling; they are terribly shy and terribly vain.",
    "hint": "Snapwraiths drift toward loose down after dark, so leave a tuft out as bait and wait nearby."
  },
  {
    "id": "c08_cheer_up_cloud",
    "title": "Cheer Up, Cloud",
    "giver": "marlow",
    "type": "pen",
    "target": {
      "species": "grumblenimbus",
      "count": 1,
      "corral": "any",
      "calm_with": "sunplum"
    },
    "reward": 110,
    "reward_unlock": "corral.gloom_pen",
    "text": "Some grumpy raincloud of a poff is pinchin' down off my fence, so calm it with a sunplum and give it a proper home.",
    "hint": "A fed Grumblenimbus stops stealing for a while; blow it into a corral before it remembers to sulk."
  },
  {
    "id": "c09_sherbet_season",
    "title": "Sherbet Season",
    "giver": "pip",
    "type": "deliver",
    "target": {
      "item": "plume",
      "species": "sherbetto",
      "count": 2,
      "to": "pip"
    },
    "reward": 150,
    "reward_unlock": "shop.pip.gust_sails",
    "text": "A customer requests two Sherbetto plumes; they did not say why, I did not ask, and we were both very professional.",
    "hint": "Feed a Marmalump a rimegrape to get a Sherbetto, then feed the Sherbetto a honeyhusk for its plume."
  },
  {
    "id": "c10_great_gust",
    "title": "The Great Gust",
    "giver": "marlow",
    "type": "survive",
    "target": {
      "event": "great_gust",
      "duration_s": 180,
      "keep_penned": 8,
      "max_lost": 2
    },
    "reward": 300,
    "reward_unlock": "title.gust_warden",
    "text": "Here she comes, Rook, the Great Gust itself; keep the herd home and we'll have a story to tell come morning.",
    "hint": "Shut the gates early, keep the Bellows full, and blow strays back before they clear the island's edge."
  }
],
};;

export const Content = {
  poffs: DEFAULTS.poffs, fruits: DEFAULTS.fruits, npcs: DEFAULTS.npcs, contracts: DEFAULTS.contracts,
  byId: {}, fruitById: {}, npcById: {},
  index() {
    this.byId = new Map(this.poffs.map(p => [p.id, p]));
    this.fruitById = new Map(this.fruits.map(f => [f.id, f]));
    this.npcById = new Map(this.npcs.map(n => [n.id, n]));
  },
  async load() {
    try {
      const keys = ['poffs', 'fruits', 'npcs', 'contracts'];
      const got = await Promise.all(keys.map(async k => {
        const r = await fetch('content/' + k + '.json', { cache: 'no-store' });
        if (!r.ok) throw new Error(k + ' missing');
        return r.json();
      }));
      let ok = true;
      keys.forEach((k, i) => { if (Array.isArray(got[i]) && got[i].length) this[k] = got[i]; else ok = false; });
      this.source = ok ? 'files' : 'defaults';
    } catch (e) {
      this.source = 'defaults';
    }
    this.index();
    return this;
  },
};
Content.index();

// ---- pure rules (shared by the game and the headless tests) ----

export function hybridOf(species, fruitId) {
  for (const p of Content.poffs) {
    if (!p.hybrid_of) continue;
    if (p.hybrid_of.includes(species) && p.favourite_fruit === fruitId) return p.id;
  }
  return null;
}

export function parentsOf(fruitId) {
  return Content.poffs.filter(p => p.hybrid_of && p.favourite_fruit === fruitId).map(p => p.hybrid_of);
}

export function marketPrice(species, t, cfg) {
  const base = species.value;
  const w = cfg.priceWave;
  const phase = (t / cfg.pricePeriod + hash01(species.id)) * Math.PI * 2;
  return Math.max(1, Math.round(base * (1 + w * Math.sin(phase))));
}

function hash01(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}

// Central tuning. Everything gameplay-number-ish lives here so the game can be
// balanced from one file (and so the headless tests can read the same numbers).

export const CFG = {
  seed: 20261024,

  world: {
    cell: 2.0,            // heightfield sample spacing (world units)
    gravity: 26.0,
    cloudSea: -26,        // cloud deck height
    fallRespawn: -34,
  },

  day: {
    dayLen: 210,          // seconds of daylight
    nightLen: 105,        // seconds of night
    stormChance: 0.22,    // chance a given night turns into a gust storm
  },

  player: {
    speed: 7.2,
    sprint: 12.4,
    accel: 46,
    airAccel: 16,
    friction: 14,
    jump: 10.2,
    doubleJump: 9.2,
    dashSpeed: 19,
    dashTime: 0.18,
    dashCooldown: 0.9,
    glideFall: 3.2,
    radius: 0.42,
    height: 1.62,
    selfBlast: 11.5,
    selfBlastCooldown: 1.4,
    respawnCoinsLoss: 6,
  },

  bellows: {
    range: 11.0,
    suckAccel: 34,
    holdRadius: 1.55,
    blowForce: 21,
    maxMass: 2.6,          // anything heavier refuses to lift
    tankMax: 1.0,          // suction "air" resource
    tankRegen: 0.55,
    tankSuckRate: 0.42,
    blastCone: 0.62,       // radians of forward cone for suction
  },

  poff: {
    wanderRadius: 26,
    driftUp: 0.55,         // constant upward tendency (they are balloons)
    hopHeight: 2.4,
    fleeSpeed: 5.4,
    downEvery: 26,         // seconds between shedding down when content
    plumeEvery: 9,         // seconds after being fed a favourite fruit
    spookRadius: 4.5,
    penRadius: 9.0,
  },

  economy: {
    startCoins: 20,
    priceWave: 0.28,       // +/- fraction a market price swings by
    pricePeriod: 170,      // seconds for a full price cycle
    sellTax: 0.0,
  },

  wraith: {
    count: 5,
    speed: 6.0,
    steal: 2,
    life: 90,
  },

  camera: {
    distance: 7.6,
    height: 2.6,
    pitchMin: -0.55,
    pitchMax: 1.15,
    sens: 0.0026,
  },
};

// Small math + RNG helpers. No dependencies.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (t) => t * t * (3 - 2 * t);
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

// frame-rate independent exponential smoothing for vectors
export function dampVec(obj, key, target, lambda, dt) {
  const k = 1 - Math.exp(-lambda * dt);
  obj[key].x += (target.x - obj[key].x) * k;
  obj[key].y += (target.y - obj[key].y) * k;
  obj[key].z += (target.z - obj[key].z) * k;
}

// deterministic 2D value noise (used for terrain bumps and wind)
export function valueNoise2(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const h = (a, b) => {
    let n = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
    n = Math.imul(n ^ (n >> 13), 1274126177);
    return ((n ^ (n >> 16)) >>> 0) / 4294967296;
  };
  const u = smoothstep(xf), v = smoothstep(yf);
  return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
}

export function fbm(x, y, octaves = 3, seed = 0) {
  let sum = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise2(x * f, y * f, seed + i * 17);
    norm += amp; amp *= 0.5; f *= 2;
  }
  return sum / norm;
}

export const TAU = Math.PI * 2;

export function angleLerp(a, b, t) {
  let d = ((b - a + Math.PI) % TAU) - Math.PI;
  if (d < -Math.PI) d += TAU;
  return a + d * t;
}

export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length) % arr.length]; }

// A tiny spatial hash for cheap neighbour queries.
export class SpatialHash {
  constructor(cell = 12) { this.cell = cell; this.map = new Map(); }
  _key(x, z) { return ((x / this.cell) | 0) + ',' + ((z / this.cell) | 0); }
  clear() { this.map.clear(); }
  insert(obj) {
    const k = this._key(obj.pos.x, obj.pos.z);
    let a = this.map.get(k); if (!a) { a = []; this.map.set(k, a); }
    a.push(obj); obj._hk = k;
  }
  move(obj) { const k = this._key(obj.pos.x, obj.pos.z); if (k !== obj._hk) { this.remove(obj); this.insert(obj); } }
  remove(obj) {
    const a = this.map.get(obj._hk); if (!a) return;
    const i = a.indexOf(obj); if (i >= 0) a.splice(i, 1);
  }
  query(x, z, r) {
    const out = []; const c = this.cell;
    const x0 = ((x - r) / c) | 0, x1 = ((x + r) / c) | 0;
    const z0 = ((z - r) / c) | 0, z1 = ((z + r) / c) | 0;
    for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
      const a = this.map.get(ix + ',' + iz); if (a && a.length) out.push(...a);
    }
    return out;
  }
}

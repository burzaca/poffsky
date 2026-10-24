// Game state: wallet, inventory, day/night, weather, contracts, upgrades,
// market prices, save/load. Pure logic — no three.js, so it can be unit tested.

import { CFG } from './config.js';
import { Content, marketPrice } from './content.js';
import { clamp } from './util.js';

export const PHASES = ['dawn', 'morning', 'midday', 'dusk', 'night'];

export class GameState {
  constructor(seed = CFG.seed) {
    this.seed = seed;
    this.coins = CFG.economy.startCoins;
    this.inv = { down: 0, plumes: {}, fruit: {} };
    this.penned = {};            // corralId -> [poffId]
    this.pennedSpecies = {};
    this.day = 1;
    this.tod = 0.02;             // 0..1 through the day
    this.time = 0;               // total seconds
    this.weather = { kind: 'clear', wx: 0, wz: 0, intensity: 0, until: 0 };
    this.upgrades = {};
    this.discovered = new Set(['thistledown']);
    this.contracts = { done: {}, active: null, offered: [] };
    this.stats = { collected: 0, sold: 0, fed: 0, photos: {}, shooed: 0, nightsSurvived: 0, gustLost: 0, pennedTotal: 0, breeds: 0 };
    this.flags = {};
    this.greatGust = { scheduledDay: 4, fired: false, resolved: null, startedAt: 0 };
    this.refreshOffers();
  }

  // ---------- day cycle ----------
  dayLength() { return CFG.day.dayLen + CFG.day.nightLen; }

  update(dt, ctx = {}) {
    this.time += dt;
    const L = this.dayLength();
    this.tod += dt / L;
    if (this.tod >= 1) {
      this.tod -= 1;
      this.day++;
      this.onNewDay(ctx);
    }
    if (this.weather.until > 0) {
      this.weather.until -= dt;
      if (this.weather.until <= 0) this.clearWeather();
    }
    // great gust schedule
    const gg = this.greatGust;
    if (!gg.fired && this.day >= gg.scheduledDay && this.tod > 0.35 && this.tod < 0.5) {
      this.startWeather('greatgust', 180, ctx);
      gg.fired = true; gg.startedAt = this.time;
    }
    if (gg.fired && this.weather.kind !== 'greatgust' && gg.resolved === null && this.time - gg.startedAt > 200) {
      gg.resolved = this.evaluateGust();
    }
  }

  phase() {
    const dayF = this.tod * this.dayLength();
    if (dayF < CFG.day.dayLen) {
      const f = dayF / CFG.day.dayLen;
      if (f < 0.08) return 'dawn';
      if (f < 0.42) return 'morning';
      if (f < 0.72) return 'midday';
      return 'dusk';
    }
    return 'night';
  }

  isNight() { return this.phase() === 'night'; }
  dayFraction() { return (this.tod * this.dayLength()) / CFG.day.dayLen; }

  onNewDay(ctx) {
    this.stats.nightsSurvived++;
    if (Math.random() < CFG.day.stormChance) this.startWeather('gust', 90, ctx);
    this.refreshOffers();
    ctx.onNewDay && ctx.onNewDay(this.day);
  }

  startWeather(kind, seconds, ctx = {}) {
    const a = Math.random() * Math.PI * 2;
    const strength = kind === 'greatgust' ? 1 : 0.55;
    this.weather = { kind, wx: Math.cos(a) * strength, wz: Math.sin(a) * strength, intensity: strength, until: seconds };
    ctx.onWeather && ctx.onWeather(this.weather);
  }

  clearWeather() { this.weather = { kind: 'clear', wx: 0, wz: 0, intensity: 0, until: 0 }; }

  // ---------- economy ----------
  price(speciesId) {
    const sp = Content.byId.get(speciesId);
    if (!sp) return 0;
    return marketPrice(sp, this.time, CFG.economy);
  }

  priceAt(speciesId, t) {
    const sp = Content.byId.get(speciesId);
    if (!sp) return 0;
    return marketPrice(sp, t, CFG.economy);
  }

  sellAll() {
    let total = 0, lines = [];
    const bonus = 1 + (this.upgrades['market.sell_bonus'] ? 0.1 : 0);
    for (const [sid, n] of Object.entries(this.inv.plumes)) {
      if (!n) continue;
      const sp = Content.byId.get(sid);
      const p = Math.round(this.price(sid) * 0.6) * n;
      total += p; lines.push(`${n} ${sp ? sp.name : sid} plume +${p}`);
      this.inv.plumes[sid] = 0;
    }
    if (this.inv.down > 0) {
      const p = Math.round(4 * (1 + CFG.economy.priceWave * Math.sin(this.time / 40))) * this.inv.down;
      total += Math.round(p * bonus);
      lines.push(`${this.inv.down} down +${Math.round(p * bonus)}`);
      this.inv.down = 0;
    }
    this.coins += total;
    this.stats.sold += total;
    return { total, lines };
  }

  buy(item, npcId) {
    if (this.coins < item.cost) return { ok: false, why: 'not enough coin' };
    if (this.upgrades[item.id]) return { ok: false, why: 'already owned' };
    this.coins -= item.cost;
    this.upgrades[item.id] = true;
    return { ok: true, effect: item.effect };
  }

  // ---------- contracts ----------
  refreshOffers() {
    const all = Content.contracts.filter(c => !this.contracts.done[c.id]);
    const active = this.contracts.active;
    this.contracts.offered = all.filter(c => c.id !== (active && active.id)).slice(0, 4);
  }

  accept(contractId) {
    const c = Content.contracts.find(x => x.id === contractId);
    if (!c || this.contracts.done[c.id]) return null;
    this.contracts.active = { def: c, progress: {}, step: 0 };
    this.refreshOffers();
    return this.contracts.active;
  }

  abandon() { this.contracts.active = null; this.refreshOffers(); }

  activeContract() { return this.contracts.active; }

  contractText(a) {
    if (!a) return '';
    const t = a.def.target || {};
    switch (a.def.type) {
      case 'collect': return `${this.stat(a, 'count')}/${t.count} ${t.item === 'plume' ? 'plumes' : t.item === 'down' ? 'down' : t.item}`;
      case 'pen': return `${this.stat(a, 'penned')}/${t.count} penned`;
      case 'feed': return `${this.stat(a, 'fed')}/${t.count} fed`;
      case 'photograph': return `${this.stat(a, 'shots')}/${t.count} photographed`;
      case 'deliver': return `carry ${Object.keys(this.inv.fruit).filter(k => this.inv.fruit[k] > 0).length ? '' : 'nothing yet — '}${t.count} ${t.item} to ${a.def.giver}`;
      case 'breed': return `${this.stat(a, 'bred')}/${t.count} hybrid`;
      case 'survive': return a.def.target.event === 'great_gust'
        ? `${this.stat(a, 'penned')}/${t.keep_penned} penned, ${this.stat(a, 'lost')}/${t.max_lost} lost`
        : `${this.stat(a, 'shooed')}/${t.wraiths} wraiths shooed, ${this.stat(a, 'nights')}/${t.nights} nights`;
      default: return '';
    }
  }

  stat(a, key) { return (a.progress[key] || 0); }
  bump(a, key, n = 1) { a.progress[key] = (a.progress[key] || 0) + n; }

  // event hooks that advance contracts
  onCollect(item) {
    const a = this.contracts.active; if (!a) return;
    if (a.def.type === 'collect' && (a.def.target.item === item.type || a.def.target.species === 'any')) this.bump(a, 'count');
    this.checkComplete();
  }

  onPen(poff) {
    const a = this.contracts.active; if (!a) return;
    if (a.def.type === 'pen') {
      const t = a.def.target;
      if ((!t.species || t.species === poff.species.id) && (!t.corral || t.corral === 'any' || t.corral === 'home')) {
        this.bump(a, 'penned');
      }
    }
    this.checkComplete();
  }

  onFeed(poff, fruitId, liked) {
    const a = this.contracts.active; if (!a) return;
    if (a.def.type === 'feed') {
      const t = a.def.target;
      if ((!t.species || t.species === poff.species.id) && (!t.fruit || t.fruit === fruitId) && liked) this.bump(a, 'fed');
    }
    this.checkComplete();
  }

  onBreed(species) {
    this.stats.breeds++;
    const a = this.contracts.active; if (!a) return;
    if (a.def.type === 'breed') this.bump(a, 'bred');
    this.checkComplete();
  }

  onPhoto(subjectId) {
    const a = this.contracts.active; if (!a) return;
    if (a.def.type === 'photograph') {
      const t = a.def.target;
      const match = (t.subject === subjectId) ||
        (t.subject === 'snapwraith' && subjectId === 'snapwraith');
      if (match) this.bump(a, 'shots');
    }
    this.checkComplete();
  }

  onShoo() {
    this.stats.shooed++;
    const a = this.contracts.active; if (!a) return;
    if (a.def.type === 'survive' && a.def.target.wraiths) this.bump(a, 'shooed');
    this.checkComplete();
  }

  onNightSurvived() {
    const a = this.contracts.active; if (!a) return;
    if (a.def.type === 'survive' && a.def.target.nights) this.bump(a, 'nights');
    this.checkComplete();
  }

  deliverTo(npcId) {
    const a = this.contracts.active; if (!a) return null;
    if (a.def.type !== 'deliver' || a.def.giver !== npcId) return null;
    const t = a.def.target;
    const have = this.inv.fruit[t.item] || 0;
    if (t.item === 'plume') {
      const need = t.count;
      const total = Object.values(this.inv.plumes).reduce((s, n) => s + n, 0);
      if (total < need) return { ok: false, why: `need ${need} plumes` };
      let left = need;
      for (const k of Object.keys(this.inv.plumes)) { const take = Math.min(left, this.inv.plumes[k]); this.inv.plumes[k] -= take; left -= take; }
      this.bump(a, 'delivered', need);
      this.checkComplete();
      return { ok: true };
    }
    if (have < t.count) return { ok: false, why: `need ${t.count} ${t.item}` };
    this.inv.fruit[t.item] -= t.count;
    this.bump(a, 'delivered', t.count);
    this.checkComplete();
    return { ok: true };
  }

  checkComplete() {
    const a = this.contracts.active; if (!a) return null;
    const t = a.def.target || {};
    let done = false;
    switch (a.def.type) {
      case 'collect': done = this.stat(a, 'count') >= t.count; break;
      case 'pen': done = this.stat(a, 'penned') >= t.count; break;
      case 'feed': done = this.stat(a, 'fed') >= t.count; break;
      case 'photograph': done = this.stat(a, 'shots') >= t.count; break;
      case 'breed': done = this.stat(a, 'bred') >= t.count; break;
      case 'deliver': done = this.stat(a, 'delivered', 0) >= t.count; break;
      case 'survive':
        if (t.event === 'great_gust') done = this.greatGust.resolved === true;
        else done = this.stat(a, 'shooed') >= (t.wraiths || 0) && this.stat(a, 'nights') >= (t.nights || 0);
        break;
    }
    if (!done) return null;
    this.contracts.done[a.def.id] = true;
    this.coins += a.def.reward;
    this.contracts.active = null;
    this.refreshOffers();
    return a.def;
  }

  evaluateGust() {
    const penned = Object.values(this.pennedSpecies).reduce((s, n) => s + n, 0);
    const ok = penned >= 4 && this.stats.gustLost <= 2;
    return ok;
  }
}

// Headless tests: node --test tests/
// The engine modules are importable in Node (three.js has no DOM dependency),
// so we can test world generation, creature physics, contracts and the economy
// without a browser.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';

import { World, ISLANDS } from '../src/world.js';
import { Creatures } from '../src/entities.js';
import { GameState } from '../src/state.js';
import { Content, hybridOf } from '../src/content.js';
import { CFG } from '../src/config.js';
import { SpatialHash, fbm, mulberry32 } from '../src/util.js';

// a THREE.Scene stand-in good enough for the headless run
const fakeScene = () => ({ add() {}, remove() {} });

test('world: islands are generated and heightfields behave', () => {
  const w = new World(1234);
  assert.equal(w.islands.length, ISLANDS.length);
  const home = w.byId.get('thistledown');
  assert.ok(w.heightAt(home.x, home.z) !== null, 'centre has ground');
  assert.equal(w.heightAt(9000, 9000), null, 'empty sky has no ground');
  // deterministic: same seed -> same terrain
  const w2 = new World(1234);
  assert.equal(w.heightAt(home.x + 10, home.z + 7), w2.heightAt(home.x + 10, home.z + 7));
  // different seed -> different terrain somewhere
  const w3 = new World(99);
  let diff = 0;
  for (let i = 0; i < 40; i++) {
    const x = home.x + (i - 20) * 1.3, z = home.z + i * 0.7;
    if (w.heightAt(x, z) !== w3.heightAt(x, z)) diff++;
  }
  assert.ok(diff > 5, 'seed changes terrain');
  // every island has a walkable centre and fruit where the biome grows fruit
  for (const isl of w.islands) assert.ok(w.heightAt(isl.x, isl.z) !== null, isl.id + ' has ground');
  assert.ok(w.fruits.length > 10, 'fruit exists');
  assert.ok(w.corrals.length >= 2, 'corrals exist');
});

test('world: props and ribbons are placed sensibly', () => {
  const w = new World(7);
  assert.ok(w.props.filter(p => p.kind === 'tree').length > 20);
  for (const rb of w.ribbons) {
    assert.ok(rb.len > 10, 'ribbon has length');
    assert.ok(Math.abs(Math.hypot(rb.nx, rb.nz) - 1) < 1e-6, 'ribbon dir normalised');
  }
});

test('util: noise is bounded and hash is stable', () => {
  for (let i = 0; i < 200; i++) {
    const v = fbm(i * 0.31, i * 0.17, 3, 5);
    assert.ok(v >= 0 && v <= 1.0001, 'fbm in [0,1]');
  }
  const r = mulberry32(1), r2 = mulberry32(1);
  for (let i = 0; i < 10; i++) assert.equal(r(), r2());
});

test('util: spatial hash finds neighbours', () => {
  const h = new SpatialHash(10);
  const a = { pos: { x: 5, z: 5 } }, b = { pos: { x: 200, z: 5 } };
  h.insert(a); h.insert(b);
  h.insert({ pos: { x: 5.5, z: 5.5 } });
  assert.ok(h.query(5, 5, 3).includes(a));
  a.pos.x = 205; h.move(a);
  assert.ok(!h.query(5, 5, 3).includes(a));
  assert.ok(h.query(205, 5, 3).includes(a));
});

test('creatures: poffs spawn, stay on their island and produce down', () => {
  const w = new World(42);
  const cr = new Creatures(w, fakeScene(), 42);
  cr.populate();
  assert.ok(cr.poffs.length >= 20, 'a populated world has poffs');
  const player = { pos: new THREE.Vector3(0, 2, 0), speed: 0 };
  const ctx = { player, night: false, storm: null, time: 0, holdingFruit: false };
  const before = cr.items.length;
  for (let i = 0; i < 60 * 90; i++) cr.update(1 / 60, ctx);
  // nobody should have fallen out of the sky permanently
  for (const p of cr.poffs) {
    assert.ok(p.pos.y > CFG.world.fallRespawn + 1, 'poff did not fall forever');
    const isl = w.islandAt(p.pos.x, p.pos.z);
    if (isl) assert.ok(isl);
  }
  assert.ok(cr.items.length >= before, 'down was produced');
});

test('creatures: feeding a favourite fruit makes a hybrid when a partner is near', () => {
  const w = new World(5);
  const cr = new Creatures(w, fakeScene(), 5);
  const home = w.byId.get('thistledown');
  const a = cr.spawnPoff('dandle', home, { x: home.x, z: home.z });
  const b = cr.spawnPoff('sootling', home, { x: home.x + 1.5, z: home.z });
  const c = cr.spawnPoff('flurrin', home, { x: home.x - 1.5, z: home.z });
  assert.ok(a && b && c);
  assert.equal(hybridOf('sootling', 'sunplum'), 'grumblenimbus');
  assert.equal(hybridOf('dandle', 'fizzleberry'), 'toastmallow');
  const res = cr.feed(a, 'emberfig');
  assert.equal(res.liked, false, 'emberfig is not a dandle favourite');
  const res2 = cr.feed(b, 'emberfig');
  assert.equal(res2.liked, true, 'sootlings love emberfigs');
  assert.equal(res2.bred, null, 'no hybrid without the right fruit');
  const res3 = cr.feed(b, 'sunplum');
  assert.ok(res3.bred, 'a hybrid hatched');
  assert.equal(res3.bred.id, 'grumblenimbus');
  assert.ok(cr.poffs.some(p => p.species.id === 'grumblenimbus'), 'hybrid exists in the world');
});

test('state: day cycle, phases and weather', () => {
  const st = new GameState(1);
  assert.equal(st.phase(), 'dawn');
  const step = 1 / 30;
  let sawNight = false, sawMidday = false, days = 0;
  const ctx = { onNewDay: () => days++ };
  for (let i = 0; i < Math.ceil((CFG.day.dayLen + CFG.day.nightLen) * 2 * 30); i++) {
    st.update(step, ctx);
    if (st.phase() === 'night') sawNight = true;
    if (st.phase() === 'midday') sawMidday = true;
  }
  assert.ok(sawNight && sawMidday, 'the cycle covers the day');
  assert.equal(days, 2, 'two day rollovers');
  assert.equal(st.day, 3);
  st.startWeather('gust', 2, {});
  assert.equal(st.weather.kind, 'gust');
  for (let i = 0; i < 200; i++) st.update(step, {});
  assert.equal(st.weather.kind, 'clear', 'weather expires');
});

test('state: contracts progress and pay out', () => {
  const st = new GameState(1);
  const c = Content.contracts[1]; // a pen contract or similar
  const any = st.contracts.offered.find(x => x.type === 'collect') || Content.contracts.find(x => x.type === 'collect');
  st.accept(any.id);
  const a = st.contracts.active;
  assert.ok(a, 'contract accepted');
  let done = null;
  for (let i = 0; i < any.target.count; i++) { st.onCollect({ item: any.target.item }); }
  done = st.contracts.done[any.id] ? any : null;
  assert.ok(done, 'contract completed');
  assert.equal(st.coins, CFG.economy.startCoins + any.reward, 'reward paid');
  assert.ok(st.contracts.done[any.id]);
  assert.equal(st.contracts.active, null);
});

test('state: deliver contracts consume inventory', () => {
  const st = new GameState(1);
  const d = Content.contracts.find(x => x.type === 'deliver' && x.target.item !== 'plume');
  if (!d) return;
  st.accept(d.id);
  st.inv.fruit[d.target.item] = 0;
  assert.equal(st.deliverTo(d.giver).ok, false, 'cannot deliver nothing');
  st.inv.fruit[d.target.item] = d.target.count;
  assert.equal(st.deliverTo(d.giver).ok, true, 'delivery works');
});

test('state: selling converts down and plumes into coin', () => {
  const st = new GameState(1);
  st.inv.down = 10;
  st.inv.plumes['dandle'] = 2;
  const before = st.coins;
  const r = st.sellAll();
  assert.ok(r.total > 0, 'sold something');
  assert.equal(st.coins, before + r.total);
  assert.equal(st.inv.down, 0);
  assert.equal(st.inv.plumes['dandle'], 0);
});

test('state: market prices oscillate around the base value', () => {
  const st = new GameState(1);
  const sp = Content.poffs[0];
  let lo = Infinity, hi = -Infinity;
  for (let t = 0; t < 2000; t += 3) {
    const p = st.priceAt(sp.id, t);
    lo = Math.min(lo, p); hi = Math.max(hi, p);
    assert.ok(p >= 1);
  }
  assert.ok(lo < sp.value && hi > sp.value, 'prices move both ways');
  assert.ok(lo > sp.value * (1 - CFG.economy.priceWave) - 2);
  assert.ok(hi < sp.value * (1 + CFG.economy.priceWave) + 2);
});

test('state: purchases are idempotent and cost money', () => {
  const st = new GameState(1);
  st.coins = 1000;
  const item = { id: 'test_item', cost: 100, effect: 'bellows.tank+1' };
  assert.equal(st.buy(item).ok, true);
  assert.equal(st.coins, 900);
  assert.equal(st.buy(item).ok, false, 'cannot buy twice');
  st.coins = 0;
  assert.equal(st.buy({ id: 'other', cost: 500 }).ok, false);
});

test('state: the Great Gust is evaluated on penned poffs', () => {
  const st = new GameState(1);
  st.pennedSpecies = { dandle: 5 };
  st.stats.gustLost = 1;
  assert.equal(st.evaluateGust(), true);
  st.pennedSpecies = { dandle: 2 };
  assert.equal(st.evaluateGust(), false);
});

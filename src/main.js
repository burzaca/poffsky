import * as THREE from '../vendor/three.module.js';
import { CFG } from './config.js';
import { Content } from './content.js';
import { World } from './world.js';
import { Sky } from './sky.js';
import { Creatures } from './entities.js';
import { Player } from './player.js';
import { Bellows } from './bellows.js';
import { NPCs } from './npcs.js';
import { GameState } from './state.js';
import { UI } from './ui.js';
import { Sound } from './audio.js';
import * as LOOKMOD from './look.js';
const { tickLook } = LOOKMOD;
import { buildSignatureProps, animateSignatureProps } from './props.js';
import { clamp, damp, TAU, mulberry32 } from './util.js';

const SAVE_KEY = 'poffsky.save.v1';

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 1400);

    this.ui = new UI();
    this.sound = new Sound();

    this.state = new GameState(CFG.seed);
    this.world = new World(CFG.seed);
    this.world.buildMeshes(this.scene);
    this.signature = buildSignatureProps(this.world, LOOKMOD);
    this.scene.add(this.signature);
    this.sky = new Sky(this.scene);
    this.creatures = new Creatures(this.world, this.scene, CFG.seed);
    this.creatures.populate();
    this.player = new Player(this.world, this.scene, { x: -14, y: 0, z: -8 });
    this.bellows = new Bellows(this.world, this.creatures, this.player, this.scene);
    this.bellows.sfx = this.sound;
    this.npcs = new NPCs(this.world, this.scene, (npc, line) => this.onTalk(npc, line));

    // one look for everything: bake the recipe into any mesh that has no
    // colour attribute of its own (see look.js)
    this.bakedMeshes = LOOKMOD.applyLookPass(this.scene, mulberry32(CFG.seed ^ 0x51ee));

    this.fruitSpawners = this.world.fruits.map(f => ({ ...f, timer: 0, active: true, mesh: null }));
    this.gardenSpawners = [];

    this.input = { keys: {}, hold: false, release: false, force: false };
    this.paused = false;
    this.running = false;
    this.time = 0;
    this.flash = 0;
    this.vignette = this.makeVignette();
    this.touch = { active: false, joyX: 0, joyY: 0 };
    this.lastPhase = 'dawn';
    this.hintTimer = 0;
    this.photoCooldown = 0;

    this.bindInput();
    addEventListener('resize', () => this.resize());
  }

  makeVignette() {
    const sc = new THREE.Scene();
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    const rg = g.createRadialGradient(128, 128, 60, 128, 128, 190);
    rg.addColorStop(0, 'rgba(0,0,0,0)');
    rg.addColorStop(1, 'rgba(10,8,20,0.42)');
    g.fillStyle = rg; g.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(c);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false }));
    sc.add(quad);
    this.flashQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false }));
    sc.add(this.flashQuad);
    return { sc, cam };
  }

  resize() {
    this.renderer.setSize(innerWidth, innerHeight);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  // ---------------- input ----------------
  bindInput() {
    const k = this.input.keys;
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const c = e.code;
      k[c] = true;
      if (c === 'Space') { e.preventDefault(); if (this.running && !this.paused) this.player.queueJump(); }
      if (c === 'KeyE' || c === 'MouseRight') this.input.hold = true;
      if (c === 'KeyF' && this.running && !this.paused) this.interact();
      if (c === 'KeyM' && this.running && !this.paused) this.toggleBoard();
      if (c === 'KeyP' && this.running && !this.paused) this.photograph();
      if (c === 'KeyT' && this.running && !this.paused) this.bellows.drop();
      if (c === 'KeyR' && this.running && !this.paused) this.player.input.blast = true;
      if (c === 'Escape') this.togglePause();
      if (c === 'KeyC' && this.running && !this.paused) this.describeHeld();
      if (c === 'KeyH' && this.running) this.showHelp();
    });
    addEventListener('keyup', (e) => {
      const c = e.code;
      k[c] = false;
      if (c === 'KeyE') { if (this.input.hold) this.input.release = true; this.input.hold = false; }
    });
    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.button === 2) { this.input.hold = true; }
      if (!this.running || this.paused) return;
      if (!this.touch.active) {
        this.dragging = true; this.lastPointer = { x: e.clientX, y: e.clientY };
        this.canvas.requestPointerLock && this.canvas.requestPointerLock();
      }
    });
    addEventListener('pointerup', (e) => {
      if (e.button === 2 && this.input.hold) { this.input.release = true; this.input.hold = false; }
      this.dragging = false;
    });
    addEventListener('mousemove', (e) => {
      const locked = document.pointerLockElement === this.canvas;
      if (!locked && !this.dragging) return;
      const dx = e.movementX || (this.lastPointer ? e.clientX - this.lastPointer.x : 0);
      const dy = e.movementY || (this.lastPointer ? e.clientY - this.lastPointer.y : 0);
      if (this.lastPointer && !locked) { this.lastPointer = { x: e.clientX, y: e.clientY }; }
      this.player.cam.yaw -= dx * CFG.camera.sens;
      this.player.cam.pitch = clamp(this.player.cam.pitch + dy * CFG.camera.sens, CFG.camera.pitchMin, CFG.camera.pitchMax);
    });
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
    this.bindTouch();
  }

  bindTouch() {
    const isTouch = matchMedia('(pointer: coarse)').matches;
    if (!isTouch) return;
    document.getElementById('touch').classList.remove('hidden');
    this.touch.active = true;
    const stick = document.getElementById('stick'), knob = document.getElementById('stick-knob');
    let sid = null, origin = null;
    stick.addEventListener('pointerdown', e => {
      sid = e.pointerId; origin = { x: e.clientX, y: e.clientY };
      stick.setPointerCapture(e.pointerId);
    });
    stick.addEventListener('pointermove', e => {
      if (e.pointerId !== sid || !origin) return;
      const dx = clamp((e.clientX - origin.x) / 46, -1, 1), dy = clamp((e.clientY - origin.y) / 46, -1, 1);
      this.touch.joyX = dx; this.touch.joyY = dy;
      knob.style.transform = `translate(${dx * 34}px, ${dy * 34}px)`;
    });
    const end = e => { if (e.pointerId === sid) { sid = null; origin = null; this.touch.joyX = this.touch.joyY = 0; knob.style.transform = ''; } };
    stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);

    const btn = (id, down, up) => {
      const el = document.getElementById(id);
      el.addEventListener('pointerdown', e => { e.preventDefault(); down(); });
      el.addEventListener('pointerup', e => { e.preventDefault(); up && up(); });
      el.addEventListener('pointercancel', () => up && up());
    };
    btn('btn-jump', () => this.player.queueJump());
    btn('btn-bellows', () => { this.input.hold = true; }, () => { this.input.release = true; this.input.hold = false; });
    btn('btn-dash', () => { this.player.input.sprint = true; }, () => { this.player.input.sprint = false; });
    btn('btn-talk', () => this.interact());
    // drag on the right half rotates the camera
    let look = null;
    this.canvas.addEventListener('pointerdown', e => { if (this.touch.active) look = { x: e.clientX, y: e.clientY }; });
    this.canvas.addEventListener('pointermove', e => {
      if (!look) return;
      this.player.cam.yaw -= (e.clientX - look.x) * 0.006;
      this.player.cam.pitch = clamp(this.player.cam.pitch + (e.clientY - look.y) * 0.005, CFG.camera.pitchMin, CFG.camera.pitchMax);
      look = { x: e.clientX, y: e.clientY };
    });
    this.canvas.addEventListener('pointerup', () => { look = null; });
  }

  pollKeys() {
    const k = this.input.keys, p = this.player.input;
    if (this.touch.active) {
      p.f = this.touch.joyY < -0.25 ? 1 : 0; p.b = this.touch.joyY > 0.25 ? 1 : 0;
      p.l = this.touch.joyX < -0.25 ? 1 : 0; p.r = this.touch.joyX > 0.25 ? 1 : 0;
      const mag = Math.hypot(this.touch.joyX, this.touch.joyY);
      p.f = clamp(-this.touch.joyY, 0, 1); p.b = clamp(this.touch.joyY, 0, 1);
      p.l = clamp(-this.touch.joyX, 0, 1); p.r = clamp(this.touch.joyX, 0, 1);
      p.sprint = mag > 0.9;
      return;
    }
    p.f = k.KeyW || k.ArrowUp ? 1 : 0;
    p.b = k.KeyS || k.ArrowDown ? 1 : 0;
    p.l = k.KeyA || k.ArrowLeft ? 1 : 0;
    p.r = k.KeyD || k.ArrowRight ? 1 : 0;
    p.sprint = !!(k.ShiftLeft || k.ShiftRight);
    p.dash = !!(k.ControlLeft || k.KeyG);
  }

  // ---------------- interactions ----------------
  interact() {
    const npc = this.npcs.nearest(this.player.pos, 4.2);
    if (this.ui.shopOpen) { this.ui.closeShop(); return; }
    if (this.ui.talking) { this.ui.endTalk(); return; }
    if (npc) { this.onTalk(npc, null); return; }
    // notice board
    const board = this.world.structures.find(s => s.kind === 'board');
    if (board && Math.hypot(board.x - this.player.pos.x, board.z - this.player.pos.z) < 4) { this.toggleBoard(); return; }
    // if holding a fruit near nothing, just say what it is
    if (this.bellows.held) this.describeHeld();
  }

  onTalk(npc, presetLine) {
    const st = this.state;
    const actions = [];
    // delivery first
    const a = st.contracts.active;
    if (a && a.def.type === 'deliver' && a.def.giver === npc.def.id) {
      actions.push({ label: 'Hand over the goods', fn: () => {
        const r = st.deliverTo(npc.def.id);
        if (r && r.ok) { this.sound.contract(); this.ui.toast('Delivered. ' + (a.def.title + ' complete — check the board for a reward.'), 'good'); this.checkContractDone(); }
        else { this.sound.error(); this.ui.toast(r ? r.why : 'Nothing to deliver yet', 'bad'); }
        this.ui.endTalk();
      } });
    }
    if (npc.def.id === 'pip') {
      actions.push({ label: 'Sell my fluff', fn: () => {
        const r = st.sellAll();
        if (r.total > 0) { this.sound.coin(); this.ui.toast('Sold for ' + r.total + ' coin: ' + r.lines.join(', '), 'good'); }
        else { this.sound.error(); this.ui.toast('Nothing to sell. Poffs shed when they are fed and penned.'); }
        this.ui.endTalk();
      } });
    }
    if ((npc.def.shop || []).some(it => !st.upgrades[it.id])) {
      actions.push({ label: 'See the shelf', fn: () => { this.ui.endTalk(); this.ui.openShop(npc, st, (it) => this.buy(npc, it)); } });
    }
    if (npc.def.id === 'marlow' || npc.def.id === 'pip') {
      actions.push({ label: 'Contracts', fn: () => { this.ui.endTalk(); this.toggleBoard(true); } });
    }
    const line = presetLine || npc.def.lines[npc.lineIdx++ % npc.def.lines.length];
    this.sound.ui();
    this.ui.talk(npc, line, actions);
  }

  buy(npc, item) {
    const r = this.state.buy(item, npc.def.id);
    if (!r.ok) { this.sound.error(); this.ui.toast('Not enough coin for ' + item.name, 'bad'); return; }
    this.sound.contract();
    this.applyEffect(r.effect, item);
    this.ui.toast('Bought: ' + item.name, 'good');
  }

  applyEffect(effect, item) {
    const st = this.state;
    if (!effect) return;
    if (effect.startsWith('player.jump')) this.player.up.jumpMul += 0.25;
    else if (effect.startsWith('player.glider')) this.player.up.glider = true;
    else if (effect.startsWith('player.gust_ride')) this.player.up.gustRide += 0.5;
    else if (effect.startsWith('market.sell_bonus')) { /* handled in sellAll */ }
    else if (effect.startsWith('bellows.tank')) this.bellows.up.tank += 1;
    else if (effect.startsWith('bellows.range')) this.bellows.up.range += 2;
    else if (effect.startsWith('bellows.force')) this.bellows.up.force += 0.25;
    else if (effect.startsWith('corral.wraith_guard')) st.flags.wraithGuard = true;
    else if (effect.startsWith('corral.escape_chance')) st.flags.escapeMul = 0.75;
    else if (effect.startsWith('corral.slots')) st.flags.penCapacity = (st.flags.penCapacity || 6) + 2;
    else if (effect.startsWith('map.reveal')) for (const i of this.world.islands) st.discovered.add(i.id);
    else if (effect.startsWith('map.pins')) st.flags.pins = (st.flags.pins || 0) + 3;
    else if (effect.startsWith('hud.compass')) st.flags.compass = true;
    else if (effect.startsWith('plot.plant')) {
      const fruitId = effect.split('=')[1];
      const home = this.world.byId.get('thistledown');
      const a = Math.random() * TAU, r = 12 + Math.random() * 10;
      const x = home.x + Math.cos(a) * r, z = home.z + Math.sin(a) * r;
      const y = this.world.heightAt(x, z);
      if (y !== null) {
        this.gardenSpawners.push({ fruitId, x, y, z, timer: 0, active: true, mesh: null });
        this.ui.toast('Planted at the ranch garden — it will regrow.', 'good');
      }
    }
  }

  toggleBoard(force) {
    if (this.ui.boardOpen) { this.ui.closeBoard(); return; }
    this.ui.openBoard(this.state, (c) => {
      const a = this.state.accept(c.id);
      if (a) { this.sound.contract(); this.ui.toast('Contract taken: ' + c.title, 'good'); }
    });
  }

  describeHeld() {
    const h = this.bellows.held;
    if (!h) { this.ui.prompt(''); return; }
    if (h.kind === 'poff') {
      const sp = h.species;
      const fav = Content.fruitById.get(sp.favourite_fruit);
      this.ui.toast(`${sp.name} — likes ${fav ? fav.name : 'nothing you carry'}. Down worth ${sp.down_value}. ${sp.personality}`);
    } else if (h.kind === 'item' && h.type === 'fruit') {
      const f = Content.fruitById.get(h.type);
      this.ui.toast(`${f.name}. Blow it at a poff to feed them.`);
    } else if (h.kind === 'wraith') {
      this.ui.toast('A snapwraith. It is embarrassed now.');
    }
  }

  photograph() {
    if (this.photoCooldown > 0) return;
    this.photoCooldown = 0.8;
    this.flash = 1;
    this.sound.shutter();
    const { origin, dir } = this.bellows.nozzle();
    let subject = null;
    for (const p of this.creatures.poffs) {
      const v = p.pos.clone().sub(origin); const d = v.length();
      if (d > 26) continue;
      if (Math.acos(clamp(v.normalize().dot(dir), -1, 1)) < 0.42) { subject = p.species.id; break; }
    }
    if (!subject) for (const w of this.creatures.wraiths) {
      const v = w.pos.clone().sub(origin); const d = v.length();
      if (d > 30) continue;
      if (Math.acos(clamp(v.normalize().dot(dir), -1, 1)) < 0.5) { subject = 'snapwraith'; break; }
    }
    if (!subject) for (const pr of this.world.props) {
      if (pr.kind !== 'jellyPad') continue;
      const v = new THREE.Vector3(pr.x, pr.y, pr.z).sub(origin); const d = v.length();
      if (d > 34) continue;
      if (Math.acos(clamp(v.normalize().dot(dir), -1, 1)) < 0.5) { subject = 'skyjelly'; break; }
    }
    if (subject) {
      this.state.onPhoto(subject);
      this.ui.toast('Nice shot: ' + subject, 'good');
      this.checkContractDone();
    } else this.ui.toast('Nothing in frame.');
  }

  checkContractDone() {
    const done = this.state.checkComplete();
    if (done) {
      this.sound.contract();
      this.ui.toast('CONTRACT COMPLETE: ' + done.title + '  +' + done.reward + ' coin', 'good');
      if (done.reward_unlock) this.state.flags['unlock:' + done.reward_unlock] = true;
      if (done.id === 'c10_great_gust') {
        this.state.flags.champion = true;
        this.ui.toast('The Drift is yours. Marlow is pretending not to be emotional.', 'good');
      }
    }
  }

  togglePause() {
    if (!this.running) return;
    this.paused = !this.paused;
    document.getElementById('pause').classList.toggle('hidden', !this.paused);
    if (this.paused) document.exitPointerLock && document.exitPointerLock();
    this.sound.resume();
  }

  // ---------------- world rules ----------------
  updateFruitSpawners(dt) {
    for (const f of this.fruitSpawners.concat(this.gardenSpawners)) {
      if (!f.active) {
        f.timer -= dt;
        if (f.timer <= 0) { f.active = true; }
        continue;
      }
      if (f.mesh) continue;
      if (f.y === undefined) continue;
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.34, 8, 6),
        new THREE.MeshLambertMaterial({ color: new THREE.Color((Content.fruitById.get(f.fruitId) || {}).color || '#ffffff'), flatShading: true }));
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 4), new THREE.MeshLambertMaterial({ color: 0x5c8f4a }));
      stem.position.y = 0.34; m.add(stem);
      m.position.set(f.x, f.y, f.z);
      m.userData.spawner = f;
      this.scene.add(m);
      f.mesh = m;
      f.baseY = f.y;
    }
    for (const f of this.fruitSpawners.concat(this.gardenSpawners)) {
      if (!f.mesh || !f.active) continue;
      f.mesh.position.y = f.baseY + Math.sin(this.time * 1.6 + f.x) * 0.08;
      f.mesh.rotation.y += dt * 0.6;
    }
  }

  collectFruitSpawners() {
    for (const f of this.fruitSpawners.concat(this.gardenSpawners)) {
      if (!f.mesh || !f.active) continue;
      const d = Math.hypot(f.mesh.position.x - this.player.pos.x, f.mesh.position.z - this.player.pos.z);
      const dy = Math.abs(f.mesh.position.y - this.player.pos.y);
      if (d < 1.6 && dy < 2.4) {
        this.creatures.spawnItem('fruit', f.mesh.position.x, f.mesh.position.y + 0.6, f.mesh.position.z, { vy: 3.5, life: 999 });
        this.scene.remove(f.mesh);
        f.mesh = null; f.active = false; f.timer = 50;
        this.sound.pluck();
      }
    }
  }

  handleItems(dt) {
    const st = this.state;
    for (let i = this.creatures.items.length - 1; i >= 0; i--) {
      const it = this.creatures.items[i];
      if (it.held) continue;
      // feeding: a fast-moving fruit hits a poff
      if (it.type === 'fruit' && it.vel.lengthSq() > 25) {
        for (const p of this.creatures.poffs) {
          if (p.pos.distanceToSquared(it.pos) < (0.8 + p.species.size * 0.62) ** 2) {
            const res = this.creatures.feed(p, it.type);
            this.creatures.removeItem(it);
            st.onFeed(p, it.type, res.liked);
            const fav = Content.fruitById.get(p.species.favourite_fruit);
            if (res.liked) {
              this.sound.squeak(1.3);
              st.stats.fed++;
              this.ui.toast(p.species.name + ' loves ' + (fav ? fav.name : 'that') + '. Plumes incoming.', 'good');
              if (res.bred) {
                this.sound.breed();
                st.onBreed(res.bred.id);
                this.ui.toast('A ' + res.bred.name + ' hatched! That is a hybrid.', 'good');
                this.checkContractDone();
              }
            } else {
              this.sound.squeak(0.7);
              this.ui.toast(p.species.name + ' is not interested. ' + (fav ? 'Try ' + fav.name + '.' : ''), 'bad');
            }
            this.checkContractDone();
            break;
          }
        }
        continue;
      }
      // pickup
      const d = it.pos.distanceTo(this.player.pos);
      if (d < 1.5) {
        if (it.type === 'down') { st.inv.down += 1; st.stats.collected++; this.sound.coin(); }
        else if (it.type === 'plume') {
          const sid = it.species || 'unknown';
          st.inv.plumes[sid] = (st.inv.plumes[sid] || 0) + 1;
          this.sound.coin();
        } else if (it.type === 'fruit') {
          st.inv.fruit[it.type] = st.inv.fruit[it.type] || 0;
          st.inv.fruit[it.type] = (st.inv.fruit[it.type] || 0) + 1;
          this.sound.pluck();
          this.creatures.removeItem(it);
          this.ui.toast('Picked up ' + (Content.fruitById.get(it.type) || {}).name + ' — blow it at a poff, or deliver it.', '');
          continue;
        }
        st.onCollect(it);
        this.creatures.removeItem(it);
        this.checkContractDone();
      }
    }
  }

  handlePenning() {
    const st = this.state;
    for (const p of this.creatures.poffs) {
      if (p.corral || p.heldBy) continue;
      for (const c of this.world.corrals) {
        if (!c.unlocked) continue;
        const d = Math.hypot(p.pos.x - c.x, p.pos.z - c.z);
        const arriving = p.heldBy || p.vel.lengthSq() > 9 || p.stunned > 0;
        if (d < c.r - 0.5 && p.pos.y < c.y + 3 && arriving) {
          const count = this.creatures.poffs.filter(q => q.corral === c).length;
          const cap = st.flags.penCapacity || 6;
          if (count >= cap) break;
          p.corral = c; p.state = 'penned';
          st.pennedSpecies[p.species.id] = (st.pennedSpecies[p.species.id] || 0) + 1;
          st.stats.pennedTotal++;
          this.sound.squeak(1.1);
          this.bellows.stats.penned++;
          this.ui.toast(p.species.name + ' moved into ' + c.id.replace('pen', 'Pen ') + '.', 'good');
          st.onPen(p);
          this.checkContractDone();
        }
        break;
      }
    }
    // escapes: a penned poff may drift out if not hobbled
    for (const p of this.creatures.poffs) {
      if (!p.corral) continue;
      const chance = 0.0006 * (st.flags.escapeMul || 1);
      if (Math.random() < chance) {
        p.corral = null; p.state = 'wander';
        st.pennedSpecies[p.species.id] = Math.max(0, (st.pennedSpecies[p.species.id] || 0) - 1);
      }
    }
  }

  handleWeatherAndDay(dt) {
    const st = this.state;
    const ph = st.phase();
    if (ph !== this.lastPhase) {
      if (ph === 'night') {
        this.sound.setMood(0.35);
        const n = CFG.wraith.count;
        for (let i = 0; i < n; i++) this.creatures.spawnWraith(this.world.islands[(Math.random() * this.world.islands.length) | 0]);
        this.ui.toast('Night. Snapwraiths are awake and after your loose down.', '');
      } else if (this.lastPhase === 'night') {
        this.sound.setMood(1);
        st.onNightSurvived();
        this.checkContractDone();
        this.ui.toast('Dawn. The wraiths drift off, sulking.', 'good');
      } else if (ph === 'midday') {
        this.ui.toast('Midday. Market prices have shifted.', '');
      }
      this.lastPhase = ph;
    }
    if (st.weather.kind !== 'clear' && st.weather.until <= 0) {
      if (st.weather.kind === 'greatgust') {
        const ok = st.evaluateGust();
        st.greatGust.resolved = ok;
        this.ui.toast(ok ? 'You weathered the Great Gust. Marlow actually cheered.' : 'The Great Gust scattered your herd. Try again with more pens.', ok ? 'good' : 'bad');
        this.checkContractDone();
      }
    }
    if (st.weather.kind === 'greatgust' && !this.gustAnnounced) {
      this.gustAnnounced = true;
      this.sound.gust();
      this.ui.toast('THE GREAT GUST is here. Get to high ground and hold on.', 'bad');
    }
  }

  handleDiscovery() {
    const isl = this.world.islandAt(this.player.pos.x, this.player.pos.z);
    if (isl && !this.state.discovered.has(isl.id)) {
      this.state.discovered.add(isl.id);
      this.sound.contract();
      this.ui.toast('Arrived at ' + isl.name + ' — ' + isl.note, 'good');
    }
  }

  updatePrompts() {
    const npc = this.npcs.nearest(this.player.pos, 4.2);
    if (npc) { this.ui.prompt('[F] talk to ' + npc.def.name); return; }
    const board = this.world.structures.find(s => s.kind === 'board');
    if (board && Math.hypot(board.x - this.player.pos.x, board.z - this.player.pos.z) < 4) { this.ui.prompt('[F] read the notice board'); return; }
    if (this.bellows.held) {
      const h = this.bellows.held;
      if (h.kind === 'poff') this.ui.prompt('Release to blow it — aim at a corral  ·  [T] drop  ·  [C] info');
      else this.ui.prompt('Release to throw it  ·  [T] drop  ·  [C] info');
      return;
    }
    const near = this.creatures.near(this.player.pos.x, this.player.pos.z, this.bellows.range(), ['poff', 'item']).length;
    if (near) this.ui.prompt('[Hold E] suck with the Bellows');
    else this.ui.prompt('');
  }

  // ---------------- save ----------------
  save() {
    const st = this.state;
    const data = {
      v: 1, coins: st.coins, inv: st.inv, day: st.day, tod: st.tod, upgrades: st.upgrades,
      discovered: [...st.discovered], contracts: { done: st.contracts.done, active: st.contracts.active ? st.contracts.active.def.id : null },
      stats: st.stats, flags: st.flags,
      player: { x: this.player.pos.x, y: this.player.pos.y, z: this.player.pos.z, yaw: this.player.cam.yaw },
      poffs: this.creatures.poffs.map(p => ({ s: p.species.id, x: p.pos.x, y: p.pos.y, z: p.pos.z, c: p.corral ? p.corral.id : null, h: p.homeIsland })),
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); this.ui.toast('Ranch saved.', 'good'); }
    catch (e) { this.ui.toast('Could not save (storage blocked)', 'bad'); }
  }

  static hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }

  loadSave() {
    let data;
    try { data = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return false; }
    if (!data) return false;
    const st = this.state;
    st.coins = data.coins; st.inv = data.inv; st.day = data.day; st.tod = data.tod;
    st.upgrades = data.upgrades || {}; st.discovered = new Set(data.discovered || ['thistledown']);
    st.stats = data.stats || st.stats; st.flags = data.flags || {};
    for (const [id] of Object.entries(st.upgrades)) {
      const item = Content.npcs.flatMap(n => n.shop || []).find(i => i.id === id);
      if (item) this.applyEffect(item.effect, item);
    }
    if (data.contracts && data.contracts.active) st.accept(data.contracts.active);
    if (data.player) {
      this.player.pos.set(data.player.x, data.player.y, data.player.z);
      this.player.cam.yaw = data.player.yaw;
    }
    if (Array.isArray(data.poffs)) {
      for (const p of this.creatures.poffs) this.creatures.removePoff(p);
      for (const d of data.poffs) {
        const isl = this.world.byId.get(d.h) || this.world.islands[0];
        const p = this.creatures.spawnPoff(d.s, isl, { x: d.x, z: d.z });
        if (p && d.c) { const c = this.world.corrals.find(cc => cc.id === d.c); if (c) { p.corral = c; p.state = 'penned'; } }
      }
    }
    return true;
  }

  // ---------------- loop ----------------
  start(continueSave) {
    if (continueSave) this.loadSave();
    this.running = true;
    this.ui.show();
    this.ui.hideLoading();
    document.getElementById('title').classList.add('hidden');
    this.sound.init(); this.sound.resume();
    this.ui.toast('Welcome to Thistledown. Marlow is by the pens — he has opinions.', 'good');
    this.ui.toast('[M] contracts · [P] photograph · [Esc] pause', '');
  }

  loop(now) {
    requestAnimationFrame(t => this.loop(t));
    try { this.frame(now); } catch (e) {
      if (!this.__errShown) { this.__errShown = true; console.error('frame error', e); this.ui.toast('A frame hiccuped: ' + e.message, 'bad'); }
    }
  }

  frame(now) {
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;
    if (!this.running) { this.idleCamera(dt); return; }
    if (this.paused) { this.renderer.render(this.scene, this.camera); return; }
    this.time += dt;
    tickLook(this.time);
    this.photoCooldown = Math.max(0, this.photoCooldown - dt);

    this.pollKeys();
    const st = this.state;
    const ctx = {
      player: this.player, playerSpeed: this.player.speed, storm: st.weather.intensity > 0 ? st.weather : null,
      night: st.isNight(), time: this.time, holdingFruit: !!(this.bellows.held && this.bellows.held.type === 'fruit'),
      magnetRadius: 2.6, repelWraiths: !!st.flags.wraithGuard,
      onJump: () => this.sound.jump(), onDoubleJump: () => this.sound.doubleJump(),
      onLand: () => this.sound.land(), onBounce: () => this.sound.bounce(),
      onDash: () => { this.sound.blow(); this.player.cam.fovKick = 1; },
      onBlast: (p) => { this.sound.blow(); this.creatures.fx.puff(p.clone().setY(p.y - 1), 0xd8e8ff, 12); },
      onFall: () => { this.sound.error(); this.ui.toast('You fell into the cloud sea. Lost ' + CFG.player.respawnCoinsLoss + ' coin.', 'bad'); st.coins = Math.max(0, st.coins - CFG.player.respawnCoinsLoss); },
      onGeyser: () => { this.sound.bounce(); this.player.cam.fovKick = 1; },
      onShoo: () => { st.onShoo(); this.checkContractDone(); },
      onBlow: (o, dir) => this.onBlow(o, dir),
    };

    if (!this.__shot) this.player.update(dt, ctx);
    this.bellows.update(dt, this.input, ctx);
    this.creatures.update(dt, ctx);
    this.npcs.update(dt, ctx);
    animateSignatureProps(this.signature, dt, st.isNight());
    this.updateFruitSpawners(dt);
    this.collectFruitSpawners();
    this.handleItems(dt);
    this.handlePenning();
    this.handleWeatherAndDay(dt);
    this.handleDiscovery();
    st.update(dt, { onWeather: (w) => { this.sound.setWeather(w.intensity); }, onNewDay: (d) => this.ui.toast('Day ' + d + '. The board has new contracts.', '') });
    this.sound.setWeather(st.weather.intensity);
    this.updatePrompts();

    // camera
    if (this.__shot) { this.camera.lookAt(this.__shotLook); }
    else this.player.updateCamera(dt, this.camera);
    this.player.cam.fovKick = Math.max(0, (this.player.cam.fovKick || 0) - dt * 2.2);
    const targetFov = 62 + this.player.cam.fovKick * 8 + (this.player.gliding ? 3 : 0);
    this.camera.fov = damp(this.camera.fov, targetFov, 6, dt);
    this.camera.updateProjectionMatrix();
    this.sky.update(dt, st, this.camera, this.player.pos);

    // ribbon streak animation
    for (const rb of this.world.ribbons) {
      if (!rb.points) continue;
      const attr = rb.posAttr;
      for (let i = 0; i < rb.streaks.length; i++) {
        const s = rb.streaks[i];
        s.t += dt * (0.06 + s.s * 0.05);
        if (s.t > 1) s.t = 0;
        const d = s.t * rb.len;
        attr.setXYZ(i, rb.ax + rb.nx * d + -rb.nz * s.off, rb.y + s.h + Math.sin(this.time + i) * 0.3, rb.az + rb.nz * d + rb.nx * s.off);
      }
      attr.needsUpdate = true;
    }

    this.ui.update(dt, st, { tank: this.bellows.tank / this.bellows.tankMax() });
    this.ui.drawMap(this.world, st, this.player, this.creatures, this.npcs);

    // render
    this.renderer.render(this.scene, this.camera);
    if (this.flash > 0) { this.flashQuad.material.opacity = this.flash * 0.8; this.flash = Math.max(0, this.flash - dt * 4); }
    else this.flashQuad.material.opacity = 0;
    this.renderer.autoClear = false;
    this.renderer.render(this.vignette.sc, this.vignette.cam);
    this.renderer.autoClear = true;
  }

  onBlow(o, dir) {
    // called for every blow that releases something
    if (o.kind === 'poff') {
      this.creatures.fx.puff(o.pos, o.species.color, 8);
    }
  }

  idleCamera(dt) {
    this.time += dt;
    const r = 40;
    this.camera.position.set(Math.cos(this.time * 0.08) * r, 14 + Math.sin(this.time * 0.13) * 3, Math.sin(this.time * 0.08) * r);
    this.camera.lookAt(0, 2, 0);
    tickLook(this.time);
    this.sky.update(dt, this.state, this.camera, { x: 0, y: 0, z: 0 });
    this.creatures.update(dt, { player: { pos: this.camera.pos, speed: 0 }, night: false, storm: null, time: this.time });
    this.renderer.render(this.scene, this.camera);
    this.renderer.autoClear = false;
    this.renderer.render(this.vignette.sc, this.vignette.cam);
    this.renderer.autoClear = true;
  }
}

// Fixed review poses (see tools/shots.txt) — used by the look-review loop.
const SHOTS = {
  // cam = absolute offset above the ground under `player`; look = where to aim.
  hero_close:  { player: [2, 4], cam: [1.6, 1.6, -3.6], look: [2.2, 1.2, 4.2], tod: 0.30 },
  ranch_wide:  { player: [0, 0], cam: [0, 26, -34], look: [0, 0, 12], tod: 0.30 },
  pen_view:    { player: [14, 12], cam: [-7, 6, -9], look: [14, 0.5, 12], tod: 0.30 },
  island_edge: { player: [30, 26], cam: [-4, 3, -6], look: [45, -4, 40], tod: 0.35 },
  sky_ride:    { player: [104, -26], cam: [0, 16, -30], look: [0, 0, 0], tod: 0.30, fly: true },
  night_mood:  { player: [-6, 6], cam: [3, 2.5, -6], look: [-6, 1.2, 6], tod: 0.88 },
};

async function boot() {
  await Content.load();
  const game = new Game(document.getElementById('game'));
  window.__poffsky = game;
  const btn = document.getElementById('btn-start');
  const cont = document.getElementById('btn-continue');
  if (Game.hasSave()) cont.classList.remove('hidden');
  btn.addEventListener('click', () => game.start(false));
  cont.addEventListener('click', () => game.start(true));
  document.getElementById('btn-resume').addEventListener('click', () => game.togglePause());
  document.getElementById('btn-save').addEventListener('click', () => game.save());
  const params = new URLSearchParams(location.search);
  const shot = params.get('shot');
  if (shot && SHOTS[shot]) {
    const s = SHOTS[shot];
    try { game.start(false); } catch (e) { console.error('shot start failed', e); }
    try {
    game.state.tod = s.tod ?? game.state.tod;
    let gy = 0;
    if (s.player) {
      gy = game.world.heightAt(s.player[0], s.player[1]) ?? 0;
      game.player.pos.set(s.player[0], gy + CFG.player.radius, s.player[1]);
      game.player.vel.set(0, 0, 0);
    }
    game.__shot = shot;
    game.__shotLook = new THREE.Vector3(s.look[0], (s.look[1] ?? 0) + gy, s.look[2]);
    game.camera.position.set(s.player[0] + s.cam[0], gy + s.cam[1], s.player[1] + s.cam[2]);
    game.camera.lookAt(game.__shotLook);
    } catch (e) { console.error('shot pose failed', e); }
  }
  game.loop(performance.now());
}

boot().catch(e => {
  const el = document.getElementById('loading-text');
  window.__bootErr = String(e && e.stack || e);
  if (el) el.textContent = 'Could not start: ' + (e && e.message);
  console.error('BOOT FAILED', e);
});

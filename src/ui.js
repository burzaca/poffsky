// HUD, minimap, dialogue, shop, contract board, toasts, touch controls.

const $ = (s) => document.querySelector(s);

export class UI {
  constructor() {
    this.hud = $('#hud');
    this.el = {
      down: $('#hud-down'), coins: $('#hud-coins'), day: $('#hud-day'), time: $('#hud-time'),
      clock: $('#clock-fill'), cTitle: $('#hud-contract-title'), cProg: $('#hud-contract-progress'),
      prompt: $('#prompt'), tank: $('#tank-fill'), tankWrap: document.querySelector('.tank'),
      toasts: $('#toasts'), minimap: $('#minimap'), weather: $('#hud-weather'),
      dialogue: $('#dialogue'), dlgName: $('#dlg-name'), dlgText: $('#dlg-text'),
      dlgActions: $('#dlg-actions'), dlgPortrait: $('#dlg-portrait'),
      shop: $('#shop'), shopItems: $('#shop-items'), shopTitle: $('#shop-title'), shopCoins: $('#shop-coins'),
      board: $('#board'), boardItems: $('#board-items'),
      title: $('#title'), pause: $('#pause'), loading: $('#loading'),
    };
    this.mm = this.el.minimap.getContext('2d');
    this.promptTimer = 0;
    this.typewriter = null;
  }

  show() { this.hud.classList.remove('hidden'); }
  hideLoading() { this.el.loading.classList.add('hidden'); }

  hud_(state) {}

  update(dt, state, ctx) {
    this.el.down.textContent = state.inv.down + Object.values(state.inv.plumes).reduce((s, n) => s + n, 0);
    this.el.coins.textContent = state.coins;
    this.el.day.textContent = 'Day ' + state.day;
    const ph = state.phase();
    this.el.time.textContent = ({ dawn: 'Dawn', morning: 'Morning', midday: 'Midday', dusk: 'Dusk', night: 'Night' })[ph];
    this.el.clock.style.width = Math.round(state.tod * 100) + '%';
    const a = state.contracts.active;
    if (a) {
      this.el.cTitle.textContent = a.def.title;
      this.el.cProg.textContent = state.contractText(a);
    } else {
      this.el.cTitle.textContent = 'Visit the notice board';
      this.el.cProg.textContent = '';
    }
    const w = state.weather;
    if (w.kind !== 'clear') {
      this.el.weather.classList.remove('hidden');
      this.el.weather.classList.add('storm');
      this.el.weather.textContent = (w.kind === 'greatgust' ? 'THE GREAT GUST' : 'Gust storm') + ' — ' + Math.ceil(w.until) + 's';
    } else this.el.weather.classList.add('hidden');
    this.el.tank.style.width = Math.round((ctx.tank || 0) * 100) + '%';
    this.el.tankWrap.classList.toggle('on', (ctx.tank || 0) < 0.999);
  }

  prompt(text) {
    if (!text) { this.el.prompt.classList.remove('on'); return; }
    this.el.prompt.textContent = text;
    this.el.prompt.classList.add('on');
  }

  toast(text, kind = '') {
    const d = document.createElement('div');
    d.className = 'toast ' + kind;
    d.textContent = text;
    this.el.toasts.appendChild(d);
    setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 320); }, 4200);
    while (this.el.toasts.children.length > 5) this.el.toasts.firstChild.remove();
  }

  // ---------- minimap ----------
  drawMap(world, state, player, creatures, npcs) {
    const c = this.mm;
    const S = 184, cx = S / 2, cy = S / 2;
    const scale = 0.2;
    c.clearRect(0, 0, S, S);
    c.save();
    c.beginPath(); c.arc(cx, cy, S / 2 - 2, 0, Math.PI * 2); c.clip();
    c.fillStyle = 'rgba(12,16,30,0.55)'; c.fillRect(0, 0, S, S);
    const px = player.pos.x, pz = player.pos.z;
    const to = (x, z) => [cx + (x - px) * scale, cy + (z - pz) * scale];
    // wind ribbons
    c.strokeStyle = 'rgba(160,220,255,0.35)'; c.lineWidth = 2;
    for (const rb of world.ribbons) {
      const [ax, az] = to(rb.ax, rb.az), [bx, bz] = to(rb.bx, rb.bz);
      c.beginPath(); c.moveTo(ax, az); c.lineTo(bx, bz); c.stroke();
    }
    // islands
    for (const isl of world.islands) {
      const [x, y] = to(isl.x, isl.z);
      const known = state.discovered.has(isl.id);
      c.fillStyle = known ? 'rgba(120,200,140,0.5)' : 'rgba(90,100,130,0.35)';
      c.beginPath(); c.arc(x, y, isl.r * scale, 0, Math.PI * 2); c.fill();
      if (known) {
        c.fillStyle = 'rgba(255,247,232,0.75)';
        c.font = '9px system-ui';
        c.textAlign = 'center';
        c.fillText(isl.name, x, y - isl.r * scale - 3);
      }
    }
    // corrals
    for (const cor of world.corrals) {
      if (!cor.unlocked) continue;
      const [x, y] = to(cor.x, cor.z);
      c.strokeStyle = 'rgba(255,220,120,0.8)'; c.lineWidth = 1.2;
      c.beginPath(); c.arc(x, y, cor.r * scale, 0, Math.PI * 2); c.stroke();
    }
    // creatures
    for (const p of creatures.poffs) {
      const [x, y] = to(p.pos.x, p.pos.z);
      c.fillStyle = p.species.color;
      c.beginPath(); c.arc(x, y, 2.2, 0, Math.PI * 2); c.fill();
    }
    for (const w of creatures.wraiths) {
      const [x, y] = to(w.pos.x, w.pos.z);
      c.fillStyle = 'rgba(150,120,255,0.9)';
      c.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    // npcs
    for (const n of npcs.list) {
      const [x, y] = to(n.mesh.position.x, n.mesh.position.z);
      c.fillStyle = '#ffd68a';
      c.beginPath(); c.arc(x, y, 2.6, 0, Math.PI * 2); c.fill();
    }
    // player
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(cx, cy, 3.2, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#ffffff'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(cx, cy);
    c.lineTo(cx + Math.sin(player.cam.yaw) * 9, cy + Math.cos(player.cam.yaw) * 9);
    c.stroke();
    c.restore();
    c.strokeStyle = 'rgba(255,247,232,0.25)'; c.lineWidth = 1;
    c.beginPath(); c.arc(cx, cy, S / 2 - 2, 0, Math.PI * 2); c.stroke();
  }

  // ---------- dialogue ----------
  talk(npc, text, actions = []) {
    this.releasePointer();
    this.el.dialogue.classList.remove('hidden');
    this.el.dlgName.textContent = (npc.def.name + ' — ' + npc.def.role).toUpperCase();
    this.el.dlgPortrait.innerHTML = '';
    const face = portrait(npc.def);
    this.el.dlgPortrait.appendChild(face);
    this.el.dlgText.textContent = '';
    let i = 0;
    clearInterval(this.typewriter);
    this.typewriter = setInterval(() => {
      i += 2;
      this.el.dlgText.textContent = text.slice(0, i);
      if (i >= text.length) clearInterval(this.typewriter);
    }, 16);
    this.el.dlgActions.innerHTML = '';
    for (const a of actions) {
      const b = document.createElement('button');
      b.textContent = a.label;
      b.onclick = () => { this.uiClick(); a.fn(); };
      this.el.dlgActions.appendChild(b);
    }
    if (!actions.length) {
      const b = document.createElement('button');
      b.textContent = 'Say goodbye';
      b.onclick = () => this.endTalk();
      this.el.dlgActions.appendChild(b);
    }
  }

  endTalk() {
    clearInterval(this.typewriter);
    this.el.dialogue.classList.add('hidden');
  }

  get talking() { return !this.el.dialogue.classList.contains('hidden'); }

  // ---------- shop ----------
  openShop(npc, state, onBuy) {
    this.releasePointer();
    this.el.shop.classList.remove('hidden');
    this.el.shopTitle.textContent = npc.def.name + ' — ' + npc.def.role;
    this.renderShop(npc, state, onBuy);
  }

  renderShop(npc, state, onBuy) {
    this.el.shopItems.innerHTML = '';
    const items = (npc.def.shop || []).filter(it => !state.upgrades[it.id]);
    if (!items.length) {
      const d = document.createElement('div');
      d.style.cssText = 'padding:10px;color:#aab3d4';
      d.textContent = 'Nothing left on the shelf today.';
      this.el.shopItems.appendChild(d);
    }
    for (const it of items) {
      const b = document.createElement('button');
      const afford = state.coins >= it.cost;
      b.disabled = !afford;
      b.innerHTML = `<span><span class="it-name">${it.name}</span><div class="it-sub">${describeEffect(it.effect)}</div></span><span class="it-cost">${it.cost}c</span>`;
      b.onclick = () => { onBuy(it); this.renderShop(npc, state, onBuy); };
      this.el.shopItems.appendChild(b);
    }
    this.el.shopCoins.textContent = state.coins + ' coin' + (state.coins === 1 ? '' : 's') + '  ·  press F again to close';
  }

  closeShop() { this.el.shop.classList.add('hidden'); }
  get shopOpen() { return !this.el.shop.classList.contains('hidden'); }

  // ---------- contract board ----------
  // Any panel we open needs the mouse. Pointer lock hides the cursor and
  // sends every click to the canvas, so panels are unclickable while it is on.
  releasePointer() { if (document.pointerLockElement) document.exitPointerLock(); }

  openBoard(state, onAccept) {
    this.releasePointer();
    this.el.board.classList.remove('hidden');
    this.renderBoard(state, onAccept);
  }

  renderBoard(state, onAccept) {
    this.el.boardItems.innerHTML = '';
    const done = Object.keys(state.contracts.done).length;
    const head = document.createElement('div');
    head.style.cssText = 'padding:4px 6px;color:#aab3d4;font-size:12px';
    head.textContent = `${done} of ${state.contracts.offered.length + done + (state.contracts.active ? 1 : 0)} contracts filed`;
    this.el.boardItems.appendChild(head);
    if (state.contracts.active) {
      const d = document.createElement('div');
      d.style.cssText = 'padding:8px 10px;border:1px dashed rgba(255,214,138,.5);border-radius:12px;color:#ffd68a;font-size:13px';
      d.textContent = 'In progress: ' + state.contracts.active.def.title + ' — ' + state.contractText(state.contracts.active);
      this.el.boardItems.appendChild(d);
    }
    for (const c of state.contracts.offered) {
      const b = document.createElement('button');
      b.innerHTML = `<span><span class="it-name">${c.title}</span><div class="it-sub">${c.text}</div></span><span class="it-cost">+${c.reward}c</span>`;
      b.onclick = () => { onAccept(c); this.renderBoard(state, onAccept); };
      this.el.boardItems.appendChild(b);
    }
    if (!state.contracts.offered.length) {
      const d = document.createElement('div');
      d.style.cssText = 'padding:10px;color:#aab3d4';
      d.textContent = 'The board is empty. Come back tomorrow.';
      this.el.boardItems.appendChild(d);
    }
  }

  closeBoard() { this.el.board.classList.add('hidden'); }
  get boardOpen() { return !this.el.board.classList.contains('hidden'); }
  uiClick() {}
}

function portrait(def) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:44px';
  const emoji = { pip: '📯', marlow: '🌾', tilda: '🗺️', bellwright: '🔧', sable: '🌙' }[def.id] || '🙂';
  wrap.textContent = emoji;
  wrap.style.background = def.color + '33';
  wrap.style.borderRadius = '12px';
  return wrap;
}

function describeEffect(effect) {
  if (!effect) return '';
  const map = {
    'player.jump': 'Jump power +25%',
    'player.glider': 'Glide: hold movement while falling',
    'player.gust_ride': 'Wind roads push you harder',
    'market.sell_bonus': 'Sell everything 10% dearer',
    'corral.slots': 'Pens hold more poffs',
    'corral.escape_chance': 'Poffs are less likely to wander off',
    'bellows.tank': 'Bigger air tank — hold things longer',
    'bellows.range': 'Bellows reaches 2m further',
    'bellows.force': 'Blow things 25% harder',
    'map.pins': 'Three map pins',
    'hud.compass': 'Compass on the minimap',
    'map.reveal': 'Reveals the wind roads',
    'corral.wraith_guard': 'Wraiths avoid your pens',
    'plot.plant': 'Plant it at the ranch garden',
  };
  for (const k in map) if (effect.startsWith(k)) return map[k];
  return effect;
}

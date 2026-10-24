import * as THREE from '../vendor/three.module.js';

// Used for prop mesh colors
const COLORS = {
  windmill: 0xebdea7,
  windmillBlades: 0xded8c6,
  windmillRoof: 0xba7847,
  post: 0x85735e,
  rope: 0xd4bc86,
  bell: 0xc4a62a,
  lantern: 0xffe6a3,
  lanternOff: 0xbfa77e,
  sign: 0xefc97a,
  signText: 0x6e5525,
  waterTank: 0xabdff4,
  water: 0x80d2ff,
  bench: 0xba7847,
  trellis: 0xeccdbb,
  orchardFruit: 0xc1ed5e
};

function buildSignatureProps(world, look) {
  const root = new THREE.Group();
  // Helper to place something at a sensible spot (centered on islands, spread out)
  let n = 0;

  // --- WINDMILL ---
  function buildWindmill(island) {
    const g = new THREE.Group();
    // Tower
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.5, 10, 12),
      look.toonMaterial({ color: COLORS.windmill, flatShading: true })
    );
    tower.position.y = 5;
    g.add(tower);
    // Roof
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(2, 2, 12),
      look.toonMaterial({ color: COLORS.windmillRoof, flatShading: true })
    );
    roof.position.y = 11;
    g.add(roof);
    // Blades
    const blades = new THREE.Group();
    for (let i = 0; i < 4; ++i) {
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.2, 6),
        look.toonMaterial({ color: COLORS.windmillBlades, flatShading: true, sway: 0.02 })
      );
      blade.position.z = 3.3;
      blade.position.y = 0.1;
      blade.rotation.y = (i * Math.PI) / 2;
      blades.add(blade);
    }
    blades.position.y = 8.5;
    g.add(blades);
    g.userData.spin = (dt) => {
      blades.rotation.z += 1.6 * dt;
    };
    // Place at edge
    g.position.set(island.x + island.r * 0.5, 0, island.z);
    const y = world.heightAt(g.position.x, g.position.z);
    if (y == null) return null;
    g.position.y = y;
    return g;
  }

  // --- BELL TOWER ---
  function buildBellTower(island) {
    const g = new THREE.Group();
    // Frame
    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(1, 10, 1),
      look.toonMaterial({ color: COLORS.post, flatShading: true })
    );
    tower.position.y = 5;
    g.add(tower);
    const arch = new THREE.Mesh(
      new THREE.BoxGeometry(2, 1, 1),
      look.toonMaterial({ color: COLORS.post, flatShading: true })
    );
    arch.position.set(0, 10, 0);
    g.add(arch);
    // Bell
    const bell = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 12, 12, 0, Math.PI),
      look.toonMaterial({ color: COLORS.bell, flatShading: true })
    );
    bell.position.set(0, 9, 0);
    g.add(bell);
    // Swing
    let swingT = Math.random() * Math.PI * 2;
    g.userData.swing = (dt) => {
      swingT += dt * 1.8;
      bell.rotation.z = Math.sin(swingT) * 0.38;
    };
    g.position.set(island.x - island.r * 0.3, 0, island.z + island.r * 0.4);
    const y = world.heightAt(g.position.x, g.position.z);
    if (y == null) return null;
    g.position.y = y;
    return g;
  }

  // --- PAPER LANTERNS ---
  function buildLanternLine(island) {
    const g = new THREE.Group();
    // Posts
    const p1 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.3, 4.5, 8),
      look.toonMaterial({ color: COLORS.post })
    );
    p1.position.set(-2, 2.25, 0);
    g.add(p1);
    const p2 = p1.clone();
    p2.position.set(2, 2.25, 0);
    g.add(p2);
    // "Cable"
    const rope = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.06, 4.1, 6),
      look.toonMaterial({ color: COLORS.rope })
    );
    rope.position.y = 4.2;
    rope.rotation.z = Math.PI / 2;
    g.add(rope);
    // Lanterns
    const lanterns = [];
    for (let i = -1; i <= 1; i++) {
      const lantern = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 10, 10),
        look.toonMaterial({ color: COLORS.lantern, flatShading: true })
      );
      lantern.position.set(i * 1.25, 4, 0);
      lanterns.push(lantern);
      g.add(lantern);
    }
    // Glow control
    g.userData.glowAt = (night) => {
      lanterns.forEach(lantern => {
        lantern.material.color.setHex(night ? COLORS.lantern : COLORS.lanternOff);
      });
    };
    g.position.set(island.x, 0, island.z - island.r * 0.3);
    const y = world.heightAt(g.position.x, g.position.z);
    if (y == null) return null;
    g.position.y = y;
    return g;
  }

  // --- POFF POST ---
  function buildPoffPost(island) {
    const g = new THREE.Group();
    // Pole
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.26, 6, 10),
      look.toonMaterial({ color: COLORS.post })
    );
    pole.position.y = 3;
    g.add(pole);
    // Rings
    for (let j = 0; j < 3; ++j) {
      const ringGeo = new THREE.TorusGeometry(0.38, 0.06, 8, 13);
      const ring = new THREE.Mesh(
        ringGeo,
        look.toonMaterial({ color: COLORS.rope })
      );
      ring.position.y = 1.2 + j * 1.4;
      ring.rotation.x = Math.PI / 2 + (j - 1) * 0.2;
      g.add(ring);
    }
    g.position.set(island.x - island.r * 0.45, 0, island.z - island.r * 0.15);
    const y = world.heightAt(g.position.x, g.position.z);
    if (y == null) return null;
    g.position.y = y;
    return g;
  }

  // --- WATER TOWER ---
  function buildWaterTower(island) {
    const g = new THREE.Group();
    // Tank
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.2, 3, 14),
      look.toonMaterial({ color: COLORS.waterTank })
    );
    tank.position.y = 6;
    g.add(tank);
    // Legs
    for (let i = 0; i < 4; ++i) {
      const ang = (i * Math.PI * 2) / 4;
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.23, 0.28, 6, 7),
        look.toonMaterial({ color: COLORS.post })
      );
      leg.position.set(Math.cos(ang) * 0.8, 3, Math.sin(ang) * 0.8);
      g.add(leg);
    }
    // Waterfall
    const w = 1.5, h = 7;
    const canvas = document.createElement('canvas');
    canvas.width = 32; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#80d2ff';
    ctx.fillRect(0, 0, 32, 64);
    ctx.strokeStyle = '#ffffff88';
    ctx.lineWidth = 3;
    for (let k = 0; k < 4; ++k) {
      ctx.beginPath();
      ctx.moveTo(8 + k * 6, 0);
      ctx.lineTo(12 + k * 5, 64);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 1);
    const fall = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    );
    fall.position.set(0, h / 2, 1.7);
    g.add(fall);
    let scroll = 0;
    g.userData.scroll = (dt) => {
      scroll = (scroll + 0.33 * dt) % 1;
      tex.offset.y = scroll;
    };
    g.position.set(island.x + island.r * 0.44, 0, island.z - island.r * 0.45);
    const y = world.heightAt(g.position.x, g.position.z);
    if (y == null) return null;
    g.position.y = y + 5.5; // on edge, up high
    return g;
  }

  // --- NOTICE SIGNPOST ---
  function buildSignpost(island) {
    const g = new THREE.Group();
    // Post
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.22, 4.2, 8),
      look.toonMaterial({ color: COLORS.post })
    );
    pole.position.y = 2.1;
    g.add(pole);
    // Arrows
    for (let i = -1; i <= 1; ++i) {
      const arrow = new THREE.Mesh(
        new THREE.BoxGeometry(2, 0.4, 0.15),
        look.toonMaterial({ color: COLORS.sign })
      );
      arrow.position.set(0.65, 2.7 + i * 0.6, 0);
      arrow.rotation.z = i * 0.18;
      g.add(arrow);
    }
    g.position.set(island.x, 0, island.z + island.r * 0.34);
    const y = world.heightAt(g.position.x, g.position.z);
    if (y == null) return null;
    g.position.y = y;
    return g;
  }

  // --- ORCHARD TRELLIS ---
  function buildOrchard(island) {
    const g = new THREE.Group();
    // Bench
    const bench = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.33, 0.4),
      look.toonMaterial({ color: COLORS.bench })
    );
    bench.position.y = 0.17;
    g.add(bench);
    // Trellis Frame
    const tframe = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 1.6, 0.13),
      look.toonMaterial({ color: COLORS.trellis })
    );
    tframe.position.y = 1.1;
    g.add(tframe);
    // Supports
    for (let i = -1; i <= 1; i += 2) {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.15, 1.4, 6),
        look.toonMaterial({ color: COLORS.trellis })
      );
      leg.position.set(i * 1.05, 0.7, 0);
      g.add(leg);
    }
    // Fruits
    for (let k = 0; k < 4; ++k) {
      const fruit = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 7, 7),
        look.toonMaterial({ color: COLORS.orchardFruit })
      );
      fruit.position.set(-0.85 + k * 0.6, 1.4 + Math.sin(k) * 0.07, 0.1 + Math.cos(k) * 0.1);
      g.add(fruit);
    }
    g.position.set(island.x + island.r * 0.25, 0, island.z + island.r * 0.3);
    const y = world.heightAt(g.position.x, g.position.z);
    if (y == null) return null;
    g.position.y = y;
    return g;
  }

  // Place these props, spread out so rarely overlap
  const islands = Array.isArray(world.islands) ? world.islands : [];
  if (islands.length === 0) return root;
  // One windmill on first, bell tower on second, water tower on last, etc
  const windIsland = islands[0];
  const bellIsland = islands[1 % islands.length];
  const lanternIsland = islands[2 % islands.length];
  const poffIsland = islands[3 % islands.length];
  const waterIsland = islands[islands.length - 1];
  const signIsland = islands[4 % islands.length];
  const orchardIsland = islands[5 % islands.length];

  [
    buildWindmill(windIsland),
    buildBellTower(bellIsland),
    buildLanternLine(lanternIsland),
    buildPoffPost(poffIsland),
    buildWaterTower(waterIsland),
    buildSignpost(signIsland),
    buildOrchard(orchardIsland)
  ]
    .forEach((g) => {
      if (g) root.add(g);
    });

  return root;
}

function animateSignatureProps(group, dt, night) {
  group.traverse(obj => {
    if (obj.userData) {
      if (typeof obj.userData.spin === 'function') {
        try { obj.userData.spin(dt); } catch {}
      }
      if (typeof obj.userData.swing === 'function') {
        try { obj.userData.swing(dt); } catch {}
      }
      if (typeof obj.userData.glowAt === 'function') {
        try { obj.userData.glowAt(!!night); } catch {}
      }
      if (typeof obj.userData.scroll === 'function') {
        try { obj.userData.scroll(dt); } catch {}
      }
    }
  });
}

export { buildSignatureProps, animateSignatureProps };

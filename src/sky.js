// Sky, sun, moon, cloud sea, fog and weather. All procedural.

import * as THREE from '../vendor/three.module.js';
import { TAU, clamp, damp } from './util.js';

const PALETTES = {
  dawn:    { top: new THREE.Color('#3f5aa8'), hor: new THREE.Color('#ffb37a'), fog: new THREE.Color('#c9a9c4'), sun: new THREE.Color('#ffd9a0'), hemiSky: new THREE.Color('#8fa8e0'), hemiGround: new THREE.Color('#6a7a55'), sunI: 1.05, hemiI: 0.55 },
  morning: { top: new THREE.Color('#4f8fd8'), hor: new THREE.Color('#cfe9ff'), fog: new THREE.Color('#cfe4f5'), sun: new THREE.Color('#fff4d0'), hemiSky: new THREE.Color('#a8d4f5'), hemiGround: new THREE.Color('#7ba05e'), sunI: 1.35, hemiI: 0.75 },
  midday:  { top: new THREE.Color('#3f86e0'), hor: new THREE.Color('#dff1ff'), fog: new THREE.Color('#dceaf7'), sun: new THREE.Color('#ffffff'), hemiSky: new THREE.Color('#b8e0ff'), hemiGround: new THREE.Color('#89ad68'), sunI: 1.5, hemiI: 0.85 },
  dusk:    { top: new THREE.Color('#3b3f7a'), hor: new THREE.Color('#ff8f6b'), fog: new THREE.Color('#a58aa8'), sun: new THREE.Color('#ff9a5a'), hemiSky: new THREE.Color('#8d7fb8'), hemiGround: new THREE.Color('#5d5a48'), sunI: 0.9, hemiI: 0.5 },
  night:   { top: new THREE.Color('#0d1230'), hor: new THREE.Color('#2a3560'), fog: new THREE.Color('#232a4a'), sun: new THREE.Color('#9fb4ff'), hemiSky: new THREE.Color('#39456f'), hemiGround: new THREE.Color('#2a3040'), sunI: 0.35, hemiI: 0.3 },
  storm:   { top: new THREE.Color('#4a5570'), hor: new THREE.Color('#8b96a8'), fog: new THREE.Color('#7c8798'), sun: new THREE.Color('#d8dee8'), hemiSky: new THREE.Color('#7f8ba0'), hemiGround: new THREE.Color('#5a6152'), sunI: 0.7, hemiI: 0.6 },
};

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(900, 24, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false,
        uniforms: {
          top: { value: new THREE.Color('#3f86e0') }, hor: { value: new THREE.Color('#dff1ff') },
          band: { value: new THREE.Color('#ffffff') }, haze: { value: 0.0 },
        },
        vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: `
          varying vec3 vP; uniform vec3 top; uniform vec3 hor; uniform vec3 band; uniform float haze;
          void main(){
            float h = normalize(vP).y;
            float t = smoothstep(-0.08, 0.55, h);
            vec3 c = mix(hor, top, t);
            float bandMask = smoothstep(0.0, 0.06, h) * (1.0 - smoothstep(0.06, 0.22, h));
            c = mix(c, band, bandMask * haze);
            gl_FragColor = vec4(c, 1.0);
          }`,
      }));
    this.dome.frustumCulled = false;
    scene.add(this.dome);

    this.hemi = new THREE.HemisphereLight(0xb8e0ff, 0x89ad68, 0.85);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const s = this.sun.shadow;
    s.camera.near = 1; s.camera.far = 260;
    s.camera.left = -60; s.camera.right = 60; s.camera.top = 60; s.camera.bottom = -60;
    s.bias = -0.0012; s.normalBias = 0.03;
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.sunDisc = new THREE.Mesh(new THREE.CircleGeometry(18, 24), new THREE.MeshBasicMaterial({ color: 0xfff3c4, transparent: true, opacity: 0.9, fog: false }));
    scene.add(this.sunDisc);
    this.moonDisc = new THREE.Mesh(new THREE.CircleGeometry(12, 20), new THREE.MeshBasicMaterial({ color: 0xdfe7ff, transparent: true, opacity: 0.0, fog: false }));
    scene.add(this.moonDisc);

    // stars
    const N = 700, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const a = Math.random() * TAU, y = Math.random() * 0.9 + 0.05, r = Math.sqrt(1 - y * y) * 800;
      pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = y * 800; pos[i * 3 + 2] = Math.sin(a) * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, transparent: true, opacity: 0, fog: false, sizeAttenuation: false }));
    this.stars.frustumCulled = false;
    scene.add(this.stars);

    // cloud sea
    const CN = 260;
    this.clouds = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      // depth-tested: the deck must sit *below* the islands, never wash over them
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.72, depthWrite: true, side: THREE.DoubleSide }),
      CN);
    this.cloudData = [];
    const m = new THREE.Matrix4();
    for (let i = 0; i < CN; i++) {
      const a = Math.random() * TAU, r = Math.random() * 620;
      const d = { x: Math.cos(a) * r, z: Math.sin(a) * r, y: -24 - Math.random() * 8, s: 26 + Math.random() * 70, sp: 0.6 + Math.random() * 1.4, ph: Math.random() * TAU };
      this.cloudData.push(d);
      m.makeRotationX(-Math.PI / 2); m.setPosition(d.x, d.y, d.z);
      m.scale(new THREE.Vector3(d.s, d.s, 1));
      this.clouds.setMatrixAt(i, m);
    }
    this.clouds.instanceMatrix.needsUpdate = true;
    this.clouds.frustumCulled = false;
    scene.add(this.clouds);

    // rain / gust streaks
    const RN = 900, rp = new Float32Array(RN * 3);
    for (let i = 0; i < RN; i++) { rp[i * 3] = (Math.random() - 0.5) * 90; rp[i * 3 + 1] = Math.random() * 40; rp[i * 3 + 2] = (Math.random() - 0.5) * 90; }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    this.rain = new THREE.Points(rg, new THREE.PointsMaterial({ color: 0xdfeaff, size: 0.16, transparent: true, opacity: 0, depthWrite: false }));
    this.rain.frustumCulled = false;
    scene.add(this.rain);
    this.rainPos = rg.getAttribute('position');

    scene.fog = new THREE.Fog(0xdceaf7, 90, 620);
    this.cur = { top: new THREE.Color(), hor: new THREE.Color(), fog: new THREE.Color(), sunC: new THREE.Color(), hemiSky: new THREE.Color(), hemiGround: new THREE.Color() };
    this.t = 0;
  }

  update(dt, state, camera, focus) {
    this.t += dt;
    const phase = state.phase();
    const stormy = state.weather.intensity > 0;
    const pal = stormy ? PALETTES.storm : PALETTES[phase];
    const k = 1 - Math.exp(-1.2 * dt);

    this.cur.top.lerp(pal.top, k); this.cur.hor.lerp(pal.hor, k);
    this.cur.fog.lerp(pal.fog, k); this.cur.sunC.lerp(pal.sun, k);
    this.cur.hemiSky.lerp(pal.hemiSky, k); this.cur.hemiGround.lerp(pal.hemiGround, k);

    this.dome.material.uniforms.top.value.copy(this.cur.top);
    this.dome.material.uniforms.hor.value.copy(this.cur.hor);
    this.dome.material.uniforms.band.value.copy(pal.hor);
    this.dome.material.uniforms.haze.value = stormy ? 0.15 : (phase === 'dawn' || phase === 'dusk' ? 0.5 : 0.2);
    this.dome.position.copy(camera.position);

    this.hemi.color.copy(this.cur.hemiSky);
    this.hemi.groundColor.copy(this.cur.hemiGround);
    this.hemi.intensity = damp(this.hemi.intensity, pal.hemiI, 1.2, dt);

    // sun orbit: rises at tod 0, overhead at 0.4, sets ~0.78
    const ang = (state.tod * 1.0 - 0.05) * Math.PI * 1.15;
    const el = Math.sin(ang);
    const dir = new THREE.Vector3(Math.cos(ang) * 0.7, Math.max(-0.35, el), Math.sin(ang * 0.6 + 1.2) * 0.6).normalize();
    this.sun.position.copy(focus).addScaledVector(dir, 120);
    this.sun.target.position.copy(focus);
    this.sun.intensity = damp(this.sun.intensity, pal.sunI, 1.5, dt);
    this.sun.color.copy(this.cur.sunC);

    this.sunDisc.position.copy(camera.position).addScaledVector(dir, 700);
    this.sunDisc.material.opacity = clamp(el * 1.4, 0, 0.95);
    this.sunDisc.lookAt(camera.position);
    const moonDir = dir.clone().multiplyScalar(-1);
    this.moonDisc.position.copy(camera.position).addScaledVector(moonDir, 700);
    this.moonDisc.material.opacity = clamp(-el * 1.2, 0, 0.7);
    this.moonDisc.lookAt(camera.position);

    this.stars.position.copy(camera.position);
    const starTarget = (phase === 'night' ? 0.85 : (phase === 'dusk' ? 0.15 : 0)) * (1 - state.weather.intensity);
    this.stars.material.opacity = damp(this.stars.material.opacity, starTarget, 1.2, dt);

    // clouds drift and tint
    const m = new THREE.Matrix4();
    const tint = this.cur.fog.clone().lerp(new THREE.Color(0xffffff), 0.5);
    this.clouds.material.color.copy(tint);
    this.clouds.material.opacity = stormy ? 0.75 : 0.55;
    for (let i = 0; i < this.cloudData.length; i++) {
      const d = this.cloudData[i];
      d.x += (state.weather.wx * 6 + 0.6) * dt;
      d.z += (state.weather.wz * 6 + 0.2) * dt;
      if (d.x > 640) d.x -= 1280; if (d.x < -640) d.x += 1280;
      if (d.z > 640) d.z -= 1280; if (d.z < -640) d.z += 1280;
      m.makeRotationX(-Math.PI / 2);
      m.setPosition(d.x, d.y + Math.sin(this.t * 0.2 + d.ph) * 1.2, d.z);
      m.scale(new THREE.Vector3(d.s, d.s, 1));
      this.clouds.setMatrixAt(i, m);
    }
    this.clouds.instanceMatrix.needsUpdate = true;

    // rain around the player
    const rp = this.rainPos;
    const inten = state.weather.intensity;
    this.rain.material.opacity = damp(this.rain.material.opacity, inten * 0.55, 2, dt);
    this.rain.visible = this.rain.material.opacity > 0.01;
    if (this.rain.visible) {
      this.rain.position.set(focus.x, 0, focus.z);
      for (let i = 0; i < rp.count; i++) {
        let y = rp.getY(i) - (24 + inten * 30) * dt;
        if (y < -2) y = 42;
        rp.setY(i, y);
        rp.setX(i, rp.getX(i) + state.weather.wx * 18 * dt);
        rp.setZ(i, rp.getZ(i) + state.weather.wz * 18 * dt);
      }
      rp.needsUpdate = true;
    }

    this.scene.fog.color.copy(this.cur.fog);
    this.scene.fog.near = stormy ? 30 : 90;
    this.scene.fog.far = stormy ? 320 : 620;
  }
}

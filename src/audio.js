// Procedural audio: everything is synthesised, no audio files.

export class Sound {
  constructor() {
    this.ctx = null; this.master = null; this.enabled = true;
    this.noiseBuf = null;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.startAmbient();
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  noise(dur, freq, q, gain, type = 'bandpass', sweep = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(60, freq + sweep), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur + 0.05);
  }

  tone(freq, dur, gain = 0.2, type = 'sine', slideTo = 0, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  startAmbient() {
    // wind bed
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320; f.Q.value = 0.6;
    const g = this.ctx.createGain(); g.gain.value = 0.035;
    const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.08;
    const lfoG = this.ctx.createGain(); lfoG.gain.value = 0.02;
    lfo.connect(lfoG); lfoG.connect(g.gain);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); lfo.start(t);
    this.windGain = g; this.windFilter = f;
    // soft pad
    const pad = [196, 262, 330].map((fr, i) => {
      const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = fr;
      const gg = this.ctx.createGain(); gg.gain.value = 0.012 / (i + 1);
      const f2 = this.ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 900;
      o.connect(f2); f2.connect(gg); gg.connect(this.master); o.start(t);
      return { o, g: gg };
    });
    this.pad = pad;
  }

  setWeather(intensity) {
    if (!this.windGain) return;
    this.windGain.gain.value = 0.035 + intensity * 0.12;
    this.windFilter.frequency.value = 320 + intensity * 900;
  }

  setMood(bright) {
    if (!this.pad) return;
    this.pad.forEach((p, i) => { p.g.gain.value = (0.012 / (i + 1)) * bright; });
  }

  // ---- one-shots ----
  grab() { this.tone(520, 0.12, 0.12, 'sine', 880); this.noise(0.12, 900, 1.2, 0.05, 'bandpass', 600); }
  blow() { this.noise(0.28, 1400, 0.8, 0.16, 'bandpass', -1100); this.tone(180, 0.2, 0.08, 'sine', 90); }
  jump() { this.tone(320, 0.12, 0.1, 'sine', 520); }
  doubleJump() { this.tone(520, 0.14, 0.1, 'triangle', 760); }
  land() { this.noise(0.12, 220, 1.0, 0.1, 'lowpass'); }
  bounce() { this.tone(240, 0.2, 0.14, 'sine', 620); }
  coin() { this.tone(880, 0.09, 0.12, 'triangle'); this.tone(1320, 0.12, 0.1, 'triangle', 0, 0.06); }
  pluck() { this.tone(660, 0.1, 0.08, 'triangle', 520); }
  pop() { this.noise(0.1, 600, 2, 0.1, 'bandpass', 400); }
  squeak(pitch = 1) { this.tone(700 * pitch, 0.14, 0.09, 'sine', 1100 * pitch); this.tone(1100 * pitch, 0.1, 0.05, 'sine', 700 * pitch, 0.08); }
  breed() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, 0.1, 'triangle', 0, i * 0.09)); }
  contract() { [659, 784, 988].forEach((f, i) => this.tone(f, 0.35, 0.1, 'sine', 0, i * 0.12)); }
  shutter() { this.noise(0.05, 2500, 3, 0.12); this.tone(1200, 0.05, 0.05, 'square'); }
  ui() { this.tone(440, 0.05, 0.05, 'triangle'); }
  error() { this.tone(220, 0.18, 0.09, 'sawtooth', 140); }
  gull() { this.tone(1200 + Math.random() * 300, 0.18, 0.04, 'sine', 800); this.tone(900, 0.14, 0.03, 'sine', 1100, 0.16); }
  gust() { this.noise(2.2, 300, 0.5, 0.22, 'lowpass', 1400); }
}

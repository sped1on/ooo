// Все звуки синтезируются WebAudio — никаких файлов.

let ctx = null;
let master = null;
let sfxBus = null;
let musicBus = null;
let noiseBuf = null;
let settings = { sound: true, music: true };
let paused = false;
let unlocked = false;
let pendingMusic = null;

function ensure() {
  if (ctx) return ctx;
  if (!unlocked) return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.8;
  master.connect(ctx.destination);
  sfxBus = ctx.createGain();
  sfxBus.connect(master);
  musicBus = ctx.createGain();
  musicBus.gain.value = 0.32;
  musicBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  applySettings();
  return ctx;
}

function applySettings() {
  if (!ctx) return;
  sfxBus.gain.value = settings.sound ? 1 : 0;
  musicBus.gain.value = settings.music ? 0.32 : 0;
}

export function unlockAudio() {
  unlocked = true;
  const c = ensure();
  if (c && c.state === 'suspended' && !paused) c.resume();
  if (pendingMusic && c) {
    const k = pendingMusic;
    pendingMusic = null;
    playMusic(k);
  }
}

export function setAudioSettings(s) {
  settings = { ...settings, ...s };
  applySettings();
}

export function setPaused(p) {
  paused = p;
  if (!ctx) return;
  if (p) ctx.suspend();
  else ctx.resume();
}

function noise(dur, { freq = 1000, q = 1, type = 'lowpass', gain = 0.5, attack = 0.002, decay, when = 0, sweep, bus } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + (decay ?? dur));
  src.connect(f).connect(g).connect(bus || sfxBus);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

function tone(freq, dur, { type = 'sine', gain = 0.3, attack = 0.005, when = 0, slide, bus } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(bus || sfxBus);
  o.start(t);
  o.stop(t + dur + 0.05);
}

let lastShot = 0;
export const sfx = {
  click() {
    ensure();
    tone(900, 0.05, { type: 'square', gain: 0.08 });
  },
  buy() {
    ensure();
    tone(660, 0.12, { type: 'triangle', gain: 0.2 });
    tone(990, 0.2, { type: 'triangle', gain: 0.2, when: 0.08 });
    noise(0.15, { freq: 6000, type: 'highpass', gain: 0.08, when: 0.05 });
  },
  error() {
    ensure();
    tone(200, 0.2, { type: 'square', gain: 0.1 });
    tone(150, 0.25, { type: 'square', gain: 0.1, when: 0.1 });
  },
  coin() {
    ensure();
    tone(1200, 0.08, { type: 'square', gain: 0.07 });
    tone(1800, 0.15, { type: 'square', gain: 0.07, when: 0.06 });
  },
  pickup() {
    ensure();
    tone(700, 0.08, { type: 'triangle', gain: 0.18 });
    tone(1050, 0.14, { type: 'triangle', gain: 0.16, when: 0.06 });
  },
  shot(kind = 'bullet') {
    ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now - lastShot < 0.03) return;
    lastShot = now;
    if (kind === 'bullet') {
      noise(0.12, { freq: 2600, sweep: 400, gain: 0.35, decay: 0.1 });
      tone(140, 0.08, { type: 'square', gain: 0.12, slide: 60 });
    } else if (kind === 'shotgun' || kind === 'cannon') {
      noise(0.35, { freq: 1800, sweep: 200, gain: 0.6, decay: 0.3 });
      tone(90, 0.25, { type: 'sine', gain: 0.4, slide: 40 });
    } else if (kind === 'rocket' || kind === 'grenade' || kind === 'mortar' || kind === 'mine') {
      noise(0.5, { freq: 900, sweep: 3000, gain: 0.3, decay: 0.45, type: 'bandpass', q: 0.8 });
    } else if (kind === 'laser') {
      tone(1800, 0.18, { type: 'sawtooth', gain: 0.12, slide: 300 });
    } else if (kind === 'shock') {
      noise(0.25, { freq: 4000, gain: 0.25, type: 'bandpass', q: 3 });
      tone(120, 0.2, { type: 'square', gain: 0.12 });
    } else if (kind === 'flame') {
      noise(0.15, { freq: 700, gain: 0.18, type: 'bandpass', q: 0.6 });
    } else if (kind === 'pistol') {
      noise(0.1, { freq: 3000, sweep: 600, gain: 0.3, decay: 0.09 });
    } else if (kind === 'melee') {
      noise(0.15, { freq: 1200, sweep: 3000, gain: 0.12, type: 'bandpass', q: 2 });
    }
  },
  explosion(big = 1) {
    ensure();
    noise(1.2 * big, { freq: 800, sweep: 60, gain: 0.8, decay: 1.1 * big });
    tone(60, 0.8, { type: 'sine', gain: 0.6, slide: 25 });
  },
  hit() {
    ensure();
    noise(0.12, { freq: 400, gain: 0.5, decay: 0.1 });
    tone(80, 0.12, { type: 'sine', gain: 0.4, slide: 40 });
  },
  crash() {
    ensure();
    noise(0.5, { freq: 1500, sweep: 200, gain: 0.7, decay: 0.45 });
    tone(55, 0.4, { type: 'square', gain: 0.25, slide: 30 });
  },
  splat() {
    ensure();
    noise(0.18, { freq: 600, gain: 0.45, decay: 0.15, type: 'bandpass', q: 1.5 });
  },
  groan() {
    ensure();
    if (!ctx) return;
    const f = 90 + Math.random() * 60;
    tone(f, 0.9, { type: 'sawtooth', gain: 0.05, slide: f * 0.7, attack: 0.15 });
    noise(0.8, { freq: 500, gain: 0.04, type: 'bandpass', q: 4, attack: 0.2 });
  },
  hurt() {
    ensure();
    tone(300, 0.15, { type: 'square', gain: 0.12, slide: 150 });
  },
  type() {
    ensure();
    noise(0.03, { freq: 3500, gain: 0.35, type: 'highpass', decay: 0.025 });
    tone(180 + Math.random() * 60, 0.03, { type: 'square', gain: 0.08 });
  },
  typeBell() {
    ensure();
    tone(1600, 0.6, { type: 'sine', gain: 0.18 });
    tone(2400, 0.4, { type: 'sine', gain: 0.08 });
  },
  gate() {
    ensure();
    noise(1.6, { freq: 300, gain: 0.25, type: 'bandpass', q: 6, attack: 0.1, decay: 1.5 });
    tone(70, 1.5, { type: 'sawtooth', gain: 0.06, attack: 0.2 });
  },
  whoosh() {
    ensure();
    noise(0.6, { freq: 400, sweep: 2000, gain: 0.2, type: 'bandpass', q: 1, attack: 0.2 });
  },
  fuel() {
    ensure();
    noise(0.3, { freq: 900, gain: 0.08, type: 'bandpass', q: 2 });
  },
  reload() {
    ensure();
    noise(0.05, { freq: 3000, gain: 0.2, type: 'highpass' });
    noise(0.05, { freq: 2000, gain: 0.2, type: 'highpass', when: 0.15 });
  },
  lights() {
    ensure();
    tone(120, 0.12, { type: 'square', gain: 0.1 });
    noise(0.08, { freq: 5000, gain: 0.12, type: 'highpass', when: 0.05 });
  },
  wheelTick() {
    ensure();
    tone(1400, 0.02, { type: 'square', gain: 0.05 });
  },
  win() {
    ensure();
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, { type: 'triangle', gain: 0.18, when: i * 0.1 }));
  },
  alarm() {
    ensure();
    tone(880, 0.15, { type: 'square', gain: 0.08 });
    tone(660, 0.15, { type: 'square', gain: 0.08, when: 0.16 });
  },
};

// ------------------------------ двигатель ------------------------------
// Двигатель: основной тон с затухающими гармониками (как у 4-цилиндрового мотора),
// пульсация тактов, суббас и мягкий шум впуска. Всё проходит через фильтр
// и лёгкое насыщение — получается бархатное урчание вместо гудения.

let engine = null;

function engineWave() {
  const n = 16;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  const amps = [0, 1, 0.75, 0.5, 0.42, 0.25, 0.2, 0.12, 0.1, 0.06, 0.05, 0.03, 0.025, 0.015, 0.01, 0.008];
  for (let i = 1; i < n; i++) imag[i] = amps[i] * (i % 2 ? 1 : 0.8);
  return ctx.createPeriodicWave(real, imag);
}

function softClip() {
  const ws = ctx.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) {
    const x = (i / 1023) * 2 - 1;
    curve[i] = Math.tanh(x * 1.8) / Math.tanh(1.8);
  }
  ws.curve = curve;
  return ws;
}

export function engineStart() {
  ensure();
  if (!ctx || engine) return;
  const t = ctx.currentTime;
  const main = ctx.createOscillator();
  main.setPeriodicWave(engineWave());
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  const sec = ctx.createOscillator();
  sec.setPeriodicWave(engineWave());
  sec.detune.value = 9;
  // пульсация тактов: амплитудная модуляция
  const pulse = ctx.createGain();
  pulse.gain.value = 0.75;
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.25;
  lfo.connect(lfoGain).connect(pulse.gain);
  // шум впуска
  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = noiseBuf;
  noiseSrc.loop = true;
  const nf = ctx.createBiquadFilter();
  nf.type = 'bandpass';
  nf.Q.value = 0.9;
  const ng = ctx.createGain();
  ng.gain.value = 0.05;
  noiseSrc.connect(nf).connect(ng);

  const mix = ctx.createGain();
  mix.gain.value = 0.5;
  const subG = ctx.createGain();
  subG.gain.value = 0.55;
  const secG = ctx.createGain();
  secG.gain.value = 0.35;
  main.connect(mix);
  sec.connect(secG).connect(mix);
  sub.connect(subG).connect(mix);
  ng.connect(mix);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 0.8;
  lp.frequency.value = 500;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 35;
  const sat = softClip();
  const out = ctx.createGain();
  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(0.09, t + 0.6);
  mix.connect(pulse).connect(sat).connect(lp).connect(hp).connect(out).connect(sfxBus);
  for (const o of [main, sub, sec, lfo]) o.start(t);
  noiseSrc.start(t);
  engine = { main, sub, sec, lfo, nf, lp, out, lfoGain, noiseSrc, ng };
  engineSet(0, 0.3);
  // стартер
  noise(0.5, { freq: 700, gain: 0.12, type: 'bandpass', q: 3, attack: 0.02, decay: 0.45 });
}

// rpm: 0..1 (холостые … отсечка), load: нагрузка (газ)
export function engineSet(rpm, load = 0.5) {
  if (!engine) return;
  const t = ctx.currentTime;
  const r = Math.max(0, Math.min(1.1, rpm));
  const f = 26 + r * 62; // частота вспышек в цилиндрах, Гц
  const k = 0.12;
  engine.main.frequency.setTargetAtTime(f, t, k);
  engine.sec.frequency.setTargetAtTime(f * 1.5, t, k);
  engine.sub.frequency.setTargetAtTime(f / 2, t, k);
  engine.lfo.frequency.setTargetAtTime(f / 4, t, k);
  engine.lfoGain.gain.setTargetAtTime(0.3 - r * 0.18, t, 0.2);
  engine.nf.frequency.setTargetAtTime(400 + r * 1400, t, k);
  engine.ng.gain.setTargetAtTime(0.03 + load * 0.06, t, 0.15);
  engine.lp.frequency.setTargetAtTime(260 + r * 900 + load * 500, t, k);
  engine.out.gain.setTargetAtTime(0.06 + load * 0.035 + r * 0.02, t, 0.2);
}

export function engineStop() {
  if (!engine) return;
  const e = engine;
  engine = null;
  const t = ctx.currentTime;
  e.main.frequency.setTargetAtTime(18, t, 0.3);
  e.out.gain.setTargetAtTime(0, t, 0.25);
  setTimeout(() => {
    for (const o of [e.main, e.sub, e.sec, e.lfo, e.noiseSrc]) o.stop();
  }, 1500);
}

// ------------------------------ музыка ------------------------------

let music = null;
const SCALE = [0, 3, 5, 7, 10];
function midi(n) {
  return 440 * Math.pow(2, (n - 69) / 12);
}

export function playMusic(kind) {
  ensure();
  if (!ctx) {
    pendingMusic = kind;
    return;
  }
  if (music?.kind === kind) return;
  stopMusic();
  const st = { kind, step: 0, next: ctx.currentTime + 0.1, timer: null };
  const bpm = kind === 'drive' ? 118 : 76;
  const stepDur = 60 / bpm / 2;
  const root = kind === 'drive' ? 40 : 45;
  const prog = [0, -4, -2, -5];
  const tick = () => {
    while (st.next < ctx.currentTime + 0.3) {
      const s = st.step;
      const bar = Math.floor(s / 16) % 4;
      const r = root + prog[bar];
      const when = st.next - ctx.currentTime;
      if (kind === 'drive') {
        if (s % 4 === 0) tone(midi(r), stepDur * 1.6, { type: 'sawtooth', gain: 0.18, when, bus: musicBus });
        if (s % 2 === 1) tone(midi(r + 12), stepDur * 0.8, { type: 'square', gain: 0.05, when, bus: musicBus });
        if (s % 8 === 0) {
          tone(55, 0.25, { type: 'sine', gain: 0.5, when, slide: 35, bus: musicBus });
        }
        if (s % 8 === 4) noise(0.18, { freq: 1800, gain: 0.25, type: 'bandpass', q: 0.8, when, bus: musicBus });
        if (s % 2 === 0) noise(0.05, { freq: 8000, gain: 0.06, type: 'highpass', when, bus: musicBus });
        if (s % 16 === 10 || s % 16 === 14) tone(midi(r + 24 + SCALE[(s >> 2) % 5]), stepDur * 1.5, { type: 'triangle', gain: 0.06, when, bus: musicBus });
      } else {
        if (s % 16 === 0) {
          for (const iv of [0, 7, 12, 15]) tone(midi(r + iv - 12), stepDur * 15, { type: 'triangle', gain: 0.06, attack: 0.8, when, bus: musicBus });
        }
        if (s % 2 === 0) {
          const n = r + 12 + SCALE[(s * 3 + bar) % 5] + ((s >> 3) % 2) * 12;
          tone(midi(n), stepDur * 2.5, { type: 'sine', gain: 0.07, when, bus: musicBus });
        }
        if (s % 8 === 0) tone(50, 0.4, { type: 'sine', gain: 0.25, when, slide: 35, bus: musicBus });
      }
      st.step++;
      st.next += stepDur;
    }
  };
  st.timer = setInterval(tick, 100);
  tick();
  music = st;
}

export function stopMusic() {
  pendingMusic = null;
  if (!music) return;
  clearInterval(music.timer);
  music = null;
}

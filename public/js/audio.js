// Синтезированные звуки (WebAudio) — никаких внешних файлов.

import { state } from './state/store.js';

let ctx = null;
let master = null;
let paused = false;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended' && !paused) ctx.resume();
  master.gain.value = state.settings.sound ? state.settings.volume : 0;
  return ctx;
}

// Браузеры разрешают звук только после действия пользователя
window.addEventListener('pointerdown', () => ensure(), { once: true });

export function setPaused(p) {
  paused = p;
  if (!ctx) return;
  if (p) ctx.suspend();
  else ctx.resume();
}

function tone({ freq = 440, to = null, dur = 0.12, type = 'sine', vol = 0.3, delay = 0, attack = 0.005 }) {
  const c = ensure();
  if (!c || !state.settings.sound || paused) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.15, vol = 0.3, freq = 800, delay = 0 }) {
  const c = ensure();
  if (!c || !state.settings.sound || paused) return;
  const t0 = c.currentTime + delay;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = freq;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start(t0);
}

export const sfx = {
  click: () => tone({ freq: 880, to: 660, dur: 0.06, type: 'triangle', vol: 0.15 }),
  hover: () => tone({ freq: 1200, dur: 0.03, type: 'sine', vol: 0.05 }),
  move: () => {
    tone({ freq: 320, to: 520, dur: 0.12, type: 'triangle', vol: 0.22 });
    noise({ dur: 0.08, vol: 0.15, freq: 1500, delay: 0.25 });
  },
  wall: () => {
    noise({ dur: 0.22, vol: 0.5, freq: 600, delay: 0.3 });
    tone({ freq: 110, to: 60, dur: 0.25, type: 'sine', vol: 0.4, delay: 0.3 });
  },
  error: () => tone({ freq: 180, to: 120, dur: 0.18, type: 'square', vol: 0.08 }),
  tick: () => tone({ freq: 1400, dur: 0.04, type: 'square', vol: 0.05 }),
  coin: () => {
    tone({ freq: 988, dur: 0.08, type: 'square', vol: 0.1 });
    tone({ freq: 1319, dur: 0.25, type: 'square', vol: 0.1, delay: 0.08 });
  },
  win: () => {
    [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.3, type: 'triangle', vol: 0.22, delay: i * 0.12 }));
  },
  lose: () => {
    [392, 330, 262].forEach((f, i) => tone({ freq: f, dur: 0.35, type: 'triangle', vol: 0.2, delay: i * 0.16 }));
  },
  start: () => {
    tone({ freq: 440, dur: 0.1, type: 'triangle', vol: 0.18 });
    tone({ freq: 660, dur: 0.18, type: 'triangle', vol: 0.18, delay: 0.1 });
  },
};

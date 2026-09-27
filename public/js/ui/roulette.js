// Ежедневная рулетка: одно бесплатное вращение в день, ещё — за рекламу.
// Призы: монеты или случайный ещё не купленный скин.

import { h, icon, coinIcon, modal, toast } from './dom.js';
import { sfx } from '../audio.js';
import { state, save, addCoins } from '../state/store.js';
import { SKIN_KINDS } from '../data/skins.js';
import { watchRewarded } from './ads.js';

const SEGMENTS = [
  { coins: 50, weight: 22, color: '#2a4d9c' },
  { skin: true, weight: 8, color: '#8a3cf0' },
  { coins: 100, weight: 18, color: '#1f6f8b' },
  { coins: 250, weight: 8, color: '#b8862c' },
  { coins: 75, weight: 18, color: '#2a4d9c' },
  { skin: true, weight: 8, color: '#c0306a' },
  { coins: 150, weight: 13, color: '#1f6f8b' },
  { coins: 500, weight: 4, color: '#d4a017' },
];
const AD_SPINS_PER_DAY = 3;

const today = () => new Date().toISOString().slice(0, 10);

function spinState() {
  state.spin ||= { day: '', free: false, ads: 0 };
  if (state.spin.day !== today()) state.spin = { day: today(), free: false, ads: 0 };
  return state.spin;
}

export function freeSpinAvailable() {
  return !spinState().free;
}

function randomSkinPrize(preferKinds) {
  const pool = [];
  for (const [kind, def] of Object.entries(SKIN_KINDS)) {
    for (const s of def.list) {
      if (!state.owned[kind].includes(s.id)) pool.push({ kind, skin: s, pref: preferKinds.includes(kind) });
    }
  }
  if (!pool.length) return null;
  const preferred = pool.filter((p) => p.pref);
  const list = preferred.length && Math.random() < 0.75 ? preferred : pool;
  return list[Math.floor(Math.random() * list.length)];
}

function pickSegment() {
  const total = SEGMENTS.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (let i = 0; i < SEGMENTS.length; i++) {
    r -= SEGMENTS[i].weight;
    if (r <= 0) return i;
  }
  return 0;
}

function drawWheel(canvas, rotation) {
  const ctx = canvas.getContext('2d');
  const S = canvas.width;
  const c = S / 2;
  const R = c - 10;
  ctx.clearRect(0, 0, S, S);
  const seg = (Math.PI * 2) / SEGMENTS.length;
  // Внешнее кольцо с лампочками
  ctx.fillStyle = '#16213d';
  ctx.beginPath();
  ctx.arc(c, c, R + 8, 0, Math.PI * 2);
  ctx.fill();
  SEGMENTS.forEach((s, i) => {
    const a0 = rotation + i * seg - Math.PI / 2 - seg / 2;
    const g = ctx.createRadialGradient(c, c, R * 0.2, c, c, R);
    g.addColorStop(0, s.color);
    g.addColorStop(1, shade(s.color, -0.35));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.arc(c, c, R, a0, a0 + seg);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(a0 + seg / 2);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 6;
    ctx.font = `800 ${Math.round(S * 0.07)}px "Segoe UI", Arial, sans-serif`;
    ctx.fillText(s.skin ? 'СКИН' : String(s.coins), R - 18, 0);
    ctx.restore();
  });
  for (let i = 0; i < 24; i++) {
    const a = rotation + (i / 24) * Math.PI * 2;
    ctx.fillStyle = i % 2 ? '#ffd35a' : '#fff6d6';
    ctx.beginPath();
    ctx.arc(c + Math.cos(a) * (R + 4), c + Math.sin(a) * (R + 4), 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  const hub = ctx.createRadialGradient(c - 8, c - 8, 4, c, c, 34);
  hub.addColorStop(0, '#fff3b0');
  hub.addColorStop(1, '#c98a0c');
  ctx.fillStyle = hub;
  ctx.beginPath();
  ctx.arc(c, c, 30, 0, Math.PI * 2);
  ctx.fill();
}

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + v * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

export function openRoulette({ preferKinds = [], thumb, onSkin } = {}) {
  const canvas = h('canvas', { class: 'wheel', width: 360, height: 360 });
  let rotation = 0;
  drawWheel(canvas, rotation);
  const info = h('p', { class: 'wheel-info' });
  const spinBtn = h('button', { class: 'btn primary huge' }, icon('wheel'), 'Крутить');
  const adBtn = h('button', { class: 'btn gold' }, icon('video'), 'Ещё вращение за рекламу');
  let spinning = false;

  const update = () => {
    const st = spinState();
    spinBtn.style.display = st.free ? 'none' : '';
    adBtn.style.display = st.free && st.ads < AD_SPINS_PER_DAY ? '' : 'none';
    info.textContent = st.free ? (st.ads < AD_SPINS_PER_DAY ? `Бесплатное вращение уже использовано. За рекламу — ещё ${AD_SPINS_PER_DAY - st.ads}.` : 'На сегодня вращения закончились. Приходите завтра!') : 'Одно бесплатное вращение каждый день!';
  };

  const spin = () => {
    if (spinning) return;
    spinning = true;
    const idx = pickSegment();
    const seg = (Math.PI * 2) / SEGMENTS.length;
    // Колесо останавливается так, чтобы сектор idx оказался под стрелкой сверху
    const target = -idx * seg + (Math.random() - 0.5) * seg * 0.6;
    const start = rotation;
    const end = target - Math.PI * 2 * 6 - (((start % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2));
    const t0 = performance.now();
    const dur = 4200;
    let lastTick = 0;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      const e = 1 - (1 - k) ** 4;
      rotation = start + (end - start) * e;
      drawWheel(canvas, rotation);
      const tick = Math.floor((rotation / seg) * 1);
      if (tick !== lastTick) {
        lastTick = tick;
        sfx.tick();
      }
      if (k < 1) requestAnimationFrame(step);
      else {
        spinning = false;
        award(SEGMENTS[idx]);
        update();
      }
    };
    requestAnimationFrame(step);
  };

  const award = (s) => {
    if (s.skin) {
      const prize = randomSkinPrize(preferKinds);
      if (prize) {
        state.owned[prize.kind].push(prize.skin.id);
        save();
        sfx.win();
        modal({
          title: 'Новый скин!',
          body: h('div', { style: { textAlign: 'center' } }, thumb ? h('img', { class: 'modal-thumb', src: thumb(prize.kind, prize.skin), alt: '' }) : null, h('p', {}, `${SKIN_KINDS[prize.kind].title}: «${prize.skin.name}» теперь ваш.`)),
          buttons: [
            { label: 'Отлично', kind: 'ghost' },
            { label: 'Надеть', kind: 'primary', onClick: () => onSkin?.(prize.kind, prize.skin.id) },
          ],
        });
        return;
      }
      addCoins(300);
      toast('Все скины уже собраны — вот 300 монет!', 'success');
      sfx.coin();
      return;
    }
    addCoins(s.coins);
    sfx.coin();
    modal({ title: 'Выигрыш!', body: h('div', { class: 'result win' }, h('div', { class: 'reward' }, '+', String(s.coins), coinIcon())), buttons: [{ label: 'Забрать', kind: 'primary' }] });
  };

  spinBtn.addEventListener('click', () => {
    const st = spinState();
    if (st.free || spinning) return;
    st.free = true;
    save();
    update();
    spin();
  });
  adBtn.addEventListener('click', async () => {
    const st = spinState();
    if (spinning || st.ads >= AD_SPINS_PER_DAY) return;
    if (!(await watchRewarded())) {
      toast('Реклама сейчас недоступна');
      return;
    }
    st.ads++;
    save();
    update();
    spin();
  });
  update();
  modal({
    title: 'Ежедневная рулетка',
    cls: 'roulette',
    body: h('div', { class: 'wheel-wrap' }, h('div', { class: 'wheel-box' }, canvas, h('div', { class: 'wheel-pointer' })), info, spinBtn, adBtn),
  });
}

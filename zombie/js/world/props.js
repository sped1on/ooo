// Модели окружения: природа, постройки, объекты на дороге, заправка, лагерь бандитов, база.
// Каждая функция возвращает GeoBuilder (цвета в вершинах); результаты кэшируются.

import * as THREE from 'three';
import { GeoBuilder } from '../engine/geo.js';
import { Rng } from '../engine/util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const cache = new Map();
function cached(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

// ------------------------------ природа ------------------------------

export function spruce(v = 0, snow = false) {
  return cached(`spruce${v}${snow}`, () => {
    const b = new GeoBuilder();
    const r = new Rng(10 + v);
    const h = 6 + v * 1.5;
    b.cyl(0.14, 0.22, 1.4, 6, '#5a3e26', { y: 0.7 });
    const greens = ['#2f5a2e', '#335f30', '#2a4f2a'];
    const n = 4;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const rad = (1.9 - t * 1.3) * (1 + v * 0.1);
      const y = 1.2 + t * (h - 2.2);
      b.cone(rad, 2.4 - t * 0.6, 7, r.pick(greens), { y: y + 1.1, ry: r.f(0, 3) }, { jitter: 0.12 });
      if (snow) b.cone(rad * 0.7, 0.9, 7, '#eef3f8', { y: y + 1.9, ry: r.f(0, 3) });
    }
    return b;
  });
}

export function pine(v = 0) {
  return cached(`pine${v}`, () => {
    const b = new GeoBuilder();
    const r = new Rng(30 + v);
    const h = 7 + v * 1.5;
    b.cyl(0.13, 0.22, h, 6, '#8a5a34', { y: h / 2 });
    for (let i = 0; i < 5; i++) {
      b.ico(r.f(0.9, 1.4), 0, r.pick(['#3a6a32', '#2f5f2c', '#46763a']), { x: r.f(-0.9, 0.9), y: h - r.f(0, 1.6), z: r.f(-0.9, 0.9), sy: 0.7 }, { jitter: 0.1 });
    }
    b.plank(V(0, h * 0.6, 0), V(0.9, h * 0.75, 0.3), 0.08, 0.08, '#6a4428');
    return b;
  });
}

export function birch(v = 0, autumn = false) {
  return cached(`birch${v}${autumn}`, () => {
    const b = new GeoBuilder();
    const r = new Rng(50 + v);
    const h = 5.5 + v;
    b.cyl(0.11, 0.16, h, 6, '#e8e4da', { y: h / 2 });
    for (let i = 0; i < 6; i++) b.box(0.24, 0.06, 0.24, '#2a2a2a', { y: 0.6 + i * 0.7 + r.f(0, 0.3), ry: r.f(0, 3), s: 0.8 });
    const cols = autumn ? ['#d0762a', '#c9521e', '#e0a02a'] : ['#6f9a3a', '#7faa44', '#5f8a34'];
    for (let i = 0; i < 5; i++) {
      b.ico(r.f(1.0, 1.5), 1, r.pick(cols), { x: r.f(-0.9, 0.9), y: h - 0.5 + r.f(-0.6, 0.9), z: r.f(-0.9, 0.9) }, { jitter: 0.12 });
    }
    return b;
  });
}

export function deadTree(v = 0) {
  return cached(`dead${v}`, () => {
    const b = new GeoBuilder();
    const r = new Rng(70 + v);
    const h = 4.5 + v;
    const col = '#5a4634';
    b.cyl(0.1, 0.22, h, 6, col, { y: h / 2 });
    for (let i = 0; i < 5; i++) {
      const y = h * r.f(0.45, 0.95);
      const a = r.f(0, Math.PI * 2);
      const l = r.f(0.8, 1.8);
      b.beam(V(0, y, 0), V(Math.cos(a) * l, y + r.f(0.4, 1.2), Math.sin(a) * l), 0.05, col, 5);
    }
    return b;
  });
}

export function bush(v = 0, col = '#4f7a34') {
  return cached(`bush${v}${col}`, () => {
    const b = new GeoBuilder();
    const r = new Rng(90 + v);
    for (let i = 0; i < 4; i++) b.ico(r.f(0.5, 0.9), 0, col, { x: r.f(-0.6, 0.6), y: 0.4, z: r.f(-0.6, 0.6), sy: 0.75 }, { jitter: 0.2 });
    return b;
  });
}

export function rock(v = 0, col = '#8a8580') {
  return cached(`rock${v}${col}`, () => {
    const b = new GeoBuilder();
    const r = new Rng(110 + v);
    b.dodeca(1, col, { y: 0.3, sx: r.f(0.8, 1.4), sy: r.f(0.5, 0.9), sz: r.f(0.8, 1.3), ry: r.f(0, 3) }, { jitter: 0.15 });
    if (v % 2) b.dodeca(0.5, col, { x: 0.9, y: 0.15, sy: 0.7 }, { jitter: 0.15 });
    return b;
  });
}

export function cliff(v = 0, col = '#7f7a74') {
  return cached(`cliff${v}${col}`, () => {
    const b = new GeoBuilder();
    const r = new Rng(130 + v);
    for (let i = 0; i < 5; i++) {
      b.dodeca(r.f(2, 3.5), col, { x: r.f(-3, 3), y: r.f(1, 3), z: r.f(-3, 3), sy: r.f(1.2, 2.2), ry: r.f(0, 3) }, { jitter: 0.12 });
    }
    return b;
  });
}

// Простая ёлка для дальнего леса (мало треугольников — их тысячи)
export function farTree(v = 0, snow = false) {
  return cached(`far${v}${snow}`, () => {
    const b = new GeoBuilder();
    const cols = ['#27492a', '#2f5530', '#223f24', '#35602f'];
    b.cyl(0.15, 0.2, 1.2, 5, '#4a3424', { y: 0.6 });
    b.cone(1.9, 4.2, 7, cols[v % 4], { y: 3.0, ry: v });
    b.cone(1.3, 3.2, 7, cols[(v + 1) % 4], { y: 5.2, ry: v + 1 });
    if (snow) b.cone(0.9, 1.2, 7, '#eef3f8', { y: 6.4 });
    return b;
  });
}

export function grassTuft(col = '#7f8a3e') {
  return cached(`grass${col}`, () => {
    const b = new GeoBuilder();
    const r = new Rng(150);
    for (let i = 0; i < 7; i++) {
      b.cone(0.07, r.f(0.5, 0.9), 3, col, { x: r.f(-0.3, 0.3), y: 0.3, z: r.f(-0.3, 0.3), rx: r.f(-0.3, 0.3), rz: r.f(-0.3, 0.3) });
    }
    return b;
  });
}

export function stump() {
  return cached('stump', () => {
    const b = new GeoBuilder();
    b.cyl(0.35, 0.45, 0.6, 8, '#6a4a2e', { y: 0.3 });
    b.cyl(0.33, 0.33, 0.02, 8, '#c8a070', { y: 0.61 });
    b.box(0.6, 0.12, 0.12, '#5a3e26', { x: 0.4, y: 0.06, ry: 0.4 });
    return b;
  });
}

// ------------------------------ постройки ------------------------------

const MW = { mat: 'wood' };
const MP = { mat: 'plank' };
const MM = { mat: 'metal' };
const MR = { mat: 'roofm' };
const MB = { mat: 'brick' };
const MC = { mat: 'concrete' };

// Окно: рама, стекло с отражением, переплёт, подоконник. Смотрит в +Z (поворот ry).
function win(b, x, y, z, w, h, { ry = 0, broken = false, frame = '#e8e2d4', shutters = null } = {}) {
  const g = new GeoBuilder();
  g.box(w + 0.16, h + 0.16, 0.08, frame, { z: 0.02 });
  g.box(w, h, 0.1, broken ? '#0c0d0f' : '#2c3e4e', { z: 0.03 });
  if (!broken) {
    g.box(w * 0.4, h * 0.35, 0.02, '#5a7488', { x: -w * 0.18, y: h * 0.18, z: 0.085 });
    g.box(0.05, h, 0.12, frame, { z: 0.04 });
    g.box(w, 0.05, 0.12, frame, { y: h * 0.1, z: 0.04 });
  } else {
    g.box(w * 0.3, h * 0.25, 0.02, '#4a6070', { x: w * 0.25, y: -h * 0.3, z: 0.085, rz: 0.4 });
  }
  g.box(w + 0.3, 0.06, 0.2, frame, { y: -h / 2 - 0.1, z: 0.08 });
  if (shutters) for (const sx of [-1, 1]) g.box(w * 0.5, h + 0.1, 0.05, shutters, { x: sx * (w * 0.75 + 0.1), z: 0.06 }, MP);
  b.merge(g, { x, y, z, ry });
}

function door(b, x, y, z, w, h, col = '#5a3e26', ry = 0) {
  const g = new GeoBuilder();
  g.box(w + 0.2, h + 0.1, 0.1, '#3a2a1c', { y: h / 2 + 0.05, z: 0.02 });
  g.box(w, h, 0.08, col, { y: h / 2, z: 0.06 }, MP);
  g.box(0.06, 0.04, 0.06, '#c8b070', { x: w * 0.35, y: h * 0.48, z: 0.13 });
  b.merge(g, { x, y, z, ry });
}

export function house(v = 0) {
  return cached(`house${v}`, () => {
    const b = new GeoBuilder();
    const wall = ['#9a8068', '#7a8a98', '#8a9a7a'][v % 3];
    const roof = ['#9a5030', '#6a7078', '#56745a'][v % 3];
    const trim = '#e8e2d4';
    const L = 7;
    const D = 6;
    const H = 3;
    // фундамент
    b.box(L + 0.4, 0.5, D + 0.4, '#8a8680', { y: 0.25 }, MC);
    // стены из досок
    b.box(L, H, 0.18, wall, { y: 0.5 + H / 2, z: D / 2 - 0.09 }, MW);
    b.box(L, H, 0.18, wall, { y: 0.5 + H / 2, z: -D / 2 + 0.09 }, MW);
    b.box(0.18, H, D - 0.36, wall, { x: L / 2 - 0.09, y: 0.5 + H / 2 }, MW);
    b.box(0.18, H, D - 0.36, wall, { x: -L / 2 + 0.09, y: 0.5 + H / 2 }, MW);
    // угловые стойки и пояс
    for (const x of [-1, 1]) for (const z of [-1, 1]) b.box(0.26, H + 0.05, 0.26, trim, { x: x * (L / 2 + 0.02), y: 0.5 + H / 2, z: z * (D / 2 + 0.02) });
    b.box(L + 0.1, 0.12, 0.06, trim, { y: 0.56, z: D / 2 + 0.02 });
    // фронтоны
    const gs = new THREE.Shape();
    gs.moveTo(-D / 2, 0);
    gs.lineTo(D / 2, 0);
    gs.lineTo(0, 2.1);
    gs.closePath();
    const gg = new THREE.ExtrudeGeometry(gs, { depth: 0.18, bevelEnabled: false });
    for (const sx of [1, -1]) b.add(gg, wall, { x: sx * (L / 2 - 0.09) - 0.09, y: 0.5 + H, ry: Math.PI / 2 }, MW);
    // крыша со свесами
    const half = D / 2 + 0.6;
    const ang = Math.atan2(2.1, D / 2);
    const slope = half / Math.cos(ang);
    for (const sz of [1, -1]) {
      b.box(L + 1.0, 0.14, slope, roof, { y: 0.5 + H + 2.1 / 2 + 0.12 - 0.3, z: (sz * slope * Math.cos(ang)) / 2 - sz * 0.05, rx: sz * ang }, MR);
      b.box(L + 1.0, 0.2, 0.06, '#4a3a2a', { y: 0.5 + H - 0.42, z: sz * (half - 0.02) });
    }
    b.box(L + 1.05, 0.14, 0.3, '#3a3e44', { y: 0.5 + H + 2.25 });
    // окна со ставнями
    const sh = ['#6a3a2a', '#3a5a7a', '#4a6a3a'][v % 3];
    win(b, -1.9, 2.2, D / 2, 1.1, 1.2, { shutters: sh, broken: v === 2 });
    win(b, 1.9, 2.2, D / 2, 1.1, 1.2, { shutters: sh });
    win(b, L / 2, 2.2, 0.8, 1.1, 1.2, { ry: Math.PI / 2, shutters: sh });
    win(b, -L / 2, 2.2, -0.8, 1.1, 1.2, { ry: -Math.PI / 2, broken: true });
    win(b, 0, 2.2, -D / 2, 1.0, 1.1, { ry: Math.PI });
    // дверь и крыльцо
    door(b, 0, 0.5, D / 2, 1.0, 2.1);
    b.box(2.8, 0.18, 1.6, '#7a6048', { y: 0.46, z: D / 2 + 0.8 }, MP);
    for (let i = 0; i < 2; i++) b.box(1.4, 0.16, 0.34, '#6a5038', { y: 0.12 + i * 0.16, z: D / 2 + 1.75 - i * 0.3 }, MP);
    for (const x of [-1.3, 1.3]) b.box(0.14, 2.4, 0.14, trim, { x, y: 1.75, z: D / 2 + 1.5 });
    b.box(3.1, 0.1, 1.9, roof, { y: 3.0, z: D / 2 + 0.85, rx: -0.18 }, MR);
    // перила
    for (const x of [-1.3, 1.3]) b.box(0.06, 0.06, 1.4, trim, { x, y: 1.3, z: D / 2 + 0.8 });
    // труба
    b.box(0.6, 1.8, 0.6, '#a8664a', { x: 2.0, y: 4.8, z: -0.8 }, MB);
    b.box(0.72, 0.1, 0.72, '#6a6a66', { x: 2.0, y: 5.72, z: -0.8 });
    // водосток
    b.cyl(0.05, 0.05, H, 6, '#8a8e94', { x: L / 2 + 0.25, y: 0.5 + H / 2, z: D / 2 + 0.3 });
    // поленница и бочка
    for (let i = 0; i < 9; i++) b.cyl(0.1, 0.1, 1.0, 6, i % 2 ? '#8a6038' : '#7a5230', { x: -L / 2 - 0.4, y: 0.12 + Math.floor(i / 3) * 0.2, z: -1.2 + (i % 3) * 0.22, rx: Math.PI / 2 });
    b.cyl(0.3, 0.3, 0.9, 10, '#4a5a6a', { x: L / 2 + 0.6, y: 0.45, z: -1.5 }, MM);
    return b;
  });
}

export function ruin(v = 0) {
  return cached(`ruin${v}`, () => {
    const b = new GeoBuilder();
    const c = v ? '#c4a68e' : '#b8b2a6';
    const m = v ? MB : MC;
    const W = 9;
    const D = 7;
    const r = new Rng(200 + v);
    // стены (две половины, у одной обвалился верх)
    b.box(W, 6.4, 0.3, c, { y: 3.2, z: D / 2 - 0.15 }, m);
    b.box(W, 6.4, 0.3, c, { y: 3.2, z: -D / 2 + 0.15 }, m);
    b.box(0.3, 6.4, D - 0.6, c, { x: -W / 2 + 0.15, y: 3.2 }, m);
    b.box(0.3, 4.2, D - 0.6, c, { x: W / 2 - 0.15, y: 2.1 }, m);
    // межэтажные плиты и парапет
    for (const y of [0.15, 3.2]) b.box(W + 0.3, 0.3, D + 0.3, '#8a8680', { y }, MC);
    b.box(W + 0.2, 0.4, 0.4, '#8a8680', { y: 6.5, z: D / 2 - 0.1 }, MC);
    b.box(0.4, 0.4, D, '#8a8680', { x: -W / 2 + 0.1, y: 6.5 }, MC);
    // обрушенный угол: неровные куски
    for (let i = 0; i < 6; i++) b.box(r.f(0.5, 1.4), r.f(0.4, 1.2), r.f(0.3, 0.5), c, { x: W / 2 - r.f(0.3, 3), y: 4.2 + r.f(0, 1.6), z: D / 2 - 0.2, rz: r.f(-0.4, 0.4) }, m);
    // окна (выбиты), дверной проём
    for (let f = 0; f < 2; f++) {
      for (let i = 0; i < 3; i++) {
        win(b, -3 + i * 3, 1.9 + f * 3.1, D / 2, 1.2, 1.4, { broken: true, frame: '#6a6660' });
        win(b, -3 + i * 3, 1.9 + f * 3.1, -D / 2, 1.2, 1.4, { ry: Math.PI, broken: true, frame: '#6a6660' });
      }
    }
    b.box(1.6, 2.4, 0.34, '#101112', { x: -3, y: 1.35, z: D / 2 - 0.1 });
    // балкон с перилами
    b.box(2.4, 0.15, 1.0, '#8a8680', { x: 3, y: 3.15, z: D / 2 + 0.5 }, MC);
    for (let i = 0; i < 7; i++) b.box(0.04, 0.9, 0.04, '#3a3e44', { x: 1.9 + i * 0.37, y: 3.65, z: D / 2 + 0.95 });
    b.box(2.4, 0.05, 0.05, '#3a3e44', { x: 3, y: 4.1, z: D / 2 + 0.95 });
    // арматура и мусор
    for (let i = 0; i < 5; i++) b.beam(V(W / 2 - 0.2 - i * 0.4, 4.2, D / 2 - 0.15), V(W / 2 - 0.1 - i * 0.45, 4.9 + r.f(0, 0.6), D / 2 - 0.1 + r.f(-0.2, 0.2)), 0.02, '#6a4a30', 4);
    for (let i = 0; i < 12; i++) b.box(r.f(0.3, 1.0), r.f(0.2, 0.6), r.f(0.3, 1.0), r.chance(0.5) ? c : '#8a8680', { x: r.f(-W / 2, W / 2 + 1.5), y: 0.15, z: D / 2 + r.f(0.4, 2.5), ry: r.f(0, 3), rx: r.f(-0.3, 0.3) }, m);
    return b;
  });
}

export function hangar() {
  return cached('hangar', () => {
    const b = new GeoBuilder();
    const g = new THREE.CylinderGeometry(6, 6, 16, 18, 1, true, -Math.PI / 2, Math.PI);
    b.add(g, '#9aa2a8', { rx: Math.PI / 2, rz: Math.PI / 2, y: 0 }, MR);
    for (let i = 0; i < 9; i++) b.add(new THREE.TorusGeometry(6.03, 0.07, 4, 18, Math.PI), '#5a6068', { z: -8 + i * 2 });
    // торцы с воротами
    const endShape = new THREE.Shape();
    endShape.absarc(0, 0, 6, 0, Math.PI, false);
    endShape.closePath();
    const eg = new THREE.ExtrudeGeometry(endShape, { depth: 0.12, bevelEnabled: false, curveSegments: 18 });
    b.add(eg, '#8a929a', { z: 7.9 }, MM);
    b.add(eg, '#8a929a', { z: -8.02 }, MM);
    b.box(6.2, 4.4, 0.14, '#5a6068', { y: 2.2, z: 8.05 }, MM);
    b.box(0.08, 4.4, 0.16, '#2a2c30', { y: 2.2, z: 8.1 });
    for (const x of [-3.2, 3.2]) b.box(0.25, 4.6, 0.3, '#3a3e44', { x, y: 2.3, z: 8.08 });
    b.box(6.8, 0.25, 0.3, '#3a3e44', { y: 4.6, z: 8.08 });
    // окна-полоса и дверь
    for (let i = 0; i < 4; i++) win(b, -4.4 + (i > 1 ? 7.6 : 0) + (i % 2) * 1.2, 5.0, 8.0, 0.9, 0.6, { frame: '#3a3e44' });
    door(b, 4.4, 0, 8.02, 0.9, 2.0, '#4a5a6a');
    // бетонная площадка и бочки
    b.box(14, 0.12, 5, '#8a8680', { y: 0.06, z: 10.5 }, MC);
    b.merge(barrels(3, 3), { x: -5, z: 10 });
    return b;
  });
}

export function watchtower() {
  return cached('tower', () => {
    const b = new GeoBuilder();
    const wood = '#8a6a48';
    const h = 7;
    for (const x of [-1.3, 1.3]) {
      for (const z of [-1.3, 1.3]) {
        b.beam(V(x * 1.2, 0, z * 1.2), V(x, h, z), 0.13, wood, 6, MW);
        b.box(0.5, 0.3, 0.5, '#8a8680', { x: x * 1.2, y: 0.15, z: z * 1.2 }, MC);
      }
    }
    for (let k = 0; k < 2; k++) {
      const y0 = k * 3.3;
      const y1 = y0 + 3.3;
      b.beam(V(-1.5, y0, 1.45), V(1.45, y1, 1.35), 0.06, wood, 5, MW);
      b.beam(V(-1.5, y0, -1.45), V(1.45, y1, -1.35), 0.06, wood, 5, MW);
      b.beam(V(1.45, y0, -1.5), V(1.35, y1, 1.45), 0.06, wood, 5, MW);
      b.beam(V(-1.45, y0, -1.5), V(-1.35, y1, 1.45), 0.06, wood, 5, MW);
    }
    b.box(3.5, 0.2, 3.5, '#7a5a3a', { y: h }, MP);
    for (const sz of [-1, 1]) {
      b.box(3.5, 1.0, 0.08, wood, { y: h + 0.6, z: sz * 1.7 }, MW);
      b.box(0.08, 1.0, 3.5, wood, { y: h + 0.6, x: sz * 1.7 }, MW);
    }
    for (const x of [-1.66, 1.66]) for (const z of [-1.66, 1.66]) b.box(0.12, 2.3, 0.12, wood, { x, y: h + 1.15, z }, MW);
    // крыша-пирамида из профлиста и прожектор
    b.add(new THREE.ConeGeometry(2.8, 1.3, 4, 1), '#8a4a30', { y: h + 2.9, ry: Math.PI / 4 }, MR);
    b.box(0.4, 0.3, 0.35, '#2a2c30', { x: 1.2, y: h + 1.3, z: 1.4 });
    // лестница
    b.beam(V(0.35, 0, 2.4), V(0.3, h, 1.6), 0.05, wood, 5, MW);
    b.beam(V(-0.35, 0, 2.4), V(-0.3, h, 1.6), 0.05, wood, 5, MW);
    for (let i = 1; i < 12; i++) {
      const t = i / 12;
      b.box(0.7, 0.05, 0.08, wood, { y: t * h, z: 2.4 - t * 0.8 });
    }
    // мешки с песком на площадке
    for (let i = 0; i < 4; i++) b.box(0.55, 0.22, 0.35, '#a8966a', { x: -1.0 + i * 0.6, y: h + 0.22, z: 1.45 });
    return b;
  });
}

export function bunker() {
  return cached('bunker', () => {
    const b = new GeoBuilder();
    b.cyl(4, 4.5, 2.2, 16, '#9a9890', { y: 1.1 }, MC);
    b.add(new THREE.SphereGeometry(4, 16, 5, 0, Math.PI * 2, 0, Math.PI / 2), '#8f8d86', { y: 2.2, sy: 0.35 }, MC);
    // бойницы
    for (const a of [-0.6, 0, 0.6]) b.box(1.2, 0.3, 0.4, '#101112', { x: Math.sin(a) * 4.1, y: 1.7, z: Math.cos(a) * 4.1, ry: a });
    // вход
    b.box(2.0, 2.2, 2.4, '#8a8880', { y: 1.1, z: -4.4 }, MC);
    b.box(1.2, 1.8, 0.1, '#4a5040', { y: 0.95, z: -5.62 }, MM);
    b.box(0.1, 0.1, 0.12, '#c8b070', { x: 0.4, y: 1.0, z: -5.7 });
    // мешки и маскировочная сетка
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      if (Math.abs(a - Math.PI) < 0.5) continue;
      b.box(0.8, 0.35, 0.45, '#a8966a', { x: Math.sin(a) * 4.8, y: 0.18, z: Math.cos(a) * 4.8, ry: a }, { jitter: 0.1 });
    }
    b.add(new THREE.SphereGeometry(4.3, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2), '#5a6a3a', { y: 2.3, sy: 0.3 }, { jitter: 0.25 });
    return b;
  });
}

export function garageShed(v = 0) {
  return cached(`garage${v}`, () => {
    const b = new GeoBuilder();
    const c = ['#b8765a', '#a8a49c'][v % 2];
    const m = v % 2 ? MC : MB;
    b.box(5, 3, 0.2, c, { y: 1.5, z: -3.4 }, m);
    b.box(0.2, 3, 6.8, c, { x: 2.4, y: 1.5 }, m);
    b.box(0.2, 3, 6.8, c, { x: -2.4, y: 1.5 }, m);
    b.box(0.7, 3, 0.2, c, { x: 2.15, y: 1.5, z: 3.4 }, m);
    b.box(0.7, 3, 0.2, c, { x: -2.15, y: 1.5, z: 3.4 }, m);
    b.box(5, 0.5, 0.2, c, { y: 2.75, z: 3.4 }, m);
    // плоская крыша с отливом
    b.box(5.5, 0.2, 7.4, '#4a4a4a', { y: 3.1, z: 0.1, rx: 0.02 }, MR);
    b.box(5.5, 0.12, 0.12, '#8a8e94', { y: 2.95, z: 3.8 });
    // рольставня
    b.box(3.6, 2.5, 0.08, '#8a9098', { y: 1.25, z: 3.35 }, MR);
    b.box(3.8, 0.3, 0.35, '#5a6068', { y: 2.55, z: 3.4 });
    // фонарь над воротами и окошко
    b.box(0.3, 0.15, 0.25, '#2a2c30', { y: 2.75, z: 3.6 });
    win(b, 2.5, 1.9, 1.5, 0.7, 0.5, { ry: Math.PI / 2, frame: '#5a5a58' });
    // пятно масла и канистры
    b.box(1.2, 0.01, 0.9, '#2a2622', { y: 0.015, z: 4.2 });
    b.box(0.3, 0.45, 0.18, '#c0261c', { x: -2.8, y: 0.23, z: 3.0 });
    b.box(0.3, 0.45, 0.18, '#3a6a3a', { x: -2.8, y: 0.23, z: 2.6 });
    return b;
  });
}

// ------------------------------ окружение ------------------------------

export function fence(len = 4, broken = false) {
  return cached(`fence${len}${broken}`, () => {
    const b = new GeoBuilder();
    const wood = '#6a5238';
    const r = new Rng(len * 7 + (broken ? 1 : 0));
    for (let x = -len / 2; x <= len / 2 + 0.01; x += 2) b.box(0.14, 1.5, 0.14, '#4a3828', { x, y: 0.75 });
    for (const y of [0.5, 1.1]) b.box(len, 0.1, 0.06, wood, { y, z: 0.08 }, MW);
    for (let x = -len / 2 + 0.15; x < len / 2; x += 0.3) {
      if (broken && r.chance(0.3)) continue;
      const hh = r.f(1.2, 1.45);
      b.box(0.22, hh, 0.04, r.chance(0.5) ? '#9a8266' : '#8a7458', { x, y: hh / 2 + 0.05, z: 0.13, rz: r.f(-0.03, 0.03) }, MP);
    }
    return b;
  });
}

export function barrels(n = 3, v = 0) {
  return cached(`barrels${n}${v}`, () => {
    const b = new GeoBuilder();
    const cols = ['#8a3a22', '#3a5a7a', '#6a6a2a', '#9a4a1e'];
    const r = new Rng(300 + n + v);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const c = r.pick(cols);
      const x = Math.cos(a) * 0.5 * (n > 1);
      const z = Math.sin(a) * 0.5 * (n > 1);
      b.cyl(0.3, 0.3, 0.9, 10, c, { x, y: 0.45, z }, { jitter: 0.1 });
      b.cyl(0.31, 0.31, 0.05, 10, '#2a2a2a', { x, y: 0.3, z });
      b.cyl(0.31, 0.31, 0.05, 10, '#2a2a2a', { x, y: 0.62, z });
    }
    return b;
  });
}

export function redBarrel() {
  return cached('redbarrel', () => {
    const b = new GeoBuilder();
    b.cyl(0.34, 0.34, 1.0, 12, '#c0261c', { y: 0.5 });
    b.cyl(0.35, 0.35, 0.06, 12, '#2a2a2a', { y: 0.33 });
    b.cyl(0.35, 0.35, 0.06, 12, '#2a2a2a', { y: 0.68 });
    b.box(0.3, 0.2, 0.02, '#e0c020', { y: 0.55, z: 0.34 });
    return b;
  });
}

export function crate(v = 0) {
  return cached(`crate${v}`, () => {
    const b = new GeoBuilder();
    const c = v ? '#8a6a3a' : '#a07840';
    b.box(1, 1, 1, c, { y: 0.5 }, MP);
    for (const s of [-1, 1]) {
      b.box(1.02, 0.12, 0.12, '#5a3e22', { y: 0.5 + s * 0.44, z: 0.46 });
      b.box(0.12, 1.02, 0.12, '#5a3e22', { x: s * 0.44, y: 0.5, z: 0.46 });
      b.box(1.02, 0.12, 0.12, '#5a3e22', { y: 0.5 + s * 0.44, z: -0.46 });
    }
    b.plank(V(-0.44, 0.06, 0.5), V(0.44, 0.94, 0.5), 0.1, 0.02, '#5a3e22');
    return b;
  });
}

export function crates() {
  return cached('crates', () => {
    const b = new GeoBuilder();
    b.merge(crate(0), { x: -0.55, ry: 0.1 });
    b.merge(crate(1), { x: 0.6, ry: -0.2, s: 0.9 });
    b.merge(crate(0), { y: 1, x: 0, ry: 0.4, s: 0.85 });
    return b;
  });
}

export function wreck(v = 0) {
  return cached(`wreck${v}`, () => {
    const b = new GeoBuilder();
    const cols = ['#8a4a2a', '#5a6a7a', '#6a6a4a', '#7a2a22', '#4a4a4a'];
    const c = cols[v % cols.length];
    const r = new Rng(400 + v);
    b.box(1.8, 0.65, 4.4, c, { y: 0.62 }, { jitter: 0.15 });
    b.box(1.6, 0.55, 2, c, { y: 1.2, z: -0.3 }, { jitter: 0.15 });
    b.box(1.5, 0.45, 1.9, '#1a1e22', { y: 1.2, z: -0.3 });
    b.box(1.82, 0.2, 4.45, '#3a2a1e', { y: 0.35 });
    for (const x of [-0.8, 0.8]) {
      for (const z of [-1.4, 1.4]) {
        if (r.chance(0.2)) continue;
        b.cyl(0.34, 0.34, 0.24, 10, '#1d1d1f', { x, y: 0.3, z, rz: Math.PI / 2 });
      }
    }
    // ржавчина
    for (let i = 0; i < 6; i++) b.box(r.f(0.3, 0.8), 0.02, r.f(0.3, 0.8), '#6a3a1a', { x: r.f(-0.6, 0.6), y: 0.95, z: r.f(-2, 2) });
    if (v % 2) b.box(1.7, 0.1, 1.3, '#3a2a1e', { y: 1.0, z: 1.6, rx: -0.3 }); // открытый капот
    return b;
  });
}

export function pole() {
  return cached('pole', () => {
    const b = new GeoBuilder();
    b.cyl(0.12, 0.16, 8, 6, '#5a4630', { y: 4 });
    b.box(2.2, 0.14, 0.14, '#5a4630', { y: 7.4 });
    for (const x of [-0.9, 0, 0.9]) b.cyl(0.05, 0.05, 0.16, 6, '#c8d0d8', { x, y: 7.55 });
    return b;
  });
}

export function roadSign(v = 0) {
  return cached(`sign${v}`, () => {
    const b = new GeoBuilder();
    b.cyl(0.05, 0.05, 2.4, 6, '#8a8e94', { y: 1.2 });
    if (v === 0) {
      b.cyl(0.45, 0.45, 0.05, 3, '#d0d0c8', { y: 2.4, rx: Math.PI / 2, rz: Math.PI });
      b.cyl(0.36, 0.36, 0.06, 3, '#c0261c', { y: 2.4, rx: Math.PI / 2, rz: Math.PI });
    } else {
      b.box(1.4, 0.8, 0.05, '#2f7a3a', { y: 2.5 });
      b.box(1.3, 0.05, 0.06, '#e0e0d8', { y: 2.5 });
    }
    return b;
  });
}

export function sandbags(len = 4) {
  return cached(`sand${len}`, () => {
    const b = new GeoBuilder();
    const r = new Rng(500 + len);
    for (let row = 0; row < 3; row++) {
      for (let x = -len / 2 + 0.3; x < len / 2; x += 0.62) {
        b.box(0.6, 0.28, 0.4, r.pick(['#a8966a', '#9a8a60', '#b0a070']), { x: x + (row % 2) * 0.3, y: 0.14 + row * 0.27, ry: r.f(-0.1, 0.1) }, { jitter: 0.1 });
      }
    }
    return b;
  });
}

export function tent(v = 0) {
  return cached(`tent${v}`, () => {
    const b = new GeoBuilder();
    const c = ['#5a6040', '#6a5a3a', '#4a5a6a'][v % 3];
    const s = new THREE.Shape();
    s.moveTo(-1.8, 0);
    s.lineTo(1.8, 0);
    s.lineTo(0, 2.2);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 3.6, bevelEnabled: false });
    g.translate(0, 0, -1.8);
    b.add(g, c, {}, {});
    b.box(1.0, 1.4, 0.05, '#1a1a1a', { y: 0.7, z: 1.81 });
    return b;
  });
}

export function campfire() {
  return cached('fire', () => {
    const b = new GeoBuilder();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      b.dodeca(0.2, '#6a6a66', { x: Math.cos(a) * 0.6, y: 0.1, z: Math.sin(a) * 0.6 });
    }
    for (let i = 0; i < 4; i++) b.cyl(0.07, 0.07, 1, 5, '#4a3020', { y: 0.15, rz: Math.PI / 2, ry: (i / 4) * Math.PI });
    return b;
  });
}

export function tires() {
  return cached('tires', () => {
    const b = new GeoBuilder();
    for (let i = 0; i < 4; i++) b.torus(0.38, 0.16, 6, 12, '#1d1d1f', { y: 0.16 + i * 0.3, rx: Math.PI / 2, x: i === 3 ? 0.1 : 0 });
    b.torus(0.38, 0.16, 6, 12, '#1d1d1f', { x: 1.0, y: 0.16, rx: Math.PI / 2 });
    return b;
  });
}

export function container(v = 0) {
  return cached(`cont${v}`, () => {
    const b = new GeoBuilder();
    const c = ['#2f5f8a', '#8a3a22', '#4a6a3a', '#b8861e'][v % 4];
    b.box(2.4, 2.5, 6, c, { y: 1.25 }, MM);
    for (const x of [-1.2, 1.2]) for (const z of [-3, 3]) b.box(0.14, 2.6, 0.14, '#3a3a3a', { x, y: 1.3, z });
    b.box(2.3, 2.3, 0.06, c, { y: 1.25, z: 3.02 }, MM);
    for (const x of [-0.8, -0.3, 0.3, 0.8]) b.box(0.04, 2.3, 0.05, '#8a8e94', { x, y: 1.25, z: 3.07 });
    b.box(0.05, 2.3, 0.04, '#1a1a1a', { y: 1.25, z: 3.06 });
    return b;
  });
}

export function waterTower() {
  return cached('wtower', () => {
    const b = new GeoBuilder();
    for (const x of [-1.2, 1.2]) for (const z of [-1.2, 1.2]) b.beam(V(x * 1.3, 0, z * 1.3), V(x, 8, z), 0.12, '#5a4a38');
    b.cyl(2.2, 2.2, 3, 14, '#8a7458', { y: 9.5 }, MW);
    b.cone(2.4, 1.2, 12, '#4a3a2a', { y: 11.6 });
    for (let i = 0; i < 3; i++) b.torus(2.22, 0.05, 4, 16, '#2a2a2a', { y: 8.4 + i * 1.1, rx: Math.PI / 2 });
    return b;
  });
}

export function flagPole(col = '#b8261e') {
  return cached(`flag${col}`, () => {
    const b = new GeoBuilder();
    b.cyl(0.06, 0.08, 9, 6, '#9a9ea4', { y: 4.5 });
    b.box(1.8, 1.1, 0.03, col, { x: 0.95, y: 8.2 });
    return b;
  });
}

// ------------------------------ опасности ------------------------------

export function mine() {
  return cached('mine', () => {
    const b = new GeoBuilder();
    b.cyl(0.36, 0.42, 0.14, 12, '#4a5236', { y: 0.07 });
    b.cyl(0.14, 0.16, 0.08, 10, '#2a2e22', { y: 0.17 });
    return b;
  });
}

export function spikeTrap(len = 5) {
  return cached(`spikes${len}`, () => {
    const b = new GeoBuilder();
    b.box(0.5, 0.06, len, '#3a3a3a', { y: 0.03, ry: Math.PI / 2 });
    for (let i = 0; i < len * 3; i++) {
      const x = -len / 2 + (i + 0.5) / 3;
      b.cone(0.07, 0.35, 4, '#9aa0a8', { x, y: 0.2, z: (i % 2 ? 0.1 : -0.1) });
    }
    return b;
  });
}

export function roadblock(v = 0) {
  return cached(`rblock${v}`, () => {
    const b = new GeoBuilder();
    if (v === 0) {
      // бетонные блоки
      for (const x of [-1.3, 1.3]) {
        b.box(2.4, 0.9, 0.8, '#9a968e', { x, y: 0.45 }, { jitter: 0.08 });
        b.box(2.4, 0.2, 0.82, '#c83a2a', { x, y: 0.6 });
      }
    } else {
      // деревянная баррикада
      for (const x of [-1.5, 1.5]) {
        b.beam(V(x - 0.6, 0, -0.5), V(x + 0.6, 1.4, 0.5), 0.07, '#5a4028');
        b.beam(V(x + 0.6, 0, -0.5), V(x - 0.6, 1.4, 0.5), 0.07, '#5a4028');
      }
      for (const y of [0.5, 0.95]) b.box(4.4, 0.24, 0.08, '#8a6a42', { y, ry: 0.02 });
      b.box(4.4, 0.24, 0.09, '#d8d0c0', { y: 0.95, x: 0 });
    }
    return b;
  });
}

// ------------------------------ заправка ------------------------------
// Локальные координаты: +Z — вдоль дороги, дорога у x≈0, всё стоит в стороне +X.
export const STATION = {
  pumps: [V(13, 0, -3), V(13, 0, 3), V(19, 0, -3), V(19, 0, 3)],
  carSpot: V(16, 0, -9),
};

export function gasStation() {
  return cached('station', () => {
    const b = new GeoBuilder();
    // площадка
    b.box(26, 0.12, 44, '#a8a6a0', { x: 20, y: 0.06 }, MC);
    for (let i = 0; i < 8; i++) b.box(0.08, 0.13, 44, '#6a6a66', { x: 8 + i * 3.4, y: 0.07 });
    b.box(0.3, 0.14, 44, '#d8c040', { x: 7.2, y: 0.07 });
    // опоры навеса (сам навес — отдельной моделью, его делаем прозрачным, когда игрок под ним)
    for (const x of [11, 21]) for (const z of [-7, 7]) {
      b.box(0.45, 5.2, 0.45, '#d8d4cc', { x, y: 2.6, z }, MC);
      b.box(0.5, 0.6, 0.5, '#c0261c', { x, y: 0.3, z });
    }
    // колонки
    for (const p of STATION.pumps) {
      b.box(1.6, 0.25, 3.4, '#b8b4ac', { x: p.x, y: 0.2, z: p.z }, MC);
      b.box(0.8, 1.8, 0.6, '#c0261c', { x: p.x, y: 1.2, z: p.z });
      b.box(0.82, 0.5, 0.62, '#e8e4dc', { x: p.x, y: 1.9, z: p.z });
      b.box(0.5, 0.3, 0.64, '#1a1e22', { x: p.x, y: 1.55, z: p.z });
      b.box(0.3, 0.1, 0.66, '#3aa04a', { x: p.x, y: 1.28, z: p.z });
      b.box(0.1, 0.5, 0.1, '#1a1a1a', { x: p.x - 0.45, y: 1.1, z: p.z + 0.2 });
      b.beam(V(p.x - 0.45, 1.3, p.z + 0.2), V(p.x - 0.6, 0.35, p.z + 0.5), 0.025, '#1a1a1a', 5);
      b.cyl(0.08, 0.08, 1.0, 8, '#e0b22a', { x: p.x, y: 0.75, z: p.z + 1.4 });
      b.cyl(0.08, 0.08, 1.0, 8, '#e0b22a', { x: p.x, y: 0.75, z: p.z - 1.4 });
    }
    // магазин: кирпичный цоколь, витрины, дверь, вывеска, кондиционер
    b.box(8, 1.0, 14, '#a86a4e', { x: 30, y: 0.5 }, MB);
    b.box(8, 2.6, 14, '#d8cfb8', { x: 30, y: 2.3 }, MC);
    b.box(8.4, 0.4, 14.4, '#7a2a22', { x: 30, y: 3.8 });
    b.box(0.3, 1.2, 14.6, '#c0261c', { x: 25.8, y: 4.4 });
    b.box(0.32, 0.25, 14.6, '#e8e4dc', { x: 25.8, y: 4.4 });
    for (let i = 0; i < 4; i++) win(b, 25.95, 2.0, -5.2 + i * 2.2, 1.8, 1.5, { ry: -Math.PI / 2, frame: '#5a5e64', broken: i === 2 });
    door(b, 25.95, 0.05, 5.5, 1.3, 2.3, '#3a4a5a', -Math.PI / 2);
    b.box(0.6, 0.6, 1.0, '#c8ccd0', { x: 25.6, y: 3.0, z: -6.5 }, MM);
    b.box(0.7, 0.9, 0.6, '#3a5a8a', { x: 25.4, y: 0.45, z: 3.2 });
    b.box(0.5, 0.8, 0.5, '#2a2c30', { x: 25.4, y: 0.4, z: 4.2 });
    // стела
    b.box(0.4, 7, 0.4, '#8a8e94', { x: 8, y: 3.5, z: -18 }, MM);
    b.box(0.5, 2.6, 2.2, '#c0261c', { x: 8, y: 7.2, z: -18 });
    b.box(0.55, 1.6, 1.6, '#e8e4dc', { x: 8, y: 7.2, z: -18 });
    b.box(0.6, 0.9, 0.7, '#1a1a1a', { x: 8, y: 7.2, z: -18.1 });
    for (let i = 0; i < 3; i++) b.box(0.6, 0.3, 1.8, i === 0 ? '#3aa04a' : '#2a2c30', { x: 8, y: 5.6 - i * 0.4, z: -18 });
    // мусор
    b.merge(barrels(3, 1), { x: 27, z: -12 });
    b.merge(tires(), { x: 24, z: 12 });
    b.merge(crates(), { x: 33, z: 10, ry: 0.3 });
    b.merge(wreck(3), { x: 30, z: -15, ry: 1.3 });
    return b;
  });
}

export function gasCanopy() {
  return cached('canopy', () => {
    const b = new GeoBuilder();
    b.box(13, 0.7, 20, '#e8e4dc', { x: 16, y: 5.6 });
    b.box(13.1, 0.25, 20.1, '#c0261c', { x: 16, y: 5.45 });
    b.box(12.6, 0.1, 19.6, '#c8c4bc', { x: 16, y: 5.2 });
    return b;
  });
}

// ------------------------------ лагерь бандитов ------------------------------
// Стоит в стороне -X от дороги. Возвращает также позиции бандитов и турели.
export const CAMP = {
  bandits: [V(-11, 0, -8), V(-11, 0, 4), V(-14, 0, 12), V(-18, 0, -2), V(-12, 0, 16), V(-16, 0, -14), V(-22, 0, 8), V(-10, 0, -16), V(-20, 0, -10)],
  turret: V(-12, 0, -2),
};

export function banditCamp() {
  return cached('camp', () => {
    const b = new GeoBuilder();
    b.box(22, 0.08, 40, '#7a6a4a', { x: -20, y: 0.04 }, { jitter: 0.05 });
    b.merge(sandbags(6), { x: -9, z: -8, ry: Math.PI / 2 });
    b.merge(sandbags(6), { x: -9, z: 4, ry: Math.PI / 2 });
    b.merge(sandbags(4), { x: -12, z: 15, ry: Math.PI / 2 });
    b.merge(sandbags(4), { x: -12, z: -1, ry: Math.PI / 2 });
    b.merge(tent(0), { x: -22, z: -6, ry: 0.2 });
    b.merge(tent(1), { x: -24, z: 6, ry: -0.1 });
    b.merge(tent(2), { x: -26, z: 16, ry: 0.4 });
    b.merge(watchtower(), { x: -18, z: -18, s: 0.9 });
    b.merge(campfire(), { x: -18, z: 2 });
    b.merge(wreck(1), { x: -14, z: 22, ry: 1.2 });
    b.merge(wreck(4), { x: -27, z: -14, ry: 0.4 });
    b.merge(barrels(3, 2), { x: -20, z: 12 });
    b.merge(crates(), { x: -25, z: -1 });
    b.merge(flagPole('#1a1a1a'), { x: -16, z: 8 });
    b.merge(fence(8, true), { x: -30, z: 0, ry: Math.PI / 2 });
    b.merge(fence(8, true), { x: -30, z: 10, ry: Math.PI / 2 });
    return b;
  });
}

// ------------------------------ мост ------------------------------

export function bridge(len = 80, width = 14) {
  return cached(`bridge${len}`, () => {
    const b = new GeoBuilder();
    const w = width / 2 + 0.8;
    b.box(width + 1.6, 0.6, len, '#6a6660', { y: -0.35 });
    const steel = '#5a4a3e';
    const h = 4.5;
    for (const sx of [-1, 1]) {
      const x = sx * w;
      b.box(0.3, 0.3, len, steel, { x, y: 0.1 });
      b.box(0.3, 0.3, len - 8, steel, { x, y: h });
      const n = Math.round(len / 8);
      for (let i = 0; i <= n; i++) {
        const z = -len / 2 + (i * len) / n;
        const zc = Math.max(-len / 2 + 4, Math.min(len / 2 - 4, z));
        b.beam(V(x, 0, z), V(x, h, zc), 0.14, steel);
        if (i < n) b.beam(V(x, 0, z), V(x, h, Math.min(len / 2 - 4, z + len / n)), 0.1, steel);
      }
      // перила
      b.box(0.08, 0.08, len, '#8a8e94', { x: x - sx * 0.4, y: 1.0 });
    }
    for (let i = 0; i < 6; i++) b.box(width + 1.6, 0.2, 0.3, steel, { y: h, z: -len / 2 + 8 + (i * (len - 16)) / 5 });
    // опоры
    for (const z of [-len / 4, len / 4]) b.box(width, 12, 3, '#7a766e', { y: -6.6, z });
    return b;
  });
}

// ------------------------------ база ------------------------------
// Ворота на z=0 смотрят в +Z, база уходит в -Z. Гараж в глубине, его ворота на z=-30.
export const BASE = {
  gateHalf: 4.2,
  garageDoorZ: -30,
  carStartZ: -37,
  size: [46, 50],
};

export function baseModel(col = '#2f5f9e') {
  return cached(`base${col}`, () => {
    const b = new GeoBuilder();
    const [W, D] = BASE.size;
    const hw = W / 2;
    b.box(W + 6, 0.08, D + 4, '#9a8a6a', { y: 0.04, z: -D / 2 }, { jitter: 0.04 });
    // стены из листового металла
    const r = new Rng(77);
    const wallSeg = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.max(1, Math.round(len / 2));
      const ry = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const x = x0 + (x1 - x0) * t;
        const z = z0 + (z1 - z0) * t;
        const hh = r.f(2.7, 3.1);
        b.box(len / n - 0.02, hh, 0.1, r.pick(['#b8b4ae', '#c89a6a', '#8aa0b4', '#b87a5a', '#a8b0a0']), { x, y: hh / 2 + 0.05, z, ry }, MM);
      }
      b.plank(V(x0, 2.6, z0), V(x1, 2.6, z1), 0.1, 0.12, '#5a4632', MW);
      b.plank(V(x0, 0.9, z0), V(x1, 0.9, z1), 0.1, 0.12, '#5a4632', MW);
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        b.box(0.2, 3.4, 0.2, '#5a4632', { x: x0 + (x1 - x0) * t, y: 1.7, z: z0 + (z1 - z0) * t }, MW);
      }
      // колючая проволока
      b.plank(V(x0, 3.25, z0), V(x1, 3.25, z1), 0.02, 0.02, '#6a6e74');
      b.plank(V(x0, 3.45, z0), V(x1, 3.45, z1), 0.02, 0.02, '#6a6e74');
    };
    const g = BASE.gateHalf;
    wallSeg(-hw, 0, -g - 0.3, 0);
    wallSeg(g + 0.3, 0, hw, 0);
    wallSeg(-hw, 0, -hw, -D);
    wallSeg(hw, 0, hw, -D);
    wallSeg(-hw, -D, hw, -D);
    // столбы ворот
    for (const sx of [-1, 1]) b.box(0.6, 4.6, 0.6, '#4a4e54', { x: sx * (g + 0.3), y: 2.3 }, MM);
    b.box(2 * g + 1.2, 0.5, 0.6, '#4a4e54', { y: 4.5 }, MM);
    b.box(3.2, 0.9, 0.08, '#e0b22a', { y: 5.2, z: 0.3 });
    b.box(3.0, 0.7, 0.1, '#2a2c30', { y: 5.2, z: 0.3 });
    // вышки по углам
    b.merge(watchtower(), { x: -hw + 2.5, z: -2.5, s: 0.9 });
    b.merge(watchtower(), { x: hw - 2.5, z: -2.5, s: 0.9, ry: Math.PI / 2 });

    // гараж: полый, с интерьером (ворота на z = garageDoorZ)
    const gz = BASE.garageDoorZ;
    const GW = 14;
    const GD = 14;
    const GH = 6;
    const zc = gz - GD / 2;
    const wc = '#b8805e';
    b.box(GW - 0.6, 0.1, GD - 0.4, '#9a968e', { y: 0.05, z: zc }, MC);
    b.box(GW, GH, 0.3, wc, { y: GH / 2, z: gz - GD + 0.15 }, MB);
    for (const sx of [-1, 1]) b.box(0.3, GH, GD, wc, { x: sx * (GW / 2 - 0.15), y: GH / 2, z: zc }, MB);
    const op = 3.4;
    const side = (GW / 2 - op) / 1;
    for (const sx of [-1, 1]) b.box(side, GH, 0.3, wc, { x: sx * (op + side / 2), y: GH / 2, z: gz - 0.15 }, MB);
    b.box(op * 2, GH - 4.8, 0.3, wc, { y: 4.8 + (GH - 4.8) / 2, z: gz - 0.15 }, MB);
    // пилястры, карниз, крыша
    for (const x of [-GW / 2, -op - 0.2, op + 0.2, GW / 2]) b.box(0.45, GH + 0.1, 0.45, '#9a6a4e', { x, y: (GH + 0.1) / 2, z: gz }, MB);
    b.box(GW + 0.6, 0.4, GD + 0.6, '#6a6a66', { y: GH + 0.2, z: zc }, MC);
    b.box(GW + 0.7, 0.15, 0.2, '#4a4a48', { y: GH + 0.45, z: gz + 0.3 });
    // вывеска над воротами
    b.box(6.2, 0.9, 0.12, '#2a2c30', { y: 5.4, z: gz + 0.12 });
    b.box(6.4, 0.08, 0.14, '#e0b22a', { y: 4.92, z: gz + 0.14 });
    // вентиляция и лампы у ворот
    b.box(1.2, 0.6, 0.8, '#8a8e94', { x: 4, y: GH + 0.7, z: zc }, MM);
    for (const sx of [-1, 1]) b.box(0.35, 0.2, 0.3, '#2a2c30', { x: sx * 4.6, y: 4.3, z: gz + 0.3 });
    // интерьер: стеллажи
    const shelf = (x, z, ry) => {
      const s2 = new GeoBuilder();
      const rr = new Rng(Math.round(x * 13 + z));
      for (const px of [-1.4, 1.4]) for (const pz of [-0.35, 0.35]) s2.box(0.08, 2.8, 0.08, '#3a5a8a', { x: px, y: 1.4, z: pz });
      for (let i = 0; i < 4; i++) {
        s2.box(2.9, 0.05, 0.8, '#5a6068', { y: 0.25 + i * 0.8 }, MM);
        for (let k = 0; k < 5; k++) {
          if (rr.chance(0.25)) continue;
          const col = rr.pick(['#a07840', '#3a5a7a', '#b8261e', '#5a6a3a', '#d8c070', '#6a6a6a']);
          s2.box(rr.f(0.3, 0.5), rr.f(0.22, 0.5), 0.55, col, { x: -1.15 + k * 0.57, y: 0.25 + i * 0.8 + 0.2, z: 0 }, col === '#a07840' ? MP : {});
        }
      }
      b.merge(s2, { x, z, ry });
    };
    shelf(-GW / 2 + 0.8, zc - 3, Math.PI / 2);
    shelf(-GW / 2 + 0.8, zc + 1, Math.PI / 2);
    shelf(GW / 2 - 0.8, zc - 3.5, -Math.PI / 2);
    // верстак с тисками, щит с инструментами
    b.box(3.2, 0.12, 0.9, '#7a5a3a', { x: 3, y: 1.0, z: gz - GD + 0.8 }, MP);
    for (const x of [1.6, 4.4]) b.box(0.1, 1.0, 0.8, '#3a3e44', { x, y: 0.5, z: gz - GD + 0.8 });
    b.box(0.25, 0.2, 0.3, '#3a5a8a', { x: 2, y: 1.16, z: gz - GD + 0.8 });
    b.box(3.2, 1.6, 0.05, '#8a7a5a', { x: 3, y: 2.3, z: gz - GD + 0.33 }, MP);
    for (let i = 0; i < 7; i++) b.box(0.05, 0.4 + (i % 3) * 0.1, 0.04, '#9aa0a8', { x: 1.8 + i * 0.4, y: 2.3, z: gz - GD + 0.37, rz: (i % 2) * 0.3 });
    b.box(1.4, 1.0, 0.6, '#c0261c', { x: 5.6, y: 0.5, z: gz - GD + 0.8 });
    for (let i = 0; i < 4; i++) b.box(1.3, 0.02, 0.02, '#1a1a1a', { x: 5.6, y: 0.2 + i * 0.22, z: gz - GD + 1.11 });
    // шины, бочки, канистры, подъёмник
    b.merge(tires(), { x: -4.6, z: gz - GD + 1.2 });
    b.merge(barrels(3, 0), { x: -2.2, z: gz - GD + 1.2 });
    for (let i = 0; i < 3; i++) b.box(0.3, 0.45, 0.18, i % 2 ? '#3a6a3a' : '#c0261c', { x: 5.8, y: 0.33, z: zc + 2 + i * 0.3 });
    for (const sx of [-1, 1]) b.box(0.25, 2.2, 0.25, '#e0b22a', { x: sx * 2.4, y: 1.1, z: zc - 1.5 });
    b.box(1.1, 0.01, 0.8, '#2a2622', { x: 0.4, y: 0.105, z: zc - 1 });
    // лампы под потолком
    for (const z of [zc - 3, zc + 2]) b.box(2.4, 0.12, 0.3, '#fff4dc', { y: GH - 0.35, z }, { mat: 'glow' });

    // флаг, контейнеры, палатки, водонапорка, мелочи
    b.merge(flagPole(col), { x: -8, z: -8 });
    b.merge(container(0), { x: -17, z: -12, ry: 0.05 });
    b.merge(container(1), { x: -17, z: -20, ry: -0.05 });
    b.merge(container(2), { x: 16.5, z: -38 });
    b.merge(tent(0), { x: 14, z: -12, ry: Math.PI / 2 });
    b.merge(tent(1), { x: 14, z: -18, ry: Math.PI / 2 });
    b.merge(waterTower(), { x: 16, z: -26, s: 0.8 });
    b.merge(garageShed(0), { x: -16, z: -34, ry: Math.PI / 2 });
    b.merge(barrels(3, 0), { x: 9, z: -26 });
    b.merge(tires(), { x: -9.5, z: -26 });
    b.merge(crates(), { x: 10, z: -6, ry: 0.4 });
    b.merge(crates(), { x: -12, z: -4, ry: -0.3 });
    b.merge(sandbags(4), { x: -7, z: 2 });
    b.merge(sandbags(4), { x: 7, z: 2 });
    b.merge(campfire(), { x: 4, z: -16 });
    // прожекторы на столбах
    for (const sx of [-1, 1]) {
      b.cyl(0.06, 0.08, 5, 6, '#3a3e44', { x: sx * 10, y: 2.5, z: -22 });
      b.box(0.5, 0.35, 0.3, '#2a2c30', { x: sx * 10, y: 5, z: -21.9 });
    }
    return b;
  });
}

// Створка ворот базы (петля в точке x=0)
export function gateDoor() {
  return cached('gatedoor', () => {
    const b = new GeoBuilder();
    const w = BASE.gateHalf;
    b.box(w, 3.2, 0.14, '#8a929a', { x: w / 2, y: 1.8 }, MM);
    for (let i = 0; i < 4; i++) b.box(w - 0.1, 0.12, 0.2, '#3a3e44', { x: w / 2, y: 0.5 + i * 0.9 });
    b.plank(V(0.1, 0.4, 0), V(w - 0.1, 3.2, 0), 0.14, 0.2, '#3a3e44');
    b.box(0.2, 3.6, 0.24, '#2a2c30', { x: 0.1, y: 1.8 });
    return b;
  });
}

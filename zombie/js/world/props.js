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

function windows(b, w, h, x, y, z, ry = 0, broken = false) {
  b.box(w + 0.12, h + 0.12, 0.06, '#e8e0cc', { x, y, z, ry });
  b.box(w, h, 0.08, broken ? '#0c0d0f' : '#2a3a48', { x, y, z, ry });
}

export function house(v = 0) {
  return cached(`house${v}`, () => {
    const b = new GeoBuilder();
    const wall = ['#8a5a3a', '#7a6a4a', '#6a7a8a'][v % 3];
    const roof = ['#5a3a2a', '#6a2a22', '#3a3e44'][v % 3];
    b.box(7, 3.2, 6, wall, { y: 1.6 }, { jitter: 0.06 });
    // брёвна
    for (let i = 0; i < 8; i++) b.box(7.05, 0.05, 6.05, '#4a3222', { y: 0.35 + i * 0.4 });
    // крыша
    const s = new THREE.Shape();
    s.moveTo(-4, 0);
    s.lineTo(4, 0);
    s.lineTo(0, 2.4);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 7.6, bevelEnabled: false });
    g.translate(0, 0, -3.8);
    b.add(g, roof, { y: 3.2, ry: Math.PI / 2 });
    b.box(0.6, 1.6, 0.6, '#6a4a3a', { x: 1.8, y: 4.6, z: 1 });
    windows(b, 1, 1, -1.8, 1.8, 3.01);
    windows(b, 1, 1, 1.8, 1.8, 3.01, 0, v === 2);
    windows(b, 1, 1, 3.51, 1.8, 0, Math.PI / 2);
    b.box(1.1, 2, 0.1, '#3a2618', { y: 1, z: -3.02 });
    // крыльцо
    b.box(2.4, 0.3, 1.4, '#5a3e26', { y: 0.15, z: -3.6 });
    return b;
  });
}

export function ruin(v = 0) {
  return cached(`ruin${v}`, () => {
    const b = new GeoBuilder();
    const c = v ? '#8a8480' : '#9a9088';
    b.box(9, 6.4, 7, c, { y: 3.2 }, { jitter: 0.08 });
    b.box(9.3, 0.3, 7.3, '#6a6460', { y: 3.2 });
    // обрушенный угол
    b.box(3.5, 2.4, 3, '#6a6460', { x: 2.8, y: 7.2, z: 2 }, { jitter: 0.1 });
    for (let f = 0; f < 2; f++) {
      for (let i = 0; i < 3; i++) {
        windows(b, 1.2, 1.3, -3 + i * 3, 1.8 + f * 3.2, 3.51, 0, true);
        windows(b, 1.2, 1.3, -3 + i * 3, 1.8 + f * 3.2, -3.51, 0, true);
      }
    }
    const r = new Rng(200 + v);
    for (let i = 0; i < 8; i++) b.box(r.f(0.4, 1.2), r.f(0.3, 0.7), r.f(0.4, 1.2), '#7a746e', { x: r.f(-5, 5), y: 0.2, z: r.f(4, 6), ry: r.f(0, 3) });
    b.box(2, 2.6, 0.1, '#1a1a1a', { z: 3.52, y: 1.3 });
    return b;
  });
}

export function hangar() {
  return cached('hangar', () => {
    const b = new GeoBuilder();
    const g = new THREE.CylinderGeometry(6, 6, 16, 14, 1, false, -Math.PI / 2, Math.PI);
    b.add(g, '#6f7880', { rx: Math.PI / 2, rz: Math.PI / 2, y: 0 }, { jitter: 0.04 });
    for (let i = 0; i < 8; i++) {
      const tg = new THREE.TorusGeometry(6.02, 0.06, 4, 14, Math.PI);
      b.add(tg, '#4a5058', { z: -7.5 + i * 2.14 });
    }
    b.box(12, 6, 0.1, '#5a6068', { z: 8, y: 0 }, {});
    b.box(6, 4.2, 0.12, '#3a3e44', { z: 8.05, y: 2.1 });
    b.box(0.4, 0.4, 0.2, '#e0b22a', { y: 4.8, z: 8.1 });
    return b;
  });
}

export function watchtower() {
  return cached('tower', () => {
    const b = new GeoBuilder();
    const wood = '#6a4a30';
    const h = 7;
    for (const x of [-1.3, 1.3]) {
      for (const z of [-1.3, 1.3]) b.beam(V(x * 1.2, 0, z * 1.2), V(x, h, z), 0.12, wood);
    }
    for (let k = 0; k < 2; k++) {
      const y0 = k * 3.3;
      const y1 = y0 + 3.3;
      b.beam(V(-1.5, y0, 1.45), V(1.45, y1, 1.35), 0.06, wood);
      b.beam(V(-1.5, y0, -1.45), V(1.45, y1, -1.35), 0.06, wood);
      b.beam(V(1.45, y0, -1.5), V(1.35, y1, 1.45), 0.06, wood);
      b.beam(V(-1.45, y0, -1.5), V(-1.35, y1, 1.45), 0.06, wood);
    }
    b.box(3.4, 0.2, 3.4, '#5a3e26', { y: h });
    for (const s of [-1, 1]) {
      b.box(3.4, 1, 0.1, '#6a4a30', { y: h + 0.6, z: s * 1.65 });
      b.box(0.1, 1, 3.4, '#6a4a30', { y: h + 0.6, x: s * 1.65 });
    }
    for (const x of [-1.6, 1.6]) for (const z of [-1.6, 1.6]) b.box(0.1, 2.2, 0.1, wood, { x, y: h + 1.1, z });
    const s = new THREE.ConeGeometry(2.8, 1.3, 4);
    b.add(s, '#4a3a2a', { y: h + 2.8, ry: Math.PI / 4 });
    // лестница
    b.beam(V(0.35, 0, 2.4), V(0.3, h, 1.5), 0.05, wood);
    b.beam(V(-0.35, 0, 2.4), V(-0.3, h, 1.5), 0.05, wood);
    for (let i = 1; i < 12; i++) {
      const t = i / 12;
      b.box(0.7, 0.05, 0.08, wood, { y: t * h, z: 2.4 - t * 0.9 });
    }
    return b;
  });
}

export function bunker() {
  return cached('bunker', () => {
    const b = new GeoBuilder();
    b.cyl(4, 4.6, 2.2, 12, '#8a8a82', { y: 1.1 }, { jitter: 0.06 });
    b.add(new THREE.SphereGeometry(4, 12, 4, 0, Math.PI * 2, 0, Math.PI / 2), '#7f7f78', { y: 2.2, sy: 0.35 });
    b.box(3, 0.3, 0.3, '#111', { y: 1.8, z: 4.1 });
    b.box(1.6, 1.8, 2, '#6f6f68', { y: 0.9, z: -4.2 });
    b.box(1.1, 1.5, 0.1, '#2a2a2a', { y: 0.8, z: -5.2 });
    return b;
  });
}

export function garageShed(v = 0) {
  return cached(`garage${v}`, () => {
    const b = new GeoBuilder();
    const c = ['#8a4a34', '#7a7a74'][v % 2];
    b.box(5, 3, 7, c, { y: 1.5 }, { jitter: 0.06 });
    b.box(5.3, 0.25, 7.4, '#3a3a3a', { y: 3.1 });
    b.box(3.6, 2.4, 0.1, '#6a6e74', { y: 1.2, z: 3.52 });
    for (let i = 0; i < 8; i++) b.box(3.6, 0.03, 0.12, '#4a4e54', { y: 0.2 + i * 0.3, z: 3.55 });
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
    for (const y of [0.5, 1.1]) b.box(len, 0.1, 0.06, wood, { y, z: 0.08 });
    for (let x = -len / 2 + 0.15; x < len / 2; x += 0.3) {
      if (broken && r.chance(0.3)) continue;
      b.box(0.22, r.f(1.2, 1.45), 0.04, r.chance(0.5) ? wood : '#7a6044', { x, y: 0.7, z: 0.13 });
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
    b.box(1, 1, 1, c, { y: 0.5 }, { jitter: 0.08 });
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
    b.box(2.4, 2.5, 6, c, { y: 1.25 }, { jitter: 0.05 });
    for (let i = 0; i < 13; i++) b.box(2.46, 2.3, 0.08, c, { y: 1.25, z: -2.9 + i * 0.48 }, { jitter: 0.12 });
    b.box(2.3, 2.3, 0.06, '#2a2a2a', { y: 1.25, z: 3.02 });
    return b;
  });
}

export function waterTower() {
  return cached('wtower', () => {
    const b = new GeoBuilder();
    for (const x of [-1.2, 1.2]) for (const z of [-1.2, 1.2]) b.beam(V(x * 1.3, 0, z * 1.3), V(x, 8, z), 0.12, '#5a4a38');
    b.cyl(2.2, 2.2, 3, 12, '#6a5a44', { y: 9.5 }, { jitter: 0.08 });
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
    b.box(26, 0.12, 44, '#8a8a86', { x: 20, y: 0.06 }, { jitter: 0.03 });
    for (let i = 0; i < 8; i++) b.box(0.08, 0.13, 44, '#6a6a66', { x: 8 + i * 3.4, y: 0.07 });
    // опоры навеса (сам навес — отдельной моделью, его делаем прозрачным, когда игрок под ним)
    for (const x of [11, 21]) for (const z of [-7, 7]) b.box(0.45, 5.2, 0.45, '#d8d4cc', { x, y: 2.6, z });
    // колонки
    for (const p of STATION.pumps) {
      b.box(1.6, 0.25, 3.4, '#b8b4ac', { x: p.x, y: 0.2, z: p.z });
      b.box(0.8, 1.8, 0.6, '#c0261c', { x: p.x, y: 1.2, z: p.z });
      b.box(0.82, 0.5, 0.62, '#e8e4dc', { x: p.x, y: 1.9, z: p.z });
      b.box(0.5, 0.3, 0.64, '#1a1e22', { x: p.x, y: 1.55, z: p.z });
      b.box(0.1, 0.5, 0.1, '#1a1a1a', { x: p.x - 0.45, y: 1.1, z: p.z + 0.2 });
    }
    // магазин
    b.box(8, 3.6, 14, '#d8cfb8', { x: 30, y: 1.8 }, { jitter: 0.05 });
    b.box(8.4, 0.4, 14.4, '#7a2a22', { x: 30, y: 3.8 });
    b.box(0.1, 1.8, 8, '#2a3a48', { x: 25.95, y: 1.6 });
    for (let i = 0; i < 5; i++) b.box(0.12, 1.9, 0.1, '#6a6a66', { x: 25.93, y: 1.6, z: -4 + i * 2 });
    b.box(0.1, 2.3, 1.4, '#2a2a2a', { x: 25.95, y: 1.15, z: 5.5 });
    // стела
    b.box(0.4, 7, 0.4, '#8a8e94', { x: 8, y: 3.5, z: -18 });
    b.box(0.5, 2.6, 2.2, '#c0261c', { x: 8, y: 7.2, z: -18 });
    b.box(0.55, 1.6, 1.6, '#e8e4dc', { x: 8, y: 7.2, z: -18 });
    b.box(0.6, 0.9, 0.7, '#1a1a1a', { x: 8, y: 7.2, z: -18.1 });
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
    b.box(W + 6, 0.08, D + 4, '#8a7a5a', { y: 0.04, z: -D / 2 }, { jitter: 0.04 });
    // стены из листового металла
    const r = new Rng(77);
    const wallSeg = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.max(1, Math.round(len / 2));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const x = x0 + (x1 - x0) * t;
        const z = z0 + (z1 - z0) * t;
        const ry = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2;
        b.box(len / n + 0.05, r.f(2.6, 3.2), 0.12, r.pick(['#6f7478', '#7a6a5a', '#5f676e', '#8a5a3a']), { x, y: 1.4, z, ry }, { jitter: 0.1 });
      }
      b.plank(V(x0, 2.6, z0), V(x1, 2.6, z1), 0.1, 0.12, '#4a3a2a');
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        b.box(0.22, 3.4, 0.22, '#4a3a2a', { x: x0 + (x1 - x0) * t, y: 1.7, z: z0 + (z1 - z0) * t });
      }
    };
    const g = BASE.gateHalf;
    wallSeg(-hw, 0, -g - 0.3, 0);
    wallSeg(g + 0.3, 0, hw, 0);
    wallSeg(-hw, 0, -hw, -D);
    wallSeg(hw, 0, hw, -D);
    wallSeg(-hw, -D, hw, -D);
    // столбы ворот
    for (const sx of [-1, 1]) b.box(0.6, 4.4, 0.6, '#3a3e44', { x: sx * (g + 0.3), y: 2.2 });
    b.box(2 * g + 1.2, 0.5, 0.6, '#3a3e44', { y: 4.4 });
    // вышки по углам
    b.merge(watchtower(), { x: -hw + 2.5, z: -2.5, s: 0.9 });
    b.merge(watchtower(), { x: hw - 2.5, z: -2.5, s: 0.9, ry: Math.PI / 2 });
    // гараж
    const gz = BASE.garageDoorZ;
    b.box(14, 6, 14, '#7a6e62', { y: 3, z: gz - 7 }, { jitter: 0.04 });
    b.box(14.6, 0.5, 14.6, '#4a4038', { y: 6.2, z: gz - 7 });
    for (const sx of [-1, 1]) b.box(3.6, 6, 0.2, '#6a5e52', { x: sx * 5.2, y: 3, z: gz + 0.02 });
    b.box(14, 1.2, 0.2, '#6a5e52', { y: 5.4, z: gz + 0.02 });
    b.box(6.8, 0.5, 0.4, '#e0b22a', { y: 4.5, z: gz + 0.15 });
    // пол гаража
    b.box(6.6, 0.05, 13, '#5a5a58', { y: 0.1, z: gz - 6.5 });
    // полоса от гаража к воротам
    b.box(8, 0.03, -gz, '#6a6258', { y: 0.09, z: gz / 2 });
    // флаг и сооружения
    b.merge(flagPole(col), { x: -8, z: -8 });
    b.merge(container(0), { x: -17, z: -12, ry: 0.05 });
    b.merge(container(1), { x: -17, z: -20, ry: -0.05 });
    b.merge(container(2), { x: 16.5, z: -38 });
    b.merge(tent(0), { x: 14, z: -12, ry: Math.PI / 2 });
    b.merge(tent(1), { x: 14, z: -18, ry: Math.PI / 2 });
    b.merge(waterTower(), { x: 16, z: -26, s: 0.8 });
    b.merge(garageShed(0), { x: -16, z: -34, ry: Math.PI / 2 });
    b.merge(barrels(3, 0), { x: 9, z: -26 });
    b.merge(tires(), { x: -9, z: -26 });
    b.merge(crates(), { x: 10, z: -6, ry: 0.4 });
    b.merge(crates(), { x: -12, z: -4, ry: -0.3 });
    b.merge(sandbags(4), { x: -7, z: 2 });
    b.merge(sandbags(4), { x: 7, z: 2 });
    b.merge(campfire(), { x: 4, z: -16 });
    // прожекторы
    for (const sx of [-1, 1]) {
      b.cyl(0.06, 0.06, 5, 6, '#3a3e44', { x: sx * 10, y: 2.5, z: -22 });
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
    b.box(w, 3.2, 0.14, '#5a6068', { x: w / 2, y: 1.8 }, { jitter: 0.05 });
    for (let i = 0; i < 4; i++) b.box(w - 0.1, 0.12, 0.2, '#3a3e44', { x: w / 2, y: 0.5 + i * 0.9 });
    b.plank(V(0.1, 0.4, 0), V(w - 0.1, 3.2, 0), 0.14, 0.2, '#3a3e44');
    b.box(0.2, 3.6, 0.24, '#2a2c30', { x: 0.1, y: 1.8 });
    return b;
  });
}

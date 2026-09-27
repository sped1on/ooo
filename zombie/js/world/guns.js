// Модели ручного оружия, брони и аптечек (для персонажа и превью в магазине).
// Оружие направлено вдоль +Z, рукоять в начале координат.

import * as THREE from 'three';
import { GeoBuilder } from '../engine/geo.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const cache = new Map();

const BLACK = '#2c3036';
const DARK = '#454a52';
const WOOD = '#8a4e24';
const TAN = '#b89a6a';

function rifle(b, o) {
  const body = o.body || DARK;
  const len = o.len || 0.55;
  b.box(0.06, 0.1, len, body, { z: len / 2 - 0.08, y: 0.03 });
  // спусковая скоба и крышка ствольной коробки
  b.box(0.012, 0.035, 0.08, BLACK, { y: -0.035, z: 0.04 });
  b.box(0.05, 0.02, len * 0.5, '#5a6068', { y: 0.085, z: len * 0.2 });
  // мушка
  b.box(0.012, 0.04, 0.012, BLACK, { y: 0.09, z: len - 0.1 + (o.barrel || 0.35) * 0.8 });
  b.cyl(0.016, 0.016, o.barrel || 0.35, 8, BLACK, { z: len - 0.08 + (o.barrel || 0.35) / 2, y: 0.05, rx: Math.PI / 2 });
  // рукоять
  b.box(0.04, 0.12, 0.05, o.grip || BLACK, { y: -0.06, z: 0, rx: 0.3 });
  // приклад
  if (o.stock !== false) b.box(0.05, 0.1, 0.22, o.stockCol || body, { z: -0.18, y: 0.0 });
  // магазин
  if (o.mag) b.box(0.04, o.mag, 0.07, o.magCol || BLACK, { y: -0.03 - o.mag / 2, z: 0.12, rx: o.magCurve || 0 });
  if (o.scope) {
    b.cyl(0.028, 0.028, 0.22, 8, BLACK, { y: 0.12, z: 0.15, rx: Math.PI / 2 });
    b.cyl(0.034, 0.034, 0.04, 8, BLACK, { y: 0.12, z: 0.27, rx: Math.PI / 2 });
  }
  if (o.rail) {
    b.box(0.03, 0.02, len * 0.6, BLACK, { y: 0.09, z: len * 0.3 });
    for (let i = 0; i < 8; i++) b.box(0.034, 0.008, 0.012, '#1a1c20', { y: 0.101, z: len * 0.05 + i * len * 0.07 });
  }
  if (o.handguard) {
    b.box(0.07, 0.07, 0.22, o.handguard, { z: len - 0.2, y: 0.03 });
    for (let i = 0; i < 4; i++) b.box(0.074, 0.012, 0.03, '#1a1c20', { y: 0.03, z: len - 0.28 + i * 0.05 });
  }
  // дульный тормоз, рукоятка затвора, целик, затыльник, антабки
  const bz = len - 0.08 + (o.barrel || 0.35);
  b.cyl(0.024, 0.024, 0.06, 8, '#2a2c30', { z: bz, y: 0.05, rx: Math.PI / 2 });
  for (let i = 0; i < 3; i++) b.box(0.05, 0.008, 0.008, '#15161a', { z: bz - 0.015 + i * 0.015, y: 0.075 });
  b.box(0.05, 0.015, 0.015, '#8a8e94', { x: 0.035, y: 0.06, z: len * 0.35 });
  b.box(0.02, 0.03, 0.02, BLACK, { y: 0.1, z: 0.02 });
  if (o.stock !== false) {
    b.box(0.055, 0.12, 0.02, '#15161a', { z: -0.3, y: 0.0 });
    b.torus(0.012, 0.004, 4, 6, '#6a6e74', { z: -0.25, y: -0.055, ry: Math.PI / 2 });
  }
  if (o.mag) for (let i = 0; i < 3; i++) b.box(0.042, 0.006, 0.072, '#15161a', { y: -0.05 - i * (o.mag / 4), z: 0.12 });
}

export function gunGeo(model) {
  if (cache.has(model)) return cache.get(model);
  const b = new GeoBuilder();
  const glow = new GeoBuilder();
  switch (model) {
    case 'pistol':
      b.box(0.036, 0.045, 0.2, '#3a3e45', { y: 0.05, z: 0.06 });
      b.box(0.034, 0.03, 0.19, '#23262b', { y: 0.015, z: 0.06 });
      for (let i = 0; i < 5; i++) b.box(0.038, 0.035, 0.006, '#23262b', { y: 0.05, z: -0.02 + i * 0.012 });
      b.box(0.032, 0.12, 0.055, '#2a2d32', { y: -0.045, z: -0.005, rx: 0.25 });
      b.box(0.012, 0.03, 0.05, '#23262b', { y: -0.015, z: 0.05 });
      b.box(0.01, 0.015, 0.01, '#9aa0a8', { y: 0.078, z: 0.15 });
      break;
    case 'revolver':
      b.cyl(0.018, 0.018, 0.22, 8, '#8a8e94', { y: 0.05, z: 0.14, rx: Math.PI / 2 });
      b.cyl(0.04, 0.04, 0.06, 8, '#6a6e74', { y: 0.04, z: 0.02, rx: Math.PI / 2 });
      b.box(0.035, 0.11, 0.05, WOOD, { y: -0.04, z: -0.03, rx: 0.35 });
      break;
    case 'pump':
      rifle(b, { len: 0.5, barrel: 0.4, body: '#3a2a20', stockCol: WOOD, handguard: WOOD, grip: WOOD });
      break;
    case 'spas':
      rifle(b, { len: 0.5, barrel: 0.35, body: '#4a4e56', handguard: BLACK, stockCol: BLACK });
      b.cyl(0.02, 0.02, 0.35, 8, BLACK, { z: 0.6, y: 0.0, rx: Math.PI / 2 });
      break;
    case 'smg':
      rifle(b, { len: 0.4, barrel: 0.12, mag: 0.16, magCurve: 0.2, stock: true });
      break;
    case 'ak':
      rifle(b, { len: 0.55, barrel: 0.3, mag: 0.2, magCurve: 0.35, stockCol: WOOD, handguard: WOOD, body: '#3a3c40' });
      break;
    case 'scar':
      rifle(b, { len: 0.55, barrel: 0.25, mag: 0.16, body: TAN, stockCol: TAN, rail: true, handguard: TAN });
      break;
    case 'p90':
      b.box(0.08, 0.14, 0.5, BLACK, { z: 0.12, y: 0.02 });
      b.box(0.05, 0.04, 0.3, '#3a3e44', { z: 0.15, y: 0.1 });
      b.cyl(0.016, 0.016, 0.1, 8, BLACK, { z: 0.42, y: 0.03, rx: Math.PI / 2 });
      break;
    case 'm4':
      rifle(b, { len: 0.55, barrel: 0.3, mag: 0.17, magCurve: 0.15, rail: true, handguard: '#2a2c30', scope: false });
      b.box(0.02, 0.06, 0.02, BLACK, { y: 0.1, z: 0.38 });
      break;
    case 'sniper':
      rifle(b, { len: 0.7, barrel: 0.45, mag: 0.08, body: '#4a5a3a', stockCol: '#4a5a3a', scope: true });
      break;
    case 'barrett':
      rifle(b, { len: 0.75, barrel: 0.55, mag: 0.12, body: '#3a3c40', scope: true, rail: true });
      b.box(0.07, 0.05, 0.08, BLACK, { z: 1.3, y: 0.05 });
      break;
    case 'm249':
      rifle(b, { len: 0.6, barrel: 0.35, body: '#3a3c40', handguard: BLACK });
      b.box(0.12, 0.12, 0.14, '#4a5230', { x: 0.02, y: -0.08, z: 0.2 });
      break;
    case 'm60':
      rifle(b, { len: 0.65, barrel: 0.4, body: '#2e3034', stockCol: WOOD, handguard: '#2e3034' });
      b.box(0.1, 0.1, 0.12, '#4a5230', { x: 0.06, y: -0.07, z: 0.22 });
      break;
    case 'm203':
      rifle(b, { len: 0.55, barrel: 0.25, mag: 0.15, rail: true });
      b.cyl(0.04, 0.04, 0.25, 10, '#3a3e44', { z: 0.45, y: -0.05, rx: Math.PI / 2 });
      break;
    case 'rpg':
      b.cyl(0.04, 0.04, 0.9, 10, '#4a5a3a', { z: 0.2, y: 0.06, rx: Math.PI / 2 });
      b.cone(0.07, 0.2, 10, '#5a6a3a', { z: 0.75, y: 0.06, rx: Math.PI / 2 });
      b.cyl(0.02, 0.07, 0.08, 10, '#c05a24', { z: 0.62, y: 0.06, rx: Math.PI / 2 });
      b.box(0.035, 0.1, 0.05, WOOD, { y: -0.03, z: 0.05 });
      break;
    case 'laser':
      rifle(b, { len: 0.55, barrel: 0.2, body: '#4a3a6a', stockCol: '#4a3a6a', mag: 0.1 });
      glow.cyl(0.03, 0.03, 0.25, 8, '#c060ff', { z: 0.35, y: 0.09, rx: Math.PI / 2 });
      glow.cyl(0.022, 0.022, 0.03, 8, '#ff9aff', { z: 0.78, y: 0.05, rx: Math.PI / 2 });
      break;
    case 'bat':
      b.cyl(0.025, 0.045, 0.75, 8, '#b88a4a', { z: 0.3, rx: Math.PI / 2 });
      b.cyl(0.02, 0.02, 0.15, 8, '#2a2a2a', { z: -0.05, rx: Math.PI / 2 });
      for (let i = 0; i < 4; i++) b.cone(0.012, 0.06, 4, '#9aa0a8', { z: 0.45 + i * 0.05, x: 0.04, rz: -Math.PI / 2 });
      break;
    case 'machete':
      b.box(0.012, 0.07, 0.5, '#b8bcc2', { z: 0.33, y: 0.01 });
      b.box(0.03, 0.04, 0.13, '#2a2a2a', { z: 0.02 });
      break;
    case 'axe':
      b.cyl(0.02, 0.02, 0.7, 8, '#b8261e', { z: 0.25, rx: Math.PI / 2 });
      b.box(0.02, 0.18, 0.12, '#8a8e94', { z: 0.52, y: 0.08 });
      b.box(0.02, 0.05, 0.06, '#8a8e94', { z: 0.52, y: -0.04 });
      break;
    default:
      rifle(b, { len: 0.5 });
  }
  const res = { geo: b.build(), glow: glow.empty ? null : glow.build() };
  cache.set(model, res);
  return res;
}

let gunMat = null;
let glowMat = null;
export function buildGun(model) {
  gunMat ||= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.45 });
  glowMat ||= new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const { geo, glow } = gunGeo(model);
  const g = new THREE.Group();
  const m = new THREE.Mesh(geo, gunMat);
  m.castShadow = true;
  g.add(m);
  if (glow) g.add(new THREE.Mesh(glow, glowMat));
  return g;
}

export function vestGeo(item) {
  const key = `vest${item.id}`;
  if (cache.has(key)) return cache.get(key);
  const b = new GeoBuilder();
  const c = item.color;
  b.box(0.52, 0.56, 0.32, c, { y: 0 }, { jitter: 0.06 });
  b.box(0.16, 0.12, 0.3, c, { x: -0.18, y: 0.32 });
  b.box(0.16, 0.12, 0.3, c, { x: 0.18, y: 0.32 });
  for (let i = 0; i < 3; i++) b.box(0.13, 0.15, 0.08, item.accent && i === 1 ? item.accent : c, { x: -0.16 + i * 0.16, y: -0.12, z: 0.19 }, { jitter: 0.1 });
  if (item.def >= 35) for (let i = 0; i < 2; i++) b.box(0.12, 0.13, 0.07, c, { x: -0.1 + i * 0.2, y: 0.08, z: 0.19 });
  b.box(0.54, 0.05, 0.34, '#1a1a1a', { y: -0.22 });
  const g = b.build();
  cache.set(key, g);
  return g;
}

export function helmetGeo(item) {
  const key = `helm${item.id}`;
  if (cache.has(key)) return cache.get(key);
  const b = new GeoBuilder();
  b.add(new THREE.SphereGeometry(0.2, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), item.color, { sy: 0.9 }, { flat: false });
  b.cyl(0.21, 0.21, 0.05, 12, item.color, { y: 0.0 });
  if (item.visor) b.add(new THREE.SphereGeometry(0.205, 12, 4, -Math.PI / 2 - 0.9, 1.8, Math.PI / 2 - 0.05, 0.55), '#4a5a6a', { y: 0.02 }, { flat: false });
  if (item.id === 'helm1') b.box(0.3, 0.07, 0.08, '#1a1a1a', { y: 0.03, z: 0.17 });
  if (item.id === 'helm3') b.box(0.06, 0.06, 0.08, '#2a2a2a', { y: 0.14, z: 0.16 });
  const g = b.build();
  cache.set(key, g);
  return g;
}

export function medkitGeo(item) {
  const key = `med${item.id}`;
  if (cache.has(key)) return cache.get(key);
  const b = new GeoBuilder();
  const w = 0.45 + item.heal * 0.2;
  b.box(w, 0.3, 0.2, item.color, { y: 0.15 }, { jitter: 0.05 });
  b.box(w + 0.02, 0.04, 0.22, '#1a1a1a', { y: 0.3 });
  b.box(0.2, 0.05, 0.03, '#2a2a2a', { y: 0.36 });
  b.box(0.1, 0.03, 0.03, '#2a2a2a', { x: -0.05, y: 0.33 });
  b.box(0.08, 0.2, 0.02, '#f2f2f2', { y: 0.16, z: 0.105 });
  b.box(0.2, 0.08, 0.02, '#f2f2f2', { y: 0.16, z: 0.105 });
  if (item.cure) {
    b.box(0.15, 0.2, 0.15, '#3a4a6a', { x: w / 2 + 0.05, y: 0.1 });
    b.box(0.12, 0.25, 0.1, '#6a6a3a', { x: -w / 2 - 0.04, y: 0.12 });
  }
  const g = b.build();
  cache.set(key, g);
  return g;
}

// ------------------------------ оружие в руках (вид от первого лица) ------------------------------

export class ViewModel {
  constructor(gunModel, melee, sleeve = '#4a5238') {
    this.group = new THREE.Group();
    this.melee = melee;
    this.hold = new THREE.Group();
    this.group.add(this.hold);
    const gun = buildGun(gunModel);
    // модели оружия смотрят в +Z, камера — в -Z
    gun.rotation.y = Math.PI;
    gun.scale.setScalar(melee ? 0.9 : 0.85);
    this.hold.add(gun);
    this.gun = gun;
    const b = new GeoBuilder();
    // правая рука на рукояти
    b.box(0.09, 0.1, 0.1, '#3b2a1c', { x: 0.0, y: -0.06, z: 0.02 });
    b.beam(new THREE.Vector3(0.0, -0.08, 0.06), new THREE.Vector3(0.12, -0.3, 0.42), 0.05, sleeve, 8);
    // левая рука под цевьём (для одноручного — ближе к рукояти)
    const fz = melee ? 0.05 : gunModel === 'pistol' || gunModel === 'revolver' ? -0.02 : -0.3;
    b.box(0.09, 0.08, 0.12, '#3b2a1c', { x: -0.02, y: -0.05, z: fz });
    b.beam(new THREE.Vector3(-0.02, -0.07, fz + 0.04), new THREE.Vector3(-0.2, -0.32, 0.35), 0.05, sleeve, 8);
    const arms = new THREE.Mesh(b.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
    this.hold.add(arms);
    this.muzzle = new THREE.Object3D();
    this.muzzle.position.set(0, 0.05, melee ? -0.5 : -0.8);
    this.hold.add(this.muzzle);
    this.base = new THREE.Vector3(0.19, -0.2, -0.46);
    this.hold.position.copy(this.base);
    this.recoil = 0;
    this.swing = 0;
    this.bob = 0;
    this.group.traverse((o) => {
      if (o.isMesh) {
        o.renderOrder = 10;
        o.frustumCulled = false;
      }
    });
  }

  kick(amount = 1) {
    if (this.melee) this.swing = 1;
    else this.recoil = Math.min(1.5, this.recoil + amount);
  }

  update(dt, moving, speed, reloading) {
    this.bob += dt * (moving ? speed * 1.6 : 1.2);
    const bx = Math.sin(this.bob) * (moving ? 0.018 : 0.004);
    const by = Math.abs(Math.cos(this.bob)) * (moving ? 0.022 : 0.005);
    this.recoil = Math.max(0, this.recoil - dt * 9);
    this.swing = Math.max(0, this.swing - dt * 4);
    const h = this.hold;
    h.position.set(this.base.x + bx, this.base.y + by + (reloading ? -0.12 : 0), this.base.z + this.recoil * 0.06);
    h.rotation.set(this.recoil * 0.12 + (reloading ? 0.6 : 0), 0, reloading ? 0.3 : 0);
    if (this.melee) {
      const a = Math.sin(this.swing * Math.PI);
      h.rotation.set(-a * 1.3 + 0.2, a * 0.6, -a * 0.8);
      h.position.x -= a * 0.15;
    }
  }
}

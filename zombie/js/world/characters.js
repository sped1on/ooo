// Персонажи: зомби и бандиты рисуются через InstancedMesh (одна отрисовка на часть тела
// для всех сразу), игрок — обычная модель с бронёй и оружием.

import * as THREE from 'three';
import { GeoBuilder } from '../engine/geo.js';
import { buildGun, vestGeo, helmetGeo } from './guns.js';
import { findArmor } from '../data/catalog.js';

// Геометрии частей тела. Цвета вершин — оттенки серого, итоговый цвет задаёт экземпляр.
function partGeos() {
  const leg = new GeoBuilder();
  leg.box(0.17, 0.78, 0.2, '#ffffff', { y: -0.39 });
  leg.box(0.19, 0.12, 0.3, '#3a3a3a', { y: -0.8, z: 0.05 });
  const torso = new GeoBuilder();
  torso.box(0.46, 0.62, 0.26, '#ffffff', { y: 0.33 });
  torso.box(0.48, 0.08, 0.28, '#444444', { y: 0.05 });
  torso.box(0.14, 0.1, 0.14, '#d0d0d0', { y: 0.66 });
  const head = new GeoBuilder();
  head.box(0.28, 0.3, 0.28, '#ffffff', { y: 0.17 });
  head.box(0.3, 0.08, 0.3, '#555555', { y: 0.33 });
  head.box(0.16, 0.05, 0.02, '#303030', { y: 0.07, z: 0.141 });
  const arm = new GeoBuilder();
  arm.box(0.13, 0.62, 0.14, '#ffffff', { y: -0.31 });
  arm.box(0.12, 0.12, 0.13, '#d8d8d8', { y: -0.66 });
  const eyes = new GeoBuilder();
  eyes.box(0.06, 0.04, 0.02, '#ffffff', { x: -0.065, y: 0.19, z: 0.145 });
  eyes.box(0.06, 0.04, 0.02, '#ffffff', { x: 0.065, y: 0.19, z: 0.145 });
  const gun = new GeoBuilder();
  gun.box(0.06, 0.1, 0.62, '#2a2c30', { z: 0.2 });
  gun.box(0.05, 0.14, 0.06, '#1a1a1a', { y: -0.1, z: 0.16 });
  gun.cyl(0.018, 0.018, 0.3, 6, '#1a1a1a', { z: 0.6, rx: Math.PI / 2 });
  const helmet = new GeoBuilder();
  helmet.add(new THREE.SphereGeometry(0.19, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), '#4a5236', { sy: 0.85 });
  helmet.cyl(0.2, 0.2, 0.03, 10, '#3a4028');
  const vest = new GeoBuilder();
  vest.box(0.52, 0.5, 0.32, '#3a3e36', {});
  vest.box(0.4, 0.14, 0.06, '#2a2c28', { y: -0.1, z: 0.17 });
  vest.box(0.14, 0.12, 0.06, '#d8d0b0', { x: 0.12, y: 0.12, z: 0.17 });
  const cap = new GeoBuilder();
  cap.cyl(0.155, 0.16, 0.1, 10, '#ffffff', {});
  cap.box(0.2, 0.02, 0.14, '#ffffff', { y: -0.04, z: 0.18 });
  const belly = new GeoBuilder();
  belly.ico(0.36, 1, '#ffffff', { sy: 0.9 });
  for (let i = 0; i < 6; i++) belly.ico(0.08, 0, '#d8f060', { x: Math.cos(i) * 0.3, y: Math.sin(i * 2) * 0.2, z: 0.2 + (i % 2) * 0.05 });
  return {
    helmet: helmet.build(),
    vest: vest.build(),
    cap: cap.build(),
    belly: belly.build(),
    leg: leg.build(),
    torso: torso.build(),
    head: head.build(),
    arm: arm.build(),
    eyes: eyes.build(),
    gun: gun.build(),
  };
}

let GEOS = null;
export function humanGeos() {
  GEOS ||= partGeos();
  return GEOS;
}

// Виды зомби. armor — доля урона от пуль, которую поглощает броня.
export const ZTYPES = {
  walker: { name: 'Ходок', hp: 40, speed: 1.4, scale: 1, dmg: 6, skin: ['#7f9a6a', '#8aa070', '#6f8a60', '#9aa08a'], eyes: '#ff3a1a', mass: 1, cap: 0.25 },
  runner: { name: 'Бегун', hp: 28, speed: 4.6, scale: 0.95, dmg: 5, skin: ['#9aa88a', '#a0a890', '#b0a898'], eyes: '#ffb01a', mass: 0.8, thin: true },
  crawler: { name: 'Ползун', hp: 30, speed: 1.0, scale: 1, dmg: 5, skin: ['#8a8a70', '#7a8a6a'], eyes: '#ff3a1a', mass: 0.7, crawl: true },
  brute: { name: 'Громила', hp: 220, speed: 1.25, scale: 1.55, dmg: 18, skin: ['#6a7a5a', '#5f6f52'], eyes: '#ff1a1a', mass: 3, bare: true },
  armored: { name: 'Бронированный', hp: 90, speed: 1.4, scale: 1.05, dmg: 9, skin: ['#8a9478', '#7a8a6a'], eyes: '#ff5a1a', mass: 1.4, armor: 0.55, helmet: true, vest: true },
  spitter: { name: 'Плевун', hp: 50, speed: 1.3, scale: 1.0, dmg: 7, skin: ['#8ad13a', '#7ac02a'], eyes: '#e8ff4a', mass: 1, toxic: true, spit: true },
  exploder: { name: 'Взрывной', hp: 35, speed: 1.9, scale: 1.1, dmg: 22, skin: ['#b8a060', '#a89050'], eyes: '#ff8a1a', mass: 1.3, belly: true, explode: true },
  bandit: { name: 'Бандит', hp: 70, speed: 2.6, scale: 1, dmg: 8, skin: ['#c89a7a', '#b8886a', '#d0a888'], eyes: null, mass: 1.1, human: true, cap: 0.5 },
  // боссы
  tank: { name: 'Танк', hp: 600, speed: 1.6, scale: 2.7, dmg: 22, skin: ['#5a6a4a'], eyes: '#ff1a1a', mass: 12, bare: true, boss: true, armor: 0.2 },
  queen: { name: 'Королева заразы', hp: 450, speed: 1.1, scale: 2.3, dmg: 14, skin: ['#9ad13a'], eyes: '#f0ff4a', mass: 8, toxic: true, spit: true, boss: true, belly: true },
  butcher: { name: 'Мясник', hp: 500, speed: 3.4, scale: 2.1, dmg: 16, skin: ['#9a7a6a'], eyes: '#ff3a1a', mass: 8, boss: true, armor: 0.3, helmet: true, vest: true },
};

const SHIRTS = ['#5a6a7a', '#7a5a4a', '#6a6a5a', '#8a7a6a', '#4a5a4a', '#7a4a4a', '#5a5a6a', '#9a8a6a'];
const PANTS = ['#3a3e4a', '#4a4032', '#2e3238', '#5a5040'];
const BANDIT_SHIRTS = ['#2a2c30', '#3a3228', '#4a3a2a', '#2a3a2a'];

const MAX = 90;
const _m = new THREE.Matrix4();
const _zero = new THREE.Matrix4().makeScale(0, 0, 0);
const _c = new THREE.Color();
const _white = new THREE.Color(1, 1, 1);
const _t = new THREE.Matrix4();
const _t2 = new THREE.Matrix4();

function makeRig() {
  const root = new THREE.Object3D();
  const torso = new THREE.Object3D();
  torso.position.set(0, 0.84, 0);
  root.add(torso);
  const head = new THREE.Object3D();
  head.position.set(0, 0.68, 0.02);
  torso.add(head);
  const armL = new THREE.Object3D();
  armL.position.set(0.31, 0.58, 0);
  const armR = new THREE.Object3D();
  armR.position.set(-0.31, 0.58, 0);
  torso.add(armL, armR);
  const legL = new THREE.Object3D();
  legL.position.set(0.11, 0.86, 0);
  const legR = new THREE.Object3D();
  legR.position.set(-0.11, 0.86, 0);
  root.add(legL, legR);
  const gun = new THREE.Object3D();
  gun.position.set(-0.05, 0.38, 0.3);
  torso.add(gun);
  return { root, torso, head, armL, armR, legL, legR, gun };
}

// Поза для ходьбы/атаки/прицеливания
export function poseRig(r, t, st) {
  const ph = st.phase;
  const moving = st.moving;
  const sw = moving ? Math.sin(ph) : 0;
  r.legL.rotation.set(-sw * 0.6, 0, 0);
  r.legR.rotation.set(sw * 0.6, 0, 0);
  r.torso.rotation.set(st.lean ?? 0.15, 0, Math.sin(ph * 0.5) * (moving ? 0.08 : 0.03));
  r.head.rotation.set(st.headX ?? 0.1, 0, st.headZ ?? 0);
  if (st.aim) {
    r.armL.rotation.set(-1.45, 0, -0.35);
    r.armR.rotation.set(-1.45, 0, 0.25);
  } else if (st.attack) {
    const a = Math.sin(t * 14);
    r.armL.rotation.set(-1.7 + a * 0.5, 0, 0.1);
    r.armR.rotation.set(-1.7 - a * 0.5, 0, -0.1);
  } else if (st.zombieArms) {
    r.armL.rotation.set(-1.35 + Math.sin(ph * 0.5 + 1) * 0.15, 0, 0.12);
    r.armR.rotation.set(-1.25 + Math.sin(ph * 0.5) * 0.15, 0, -0.12);
  } else {
    r.armL.rotation.set(sw * 0.5, 0, 0.08);
    r.armR.rotation.set(-sw * 0.5, 0, -0.08);
  }
}

export class Humans {
  constructor(scene) {
    const g = humanGeos();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const glow = new THREE.MeshBasicMaterial({ toneMapped: false });
    const mk = (geo, m) => {
      const im = new THREE.InstancedMesh(geo, m, MAX);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.frustumCulled = false;
      im.castShadow = true;
      for (let i = 0; i < MAX; i++) {
        im.setMatrixAt(i, _zero);
        im.setColorAt(i, _white);
      }
      scene.add(im);
      return im;
    };
    this.meshes = {
      legL: mk(g.leg, mat),
      legR: mk(g.leg, mat),
      torso: mk(g.torso, mat),
      head: mk(g.head, mat),
      armL: mk(g.arm, mat),
      armR: mk(g.arm, mat),
      eyes: mk(g.eyes, glow),
      gun: mk(g.gun, mat),
      helmet: mk(g.helmet, mat),
      vest: mk(g.vest, mat),
      cap: mk(g.cap, mat),
      belly: mk(g.belly, mat),
    };
    this.meshes.eyes.castShadow = false;
    this.slots = [];
    for (let i = 0; i < MAX; i++) this.slots.push({ i, used: false, rig: makeRig(), colors: null, flash: 0 });
    this.mat = mat;
  }

  alloc(type, rng) {
    const s = this.slots.find((x) => !x.used);
    if (!s) return null;
    s.used = true;
    const T = ZTYPES[type];
    const skin = _c.set(rng.pick(T.skin)).clone();
    const shirt = new THREE.Color(T.bare ? rng.pick(T.skin) : T.human ? rng.pick(BANDIT_SHIRTS) : rng.pick(SHIRTS));
    const pants = new THREE.Color(rng.pick(PANTS));
    if (T.toxic) shirt.set('#5a7a3a');
    s.colors = { skin, shirt, pants, eyes: new THREE.Color(T.eyes || '#000000') };
    s.type = type;
    s.flash = 0;
    s.hasGun = !!T.human;
    s.thin = !!T.thin;
    s.acc = { helmet: !!T.helmet, vest: !!T.vest, belly: !!T.belly, cap: !T.helmet && rng.chance(T.cap || 0) };
    s.capColor = new THREE.Color(rng.pick(['#b8261e', '#2f5f9e', '#3a3a3a', '#d8a018', '#4a6a3a']));
    for (const k of ['helmet', 'vest', 'belly']) {
      this.meshes[k].setColorAt(s.i, _white);
      this.meshes[k].instanceColor.needsUpdate = true;
    }
    this.meshes.belly.setColorAt(s.i, skin);
    this.meshes.cap.setColorAt(s.i, s.capColor);
    this.meshes.cap.instanceColor.needsUpdate = true;
    this._paint(s);
    return s;
  }

  _paint(s, flash = 0) {
    const c = s.colors;
    const set = (name, col) => {
      _c.copy(col);
      if (flash > 0) _c.lerp(_white, Math.min(1, flash));
      this.meshes[name].setColorAt(s.i, _c);
      this.meshes[name].instanceColor.needsUpdate = true;
    };
    set('legL', c.pants);
    set('legR', c.pants);
    set('torso', c.shirt);
    set('head', c.skin);
    set('armL', c.skin);
    set('armR', c.skin);
    set('gun', c.pants);
    this.meshes.eyes.setColorAt(s.i, c.eyes);
    this.meshes.eyes.instanceColor.needsUpdate = true;
  }

  hit(s) {
    s.flash = 1;
    this._paint(s, 1);
  }

  free(s) {
    s.used = false;
    for (const k in this.meshes) this.meshes[k].setMatrixAt(s.i, _zero);
  }

  // Записать матрицы из скелета
  sync(s, dt) {
    const r = s.rig;
    r.root.updateMatrixWorld(true);
    const sx = s.thin ? 0.85 : 1;
    const put = (name, obj, scaleX = 1) => {
      _m.copy(obj.matrixWorld);
      if (scaleX !== 1) _m.scale(new THREE.Vector3(scaleX, 1, 1));
      this.meshes[name].setMatrixAt(s.i, _m);
    };
    put('legL', r.legL, sx);
    put('legR', r.legR, sx);
    put('torso', r.torso, sx);
    put('head', r.head);
    put('armL', r.armL, sx);
    put('armR', r.armR, sx);
    put('eyes', r.head);
    if (s.hasGun) put('gun', r.gun);
    else this.meshes.gun.setMatrixAt(s.i, _zero);
    // снаряжение и особенности вида
    const acc = s.acc || {};
    const off = (name, obj, x, y, z, sc = 1) => {
      if (!acc[name]) {
        this.meshes[name].setMatrixAt(s.i, _zero);
        return;
      }
      _m.copy(obj.matrixWorld).multiply(_t.makeTranslation(x, y, z));
      if (sc !== 1) _m.multiply(_t2.makeScale(sc, sc, sc));
      this.meshes[name].setMatrixAt(s.i, _m);
    };
    off('helmet', r.head, 0, 0.27, 0);
    off('cap', r.head, 0, 0.33, 0.01);
    off('vest', r.torso, 0, 0.36, 0, 1.0);
    off('belly', r.torso, 0, 0.26, 0.1);
    if (s.flash > 0) {
      s.flash -= dt * 8;
      this._paint(s, Math.max(0, s.flash));
    }
  }

  commit() {
    for (const k in this.meshes) this.meshes[k].instanceMatrix.needsUpdate = true;
  }

  clear() {
    for (const s of this.slots) if (s.used) this.free(s);
    this.commit();
  }

  dispose(scene) {
    for (const k in this.meshes) {
      scene.remove(this.meshes[k]);
      this.meshes[k].dispose();
    }
  }
}

// ------------------------------ игрок ------------------------------

export class PlayerModel {
  constructor(equip) {
    const g = humanGeos();
    this.group = new THREE.Group();
    this.rig = makeRig();
    this.group.add(this.rig.root);
    const mat = (c) => new THREE.MeshLambertMaterial({ vertexColors: true, color: c });
    const skin = '#d8a888';
    const add = (obj, geo, c) => {
      const m = new THREE.Mesh(geo, mat(c));
      m.castShadow = true;
      obj.add(m);
      return m;
    };
    const r = this.rig;
    add(r.legL, g.leg, '#3f4a38');
    add(r.legR, g.leg, '#3f4a38');
    add(r.torso, g.torso, '#5a6a4a');
    add(r.head, g.head, skin);
    add(r.armL, g.arm, '#5a6a4a');
    add(r.armR, g.arm, '#5a6a4a');
    const vest = findArmor(equip.vest);
    if (vest) {
      const m = new THREE.Mesh(vestGeo(vest), new THREE.MeshLambertMaterial({ vertexColors: true }));
      m.position.set(0, 0.34, 0);
      m.scale.set(1.02, 1.05, 1.05);
      m.castShadow = true;
      r.torso.add(m);
    }
    const helm = findArmor(equip.helmet);
    if (helm) {
      const m = new THREE.Mesh(helmetGeo(helm), new THREE.MeshLambertMaterial({ vertexColors: true }));
      m.position.set(0, 0.25, 0);
      m.scale.setScalar(0.95);
      r.head.add(m);
    }
    // рюкзак
    const pack = new GeoBuilder();
    pack.box(0.36, 0.42, 0.18, '#5a4a32', { y: 0.36, z: -0.22 });
    pack.box(0.3, 0.1, 0.16, '#3a3022', { y: 0.62, z: -0.22 });
    r.torso.add(new THREE.Mesh(pack.build(), new THREE.MeshLambertMaterial({ vertexColors: true })));
    this.gun = buildGun(equip.gunModel || 'pistol');
    this.gun.position.set(-0.05, 0.36, 0.28);
    r.torso.add(this.gun);
    this.melee = equip.melee;
    this.muzzle = new THREE.Object3D();
    this.muzzle.position.set(0, 0.05, equip.melee ? 0.4 : 0.7);
    this.gun.add(this.muzzle);
    this.phase = 0;
    this.swing = 0;
  }

  pose(dt, moving, speed, aiming, t) {
    if (moving) this.phase += dt * speed * 3.2;
    poseRig(this.rig, t, { phase: this.phase, moving, aim: aiming && !this.melee, lean: 0.05, headX: 0 });
    if (this.melee) {
      this.swing = Math.max(0, this.swing - dt * 5);
      const a = this.swing;
      this.rig.armR.rotation.set(-1.2 - Math.sin(a * Math.PI) * 1.2, 0, 0.3);
      this.rig.armL.rotation.set(-1.0, 0, -0.3);
      this.gun.rotation.set(-0.6 + Math.sin(a * Math.PI) * 1.8, 0, 0);
    }
  }
}

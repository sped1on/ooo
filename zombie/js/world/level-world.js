// Наполнение уровня: природа и постройки (instanced по кускам дороги), базы, мост,
// заправка, лагерь бандитов и список всего, что оживает в игре (зомби, бандиты, ресурсы).

import * as THREE from 'three';
import { vcMat, geoMesh, matsFor } from '../engine/geo.js';
import * as P from './props.js';
import { ROAD_HALF } from './track.js';
import { pickZombieType, ZBOSS_NAMES } from '../data/catalog.js';
import { materialTex, textTex } from '../engine/textures.js';

const CHUNK = 150;

export class Scatter {
  constructor() {
    this.groups = new Map();
  }
  add(key, make, matrix, chunk) {
    const k = `${key}|${chunk}`;
    let g = this.groups.get(k);
    if (!g) {
      g = { key, make, list: [] };
      this.groups.set(k, g);
    }
    g.list.push(matrix.clone());
  }
  build(parent, shadowKeys) {
    const geos = new Map();
    for (const g of this.groups.values()) {
      if (!geos.has(g.key)) geos.set(g.key, g.make().build());
      const geo = geos.get(g.key);
      const im = new THREE.InstancedMesh(geo, matsFor(geo), g.list.length);
      g.list.forEach((m, i) => im.setMatrixAt(i, m));
      im.computeBoundingSphere();
      im.castShadow = shadowKeys(g.key);
      im.receiveShadow = true;
      parent.add(im);
    }
  }
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

export function buildLevelWorld(scene, track, biome, params, rng, opts = {}) {
  const L = track.L;
  const root = new THREE.Group();
  scene.add(root);
  const sc = new Scatter();
  const detail = opts.detail ?? 1;

  // Положить модель в координатах дороги
  const place = (key, make, s, x, { yaw = 0, scale = 1, dy = 0, sink = 0, absYaw = null } = {}) => {
    const f = track.frame(s, {});
    _p.set(f.x + f.rx * x, track.height(s, x) + dy - sink, f.z + f.rz * x);
    _q.setFromAxisAngle(_up, absYaw ?? f.yaw + yaw);
    _s.setScalar(scale);
    _m.compose(_p, _q, _s);
    sc.add(key, make, _m, Math.floor((s + 200) / CHUNK));
  };

  const blocked = (s, x, r = 3) => {
    if (s < 25 && Math.abs(x) < 50) return true;
    if (s > L - 25 && Math.abs(x) < 50) return true;
    if (track.flatZone(s, x) > 0.02) return true;
    if (track.lakeDepth(s, x) > 0.02) return true;
    if (Math.abs(x) < ROAD_HALF + 2 + r) return true;
    if (track.onBridge(s) && Math.abs(x) < 20) return true;
    return false;
  };

  // ---- занятые места: чтобы объекты не стояли друг в друге ----
  const occ = new Map();
  const cell = (s) => Math.floor(s / 20);
  const reserve = (s, x, r) => {
    const c = cell(s);
    if (!occ.has(c)) occ.set(c, []);
    occ.get(c).push([s, x, r]);
  };
  const free = (s, x, r) => {
    for (let c = cell(s - 30); c <= cell(s + 30); c++) {
      const list = occ.get(c);
      if (!list) continue;
      for (const [s2, x2, r2] of list) if ((s - s2) ** 2 + (x - x2) ** 2 < (r + r2) ** 2) return false;
    }
    return true;
  };
  for (const k of [0.18, 0.62]) {
    const s0 = Math.round(L * k);
    reserve(s0, 22, 7);
    reserve(s0, -22, 7);
  }
  // высота для постройки: самая низкая точка под ней, чтобы не висела над склоном
  const groundUnder = (s, x, r) => {
    let h = Infinity;
    for (const [ds, dx] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) h = Math.min(h, track.height(s + ds * 0.7, x + dx * 0.7));
    return h;
  };

  // ---- столбы вдоль дороги ----
  for (let s = 30; s < L - 30; s += 42) {
    if (blocked(s, -11, -5) && !(track.flatZone(s, -11) < 0.02)) continue;
    if (track.onBridge(s) || track.lakeDepth(s, -11) > 0.02 || track.flatZone(s, -11) > 0.02) continue;
    reserve(s, -11, 1.2);
    place('pole', P.pole, s, -11, { yaw: Math.PI / 2 });
  }
  // знаки
  for (let s = 60; s < L - 60; s += rng.f(160, 320)) {
    const x = rng.sign() * 9;
    if (track.flatZone(s, x) > 0.02 || track.onBridge(s)) continue;
    const v = rng.i(0, 1);
    if (!free(s, x, 1)) continue;
    reserve(s, x, 1);
    place(`sign${v}`, () => P.roadSign(v), s, x, { yaw: x > 0 ? Math.PI : 0 });
  }

  // ---- постройки у дороги ----
  const buildings = [
    ['house0', () => P.house(0), 6],
    ['house1', () => P.house(1), 6],
    ['house2', () => P.house(2), 6],
    ['ruin0', () => P.ruin(0), 7],
    ['ruin1', () => P.ruin(1), 7],
    ['hangar', P.hangar, 10],
    ['garage0', () => P.garageShed(0), 5],
    ['garage1', () => P.garageShed(1), 5],
    ['tower', P.watchtower, 3],
    ['bunker', P.bunker, 6],
    ['wtower', P.waterTower, 4],
    ['cont0', () => P.container(0), 4],
    ['cont2', () => P.container(2), 4],
  ];
  for (let s = 70; s < L - 40; s += rng.f(90, 180)) {
    const side = rng.sign();
    const [key, make, r] = rng.pick(buildings);
    const x = side * rng.f(20 + r, 38 + r);
    if (blocked(s, x, r + 4) || track.flatZone(s, x * 0.6) > 0.02 || !free(s, x, r + 3)) continue;
    const facing = side > 0 ? -Math.PI / 2 : Math.PI / 2; // фасадом к дороге
    reserve(s, x, r + 3);
    place(key, make, s, x, { yaw: facing + rng.f(-0.2, 0.2), dy: groundUnder(s, x, r) - track.height(s, x) - 0.15 });
    // забор и мусор рядом
    if (rng.chance(0.6)) {
      const fx = x + side * rng.f(-2, 4);
      const broken = rng.chance(0.5);
      if (free(s + r + 5, fx, 4)) {
        reserve(s + r + 5, fx, 4);
        place(`fence8${broken}`, () => P.fence(8, broken), s + r + 5, fx, { yaw: facing + Math.PI / 2 });
      }
    }
    if (rng.chance(0.5) && free(s - r - 3, x - side * 4, 1.2)) {
      reserve(s - r - 3, x - side * 4, 1.2);
      place('barrels3', () => P.barrels(3, 0), s - r - 3, x - side * 4, { yaw: rng.f(0, 6) });
    }
    if (rng.chance(0.4) && free(s, x - side * (r + 2), 1.2)) {
      reserve(s, x - side * (r + 2), 1.2);
      place('tires', P.tires, s, x - side * (r + 2), { yaw: rng.f(0, 6) });
    }
  }
  // брошенные машины на обочине
  for (let s = 50; s < L - 50; s += rng.f(60, 140)) {
    const x = rng.sign() * rng.f(9.5, 14);
    if (track.flatZone(s, x) > 0.02 || track.onBridge(s) || track.lakeDepth(s, x) > 0.02 || !free(s, x, 2.6)) continue;
    reserve(s, x, 2.6);
    const v = rng.i(0, 4);
    place(`wreck${v}`, () => P.wreck(v), s, x, { yaw: rng.f(-0.6, 0.6) + (rng.chance(0.5) ? Math.PI : 0), sink: 0.05 });
  }

  // ---- деревья, кусты, камни, трава ----
  const trees = biome.trees;
  const treeMake = (t, v) => {
    switch (t) {
      case 'spruce':
        return [`spruce${v}`, () => P.spruce(v)];
      case 'snowspruce':
        return [`sspruce${v}`, () => P.spruce(v, true)];
      case 'pine':
        return [`pine${v}`, () => P.pine(v)];
      case 'birch':
        return [`birch${v}`, () => P.birch(v)];
      case 'autumn':
        return [`autumn${v}`, () => P.birch(v, true)];
      case 'dead':
        return [`dead${v}`, () => P.deadTree(v)];
      default:
        return [`bush${v}`, () => P.bush(v, biome.grass)];
    }
  };
  const nTrees = Math.round(L * 2.4 * biome.treeDensity * detail);
  for (let i = 0; i < nTrees; i++) {
    const s = rng.f(track.s0 + 5, track.s1 - 5);
    const side = rng.sign();
    const x = side * (13 + Math.pow(rng.next(), 1.5) * 200);
    if (blocked(s, x, 2) || !free(s, x, 1.6)) continue;
    reserve(s, x, 0.8);
    const t = rng.pick(trees);
    const [key, make] = treeMake(t, rng.i(0, 2));
    place(key, make, s, x, { yaw: rng.f(0, 6.28), scale: rng.f(0.8, 1.35), sink: 0.2 });
  }
  // кусты
  const nBush = Math.round(L * 0.8 * detail);
  for (let i = 0; i < nBush; i++) {
    const s = rng.f(track.s0, track.s1);
    const x = rng.sign() * rng.f(11, 90);
    if (blocked(s, x, 0) || !free(s, x, 1)) continue;
    const v = rng.i(0, 2);
    place(`bush${v}`, () => P.bush(v, biome.grass), s, x, { yaw: rng.f(0, 6.28), scale: rng.f(0.7, 1.3) });
  }
  // трава
  if (biome.name !== 'Снега') {
    const nGrass = Math.round(L * 2.2 * detail);
    for (let i = 0; i < nGrass; i++) {
      const s = rng.f(track.s0, track.s1);
      const x = rng.sign() * rng.f(8.5, 45);
      if (track.lakeDepth(s, x) > 0.02) continue;
      if ((s < 20 || s > L - 20) && Math.abs(x) < 50) continue;
      if (!free(s, x, 0.3)) continue;
      place('grass', () => P.grassTuft(biome.grass), s, x, { yaw: rng.f(0, 6.28), scale: rng.f(0.8, 1.4) });
    }
  }
  // камни и скалы
  const rockCol = biome.name === 'Снега' ? '#9aa4ae' : '#8a8580';
  const nRocks = Math.round(L * 0.35 * biome.rocks * detail);
  for (let i = 0; i < nRocks; i++) {
    const s = rng.f(track.s0, track.s1);
    const x = rng.sign() * rng.f(12, 150);
    if (blocked(s, x, 1) || !free(s, x, 2)) continue;
    reserve(s, x, 1.5);
    const v = rng.i(0, 3);
    place(`rock${v}`, () => P.rock(v, rockCol), s, x, { yaw: rng.f(0, 6.28), scale: rng.f(0.6, 2.2), sink: 0.3 });
  }
  const nCliffs = Math.round(L * 0.03 * biome.rocks);
  for (let i = 0; i < nCliffs; i++) {
    const s = rng.f(track.s0, track.s1);
    const x = rng.sign() * rng.f(60, 200);
    if (blocked(s, x, 10) || !free(s, x, 8)) continue;
    reserve(s, x, 7);
    const v = rng.i(0, 2);
    place(`cliff${v}`, () => P.cliff(v, rockCol), s, x, { yaw: rng.f(0, 6.28), scale: rng.f(1, 2), sink: 2 });
  }
  const nStumps = Math.round(L * 0.06);
  for (let i = 0; i < nStumps; i++) {
    const s = rng.f(0, L);
    const x = rng.sign() * rng.f(10, 40);
    if (blocked(s, x, 0) || !free(s, x, 0.8)) continue;
    place('stump', P.stump, s, x, { yaw: rng.f(0, 6.28) });
  }

  // ---- большие объекты ----
  const addMesh = (builder, s, x, yawOff = 0, y = null) => {
    const f = track.frame(s, {});
    const m = geoMesh(builder.build());
    m.position.set(f.x + f.rx * x, y ?? track.roadY(s), f.z + f.rz * x);
    m.rotation.y = f.yaw + yawOff;
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
    return m;
  };
  // мост
  addMesh(P.bridge(track.bridgeLen, ROAD_HALF * 2), track.bridgeS, 0, 0, track.roadY(track.bridgeS));
  // заправка (слева от дороги: локальный +X — левая сторона)
  addMesh(P.gasStation(), track.stationS, 0);
  const canopy = addMesh(P.gasCanopy(), track.stationS, 0);
  canopy.material = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 1 });
  // лагерь бандитов (справа)
  addMesh(P.banditCamp(), track.campS, 0);

  // базы
  const bases = [];
  const mkBase = (s, flip, color) => {
    const f = track.frame(s, {});
    const g = new THREE.Group();
    g.position.set(f.x, track.roadY(s), f.z);
    g.rotation.y = f.yaw + (flip ? Math.PI : 0);
    const m = geoMesh(P.baseModel(color).build());
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    const doorGeo = P.gateDoor().build();
    const left = geoMesh(doorGeo);
    left.position.x = -P.BASE.gateHalf;
    const right = geoMesh(doorGeo);
    right.position.x = P.BASE.gateHalf;
    right.rotation.y = Math.PI;
    left.castShadow = right.castShadow = true;
    g.add(left, right);
    const gdoor = new THREE.Mesh(new THREE.BoxGeometry(6.8, 4.8, 0.12), new THREE.MeshLambertMaterial({ color: 0x9aa2aa, map: materialTex('roofm') }));
    gdoor.position.set(0, 2.4, P.BASE.garageDoorZ + 0.08);
    gdoor.castShadow = true;
    g.add(gdoor);
    const gateName = flip ? opts.toName : opts.fromName;
    if (gateName) {
      const gs = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.62), new THREE.MeshBasicMaterial({ map: textTex(gateName.toUpperCase(), { color: '#f2c21b', size: 84 }), transparent: true }));
      gs.position.set(0, 5.2, 0.37);
      g.add(gs);
    }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 0.8), new THREE.MeshLambertMaterial({ map: textTex('ГАРАЖ', { color: '#f2c21b', size: 90 }), transparent: true }));
    sign.position.set(0, 5.4, P.BASE.garageDoorZ + 0.19);
    g.add(sign);
    if (!flip) {
      // свет внутри гаража — видно интерьер, когда ворота поднимаются
      const lamp = new THREE.PointLight('#ffe2b0', 60, 20, 1.6);
      lamp.position.set(0, 4.8, P.BASE.garageDoorZ - 6);
      g.add(lamp);
    }
    root.add(g);
    const b = { group: g, left, right, garageDoor: gdoor, open: 0, garageOpen: 0 };
    bases.push(b);
    return b;
  };
  const startBase = mkBase(0, false, '#2f5f9e');
  const endBase = mkBase(L, true, '#b8261e');


  // ---- живые объекты ----
  const spawns = { zombies: [], bandits: [], turrets: [], pickups: [], obstacles: [], mines: [], spikes: [] };
  const pois = [];
  const Z = (s, x, type) => spawns.zombies.push({ s, x, type });
  const pickZType = () => pickZombieType(params.mix, rng.next());
  const nearStation = (s) => Math.abs(s - track.stationS) < 70;

  // одиночные зомби вдоль дороги
  const nZ = Math.round((L - 160) * params.zombieDensity);
  for (let i = 0; i < nZ; i++) {
    const s = rng.f(90, L - 60);
    if (nearStation(s)) continue;
    Z(s, rng.f(-16, 16), pickZType());
  }
  // орды
  const hordes = [0.3, 0.7, 0.9].map((k) => Math.round(L * k));
  for (const hs of hordes) {
    pois.push({ type: 'zombies', s: hs, x: 0 });
    const n = 8 + Math.round(params.zombieDensity * 120);
    for (let i = 0; i < n; i++) Z(hs + rng.f(-25, 25), rng.f(-12, 12), pickZType());
    spawns.obstacles.push({ kind: 'wreck', s: hs - 10, x: rng.sign() * rng.f(2, 4), v: rng.i(0, 4), yaw: rng.f(0.6, 1.2) });
  }
  // тайники с ресурсами
  for (const k of [0.18, 0.62]) {
    const s = Math.round(L * k);
    const side = rng.sign();
    pois.push({ type: 'res', s, x: side * 18 });
    place('garage0', () => P.garageShed(0), s, side * 22, { yaw: side > 0 ? -Math.PI / 2 : Math.PI / 2, sink: 0.3 });
    for (let i = 0; i < 5; i++) spawns.obstacles.push({ kind: 'crate', s: s + rng.f(-12, 12), x: side * rng.f(8.5, 11) });
    for (let i = 0; i < 10; i++) spawns.pickups.push({ s: s + rng.f(-30, 30), x: rng.f(-5, 5), kind: rng.pick(['wood', 'metal', 'cloth', 'metal', 'cash', 'ammo']) });
    for (let i = 0; i < 4; i++) Z(s + rng.f(-15, 15), side * rng.f(10, 18), 'walker');
  }
  // случайные препятствия
  for (let s = 120; s < L - 80; s += params.obstacleEvery * rng.f(0.7, 1.3)) {
    if (nearStation(s) || track.onBridge(s) || Math.abs(s - track.campS) < 60) continue;
    const r = rng.next();
    if (r < 0.3) spawns.obstacles.push({ kind: 'wreck', s, x: rng.sign() * rng.f(1.5, 4.5), v: rng.i(0, 4), yaw: rng.f(-0.8, 0.8) + (rng.chance(0.5) ? Math.PI : 0) });
    else if (r < 0.5) spawns.obstacles.push({ kind: 'block', s, x: rng.sign() * 3.5, v: rng.i(0, 1) });
    else if (r < 0.75) {
      const x = rng.f(-5, 5);
      spawns.obstacles.push({ kind: 'barrel', s, x });
      if (rng.chance(0.6)) spawns.obstacles.push({ kind: 'barrel', s: s + 1.2, x: x + 0.9 });
    } else {
      const x = rng.f(-5, 5);
      spawns.obstacles.push({ kind: 'crate', s, x });
      spawns.obstacles.push({ kind: 'crate', s: s + 1.3, x: x + rng.f(-1, 1) });
    }
  }
  // ресурсы на дороге
  const weights = [['cash', 30], ['wood', 20], ['metal', 20], ['cloth', 12], ['ammo', 10], ['repair', 4], ['fuel', 4]];
  const tot = weights.reduce((a, w) => a + w[1], 0);
  const pickKind = () => {
    let r = rng.f(0, tot);
    for (const [k, w] of weights) {
      r -= w;
      if (r <= 0) return k;
    }
    return 'cash';
  };
  for (let s = 60; s < L - 40; s += rng.f(18, 34)) {
    if (nearStation(s)) continue;
    if (rng.chance(0.25)) {
      // цепочка монет
      const x = rng.f(-4.5, 4.5);
      for (let i = 0; i < 5; i++) spawns.pickups.push({ s: s + i * 3, x, kind: 'cash' });
      s += 15;
    } else spawns.pickups.push({ s, x: rng.f(-5, 5), kind: pickKind() });
  }

  // ресурсы не должны лежать внутри препятствий
  spawns.pickups = spawns.pickups.filter((pk) => !spawns.obstacles.some((o) => Math.abs(o.s - pk.s) < 3.2 && Math.abs(o.x - pk.x) < 2.8));

  // лагерь бандитов, мины, шипы
  pois.push({ type: 'camp', s: track.campS, x: 20 });
  const campF = track.frame(track.campS, {});
  const nb = Math.min(params.bandits, P.CAMP.bandits.length);
  for (let i = 0; i < nb; i++) {
    const p = P.CAMP.bandits[i];
    spawns.bandits.push({ s: track.campS + p.z, x: -p.x });
  }
  spawns.turrets.push({ s: track.campS + P.CAMP.turret.z, x: -P.CAMP.turret.x });
  for (let i = 0; i < params.mines; i++) spawns.mines.push({ s: track.campS - 60 + rng.f(0, 110), x: rng.f(-6, 6) });
  spawns.spikes.push({ s: track.campS - 70, x: rng.sign() * 3.5 });
  spawns.obstacles.push({ kind: 'block', s: track.campS + 25, x: 3.5, v: 1 });
  void campF;

  // босс перед воротами базы
  spawns.boss = { s: L - 170, x: 0, type: params.boss };
  pois.push({ type: 'boss', s: L - 170, x: 0, name: ZBOSS_NAMES[params.boss] });
  pois.push({ type: 'bridge', s: track.bridgeS, x: 0 });
  pois.push({ type: 'station', s: track.stationS, x: -20 });
  pois.push({ type: 'base', s: 0, x: 0, start: true });
  pois.push({ type: 'base', s: L, x: 0 });

  const station = {
    s: track.stationS,
    pumps: P.STATION.pumps.map((p) => ({ s: track.stationS + p.z, x: -p.x })),
    car: { s: track.stationS + P.STATION.carSpot.z, x: -P.STATION.carSpot.x },
  };

  sc.build(root, (key) => !key.startsWith('grass') && !key.startsWith('bush'));

  return { root, pois, spawns, station, startBase, endBase, bases, canopy };
}

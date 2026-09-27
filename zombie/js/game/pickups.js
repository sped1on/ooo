// Модели подбираемых предметов и динамических объектов уровня.

import * as THREE from 'three';
import { GeoBuilder, vcMat } from '../engine/geo.js';
import * as P from '../world/props.js';

const geos = {};
function g(key, fn) {
  if (!geos[key]) geos[key] = fn().build();
  return geos[key];
}

export const PICKUP_COLORS = {
  cash: '#5fd34a',
  wood: '#d09a50',
  metal: '#b8c8da',
  cloth: '#e8d8b0',
  ammo: '#ffd23a',
  fuel: '#ff5a3a',
  repair: '#ff5a5a',
};

function pickupGeo(kind) {
  return g(`p_${kind}`, () => {
    const b = new GeoBuilder();
    switch (kind) {
      case 'cash':
        for (let i = 0; i < 3; i++) b.box(0.7, 0.14, 0.36, i % 2 ? '#4fbf3a' : '#6ad84a', { y: i * 0.15, ry: i * 0.2 });
        b.box(0.12, 0.47, 0.38, '#e8e0b0', { y: 0.15 });
        break;
      case 'wood':
        for (let i = 0; i < 3; i++) b.box(0.9, 0.12, 0.2, '#b07a3c', { y: i * 0.13, z: (i - 1) * 0.1, ry: (i - 1) * 0.15 });
        break;
      case 'metal':
        b.torus(0.25, 0.08, 5, 8, '#9fb2c8', { rx: Math.PI / 2 });
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          b.box(0.12, 0.1, 0.12, '#9fb2c8', { x: Math.cos(a) * 0.36, z: Math.sin(a) * 0.36, ry: -a });
        }
        b.box(0.5, 0.06, 0.2, '#7a8898', { y: 0.12, ry: 0.5 });
        break;
      case 'cloth':
        b.cyl(0.2, 0.2, 0.7, 8, '#d8c7a0', { rz: Math.PI / 2 });
        b.cyl(0.21, 0.21, 0.1, 8, '#a8977a', { rz: Math.PI / 2, x: 0.2 });
        break;
      case 'ammo':
        b.box(0.6, 0.35, 0.35, '#5a6030', {});
        b.box(0.62, 0.08, 0.37, '#3a3e22', { y: 0.12 });
        for (let i = 0; i < 4; i++) b.cyl(0.035, 0.035, 0.18, 6, '#e0b22a', { x: -0.2 + i * 0.13, y: 0.25 });
        break;
      case 'fuel':
        b.box(0.45, 0.6, 0.22, '#c8261c', {});
        b.cyl(0.05, 0.05, 0.12, 6, '#2a2a2a', { x: 0.12, y: 0.35 });
        b.box(0.25, 0.06, 0.08, '#2a2a2a', { x: -0.05, y: 0.33 });
        break;
      case 'repair':
        b.box(0.6, 0.4, 0.3, '#d8d8d0', {});
        b.box(0.12, 0.3, 0.02, '#d8261e', { z: 0.16 });
        b.box(0.3, 0.1, 0.02, '#d8261e', { z: 0.16 });
        b.box(0.3, 0.06, 0.1, '#2a2a2a', { y: 0.24 });
        break;
      default:
        b.box(0.5, 0.5, 0.5, '#ffffff');
    }
    return b;
  });
}

let ringGeo = null;
const ringMats = {};
export function makePickup(kind) {
  const grp = new THREE.Group();
  const m = new THREE.Mesh(pickupGeo(kind), vcMat());
  m.position.y = 0.9;
  m.castShadow = true;
  grp.add(m);
  ringGeo ||= new THREE.RingGeometry(0.55, 0.8, 24).rotateX(-Math.PI / 2);
  ringMats[kind] ||= new THREE.MeshBasicMaterial({ color: PICKUP_COLORS[kind], transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  const ring = new THREE.Mesh(ringGeo, ringMats[kind]);
  ring.position.y = 0.08;
  grp.add(ring);
  grp.userData.item = m;
  return grp;
}

export function makeObstacle(o) {
  let geo;
  switch (o.kind) {
    case 'wreck':
      geo = g(`wreck${o.v}`, () => P.wreck(o.v));
      break;
    case 'block':
      geo = g(`block${o.v}`, () => P.roadblock(o.v));
      break;
    case 'barrel':
      geo = g('rbarrel', P.redBarrel);
      break;
    case 'crate':
      geo = g('crate0', () => P.crate(0));
      break;
    case 'mine':
      geo = g('mine', P.mine);
      break;
    case 'spikes':
      geo = g('spikes', () => P.spikeTrap(6));
      break;
    default:
      geo = g('crate0', () => P.crate(0));
  }
  const m = new THREE.Mesh(geo, vcMat());
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Размеры для столкновений (полудлина вдоль дороги, полуширина)
export const OBSTACLE_SIZE = {
  wreck: [2.3, 1.0],
  block: [0.5, 2.4],
  barrel: [0.4, 0.4],
  crate: [0.55, 0.55],
};

let rocketGeo = null;
let grenadeGeo = null;
export function projectileMesh(kind) {
  if (kind === 'rocket') {
    rocketGeo ||= (() => {
      const b = new GeoBuilder();
      b.cyl(0.07, 0.07, 0.6, 8, '#5a6040', { rx: Math.PI / 2 });
      b.cone(0.07, 0.18, 8, '#c21e1e', { z: 0.38, rx: Math.PI / 2 });
      return b.build();
    })();
    return new THREE.Mesh(rocketGeo, vcMat());
  }
  if (kind === 'mine') return new THREE.Mesh(g('mine', P.mine), vcMat());
  grenadeGeo ||= (() => {
    const b = new GeoBuilder();
    b.ico(0.13, 1, '#3a4028');
    return b.build();
  })();
  return new THREE.Mesh(grenadeGeo, vcMat());
}

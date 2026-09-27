// Модели машин: кузов из профилей, колёса, фары, бампера, решётки, оружие на крыше
// и кабина с руками водителя для вида из салона.
// Машина смотрит вдоль +Z, левая сторона (место водителя) — +X.

import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { GeoBuilder, makeMatrix } from '../engine/geo.js';
import { grimeTex, camoTex, meshTex, gaugeTex } from '../engine/textures.js';
import { findPart } from '../data/catalog.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Профили кузовов. top — верхний контур нижней части от заднего низа до переднего низа,
// cab — стёкла [зад-низ, зад-верх, перед-верх, перед-низ], cw — ширина кабины.
export const SPECS = {
  sedan: {
    L: 4.5, W: 1.8, wr: 0.34, ww: 0.24, ax: [-1.35, 1.4], bottom: 0.3,
    top: [[-2.25, 0.35], [-2.3, 0.75], [-2.2, 0.98], [-1.25, 1.02], [1.05, 1.02], [2.15, 0.95], [2.3, 0.75], [2.25, 0.35]],
    cab: [[-1.25, 1.0], [-0.7, 1.48], [0.45, 1.5], [1.1, 1.0]], cw: 1.6, lights: 'rect', ly: 0.8, grille: 'wide',
  },
  boxy: {
    L: 4.2, W: 1.7, wr: 0.33, ww: 0.22, ax: [-1.25, 1.3], bottom: 0.3,
    top: [[-2.1, 0.35], [-2.13, 0.95], [-1.3, 1.0], [0.98, 1.0], [2.08, 0.95], [2.13, 0.4]],
    cab: [[-1.3, 0.98], [-0.85, 1.45], [0.35, 1.47], [0.95, 0.99]], cw: 1.54, lights: 'rect', ly: 0.75, grille: 'chrome',
  },
  uaz: {
    L: 4.1, W: 1.85, wr: 0.42, ww: 0.3, ax: [-1.3, 1.3], bottom: 0.45,
    top: [[-2.05, 0.5], [-2.05, 1.15], [1.0, 1.15], [1.98, 1.1], [2.05, 0.55]],
    cab: [[-2.0, 1.14], [-2.0, 1.95], [0.55, 1.95], [1.0, 1.14]], cw: 1.72, lights: 'round', ly: 0.92, grille: 'slots',
    rack: true, spare: true, flares: true,
  },
  pickup: {
    L: 5.3, W: 2.0, wr: 0.43, ww: 0.3, ax: [-1.75, 1.6], bottom: 0.45,
    top: [[-2.65, 0.5], [-2.65, 1.25], [0.95, 1.3], [2.5, 1.25], [2.65, 1.05], [2.62, 0.5]],
    cab: [[-0.9, 1.28], [-0.85, 2.0], [0.35, 2.0], [1.0, 1.3]], cw: 1.84, lights: 'rect', ly: 1.02, grille: 'big',
    bed: [-2.6, -0.95], flares: true,
  },
  muscle: {
    L: 4.8, W: 1.95, wr: 0.38, ww: 0.28, ax: [-1.45, 1.45], bottom: 0.3,
    top: [[-2.4, 0.35], [-2.42, 0.8], [-2.3, 0.95], [-1.2, 0.98], [0.9, 0.95], [2.3, 0.82], [2.42, 0.6], [2.38, 0.35]],
    cab: [[-1.25, 0.96], [-0.5, 1.32], [0.25, 1.33], [1.0, 0.93]], cw: 1.66, lights: 'slim', ly: 0.72, grille: 'dark',
    scoop: true,
  },
  suv: {
    L: 4.8, W: 1.9, wr: 0.42, ww: 0.3, ax: [-1.4, 1.45], bottom: 0.45,
    top: [[-2.4, 0.5], [-2.4, 1.2], [1.05, 1.2], [2.3, 1.12], [2.4, 0.55]],
    cab: [[-2.35, 1.19], [-2.35, 2.0], [0.6, 2.0], [1.1, 1.19]], cw: 1.78, lights: 'round', ly: 0.95, grille: 'slots',
    spare: true, flares: true, snorkel: true,
  },
  charger: {
    L: 5.1, W: 1.95, wr: 0.38, ww: 0.28, ax: [-1.55, 1.6], bottom: 0.32,
    top: [[-2.55, 0.35], [-2.57, 0.9], [-2.4, 1.0], [-1.35, 1.02], [0.95, 1.0], [2.45, 0.95], [2.57, 0.8], [2.55, 0.35]],
    cab: [[-1.35, 1.0], [-0.75, 1.4], [0.3, 1.42], [1.05, 1.0]], cw: 1.7, lights: 'hidden', ly: 0.82, grille: 'full',
  },
  jeep: {
    L: 4.2, W: 1.85, wr: 0.46, ww: 0.34, ax: [-1.35, 1.3], bottom: 0.55,
    top: [[-2.05, 0.6], [-2.08, 1.25], [0.75, 1.25], [1.95, 1.2], [2.05, 0.7]],
    cab: [[-1.9, 1.24], [-1.9, 1.95], [0.55, 1.95], [0.75, 1.24]], cw: 1.7, lights: 'round', ly: 1.02, grille: 'slots7',
    open: true, spare: true, flares: true,
  },
  hatch: {
    L: 4.25, W: 1.8, wr: 0.35, ww: 0.25, ax: [-1.3, 1.3], bottom: 0.3,
    top: [[-2.1, 0.35], [-2.15, 1.0], [1.0, 1.0], [2.05, 0.9], [2.15, 0.62], [2.1, 0.35]],
    cab: [[-2.05, 0.99], [-1.85, 1.5], [0.3, 1.52], [1.05, 0.99]], cw: 1.62, lights: 'slim', ly: 0.78, grille: 'dark',
  },
  bigpickup: {
    L: 5.8, W: 2.1, wr: 0.47, ww: 0.34, ax: [-1.95, 1.8], bottom: 0.5,
    top: [[-2.9, 0.55], [-2.9, 1.35], [1.1, 1.4], [2.75, 1.38], [2.9, 1.15], [2.88, 0.55]],
    cab: [[-1.25, 1.38], [-1.2, 2.15], [0.45, 2.15], [1.15, 1.4]], cw: 1.94, lights: 'rect', ly: 1.1, grille: 'huge',
    bed: [-2.85, -1.3], flares: true,
  },
  hyper: {
    L: 4.5, W: 2.05, wr: 0.37, ww: 0.3, ax: [-1.35, 1.35], bottom: 0.18,
    top: [[-2.25, 0.25], [-2.3, 0.75], [-2.1, 0.9], [-0.9, 0.95], [0.9, 0.85], [2.1, 0.62], [2.28, 0.4], [2.25, 0.22]],
    cab: [[-1.4, 0.93], [-0.55, 1.2], [0.2, 1.2], [1.05, 0.84]], cw: 1.6, lights: 'slim', ly: 0.55, grille: 'horseshoe',
    cline: true,
  },
};

function shapeFrom(pts) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  return s;
}

// Выдавливание профиля по ширине машины (ось X), профиль лежит в плоскости Z-Y
function extrudeProfile(shape, width, bevel = 0.05) {
  const depth = Math.max(0.01, width - bevel * 2);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 12,
  });
  g.translate(0, 0, -depth / 2);
  g.rotateY(-Math.PI / 2);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.28, uv.getY(i) * 0.28);
  return g;
}

function lowerShape(spec) {
  const s = new THREE.Shape();
  const pts = spec.top;
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  const r = spec.wr + 0.08;
  const cy = spec.wr;
  const ax = [...spec.ax].sort((a, b) => b - a);
  for (const z of ax) {
    s.lineTo(z + r, spec.bottom);
    s.lineTo(z + r, Math.min(cy, spec.bottom + 0.02));
    s.absarc(z, cy, r, 0, Math.PI, false);
    s.lineTo(z - r, spec.bottom);
  }
  s.closePath();
  return s;
}

// Собирает окрашенные детали в одну геометрию (с UV для текстуры грязи)
class PaintParts {
  constructor() {
    this.list = [];
  }
  add(geo, t) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (t) g.applyMatrix4(makeMatrix(t).clone());
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    this.list.push(g);
  }
  box(w, h, d, t) {
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w * 0.3, uv.getY(i) * h * 0.3);
    this.add(g, t);
  }
  plank(a, b, w, h) {
    const len = a.distanceTo(b);
    const g = new THREE.BoxGeometry(w, h, len);
    const m = new THREE.Matrix4().lookAt(a, b, V(0, 1, 0));
    m.setPosition(a.clone().add(b).multiplyScalar(0.5));
    this.add(g, m);
  }
  build() {
    const g = mergeGeometries(this.list.map((x) => {
      const keep = new THREE.BufferGeometry();
      keep.setAttribute('position', x.attributes.position);
      keep.setAttribute('normal', x.attributes.normal);
      keep.setAttribute('uv', x.attributes.uv);
      return keep;
    }));
    g.computeBoundingSphere();
    return g;
  }
}

// ------------------------------ материалы ------------------------------

const mats = {};
function mat(key, make) {
  if (!mats[key]) mats[key] = make();
  return mats[key];
}
export const MAT = {
  glass: () => mat('glass', () => new THREE.MeshStandardMaterial({ color: 0x2a3c4c, roughness: 0.06, metalness: 0.35, transparent: true, opacity: 0.5, depthWrite: false })),
  inside: () => mat('inside', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05 })),
  trim: () => mat('trim', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.35 })),
  light: () => mat('light', () => new THREE.MeshBasicMaterial({ vertexColors: true })),
  tire: () => mat('tire', () => new THREE.MeshStandardMaterial({ color: 0x1b1b1d, roughness: 0.92, metalness: 0 })),
  gun: () => mat('gun', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.55 })),
  glow: () => mat('glow', () => new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })),
  interior: () => mat('interior', () => new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.85, metalness: 0.1 })),
};

export function paintMaterial(carDef, paintId) {
  const p = findPart('paint', paintId);
  const color = p.color || carDef.color;
  const rust = p.id === 'factory' ? carDef.rust : 0.15;
  const m = new THREE.MeshStandardMaterial({
    color,
    map: p.camo ? camoTex() : grimeTex(rust),
    roughness: p.metal ? 0.25 : 0.55,
    metalness: p.metal ? 0.9 : 0.3,
  });
  if (p.id === 'toxic') {
    m.emissive = new THREE.Color('#2a6a0a');
    m.emissiveIntensity = 0.35;
  }
  return m;
}

// ------------------------------ колесо ------------------------------

export function buildWheel(r, w, wheelsId) {
  const part = findPart('wheels', wheelsId);
  const g = new THREE.Group();
  // шина — тело вращения со скруглённой боковиной
  const rr = r * 0.6;
  const hw = w / 2;
  const prof = [];
  prof.push(new THREE.Vector2(rr * 1.02, -hw * 0.92));
  prof.push(new THREE.Vector2(r * 0.86, -hw));
  for (let i = 0; i <= 6; i++) {
    const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2);
    prof.push(new THREE.Vector2(r * 0.9 + Math.cos(a) * r * 0.1, -hw * 0.7 + Math.sin(a) * hw * 0.3));
  }
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    prof.push(new THREE.Vector2(r * 0.9 + Math.cos(a) * r * 0.1, hw * 0.7 + Math.sin(a) * hw * 0.3));
  }
  prof.push(new THREE.Vector2(r * 0.86, hw));
  prof.push(new THREE.Vector2(rr * 1.02, hw * 0.92));
  const tg = new THREE.LatheGeometry(prof, 28).rotateZ(Math.PI / 2);
  const tire = new THREE.Mesh(tg, MAT.tire());
  tire.castShadow = true;
  g.add(tire);
  const tb = new GeoBuilder();
  // протектор
  const n = 22;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    for (const sx of [-1, 1]) tb.box(w * 0.34, 0.035, 0.07, '#18181a', { x: sx * w * 0.2, y: Math.cos(a) * r * 0.995, z: Math.sin(a) * r * 0.995, rx: a, ry: sx * 0.35 });
  }
  // диск
  const rim = part.rim;
  for (const sx of [1, -1]) {
    const face = sx * (hw * 0.78);
    tb.torus(rr * 0.97, 0.022, 6, 24, rim, { x: face, ry: Math.PI / 2 });
    tb.cyl(rr, rr * 0.95, 0.04, 20, '#2a2c30', { x: face - sx * 0.04, rz: Math.PI / 2 });
    for (let i = 0; i < part.spokes; i++) {
      const a = (i / part.spokes) * Math.PI * 2;
      tb.box(0.035, rr * 0.72, 0.07, rim, { x: face - sx * 0.01, y: Math.cos(a) * rr * 0.5, z: Math.sin(a) * rr * 0.5, rx: a });
    }
    tb.cyl(rr * 0.3, rr * 0.34, 0.05, 14, rim, { x: face, rz: Math.PI / 2 });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      tb.cyl(0.012, 0.012, 0.03, 6, '#d8dce2', { x: face + sx * 0.03, y: Math.cos(a) * rr * 0.2, z: Math.sin(a) * rr * 0.2, rz: Math.PI / 2 });
    }
    tb.cyl(rr * 0.1, rr * 0.1, 0.02, 10, part.accent || '#c8ccd2', { x: face + sx * 0.035, rz: Math.PI / 2 });
    if (part.spikes) tb.cone(0.05, 0.22, 6, '#c8ccd2', { x: sx * (hw + 0.1), rz: -sx * Math.PI / 2 });
  }
  const tm = new THREE.Mesh(tb.build(), MAT.trim());
  tm.castShadow = true;
  g.add(tm);
  return g;
}

// ------------------------------ бампера ------------------------------

export function buildBumper(id, spec) {
  const b = new GeoBuilder();
  const W = spec.W;
  const fz = spec.top[spec.top.length - 1][0] + 0.08;
  const y = spec.bottom + 0.22;
  const dark = '#2c2f33';
  const steel = '#5c6168';
  switch (id) {
    case 'std':
      b.box(W + 0.06, 0.2, 0.22, dark, { y, z: fz });
      b.box(W * 0.3, 0.06, 0.05, steel, { y: y + 0.03, z: fz + 0.12 });
      break;
    case 'heavy':
      b.box(W + 0.14, 0.34, 0.32, '#3a3d42', { y: y + 0.04, z: fz + 0.04 });
      for (const x of [-0.6, -0.2, 0.2, 0.6]) b.box(0.08, 0.36, 0.06, steel, { x: x * W * 0.5 / 0.6, y: y + 0.04, z: fz + 0.22 });
      for (const x of [-0.45, 0.45]) b.torus(0.06, 0.02, 6, 10, '#c8a018', { x, y: y - 0.08, z: fz + 0.24, rx: Math.PI / 2 });
      break;
    case 'bull': {
      const tube = '#4a4e54';
      b.box(W * 0.9, 0.18, 0.2, dark, { y, z: fz });
      const zf = fz + 0.22;
      const top = spec.ly + 0.3;
      for (const x of [-0.55, 0.55]) {
        b.beam(V(x * W / 1.1, y - 0.05, zf), V(x * W / 1.1, top, zf), 0.045, tube);
        b.beam(V(x * W / 1.1, top, zf), V(x * W / 1.1 * 0.7, top + 0.12, zf - 0.08), 0.045, tube);
      }
      b.beam(V(-W * 0.35, top + 0.12, zf - 0.08), V(W * 0.35, top + 0.12, zf - 0.08), 0.045, tube);
      b.beam(V(-W * 0.5, y + 0.25, zf), V(W * 0.5, y + 0.25, zf), 0.04, tube);
      for (const x of [-0.18, 0.18]) b.beam(V(x * W, y - 0.05, zf + 0.02), V(x * W, top + 0.1, zf - 0.06), 0.04, tube);
      break;
    }
    case 'spikes':
      b.box(W + 0.1, 0.26, 0.26, '#34373c', { y, z: fz + 0.02 });
      for (let i = 0; i < 7; i++) {
        const x = (i / 6 - 0.5) * W * 0.95;
        b.cone(0.07, 0.34, 6, '#b8bcc2', { x, y: y + (i % 2 ? 0.05 : -0.05), z: fz + 0.3, rx: Math.PI / 2 });
      }
      break;
    case 'plow': {
      const s = new THREE.Shape();
      s.moveTo(0, 0);
      s.lineTo(0.55, 0.0);
      s.lineTo(0.2, 0.9);
      s.lineTo(0.05, 0.95);
      s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: W + 0.4, bevelEnabled: false });
      g.translate(0, 0, -(W + 0.4) / 2);
      g.rotateY(-Math.PI / 2);
      b.add(g, '#c9951c', { y: spec.bottom - 0.12, z: fz - 0.05 });
      for (let i = 0; i < 5; i++) {
        const x = (i / 4 - 0.5) * (W + 0.2);
        b.box(0.05, 0.8, 0.06, '#2a2c30', { x, y: spec.bottom + 0.33, z: fz + 0.28, rx: -0.4 });
      }
      b.box(W * 0.6, 0.12, 0.3, dark, { y, z: fz - 0.05 });
      break;
    }
    default:
      return null;
  }
  const m = new THREE.Mesh(b.build(), MAT.trim());
  m.castShadow = true;
  return m;
}

// ------------------------------ решётки ------------------------------

function windshield(spec) {
  const [, , ft, fb] = spec.cab;
  return { fb: V(0, fb[1], fb[0]), ft: V(0, ft[1], ft[0]) };
}

export function buildGrille(id, spec) {
  if (id === 'none' || !id) return null;
  const grp = new THREE.Group();
  const b = new GeoBuilder();
  const { fb, ft } = windshield(spec);
  const cw = spec.cw;
  const dir = ft.clone().sub(fb);
  const nrm = V(0, dir.z, -dir.y).normalize(); // наружу от стекла
  if (nrm.z < 0) nrm.multiplyScalar(-1);
  const at = (t, x, off = 0.07) => fb.clone().lerp(ft, t).add(nrm.clone().multiplyScalar(off)).setX(x);
  const bar = '#3c4046';
  const fz = spec.top[spec.top.length - 1][0] + 0.02;
  // защита радиатора — у всех решёток
  const gy = spec.ly;
  for (let i = 0; i < 5; i++) b.box(spec.W * 0.55, 0.035, 0.04, bar, { y: gy - 0.18 + i * 0.09, z: fz + 0.1 });
  for (const x of [-0.3, 0, 0.3]) b.box(0.04, 0.46, 0.05, bar, { x: x * spec.W * 0.9, y: gy, z: fz + 0.12 });
  if (id === 'classic' || id === 'steel' || id === 'cage') {
    const n = id === 'classic' ? 5 : 7;
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 1);
      b.beam(at(t, -cw / 2), at(t, cw / 2), 0.022, bar);
    }
    b.beam(at(0, -cw / 2 + 0.05), at(1, -cw / 2 + 0.05), 0.03, bar);
    b.beam(at(0, cw / 2 - 0.05), at(1, cw / 2 - 0.05), 0.03, bar);
  }
  if (id === 'steel' || id === 'cage') {
    // пластины на нижнюю часть лобового и боковые окна
    const p0 = at(0.02, 0, 0.08);
    const p1 = at(0.32, 0, 0.08);
    b.plank(p0.clone().setX(0), p1.clone().setX(0), cw * 0.98, 0.04, '#4a4e55');
    const [rb, rt] = spec.cab;
    const mid = (rb[0] + fb.z) / 2;
    const len = Math.abs(fb.z - rb[0]) * 0.8;
    for (const sx of [1, -1]) {
      for (let i = 0; i < 4; i++) {
        const y = fb.y + 0.12 + i * ((rt[1] - fb.y - 0.2) / 4);
        b.box(0.03, 0.03, len, bar, { x: sx * (cw / 2 + 0.06), y, z: mid });
      }
    }
  }
  if (id === 'cage') {
    const [rb, rt, ftp] = spec.cab;
    const top = rt[1] + 0.14;
    const tube = '#2e3136';
    for (const sx of [1, -1]) {
      const x = sx * (cw / 2 + 0.1);
      b.beam(V(x, fb.y, fb.z + 0.05), V(x, top, ftp[0] - 0.05), 0.045, tube);
      b.beam(V(x, top, ftp[0] - 0.05), V(x, top, rt[0] + 0.05), 0.045, tube);
      b.beam(V(x, top, rt[0] + 0.05), V(x, rb[1], rb[0] - 0.05), 0.045, tube);
    }
    for (const z of [ftp[0] - 0.05, rt[0] + 0.05, (ftp[0] + rt[0]) / 2]) b.beam(V(-cw / 2 - 0.1, top, z), V(cw / 2 + 0.1, top, z), 0.04, tube);
  }
  const m = new THREE.Mesh(b.build(), MAT.trim());
  m.castShadow = true;
  grp.add(m);
  if (id === 'mesh' || id === 'cage') {
    // сетка на лобовом стекле
    const len = fb.distanceTo(ft);
    const plane = new THREE.PlaneGeometry(cw * 0.96, len * 0.96);
    const tex = meshTex().clone();
    tex.needsUpdate = true;
    tex.repeat.set(cw * 3, len * 3);
    const pm = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.4, side: THREE.DoubleSide, metalness: 0.5, roughness: 0.5 });
    const mesh = new THREE.Mesh(plane, pm);
    const center = fb.clone().lerp(ft, 0.5).add(nrm.clone().multiplyScalar(0.05));
    mesh.position.copy(center);
    mesh.lookAt(center.clone().add(nrm));
    grp.add(mesh);
    const frame = new GeoBuilder();
    frame.beam(at(0, -cw / 2, 0.05), at(0, cw / 2, 0.05), 0.03, bar);
    frame.beam(at(1, -cw / 2, 0.05), at(1, cw / 2, 0.05), 0.03, bar);
    frame.beam(at(0, -cw / 2, 0.05), at(1, -cw / 2, 0.05), 0.03, bar);
    frame.beam(at(0, cw / 2, 0.05), at(1, cw / 2, 0.05), 0.03, bar);
    grp.add(new THREE.Mesh(frame.build(), MAT.trim()));
  }
  return grp;
}

// ------------------------------ оружие машины ------------------------------

// Возвращает { group, pivot, muzzle, spin } — pivot поворачивается к цели
export function buildCarWeapon(model) {
  const group = new THREE.Group();
  const base = new GeoBuilder();
  base.cyl(0.26, 0.32, 0.1, 12, '#2a2d31', { y: 0.05 });
  base.box(0.3, 0.2, 0.3, '#34383d', { y: 0.2 });
  group.add(new THREE.Mesh(base.build(), MAT.gun()));
  const pivot = new THREE.Group();
  pivot.position.y = 0.36;
  group.add(pivot);
  const b = new GeoBuilder();
  const glow = new GeoBuilder();
  const gm = '#2f3337';
  const dk = '#1d1f22';
  let muzzleZ = 1.0;
  let muzzleY = 0.05;
  let spin = null;
  switch (model) {
    case 'mg':
      b.box(0.18, 0.2, 0.6, gm, { z: 0.1 });
      b.cyl(0.035, 0.035, 0.7, 8, dk, { z: 0.7, rx: Math.PI / 2 });
      b.box(0.2, 0.18, 0.2, '#4b5230', { x: 0.2, y: -0.02, z: 0.05 });
      b.box(0.05, 0.14, 0.05, dk, { z: 0.95, y: 0.05 });
      muzzleZ = 1.05;
      break;
    case 'mg2':
      b.box(0.2, 0.22, 0.75, gm, { z: 0.15 });
      b.cyl(0.04, 0.04, 0.85, 8, dk, { z: 0.85, rx: Math.PI / 2 });
      b.cyl(0.07, 0.07, 0.5, 10, '#3a3e44', { z: 0.75, rx: Math.PI / 2 });
      b.box(0.26, 0.24, 0.26, '#5a6038', { x: 0.25, y: -0.05 });
      b.box(0.08, 0.06, 0.3, dk, { y: 0.15, z: 0.1 });
      muzzleZ = 1.28;
      break;
    case 'mg3':
      b.box(0.22, 0.24, 0.8, '#3a3f45', { z: 0.15 });
      b.cyl(0.045, 0.045, 1.0, 8, dk, { z: 0.95, rx: Math.PI / 2 });
      b.box(0.1, 0.1, 0.1, '#c8a018', { z: 1.42 });
      b.box(0.3, 0.26, 0.3, '#5a6038', { x: 0.28, y: -0.05 });
      for (let i = 0; i < 5; i++) b.box(0.05, 0.08, 0.03, '#c8a018', { x: 0.14 + i * 0.03, y: -0.02, z: 0.2 - i * 0.02 });
      muzzleZ = 1.48;
      break;
    case 'gatling': {
      b.box(0.34, 0.32, 0.5, gm, { z: 0 });
      b.box(0.3, 0.3, 0.3, '#5a6038', { x: 0.32, y: -0.04 });
      const sg = new GeoBuilder();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        sg.cyl(0.03, 0.03, 0.9, 6, dk, { x: Math.cos(a) * 0.09, y: Math.sin(a) * 0.09, z: 0.45, rx: Math.PI / 2 });
      }
      sg.cyl(0.14, 0.14, 0.06, 10, '#44484e', { z: 0.2, rx: Math.PI / 2 });
      sg.cyl(0.14, 0.14, 0.06, 10, '#44484e', { z: 0.8, rx: Math.PI / 2 });
      spin = new THREE.Mesh(sg.build(), MAT.gun());
      spin.position.z = 0.25;
      pivot.add(spin);
      muzzleZ = 1.2;
      break;
    }
    case 'turret': {
      b.box(0.42, 0.34, 0.5, '#3a3e44', { z: 0 });
      b.box(0.3, 0.12, 0.3, '#2a2d31', { y: 0.22, z: -0.05 });
      b.cyl(0.05, 0.05, 0.8, 8, dk, { x: 0.08, z: 0.6, rx: Math.PI / 2 });
      b.cyl(0.05, 0.05, 0.8, 8, dk, { x: -0.08, z: 0.6, rx: Math.PI / 2 });
      glow.box(0.12, 0.05, 0.02, '#ff3a2a', { y: 0.1, z: 0.26 });
      b.cyl(0.07, 0.07, 0.1, 8, '#222', { y: 0.33, z: 0.05 });
      muzzleZ = 1.02;
      break;
    }
    case 'flamer':
      b.box(0.2, 0.2, 0.55, gm, { z: 0.15 });
      b.cyl(0.05, 0.07, 0.6, 10, '#4a3a2a', { z: 0.7, rx: Math.PI / 2 });
      b.cyl(0.13, 0.13, 0.5, 12, '#8a6a30', { x: 0.26, y: -0.02, rx: Math.PI / 2 });
      b.cyl(0.13, 0.13, 0.5, 12, '#8a6a30', { x: -0.26, y: -0.02, rx: Math.PI / 2 });
      glow.cyl(0.03, 0.03, 0.04, 8, '#ff8a2a', { z: 1.02, rx: Math.PI / 2 });
      muzzleZ = 1.05;
      break;
    case 'grenade':
      b.box(0.22, 0.24, 0.5, gm, { z: 0.05 });
      b.cyl(0.1, 0.1, 0.7, 12, dk, { z: 0.6, rx: Math.PI / 2 });
      b.cyl(0.12, 0.12, 0.1, 12, '#3a3e44', { z: 0.9, rx: Math.PI / 2 });
      for (let i = 0; i < 6; i++) b.box(0.06, 0.1, 0.06, '#c8a018', { x: 0.14, y: -0.14 - i * 0.02, z: -0.1 + i * 0.07 });
      muzzleZ = 0.98;
      break;
    case 'mortar':
      b.box(0.3, 0.26, 0.5, '#4a4f36', { z: 0 });
      for (const x of [-0.12, 0.12]) b.cyl(0.1, 0.1, 0.6, 12, '#3a3f2a', { x, y: 0.12, z: 0.35, rx: Math.PI / 2 - 0.35 });
      muzzleZ = 0.7;
      muzzleY = 0.35;
      break;
    case 'mines':
      b.box(0.6, 0.3, 0.6, '#3a3e44', { z: 0 });
      for (const x of [-0.18, 0, 0.18]) {
        b.cyl(0.08, 0.08, 0.06, 10, dk, { x, y: 0.02, z: 0.31, rx: Math.PI / 2 });
        glow.cyl(0.035, 0.035, 0.02, 8, '#ff7a2a', { x, y: 0.02, z: 0.345, rx: Math.PI / 2 });
      }
      b.box(0.5, 0.06, 0.4, '#555a60', { y: 0.18 });
      muzzleZ = 0.4;
      break;
    case 'pod':
      b.box(0.5, 0.42, 0.55, '#4b5230', { z: 0.05 });
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          const x = (i - 1) * 0.14;
          const y = (j - 1) * 0.12;
          b.cyl(0.05, 0.05, 0.06, 8, dk, { x, y, z: 0.34, rx: Math.PI / 2 });
          b.cone(0.045, 0.1, 8, '#c21e1e', { x, y, z: 0.4, rx: Math.PI / 2 });
        }
      }
      muzzleZ = 0.45;
      break;
    case 'launcher':
      for (const x of [-0.17, 0.17]) {
        b.cyl(0.15, 0.15, 1.0, 12, '#55603a', { x, z: 0.3, rx: Math.PI / 2 });
        b.cone(0.12, 0.2, 10, '#c21e1e', { x, z: 0.86, rx: Math.PI / 2 });
      }
      b.box(0.5, 0.12, 0.4, '#34383d', { y: -0.14 });
      muzzleZ = 0.95;
      break;
    case 'cannon':
      b.box(0.42, 0.3, 0.6, '#3a3e44', { z: 0 });
      b.cyl(0.07, 0.08, 1.1, 10, dk, { z: 0.8, rx: Math.PI / 2 });
      b.cyl(0.1, 0.1, 0.16, 10, '#2a2d31', { z: 1.32, rx: Math.PI / 2 });
      muzzleZ = 1.42;
      break;
    case 'hcannon':
      b.box(0.55, 0.38, 0.75, '#3a3e44', { z: -0.05 });
      b.box(0.4, 0.14, 0.5, '#2e3136', { y: 0.25, z: -0.1 });
      b.cyl(0.1, 0.11, 1.5, 12, dk, { z: 1.0, rx: Math.PI / 2 });
      b.cyl(0.14, 0.14, 0.22, 12, '#2a2d31', { z: 1.78, rx: Math.PI / 2 });
      muzzleZ = 1.9;
      break;
    case 'shock':
      b.box(0.3, 0.26, 0.5, '#2e3a5a', { z: 0 });
      b.cyl(0.08, 0.08, 0.5, 10, '#3a3f45', { z: 0.45, rx: Math.PI / 2 });
      for (let i = 0; i < 4; i++) glow.torus(0.11, 0.022, 6, 14, '#4aa8ff', { z: 0.3 + i * 0.1 });
      glow.ico(0.07, 0, '#9ad8ff', { z: 0.74 });
      muzzleZ = 0.78;
      break;
    case 'laser':
      b.box(0.34, 0.3, 0.6, '#2a3350', { z: 0 });
      b.cyl(0.09, 0.07, 0.9, 12, '#3a4050', { z: 0.7, rx: Math.PI / 2 });
      glow.cyl(0.095, 0.095, 0.3, 12, '#3a9aff', { z: 0.45, rx: Math.PI / 2 });
      glow.cyl(0.05, 0.05, 0.04, 8, '#bfe6ff', { z: 1.16, rx: Math.PI / 2 });
      muzzleZ = 1.18;
      break;
    default:
      b.box(0.2, 0.2, 0.6, gm);
  }
  const gunMesh = new THREE.Mesh(b.build(), MAT.gun());
  gunMesh.castShadow = true;
  pivot.add(gunMesh);
  if (!glow.empty) pivot.add(new THREE.Mesh(glow.build(), MAT.glow()));
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, muzzleY, muzzleZ);
  pivot.add(muzzle);
  return { group, pivot, muzzle, spin };
}

// ------------------------------ сама машина ------------------------------

// ------------------------------ помощники кузова ------------------------------

// Отсечение многоугольника вертикальной прямой z = c (оставляем сторону keep = +1 / -1)
function clipPoly(pts, c, keep) {
  const out = [];
  const inside = (p) => (p.x - c) * keep >= 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const ia = inside(a);
    const ib = inside(b);
    if (ia) out.push(a);
    if (ia !== ib) {
      const t = (c - a.x) / (b.x - a.x);
      out.push(new THREE.Vector2(c, a.y + (b.y - a.y) * t));
    }
  }
  return out.length >= 3 ? out : null;
}

// Делим нижнюю часть кузова: капот, багажник и боковины салона
function splitLower(spec, zr, zf) {
  const pts = lowerShape(spec).extractPoints(14).shape;
  const toShape = (p) => (p ? new THREE.Shape(p) : null);
  const front = clipPoly(pts, zf, 1);
  const rear = clipPoly(pts, zr, -1);
  const m1 = clipPoly(pts, zr, 1);
  const mid = m1 ? clipPoly(m1, zf, -1) : null;
  return { front: toShape(front), rear: toShape(rear), mid: toShape(mid) };
}

// Штатный бампер: закруглённые края, накладка, противотуманки
function stockBumper(b, s, z, dir, full) {
  const W = s.W;
  const y = s.bottom + 0.16;
  const col = '#2a2c30';
  if (!full) return;
  const w = W * 0.84;
  b.box(w, 0.2, 0.2, col, { y, z });
  for (const sx of [1, -1]) b.cyl(0.1, 0.1, 0.2, 12, col, { x: sx * w / 2, y, z: z - dir * 0.0 });
  b.box(w * 0.94, 0.035, 0.03, '#5a5e64', { y: y + 0.05, z: z + dir * 0.1 });
  b.box(w * 0.9, 0.05, 0.24, '#18191b', { y: y - 0.11, z: z - dir * 0.01 });
  if (dir > 0) for (const sx of [1, -1]) b.cyl(0.045, 0.045, 0.03, 12, '#e8e4c8', { x: sx * w * 0.36, y: y - 0.03, z: z + 0.1, rx: Math.PI / 2 });
}

const plateCache = new Map();
function plate(seed, x, y, z, ry) {
  let tex = plateCache.get(seed);
  if (!tex) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 56;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#eceae2';
    ctx.fillRect(0, 0, 256, 56);
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 4;
    ctx.strokeRect(3, 3, 250, 50);
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '700 38px Oswald, Arial Narrow, sans-serif';
    ctx.textBaseline = 'middle';
    const L = 'АВЕКМНОРСТУХ';
    let h = 0;
    for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const txt = `${L[h % 12]} ${String(100 + (h % 899))} ${L[(h >> 4) % 12]}${L[(h >> 8) % 12]}`;
    ctx.fillText(txt, 14, 30);
    ctx.fillRect(196, 8, 2, 40);
    ctx.font = '700 22px Oswald, Arial Narrow, sans-serif';
    ctx.fillText(String(10 + (h % 89)), 206, 24);
    ctx.font = '700 12px Oswald, sans-serif';
    ctx.fillText('RUS', 210, 44);
    tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    plateCache.set(seed, tex);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.114), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }));
  m.position.set(x, y, z);
  m.rotation.y = ry;
  return m;
}

export class CarModel {
  constructor(carDef, equip = {}) {
    this.def = carDef;
    this.spec = SPECS[carDef.type];
    this.group = new THREE.Group();
    this.body = new THREE.Group(); // крен и тангаж кузова
    this.group.add(this.body);
    this.wheels = [];
    this.steer = 0;
    this.build(equip);
  }

  build(equip) {
    const s = this.spec;
    const def = this.def;
    const paint = paintMaterial(def, equip.paint || 'factory');
    this.paintMat = paint;
    const pp = new PaintParts();
    const trim = new GeoBuilder();
    const lights = new GeoBuilder();
    const inside = new GeoBuilder();
    const W = s.W;
    const [rb, rt, ft, fb] = s.cab;
    const fz = s.top[s.top.length - 1][0];
    const rz = s.top[0][0];
    const belt = fb[1];
    const wallT = 0.09;

    // кузов: капот и багажник цельные, в районе салона — только боковины (салон полый)
    const { front, rear, mid } = splitLower(s, rb[0] + 0.02, fb[0] - 0.02);
    if (front) pp.add(extrudeProfile(front, W, 0.06));
    if (rear) pp.add(extrudeProfile(rear, W, 0.06));
    if (mid) for (const sx of [1, -1]) pp.add(extrudeProfile(mid, wallT, 0.02), { x: sx * (W / 2 - wallT / 2) });
    // пол салона и порог
    const cabLen = fb[0] - rb[0];
    const cabMid = (fb[0] + rb[0]) / 2;
    const floorY = s.bottom + 0.2;
    inside.box(W - wallT * 2, 0.06, cabLen, '#1c1d20', { y: floorY, z: cabMid });

    // салон: сиденья, панель, консоль, обшивка дверей
    const seatCol = def.rust > 0.5 ? '#4a3a2c' : '#2c2d31';
    const seatY = Math.min(belt - 0.3, floorY + 0.35);
    const seat = (x, z, w, bench = false) => {
      inside.box(w, 0.12, 0.5, seatCol, { x, y: seatY, z }, { jitter: 0.05 });
      inside.box(w * 0.9, seatY - floorY - 0.06, 0.4, '#18191b', { x, y: (seatY + floorY) / 2, z });
      inside.box(w, 0.62, 0.12, seatCol, { x, y: seatY + 0.33, z: z - 0.3, rx: -0.18 }, { jitter: 0.05 });
      if (!bench) inside.box(w * 0.55, 0.16, 0.1, seatCol, { x, y: seatY + 0.74, z: z - 0.37, rx: -0.18 });
      else for (const hx of [-w * 0.3, w * 0.3]) inside.box(0.26, 0.15, 0.1, seatCol, { x: x + hx, y: seatY + 0.72, z: z - 0.37, rx: -0.18 });
    };
    const frontSeatZ = fb[0] - 1.45;
    const sw = Math.min(0.55, s.cw * 0.34);
    seat(W * 0.22, frontSeatZ, sw);
    seat(-W * 0.22, frontSeatZ, sw);
    if (frontSeatZ - 0.35 - rb[0] > 0.9) seat(0, Math.max(rb[0] + 0.45, frontSeatZ - 0.95), s.cw * 0.86, true);
    // приборная панель
    const dashTop = belt + 0.09;
    inside.box(s.cw - 0.02, 0.3, 0.46, '#2a2b2e', { y: dashTop - 0.15, z: fb[0] - 0.2 });
    inside.box(s.cw - 0.02, 0.04, 0.5, '#1f2023', { y: dashTop, z: fb[0] - 0.22 });
    inside.box(0.46, 0.08, 0.18, '#18191c', { x: W * 0.22, y: dashTop + 0.05, z: fb[0] - 0.36 });
    inside.box(0.3, 0.24, 0.1, '#232427', { y: dashTop - 0.14, z: fb[0] - 0.46 });
    inside.box(0.2, 0.05, 0.015, '#3a8a5a', { y: dashTop - 0.08, z: fb[0] - 0.515 });
    for (const sx of [-0.08, 0.08]) inside.box(0.07, 0.04, 0.015, '#111214', { x: sx, y: dashTop - 0.18, z: fb[0] - 0.515 });
    // центральная консоль и рычаг КПП
    inside.box(0.24, 0.22, Math.min(1.0, cabLen - 0.8), '#232427', { y: floorY + 0.14, z: fb[0] - 0.95 });
    inside.cyl(0.012, 0.012, 0.2, 6, '#9a9ea4', { y: floorY + 0.34, z: fb[0] - 0.75, rx: -0.2 });
    inside.ico(0.035, 1, '#141416', { y: floorY + 0.44, z: fb[0] - 0.77 });
    // обшивка дверей с подлокотником
    for (const sx of [1, -1]) {
      const x = sx * (W / 2 - wallT - 0.015);
      inside.box(0.03, belt - floorY - 0.06, cabLen - 0.25, '#34332f', { x, y: (belt + floorY) / 2 - 0.02, z: cabMid });
      inside.box(0.07, 0.05, 0.5, '#26262a', { x: x - sx * 0.03, y: seatY + 0.18, z: frontSeatZ + 0.05 });
      inside.box(0.02, 0.02, 0.12, '#9a9ea4', { x: x - sx * 0.02, y: belt - 0.1, z: fb[0] - 0.6 });
    }
    // руль (опущен, как в настоящей машине)
    this.steeringWheel = new THREE.Group();
    this.steeringWheel.position.set(W * 0.22, belt - 0.02, fb[0] - 0.74);
    this.steeringWheel.rotation.x = 0.5;
    const wb = new GeoBuilder();
    wb.torus(0.19, 0.022, 8, 28, '#141517');
    for (const a of [0, Math.PI, -Math.PI / 2]) wb.box(0.17, 0.028, 0.02, '#1c1d20', { x: Math.cos(a) * 0.09, y: Math.sin(a) * 0.09, rz: a });
    wb.cyl(0.055, 0.055, 0.05, 14, '#26282c', { rx: Math.PI / 2 });
    wb.cyl(0.02, 0.02, 0.012, 10, '#9a9ea4', { z: -0.03, rx: Math.PI / 2 });
    wb.cyl(0.028, 0.034, 0.42, 8, '#141517', { z: 0.23, rx: Math.PI / 2 });
    this.steeringWheel.add(new THREE.Mesh(wb.build(), MAT.trim()));
    this.body.add(this.steeringWheel);
    // зеркало заднего вида
    if (!s.open) {
      inside.box(0.24, 0.07, 0.025, '#121314', { y: ft[1] - 0.1, z: ft[0] - 0.12 });
      inside.box(0.02, 0.07, 0.02, '#121314', { y: ft[1] - 0.04, z: ft[0] - 0.1 });
    }

    // кабина
    const roofTop = rt[1] + 0.07;
    if (!s.open) {
      const glassGeo = extrudeProfile(shapeFrom(s.cab), s.cw, 0.03);
      const glass = new THREE.Mesh(glassGeo, MAT.glass());
      glass.renderOrder = 2;
      this.body.add(glass);
      const roof = shapeFrom([
        [rt[0] - 0.02, rt[1] - 0.01],
        [ft[0] + 0.02, ft[1] - 0.01],
        [ft[0] - 0.02, ft[1] + 0.07],
        [rt[0] + 0.03, rt[1] + 0.07],
      ]);
      pp.add(extrudeProfile(roof, s.cw + 0.08, 0.03));
      // обшивка потолка
      inside.box(s.cw - 0.08, 0.02, Math.abs(ft[0] - rt[0]) - 0.1, '#3a3a36', { y: rt[1] - 0.02, z: (ft[0] + rt[0]) / 2 });
      const pw = 0.09;
      for (const sx of [1, -1]) {
        const x = sx * (s.cw / 2 + 0.005);
        pp.plank(V(x, fb[1], fb[0]), V(x, ft[1], ft[0]), 0.06, pw);
        pp.plank(V(x, rb[1], rb[0]), V(x, rt[1], rt[0]), 0.06, pw * 1.4);
        const nB = Math.abs(ft[0] - rt[0]) > 2 ? 2 : 1;
        for (let i = 1; i <= nB; i++) {
          const z = rt[0] + ((ft[0] - rt[0]) * i) / (nB + 1) + 0.05;
          pp.box(0.06, rt[1] - rb[1], 0.1, { x, y: (rt[1] + rb[1]) / 2, z });
        }
        // резиновые уплотнители стёкол
        trim.box(0.025, 0.025, Math.abs(fb[0] - rb[0]) - 0.1, '#0e0f10', { x: sx * (s.cw / 2 + 0.02), y: belt + 0.015, z: cabMid });
        trim.box(0.025, 0.02, Math.abs(ft[0] - rt[0]), '#0e0f10', { x: sx * (s.cw / 2 + 0.02), y: rt[1] - 0.005, z: (ft[0] + rt[0]) / 2 });
      }
      // дворники
      for (const x of [-0.25, 0.3]) trim.plank(V(x - 0.25, fb[1] + 0.03, fb[0] - 0.02), V(x + 0.15, fb[1] + 0.12, fb[0] - 0.12), 0.02, 0.015, '#0e0f10');
    } else {
      // открытый верх: рамка лобового стекла и дуга безопасности
      const wsGlass = new THREE.Mesh(new THREE.BoxGeometry(s.cw - 0.1, 0.62, 0.03), MAT.glass());
      wsGlass.position.set(0, fb[1] + 0.33, fb[0] - 0.05);
      wsGlass.rotation.x = -0.12;
      this.body.add(wsGlass);
      for (const sx of [1, -1]) pp.box(0.07, 0.7, 0.07, { x: sx * (s.cw / 2), y: fb[1] + 0.34, z: fb[0] - 0.05, rx: -0.12 });
      pp.box(s.cw + 0.07, 0.07, 0.07, { y: fb[1] + 0.68, z: fb[0] - 0.09 });
      const tube = '#1e2023';
      for (const sx of [1, -1]) {
        trim.beam(V(sx * s.cw / 2, rb[1], -0.55), V(sx * s.cw / 2, 1.95, -0.55), 0.05, tube);
        trim.beam(V(sx * s.cw / 2, 1.95, -0.55), V(sx * s.cw / 2, fb[1] + 0.68, fb[0] - 0.1), 0.045, tube);
      }
      trim.beam(V(-s.cw / 2, 1.95, -0.55), V(s.cw / 2, 1.95, -0.55), 0.05, tube);
    }

    // кузов пикапа
    if (s.bed) {
      const [z0, z1] = s.bed;
      const len = z1 - z0;
      const y0 = s.top[1][1];
      for (const sx of [1, -1]) {
        pp.box(0.08, 0.38, len, { x: sx * (W / 2 - 0.04), y: y0 + 0.17, z: (z0 + z1) / 2 });
        trim.box(0.1, 0.03, len, '#1d1e20', { x: sx * (W / 2 - 0.04), y: y0 + 0.37, z: (z0 + z1) / 2 });
      }
      pp.box(W, 0.38, 0.08, { y: y0 + 0.17, z: z0 + 0.02 });
      pp.box(W, 0.38, 0.08, { y: y0 + 0.17, z: z1 });
      trim.box(W - 0.18, 0.02, len - 0.1, '#232426', { y: y0 + 0.01, z: (z0 + z1) / 2 });
      for (let i = 0; i < 5; i++) trim.box(0.04, 0.03, len - 0.15, '#34363a', { x: (i / 4 - 0.5) * (W - 0.4), y: y0 + 0.03, z: (z0 + z1) / 2 });
      trim.box(0.3, 0.03, 0.02, '#9a9ea4', { y: y0 + 0.25, z: z0 - 0.025 });
    }

    // днище
    trim.box(W - 0.3, 0.1, s.L * 0.72, '#151517', { y: s.bottom + 0.03 });

    // арки: подкрылки и накладки
    for (const z of s.ax) {
      for (const sx of [1, -1]) {
        trim.add(new THREE.TorusGeometry(s.wr + 0.085, s.flares ? 0.07 : 0.022, 5, 14, Math.PI), s.flares ? '#1d1e20' : '#141416', { x: sx * (W / 2 + (s.flares ? 0.02 : 0.005)), y: s.wr, z, ry: Math.PI / 2 });
        // брызговики за колёсами
        trim.box(0.02, 0.22, 0.2, '#111213', { x: sx * (W / 2 - s.ww / 2), y: s.bottom + 0.02, z: z - s.wr - 0.14 });
      }
    }

    // швы дверей и молдинги
    const doorH = belt - s.bottom - 0.12;
    const doorY = s.bottom + 0.06 + doorH / 2;
    const seams = [fb[0] - 0.08, rb[0] + 0.08];
    if (cabLen > 1.9) seams.push(fb[0] - cabLen * 0.52);
    for (const sx of [1, -1]) {
      const x = sx * (W / 2 + 0.003);
      for (const z of seams) trim.box(0.006, doorH, 0.014, '#161616', { x, y: doorY, z });
      trim.box(0.008, 0.035, cabLen + 0.4, def.rust > 0.5 ? '#6a6e74' : '#1a1b1d', { x: sx * (W / 2 + 0.006), y: s.bottom + (belt - s.bottom) * 0.45, z: cabMid });
      // ручки дверей
      trim.box(0.025, 0.035, 0.16, '#a8acb2', { x: sx * (W / 2 + 0.012), y: belt - 0.13, z: fb[0] - 0.85 });
      if (cabLen > 1.9) trim.box(0.025, 0.035, 0.16, '#a8acb2', { x: sx * (W / 2 + 0.012), y: belt - 0.13, z: fb[0] - cabLen * 0.52 - 0.3 });
      // зеркала на кронштейнах
      trim.box(0.1, 0.04, 0.05, '#1a1b1d', { x: sx * (W / 2 + 0.04), y: belt + 0.05, z: fb[0] - 0.12 });
      trim.box(0.07, 0.13, 0.19, '#1a1b1d', { x: sx * (W / 2 + 0.11), y: belt + 0.12, z: fb[0] - 0.14 });
      lights.box(0.005, 0.1, 0.15, '#8fa2b4', { x: sx * (W / 2 + 0.075), y: belt + 0.12, z: fb[0] - 0.14 });
    }

    // фары, решётка радиатора, фонари
    const ly = s.ly;
    const lz = fz + 0.02;
    const head = '#fff6d8';
    const lx = W * 0.34;
    if (s.lights === 'round') {
      for (const sx of [1, -1]) {
        trim.cyl(0.13, 0.13, 0.08, 16, '#b8bcc2', { x: sx * lx, y: ly, z: lz, rx: Math.PI / 2 });
        lights.cyl(0.1, 0.1, 0.1, 16, head, { x: sx * lx, y: ly, z: lz + 0.01, rx: Math.PI / 2 });
        lights.box(0.08, 0.05, 0.04, '#ffa21a', { x: sx * (lx + 0.2), y: ly - 0.08, z: lz });
      }
    } else if (s.lights === 'rect') {
      for (const sx of [1, -1]) {
        trim.box(0.4, 0.2, 0.06, '#b8bcc2', { x: sx * lx, y: ly, z: lz });
        lights.box(0.34, 0.15, 0.06, head, { x: sx * lx, y: ly, z: lz + 0.015 });
        lights.box(0.1, 0.1, 0.05, '#ffa21a', { x: sx * (lx + 0.26), y: ly, z: lz - 0.01 });
      }
    } else if (s.lights === 'slim') {
      for (const sx of [1, -1]) {
        lights.box(0.42, 0.07, 0.08, head, { x: sx * (lx + 0.05), y: ly, z: lz - 0.04, ry: sx * 0.2 });
        lights.box(0.12, 0.03, 0.06, '#ffa21a', { x: sx * (lx + 0.28), y: ly - 0.05, z: lz - 0.1, ry: sx * 0.4 });
      }
    } else if (s.lights === 'hidden') {
      for (const sx of [1, -1]) lights.box(0.3, 0.05, 0.06, head, { x: sx * lx, y: ly + 0.1, z: lz });
    }
    const gw = W * 0.4;
    switch (s.grille) {
      case 'chrome':
        trim.box(gw * 1.4, 0.2, 0.05, '#c8ccd2', { y: ly, z: lz });
        for (let i = 0; i < 4; i++) trim.box(gw * 1.35, 0.02, 0.06, '#2a2c30', { y: ly - 0.07 + i * 0.045, z: lz + 0.01 });
        break;
      case 'slots':
      case 'slots7': {
        const n = s.grille === 'slots7' ? 7 : 5;
        trim.box(gw * 1.1, 0.34, 0.05, '#1f2124', { y: ly, z: lz });
        for (let i = 0; i < n; i++) trim.box(0.05, 0.3, 0.06, '#5a5e64', { x: (i / (n - 1) - 0.5) * gw, y: ly, z: lz + 0.01 });
        break;
      }
      case 'big':
      case 'huge': {
        const hh = s.grille === 'huge' ? 0.5 : 0.36;
        trim.box(gw * 1.35, hh, 0.06, '#c0c4ca', { y: ly - 0.03, z: lz });
        trim.box(gw * 1.25, hh - 0.08, 0.07, '#1d1f22', { y: ly - 0.03, z: lz + 0.01 });
        trim.box(gw * 1.3, 0.06, 0.08, '#c0c4ca', { y: ly - 0.03, z: lz + 0.02 });
        trim.box(0.06, hh - 0.06, 0.08, '#c0c4ca', { y: ly - 0.03, z: lz + 0.02 });
        break;
      }
      case 'full':
        trim.box(W * 0.92, 0.26, 0.05, '#141516', { y: ly, z: lz });
        trim.box(W * 0.9, 0.02, 0.06, '#8a8e94', { y: ly - 0.1, z: lz + 0.01 });
        break;
      case 'horseshoe':
        trim.box(0.34, 0.3, 0.06, '#c0c4ca', { y: ly - 0.06, z: lz });
        trim.box(0.28, 0.25, 0.07, '#141516', { y: ly - 0.06, z: lz + 0.01 });
        trim.box(W * 0.8, 0.12, 0.05, '#141516', { y: s.bottom + 0.1, z: lz - 0.05 });
        break;
      default:
        trim.box(gw * 1.2, 0.18, 0.05, '#1a1b1d', { y: ly, z: lz });
    }
    // штатные бампера (закруглённые) — спереди, если не установлен свой
    stockBumper(trim, s, fz + 0.04, 1, !equip.bumper || equip.bumper === 'none');
    stockBumper(trim, s, rz - 0.04, -1, true);
    // номера
    this.body.add(plate(def.id, 0, s.bottom + 0.2, fz + 0.14, 0));
    this.body.add(plate(def.id, 0, s.bottom + 0.34, rz - 0.13, Math.PI));
    // задние фонари
    const tly = s.top[1][1] - 0.12;
    for (const sx of [1, -1]) {
      trim.box(0.34, 0.18, 0.04, '#1a1b1d', { x: sx * W * 0.36, y: tly, z: rz - 0.02 });
      lights.box(0.2, 0.14, 0.05, '#d8261e', { x: sx * (W * 0.36 + 0.06), y: tly, z: rz - 0.04 });
      lights.box(0.08, 0.14, 0.05, '#ffa21a', { x: sx * (W * 0.36 - 0.09), y: tly, z: rz - 0.04 });
    }
    // выхлоп и антенна
    trim.cyl(0.045, 0.045, 0.22, 10, '#6a6a6a', { x: W * 0.3, y: s.bottom + 0.05, z: rz - 0.08, rx: Math.PI / 2 });
    trim.cyl(0.03, 0.03, 0.02, 10, '#111', { x: W * 0.3, y: s.bottom + 0.05, z: rz - 0.19, rx: Math.PI / 2 });
    trim.cyl(0.005, 0.005, 0.7, 4, '#222', { x: -W * 0.4, y: s.top[1][1] + 0.35, z: rz + 0.5, rx: -0.15 });

    // полосы, воздухозаборник
    if (def.stripes) {
      const sc = def.stripes;
      for (const x of [-0.14, 0.14]) {
        trim.plank(V(x, fb[1] + 0.065, fb[0]), V(x, s.top[s.top.length - 3][1] + 0.065, s.top[s.top.length - 3][0]), 0.14, 0.01, sc);
        trim.box(0.14, 0.01, Math.abs(ft[0] - rt[0]), sc, { x, y: roofTop + 0.035, z: (ft[0] + rt[0]) / 2 });
      }
    }
    if (s.scoop) trim.box(0.5, 0.1, 0.7, '#1a1b1d', { y: fb[1] + 0.08, z: fb[0] + 0.5 });
    if (s.cline) {
      for (const sx of [1, -1]) {
        trim.add(new THREE.TorusGeometry(0.55, 0.035, 5, 14, Math.PI), '#c8ccd2', { x: sx * (W / 2 + 0.01), y: 0.35, z: -0.25, ry: Math.PI / 2, rz: Math.PI / 2 });
      }
    }
    let rackY = roofTop;
    if (s.rack) {
      rackY = roofTop + 0.12;
      for (const sx of [1, -1]) {
        trim.box(0.05, 0.05, Math.abs(ft[0] - rt[0]) * 0.9, '#1e2023', { x: sx * s.cw * 0.45, y: rackY, z: (ft[0] + rt[0]) / 2 });
        for (const z of [rt[0] + 0.15, ft[0] - 0.15]) trim.box(0.05, 0.12, 0.05, '#1e2023', { x: sx * s.cw * 0.45, y: roofTop + 0.06, z });
      }
      for (let i = 0; i < 4; i++) trim.box(s.cw * 0.92, 0.04, 0.05, '#1e2023', { y: rackY, z: rt[0] + 0.3 + i * ((ft[0] - rt[0] - 0.6) / 3) });
      trim.box(0.5, 0.25, 0.4, '#4a4230', { x: 0.45, y: rackY + 0.14, z: rt[0] + 0.45 });
      trim.box(0.35, 0.3, 0.25, '#b8261e', { x: -0.45, y: rackY + 0.16, z: rt[0] + 0.4 });
    }
    if (s.snorkel) {
      trim.beam(V(W / 2 + 0.05, s.top[2][1] - 0.2, fb[0] - 0.05), V(W / 2 + 0.05, ft[1] + 0.05, ft[0] - 0.05), 0.05, '#1e2023');
    }
    if (s.spare) {
      const spareWheel = buildWheel(s.wr * 0.95, s.ww, equip.wheels || 'std');
      spareWheel.rotation.y = Math.PI / 2;
      spareWheel.position.set(0, s.top[1][1] - 0.05, rz - 0.2);
      this.body.add(spareWheel);
    }

    const bodyMesh = new THREE.Mesh(toCreasedNormals(pp.build(), 0.55), paint);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    this.body.add(bodyMesh);
    this.bodyMesh = bodyMesh;
    const trimMesh = new THREE.Mesh(trim.build(), MAT.trim());
    trimMesh.castShadow = true;
    this.body.add(trimMesh);
    const inMesh = new THREE.Mesh(inside.build(), MAT.inside());
    inMesh.receiveShadow = true;
    this.body.add(inMesh);
    this.body.add(new THREE.Mesh(lights.build(), MAT.light()));

    // колёса
    for (const z of s.ax) {
      for (const sx of [1, -1]) {
        const pivot = new THREE.Group();
        pivot.position.set(sx * (W / 2 - s.ww / 2 + 0.03), s.wr, z);
        const w = buildWheel(s.wr, s.ww, equip.wheels || 'std');
        pivot.add(w);
        this.group.add(pivot);
        this.wheels.push({ pivot, spin: w, front: z > 0 });
      }
    }

    // бампер и решётка
    const bumper = buildBumper(equip.bumper, s);
    if (bumper) this.body.add(bumper);
    const grille = buildGrille(equip.grille, s);
    if (grille) this.body.add(grille);

    // оружие (над багажником на крыше, если он есть)
    const mountY = s.open ? 1.97 : rackY + (s.rack ? 0.03 : 0);
    const mountZ = s.open ? -0.55 : (rt[0] + ft[0]) / 2 + (s.rack ? 0.35 : 0);
    this.mount = V(0, mountY, mountZ);
    if (equip.weaponModel) {
      const w = buildCarWeapon(equip.weaponModel);
      w.group.position.copy(this.mount);
      w.group.scale.setScalar(0.9);
      this.body.add(w.group);
      this.weapon = w;
    }

    // точки для эффектов
    this.frontZ = fz;
    this.rearZ = rz;
    this.hoodPoint = V(0, fb[1] + 0.1, (fb[0] + fz) / 2);
    this.exhaust = V(W * 0.3, s.bottom + 0.05, rz - 0.15);
    // место водителя: глаза над сиденьем, чуть впереди спинки
    this.driver = V(W * 0.22, Math.min(rt[1] - 0.14, seatY + 0.72), frontSeatZ + 0.02);
    if (s.open) this.driver.y = seatY + 0.72;
  }

  update(dt, speed, steer) {
    const s = this.spec;
    for (const w of this.wheels) {
      w.spin.rotation.x += (speed * dt) / s.wr;
      if (w.front) w.pivot.rotation.y = steer * 0.45;
    }
    if (this.weapon?.spin) this.weapon.spin.rotation.z += this.spinRate * dt || 0;
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    this.paintMat?.dispose();
  }
}

// ------------------------------ кабина (вид из салона) ------------------------------

export class Cockpit {
  constructor(car) {
    this.group = new THREE.Group();
    this.car = car;
    const d = car.driver;
    const sw = car.steeringWheel;
    // перчатки на руле (вращаются вместе с рулём)
    const gb = new GeoBuilder();
    for (const sx of [1, -1]) {
      gb.box(0.08, 0.11, 0.075, '#3b2a1c', { x: sx * 0.185, y: 0.06, z: -0.01, rz: sx * 0.45 });
      gb.box(0.06, 0.05, 0.05, '#2a1e14', { x: sx * 0.15, y: 0.11, z: -0.03, rz: sx * 0.45 });
      gb.box(0.03, 0.06, 0.03, '#3b2a1c', { x: sx * 0.16, y: 0.02, z: -0.05, rz: sx * 0.3 });
    }
    this.gloves = new THREE.Mesh(gb.build(), MAT.trim());
    this.gloves.visible = false;
    sw.add(this.gloves);
    // рукава: от плеч к кистям
    this.arms = [];
    const armMat = new THREE.MeshStandardMaterial({ color: 0x4a4f3a, roughness: 0.9 });
    for (const sx of [1, -1]) {
      const g = new THREE.CylinderGeometry(0.045, 0.062, 1, 8).translate(0, 0.5, 0).rotateX(Math.PI / 2);
      const arm = new THREE.Mesh(g, armMat);
      this.group.add(arm);
      this.arms.push({ mesh: arm, sx });
    }
    // приборы на панели
    const s = car.spec;
    const fb = s.cab[3];
    const gauges = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.18), new THREE.MeshBasicMaterial({ map: gaugeTex() }));
    gauges.position.set(d.x, fb[1] + 0.06, fb[0] - 0.455);
    gauges.rotation.set(-0.25, Math.PI, 0, 'YXZ');
    this.group.add(gauges);
    this.shoulder = [V(d.x + 0.22, d.y - 0.3, d.z + 0.02), V(d.x - 0.22, d.y - 0.3, d.z + 0.02)];
    this.eye = d.clone();
    this._hand = new THREE.Vector3();
    this._m = new THREE.Matrix4();
  }

  set visible(v) {
    this.group.visible = v;
    this.gloves.visible = v;
  }

  update(steer) {
    const sw = this.car.steeringWheel;
    sw.rotation.z = -steer * 1.6;
    sw.updateMatrix();
    for (let i = 0; i < 2; i++) {
      const a = this.arms[i];
      this._hand.set(a.sx * 0.185, 0.06, 0.02).applyMatrix4(sw.matrix);
      const sh = this.shoulder[i];
      a.mesh.position.copy(sh);
      a.mesh.lookAt(this._hand);
      a.mesh.scale.set(1, 1, sh.distanceTo(this._hand));
    }
  }
}

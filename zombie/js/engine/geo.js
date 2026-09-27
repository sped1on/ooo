// Построитель геометрии с цветами вершин: из примитивов собирается одна BufferGeometry.
// Все статичные модели мира (деревья, дома, заправка, база) рисуются одним материалом
// с vertexColors, поэтому сцена получается лёгкой для телефонов.

import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const _n = new THREE.Matrix3();

export function makeMatrix(t) {
  if (!t) return _m.identity();
  if (t.isMatrix4) return t;
  _e.set(t.rx || 0, t.ry || 0, t.rz || 0, t.order || 'XYZ');
  _q.setFromEuler(_e);
  _v.set(t.x || 0, t.y || 0, t.z || 0);
  const s = t.s ?? 1;
  _s.set(t.sx ?? s, t.sy ?? s, t.sz ?? s);
  return _m.compose(_v, _q, _s);
}

// Масштаб текстур материалов: метров на один повтор
const TEX_SCALE = { plain: 1, metal: 2.4, wood: 2.2, brick: 1.6, concrete: 3, roofm: 2, plank: 1.2 };

class Channel {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.col = [];
    this.uv = [];
  }
}

export class GeoBuilder {
  constructor() {
    this.ch = { plain: new Channel() };
  }

  // для совместимости: основные массивы — канал plain
  get pos() {
    return this.ch.plain.pos;
  }

  channel(key) {
    return (this.ch[key] ||= new Channel());
  }

  // Добавить готовую геометрию с цветом и трансформацией.
  // opts.mat — материал с текстурой (metal, wood, brick, concrete, roofm, plank)
  add(geo, color, t, opts = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    const m = makeMatrix(t).clone();
    g.applyMatrix4(m);
    if (opts.flat !== false) {
      g.deleteAttribute('normal');
      g.computeVertexNormals();
    }
    const p = g.attributes.position.array;
    const n = g.attributes.normal.array;
    _c.set(color);
    const jit = opts.jitter || 0;
    const grad = opts.grad;
    const key = opts.mat || 'plain';
    const ch = this.channel(key);
    const sc = 1 / (TEX_SCALE[key] || 1);
    for (let i = 0; i < p.length; i += 3) {
      ch.pos.push(p[i], p[i + 1], p[i + 2]);
      ch.nor.push(n[i], n[i + 1], n[i + 2]);
      let k = 1;
      if (jit && i % 9 === 0) this._j = 1 + (Math.random() - 0.5) * jit;
      if (jit) k *= this._j;
      if (grad) {
        const t2 = Math.min(1, Math.max(0, (p[i + 1] - grad[0]) / (grad[1] - grad[0])));
        k *= grad[2] + (1 - grad[2]) * t2;
      }
      ch.col.push(_c.r * k, _c.g * k, _c.b * k);
      // проекция текстуры по доминирующей оси нормали (одинаковый масштаб на всех гранях)
      const ax = Math.abs(n[i]);
      const ay = Math.abs(n[i + 1]);
      const az = Math.abs(n[i + 2]);
      if (ay >= ax && ay >= az) ch.uv.push(p[i] * sc, p[i + 2] * sc);
      else if (ax >= az) ch.uv.push(p[i + 2] * sc, p[i + 1] * sc);
      else ch.uv.push(p[i] * sc, p[i + 1] * sc);
    }
    g.dispose();
    return this;
  }

  box(w, h, d, color, t, opts) {
    return this.add(new THREE.BoxGeometry(w, h, d), color, t, opts);
  }
  cyl(rt, rb, h, seg, color, t, opts) {
    return this.add(new THREE.CylinderGeometry(rt, rb, h, seg, 1), color, t, opts);
  }
  cone(r, h, seg, color, t, opts) {
    return this.add(new THREE.ConeGeometry(r, h, seg, 1), color, t, opts);
  }
  ico(r, detail, color, t, opts) {
    return this.add(new THREE.IcosahedronGeometry(r, detail), color, t, opts);
  }
  dodeca(r, color, t, opts) {
    return this.add(new THREE.DodecahedronGeometry(r, 0), color, t, opts);
  }
  sphere(r, ws, hs, color, t, opts) {
    return this.add(new THREE.SphereGeometry(r, ws, hs), color, t, opts);
  }
  torus(r, tube, rs, ts, color, t, opts) {
    return this.add(new THREE.TorusGeometry(r, tube, rs, ts), color, t, opts);
  }
  // Цилиндр между двумя точками (трубы, балки)
  beam(a, b, r, color, seg = 6, opts) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const g = new THREE.CylinderGeometry(r, r, len, seg, 1);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    const m = new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
    return this.add(g, color, m, opts);
  }
  // Брусок между двумя точками
  plank(a, b, w, h, color, opts) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const g = new THREE.BoxGeometry(w, h, len);
    const m = new THREE.Matrix4().lookAt(a, b, new THREE.Vector3(0, 1, 0));
    m.setPosition(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5));
    return this.add(g, color, m, opts);
  }
  // Добавить другой построитель со своей трансформацией
  merge(other, t) {
    const m = makeMatrix(t).clone();
    _n.getNormalMatrix(m);
    for (const key in other.ch) {
      const src = other.ch[key];
      const dst = this.channel(key);
      for (let i = 0; i < src.pos.length; i += 3) {
        _v.set(src.pos[i], src.pos[i + 1], src.pos[i + 2]).applyMatrix4(m);
        dst.pos.push(_v.x, _v.y, _v.z);
        _v.set(src.nor[i], src.nor[i + 1], src.nor[i + 2]).applyMatrix3(_n).normalize();
        dst.nor.push(_v.x, _v.y, _v.z);
        dst.col.push(src.col[i], src.col[i + 1], src.col[i + 2]);
      }
      for (let i = 0; i < src.uv.length; i++) dst.uv.push(src.uv[i]);
    }
    return this;
  }

  get empty() {
    return Object.values(this.ch).every((c) => c.pos.length === 0);
  }

  // Геометрия с группами по материалам; список ключей материалов — в userData.mats
  build() {
    const keys = Object.keys(this.ch).filter((k) => this.ch[k].pos.length);
    const pos = [];
    const nor = [];
    const col = [];
    const uv = [];
    const g = new THREE.BufferGeometry();
    let start = 0;
    const total = keys.reduce((a, k) => a + this.ch[k].pos.length / 3, 0);
    const P = new Float32Array(total * 3);
    const N = new Float32Array(total * 3);
    const C = new Float32Array(total * 3);
    const U = new Float32Array(total * 2);
    keys.forEach((k, i) => {
      const c = this.ch[k];
      const count = c.pos.length / 3;
      P.set(c.pos, start * 3);
      N.set(c.nor, start * 3);
      C.set(c.col, start * 3);
      U.set(c.uv, start * 2);
      g.addGroup(start, count, i);
      start += count;
    });
    void pos;
    void nor;
    void col;
    void uv;
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    g.setAttribute('color', new THREE.BufferAttribute(C, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(U, 2));
    g.userData.mats = keys.length ? keys : ['plain'];
    if (keys.length <= 1) g.clearGroups();
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

// Общие материалы для моделей с цветами вершин
let _lambert = null;
let _std = null;
export function vcMat() {
  if (!_lambert) _lambert = new THREE.MeshLambertMaterial({ vertexColors: true });
  return _lambert;
}
export function vcStd() {
  if (!_std) _std = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.25 });
  return _std;
}

// Материалы с текстурами (задаются из textures.js, чтобы не было циклических импортов)
let texFactory = null;
export function setTexFactory(fn) {
  texFactory = fn;
}
const texMats = {};
export function matFor(key) {
  if (key === 'glow') return (texMats.glow ||= new THREE.MeshBasicMaterial({ vertexColors: true }));
  if (key === 'plain' || !texFactory) return vcMat();
  if (!texMats[key]) texMats[key] = new THREE.MeshLambertMaterial({ vertexColors: true, map: texFactory(key) });
  return texMats[key];
}
// Материал(ы) для геометрии из GeoBuilder
export function matsFor(geo) {
  const keys = geo.userData?.mats || ['plain'];
  return keys.length > 1 ? keys.map(matFor) : matFor(keys[0]);
}

export function vcMesh(builder, std = false) {
  const geo = builder.build();
  const m = new THREE.Mesh(geo, std ? vcStd() : matsFor(geo));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function geoMesh(geo) {
  return new THREE.Mesh(geo, matsFor(geo));
}

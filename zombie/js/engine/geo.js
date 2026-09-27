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

export class GeoBuilder {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.col = [];
  }

  // Добавить готовую геометрию с цветом и трансформацией
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
    const grad = opts.grad; // затемнение книзу: [yMin, yMax, factor]
    for (let i = 0; i < p.length; i += 3) {
      this.pos.push(p[i], p[i + 1], p[i + 2]);
      this.nor.push(n[i], n[i + 1], n[i + 2]);
      let k = 1;
      if (jit && i % 9 === 0) this._j = 1 + (Math.random() - 0.5) * jit;
      if (jit) k *= this._j;
      if (grad) {
        const t2 = Math.min(1, Math.max(0, (p[i + 1] - grad[0]) / (grad[1] - grad[0])));
        k *= grad[2] + (1 - grad[2]) * t2;
      }
      this.col.push(_c.r * k, _c.g * k, _c.b * k);
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
    // lookAt смотрит по -Z, но коробка симметрична — подходит
    m.setPosition(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5));
    return this.add(g, color, m, opts);
  }
  // Добавить другой построитель со своей трансформацией
  merge(other, t) {
    const m = makeMatrix(t).clone();
    _n.getNormalMatrix(m);
    for (let i = 0; i < other.pos.length; i += 3) {
      _v.set(other.pos[i], other.pos[i + 1], other.pos[i + 2]).applyMatrix4(m);
      this.pos.push(_v.x, _v.y, _v.z);
      _v.set(other.nor[i], other.nor[i + 1], other.nor[i + 2]).applyMatrix3(_n).normalize();
      this.nor.push(_v.x, _v.y, _v.z);
      this.col.push(other.col[i], other.col[i + 1], other.col[i + 2]);
    }
    return this;
  }

  get empty() {
    return this.pos.length === 0;
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
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

export function vcMesh(builder, std = false) {
  const m = new THREE.Mesh(builder.build(), std ? vcStd() : vcMat());
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Частицы (пыль, кровь, дым, огонь, искры) и трассеры пуль.

import * as THREE from 'three';

const VERT = `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
varying float vAlpha;
varying vec3 vColor;
uniform float uScale;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(aSize * uScale / max(0.1, -mv.z), 1.0, 256.0);
  vAlpha = aAlpha;
  vColor = aColor;
}`;
const FRAG = `
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);
  if (r > 0.5) discard;
  float a = smoothstep(0.5, 0.15, r) * vAlpha;
  gl_FragColor = vec4(vColor, a);
}`;

class PointSystem {
  constructor(scene, cap, additive) {
    this.cap = cap;
    this.n = 0;
    this.p = new Float32Array(cap * 3);
    this.v = new Float32Array(cap * 3);
    this.c = new Float32Array(cap * 3);
    this.c2 = new Float32Array(cap * 3);
    this.life = new Float32Array(cap);
    this.max = new Float32Array(cap);
    this.size = new Float32Array(cap);
    this.grow = new Float32Array(cap);
    this.grav = new Float32Array(cap);
    this.drag = new Float32Array(cap);
    this.a0 = new Float32Array(cap);
    this.geo = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(new Float32Array(cap), 1).setUsage(THREE.DynamicDrawUsage);
    this.aAlpha = new THREE.BufferAttribute(new Float32Array(cap), 1).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', this.aPos);
    this.geo.setAttribute('aColor', this.aCol);
    this.geo.setAttribute('aSize', this.aSize);
    this.geo.setAttribute('aAlpha', this.aAlpha);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uScale: { value: 400 } },
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 3 : 2;
    scene.add(this.points);
  }

  add(x, y, z, vx, vy, vz, col, col2, life, size, grow, grav, drag, alpha) {
    let i = this.n;
    if (i >= this.cap) {
      i = Math.floor(Math.random() * this.cap);
    } else this.n++;
    const i3 = i * 3;
    this.p[i3] = x;
    this.p[i3 + 1] = y;
    this.p[i3 + 2] = z;
    this.v[i3] = vx;
    this.v[i3 + 1] = vy;
    this.v[i3 + 2] = vz;
    this.c[i3] = col.r;
    this.c[i3 + 1] = col.g;
    this.c[i3 + 2] = col.b;
    this.c2[i3] = col2.r;
    this.c2[i3 + 1] = col2.g;
    this.c2[i3 + 2] = col2.b;
    this.life[i] = life;
    this.max[i] = life;
    this.size[i] = size;
    this.grow[i] = grow;
    this.grav[i] = grav;
    this.drag[i] = drag;
    this.a0[i] = alpha;
  }

  update(dt) {
    const P = this.aPos.array;
    const C = this.aCol.array;
    const S = this.aSize.array;
    const A = this.aAlpha.array;
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        // перенос последней частицы на место умершей
        const last = this.n - 1;
        if (i !== last) this._copy(last, i);
        this.n--;
        continue;
      }
      const i3 = i * 3;
      const k = Math.exp(-this.drag[i] * dt);
      this.v[i3] *= k;
      this.v[i3 + 1] = this.v[i3 + 1] * k - this.grav[i] * dt;
      this.v[i3 + 2] *= k;
      this.p[i3] += this.v[i3] * dt;
      this.p[i3 + 1] += this.v[i3 + 1] * dt;
      this.p[i3 + 2] += this.v[i3 + 2] * dt;
      const t = 1 - this.life[i] / this.max[i];
      P[i3] = this.p[i3];
      P[i3 + 1] = this.p[i3 + 1];
      P[i3 + 2] = this.p[i3 + 2];
      C[i3] = this.c[i3] + (this.c2[i3] - this.c[i3]) * t;
      C[i3 + 1] = this.c[i3 + 1] + (this.c2[i3 + 1] - this.c[i3 + 1]) * t;
      C[i3 + 2] = this.c[i3 + 2] + (this.c2[i3 + 2] - this.c[i3 + 2]) * t;
      S[i] = this.size[i] * (1 + this.grow[i] * t);
      A[i] = this.a0[i] * (t < 0.1 ? t * 10 : 1) * (1 - t);
      i++;
    }
    this.geo.setDrawRange(0, this.n);
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSize.needsUpdate = this.aAlpha.needsUpdate = true;
  }

  _copy(a, b) {
    const a3 = a * 3;
    const b3 = b * 3;
    for (let k = 0; k < 3; k++) {
      this.p[b3 + k] = this.p[a3 + k];
      this.v[b3 + k] = this.v[a3 + k];
      this.c[b3 + k] = this.c[a3 + k];
      this.c2[b3 + k] = this.c2[a3 + k];
    }
    this.life[b] = this.life[a];
    this.max[b] = this.max[a];
    this.size[b] = this.size[a];
    this.grow[b] = this.grow[a];
    this.grav[b] = this.grav[a];
    this.drag[b] = this.drag[a];
    this.a0[b] = this.a0[a];
  }

  clear() {
    this.n = 0;
    this.geo.setDrawRange(0, 0);
  }
}

const _c1 = new THREE.Color();
const _c2 = new THREE.Color();
const R = (a, b) => a + Math.random() * (b - a);

export class Particles {
  constructor(scene, quality = 1) {
    this.q = quality;
    this.normal = new PointSystem(scene, Math.round(1600 * quality) + 200, false);
    this.glow = new PointSystem(scene, Math.round(1200 * quality) + 200, true);
    // трассеры
    this.maxTr = 96;
    const tg = new THREE.BufferGeometry();
    this.trPos = new THREE.BufferAttribute(new Float32Array(this.maxTr * 6), 3).setUsage(THREE.DynamicDrawUsage);
    this.trCol = new THREE.BufferAttribute(new Float32Array(this.maxTr * 6), 3).setUsage(THREE.DynamicDrawUsage);
    tg.setAttribute('position', this.trPos);
    tg.setAttribute('color', this.trCol);
    this.tracers = [];
    this.trLines = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    this.trLines.frustumCulled = false;
    scene.add(this.trLines);
  }

  setScale(h, fov) {
    const s = h / (2 * Math.tan((fov * Math.PI) / 360));
    this.normal.mat.uniforms.uScale.value = s;
    this.glow.mat.uniforms.uScale.value = s;
  }

  // Универсальный выброс
  emit(o) {
    const n = Math.max(1, Math.round((o.count || 1) * (o.noScale ? 1 : this.q)));
    const sys = o.glow ? this.glow : this.normal;
    _c1.set(o.color || '#ffffff');
    _c2.set(o.color2 || o.color || '#ffffff');
    const sp = o.spread ?? 1;
    const vel = o.vel || { x: 0, y: 0, z: 0 };
    for (let i = 0; i < n; i++) {
      const r = o.radius || 0;
      sys.add(
        o.pos.x + R(-r, r),
        o.pos.y + R(-r, r) * (o.flatY ? 0.2 : 1),
        o.pos.z + R(-r, r),
        vel.x + R(-sp, sp),
        vel.y + R(-sp, sp) * (o.upOnly ? 0 : 1) + (o.up || 0) * R(0.5, 1),
        vel.z + R(-sp, sp),
        _c1,
        _c2,
        R(o.life?.[0] ?? 0.5, o.life?.[1] ?? 1),
        R(o.size?.[0] ?? 0.3, o.size?.[1] ?? 0.6),
        o.grow ?? 0,
        o.gravity ?? 0,
        o.drag ?? 1,
        o.alpha ?? 1,
      );
    }
  }

  blood(pos, dir, amount = 1, toxic = false) {
    this.emit({
      pos, count: 10 * amount, spread: 1.8, up: 2.5, vel: dir ? { x: dir.x * 3, y: 0, z: dir.z * 3 } : undefined,
      color: toxic ? '#8ad13a' : '#8a1010', color2: toxic ? '#3a6a10' : '#4a0808', life: [0.4, 0.9], size: [0.15, 0.35], gravity: 9, drag: 1.5,
    });
  }

  explosion(pos, scale = 1) {
    this.emit({ pos, count: 26 * scale, spread: 5 * scale, up: 3, color: '#fff2a0', color2: '#ff4a10', life: [0.25, 0.6], size: [1.2 * scale, 2.4 * scale], grow: 1.2, drag: 3, glow: true });
    this.emit({ pos, count: 18 * scale, spread: 3 * scale, up: 3, color: '#4a4440', color2: '#2a2826', life: [1.2, 2.4], size: [1.5 * scale, 3 * scale], grow: 1.5, drag: 1.5, gravity: -1.5, alpha: 0.8 });
    this.emit({ pos, count: 20 * scale, spread: 12, up: 6, color: '#ffd070', color2: '#ff6a10', life: [0.4, 0.9], size: [0.12, 0.22], gravity: 14, drag: 0.5, glow: true });
  }

  sparks(pos, n = 6) {
    this.emit({ pos, count: n, spread: 5, up: 3, color: '#fff0a0', color2: '#ff7a20', life: [0.15, 0.35], size: [0.08, 0.16], gravity: 12, glow: true, drag: 1 });
  }

  muzzle(pos, dir, big = 1) {
    this.emit({ pos, count: 3 * big, noScale: true, spread: 0.6, vel: { x: dir.x * 6, y: dir.y * 6, z: dir.z * 6 }, color: '#fff6c0', color2: '#ff9a30', life: [0.04, 0.08], size: [0.35 * big, 0.6 * big], glow: true, drag: 4 });
  }

  dust(pos, vel, amount = 1, col = '#b8a07a') {
    this.emit({ pos, count: 2 * amount, spread: 0.8, vel, up: 0.6, color: col, color2: col, life: [0.6, 1.3], size: [0.6, 1.2], grow: 1.8, drag: 2, alpha: 0.35 });
  }

  smoke(pos, dark = false) {
    this.emit({ pos, count: 1, spread: 0.4, up: 1.5, color: dark ? '#2a2826' : '#8a8680', color2: dark ? '#141312' : '#5a5854', life: [1, 1.8], size: [0.5, 0.9], grow: 2.2, drag: 1.2, gravity: -0.8, alpha: 0.6 });
  }

  fire(pos, vel, n = 2) {
    this.emit({ pos, count: n, spread: 1.2, vel, color: '#fff0a0', color2: '#ff3a0a', life: [0.25, 0.5], size: [0.5, 1.0], grow: 1.4, drag: 2, glow: true });
  }

  pickup(pos, col) {
    this.emit({ pos, count: 14, spread: 2.5, up: 2, color: col, color2: '#ffffff', life: [0.4, 0.8], size: [0.15, 0.3], gravity: 3, glow: true });
  }

  tracer(a, b, col = '#ffd070', life = 0.08) {
    if (this.tracers.length >= this.maxTr) this.tracers.shift();
    this.tracers.push({ a: a.clone(), b: b.clone(), col: new THREE.Color(col), life, max: life });
  }

  update(dt) {
    this.normal.update(dt);
    this.glow.update(dt);
    const P = this.trPos.array;
    const C = this.trCol.array;
    let n = 0;
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.tracers.splice(i, 1);
        continue;
      }
      const k = t.life / t.max;
      const o = n * 6;
      P[o] = t.a.x;
      P[o + 1] = t.a.y;
      P[o + 2] = t.a.z;
      P[o + 3] = t.b.x;
      P[o + 4] = t.b.y;
      P[o + 5] = t.b.z;
      C[o] = t.col.r * k * 0.4;
      C[o + 1] = t.col.g * k * 0.4;
      C[o + 2] = t.col.b * k * 0.4;
      C[o + 3] = t.col.r * k;
      C[o + 4] = t.col.g * k;
      C[o + 5] = t.col.b * k;
      n++;
    }
    this.trLines.geometry.setDrawRange(0, n * 2);
    this.trPos.needsUpdate = this.trCol.needsUpdate = true;
  }

  clear() {
    this.normal.clear();
    this.glow.clear();
    this.tracers.length = 0;
  }
}

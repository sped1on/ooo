// Дорога уровня: кривая с холмами, рельеф долины вокруг неё, озеро под мостом.
// Координаты дороги: s — метры вдоль дороги, x — смещение вправо от оси.

import * as THREE from 'three';
import { Rng, fbm, smoothstep, clamp, lerp } from '../engine/util.js';
import { asphaltTex, groundTex } from '../engine/textures.js';

export const ROAD_HALF = 7;
export const S_PAD = 90; // дорога продолжается за базами

export class Track {
  constructor({ seed, length, stationS, bridgeS, campS }) {
    this.seed = seed;
    this.L = length;
    this.s0 = -S_PAD;
    this.s1 = length + S_PAD;
    this.stationS = stationS;
    this.bridgeS = bridgeS;
    this.campS = campS;
    this.bridgeLen = 90;
    const n = Math.ceil(this.s1 - this.s0) + 2;
    this.n = n;
    this.px = new Float32Array(n);
    this.py = new Float32Array(n);
    this.pz = new Float32Array(n);
    this.fx = new Float32Array(n);
    this.fz = new Float32Array(n);
    this.generate();
  }

  // Зоны, где дорога прямая и ровная
  straightMask(s) {
    const L = this.L;
    let m = 0;
    m = Math.max(m, 1 - smoothstep(20, 80, s)); // старт
    m = Math.max(m, smoothstep(L - 100, L - 40, s)); // финиш
    const zone = (c, half, soft) => 1 - smoothstep(half, half + soft, Math.abs(s - c));
    m = Math.max(m, zone(this.stationS, 45, 40));
    m = Math.max(m, zone(this.bridgeS, this.bridgeLen / 2 + 15, 40));
    m = Math.max(m, zone(this.campS, 35, 30));
    return m;
  }

  generate() {
    const rng = new Rng(this.seed);
    let x = 0;
    let z = 0;
    let h = 0;
    let k = 0;
    let kTarget = 0;
    let nextChange = 0;
    const maxK = 1 / 380;
    const hy = new Float32Array(this.n);
    for (let i = 0; i < this.n; i++) {
      const s = this.s0 + i;
      if (s >= nextChange) {
        kTarget = rng.f(-maxK, maxK) * (rng.chance(0.25) ? 0.1 : 1);
        nextChange = s + rng.f(70, 160);
      }
      const straight = this.straightMask(s);
      k = lerp(k, kTarget * (1 - straight), 0.02);
      h += k;
      const fx = Math.sin(h);
      const fz = Math.cos(h);
      this.px[i] = x;
      this.pz[i] = z;
      this.fx[i] = fx;
      this.fz[i] = fz;
      x += fx;
      z += fz;
      hy[i] = (fbm(s / 260, 0.5, this.seed, 3) - 0.5) * 22;
    }
    // выравниваем высоты у баз, заправки, моста, лагеря
    for (let i = 0; i < this.n; i++) {
      const s = this.s0 + i;
      const flat = this.straightMask(s);
      this.py[i] = hy[i] * (1 - flat) + this._flatY(s, hy) * flat;
    }
    // сглаживание
    const tmp = new Float32Array(this.py);
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 4; i < this.n - 4; i++) {
        let a = 0;
        for (let j = -4; j <= 4; j++) a += tmp[i + j];
        this.py[i] = a / 9;
      }
      tmp.set(this.py);
    }
    this.waterY = this.roadY(this.bridgeS) - 4;
  }

  _flatY(s, hy) {
    // высота ровной площадки — берём значение в центре зоны
    const idx = (c) => clamp(Math.round(c - this.s0), 0, this.n - 1);
    const L = this.L;
    if (s < 80) return hy[idx(0)];
    if (s > L - 100) return hy[idx(L)];
    const cands = [this.stationS, this.bridgeS, this.campS];
    let best = cands[0];
    for (const c of cands) if (Math.abs(s - c) < Math.abs(s - best)) best = c;
    return hy[idx(best)];
  }

  _i(s) {
    const f = clamp(s - this.s0, 0, this.n - 1.001);
    return f;
  }

  roadY(s) {
    const f = this._i(s);
    const i = Math.floor(f);
    const t = f - i;
    return this.py[i] * (1 - t) + this.py[i + 1] * t;
  }

  // Положение и направление в точке s
  frame(s, out = {}) {
    const f = this._i(s);
    const i = Math.floor(f);
    const t = f - i;
    out.x = this.px[i] * (1 - t) + this.px[i + 1] * t;
    out.y = this.py[i] * (1 - t) + this.py[i + 1] * t;
    out.z = this.pz[i] * (1 - t) + this.pz[i + 1] * t;
    let fx = this.fx[i] * (1 - t) + this.fx[i + 1] * t;
    let fz = this.fz[i] * (1 - t) + this.fz[i + 1] * t;
    const l = Math.hypot(fx, fz);
    fx /= l;
    fz /= l;
    out.fx = fx;
    out.fz = fz;
    out.rx = -fz; // вектор вправо
    out.rz = fx;
    out.yaw = Math.atan2(fx, fz);
    out.slope = (this.py[Math.min(i + 3, this.n - 1)] - this.py[Math.max(i - 3, 0)]) / 6;
    return out;
  }

  toWorld(s, x, out = new THREE.Vector3(), yOverride) {
    const f = this.frame(s, _fr);
    out.set(f.x + f.rx * x, yOverride ?? this.height(s, x), f.z + f.rz * x);
    return out;
  }

  // Высота земли (на дороге — высота дороги)
  // Бетонные площадки и полы построек, по которым ездят и ходят
  pad(s, x) {
    const L = this.L;
    // заправка: плита 26×44 м слева от дороги
    if (x < -7 && x > -33 && Math.abs(s - this.stationS) < 22) return this.roadY(this.stationS) + 0.12;
    // пол гаража на базах
    if (Math.abs(x) < 6.8) {
      if (s > -44 && s < -30) return this.roadY(0) + 0.1;
      if (s > L + 30 && s < L + 44) return this.roadY(L) + 0.1;
    }
    // площадки баз
    if (Math.abs(x) < 26 && ((s > -52 && s < 2) || (s > L - 2 && s < L + 52))) return this.roadY(s < L / 2 ? 0 : L) + 0.08;
    // лагерь бандитов справа
    if (x > 9 && x < 31 && Math.abs(s - this.campS) < 20) return this.roadY(this.campS) + 0.08;
    return null;
  }

  height(s, x, mesh = false) {
    const ry = this.roadY(s);
    const ax = Math.abs(x);
    if (!mesh) {
      const p = this.pad(s, x);
      if (p !== null) return Math.max(p, ax <= ROAD_HALF + 0.3 ? ry : -1e9);
    }
    if (ax <= ROAD_HALF + 0.3 && !(mesh && this.onBridge(s))) return ry;
    const f = this.frame(s, _fr2);
    const wx = f.x + f.rx * x;
    const wz = f.z + f.rz * x;
    let h = ry - 0.12;
    // обочина
    h -= smoothstep(ROAD_HALF, ROAD_HALF + 4, ax) * 0.35;
    // холмы
    const n = fbm(wx / 70, wz / 70, this.seed + 5, 4);
    h += (n - 0.45) * 9 * smoothstep(12, 55, ax);
    // стены долины
    h += smoothstep(70, 230, ax) * 34 * (0.6 + fbm(wx / 160, wz / 160, this.seed + 9, 2) * 0.8);
    // ровные площадки
    const flat = this.flatZone(s, x);
    if (flat > 0) h = lerp(h, ry - 0.1, flat);
    // озеро
    const lake = this.lakeDepth(s, x);
    if (lake > 0) h = lerp(h, this.waterY - 5, lake);
    return h;
  }

  flatZone(s, x) {
    const L = this.L;
    let m = 0;
    // базы
    if (s < 30) m = Math.max(m, (1 - smoothstep(35, 60, Math.abs(x))) * (1 - smoothstep(15, 40, s)));
    if (s > L - 30) m = Math.max(m, (1 - smoothstep(35, 60, Math.abs(x))) * smoothstep(L - 40, L - 15, s));
    // заправка слева (x < 0)
    const ds = Math.abs(s - this.stationS);
    if (x < 0) m = Math.max(m, (1 - smoothstep(26, 42, ds)) * (1 - smoothstep(40, 55, -x)));
    // лагерь справа
    const dc = Math.abs(s - this.campS);
    if (x > 0) m = Math.max(m, (1 - smoothstep(24, 38, dc)) * (1 - smoothstep(36, 50, x)));
    return m;
  }

  lakeDepth(s, x) {
    const ds = (s - this.bridgeS) / (this.bridgeLen * 0.62);
    const dx = x / 150;
    const d = Math.hypot(ds, dx);
    return 1 - smoothstep(0.55, 1.0, d);
  }

  onBridge(s) {
    return Math.abs(s - this.bridgeS) < this.bridgeLen / 2;
  }

  // Ближайшая точка дороги к мировой точке (поиск около подсказки)
  project(wx, wz, hint = 0) {
    let best = hint;
    let bd = Infinity;
    const from = Math.max(this.s0, hint - 60);
    const to = Math.min(this.s1, hint + 60);
    for (let s = from; s <= to; s += 1) {
      const f = this.frame(s, _fr);
      const d = (wx - f.x) ** 2 + (wz - f.z) ** 2;
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    const f = this.frame(best, _fr);
    const x = (wx - f.x) * f.rx + (wz - f.z) * f.rz;
    const ds = (wx - f.x) * f.fx + (wz - f.z) * f.fz;
    return { s: best + ds, x };
  }

  // ------------------------------ меши ------------------------------

  buildMeshes(biome, scene) {
    const group = new THREE.Group();
    const cols = [-235, -175, -130, -98, -74, -56, -43, -33, -25, -19, -14.5, -11, -9, -7.6, -5, 0, 5, 7.6, 9, 11, 14.5, 19, 25, 33, 43, 56, 74, 98, 130, 175, 235];
    const chunk = 150;
    const stepS = 3;
    const cGround = new THREE.Color(biome.ground);
    const cGround2 = new THREE.Color(biome.ground2);
    const cGrass = new THREE.Color(biome.grass);
    const cFar = new THREE.Color(biome.far);
    const cDirt = new THREE.Color('#8a7658');
    const cShore = new THREE.Color('#9a8a6a');
    const tmpC = new THREE.Color();
    const groundMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: groundTex() });
    groundMat.map.repeat.set(1, 1);
    const roadMat = new THREE.MeshLambertMaterial({ map: asphaltTex(), color: 0xd8d8d8 });
    this.chunks = [];
    for (let c0 = this.s0; c0 < this.s1; c0 += chunk) {
      const c1 = Math.min(this.s1, c0 + chunk);
      const rows = Math.ceil((c1 - c0) / stepS) + 1;
      // рельеф
      const pos = [];
      const col = [];
      const uv = [];
      const idx = [];
      for (let r = 0; r < rows; r++) {
        const s = Math.min(c1, c0 + r * stepS);
        const f = this.frame(s, _fr);
        for (let ci = 0; ci < cols.length; ci++) {
          const x = cols[ci];
          const wx = f.x + f.rx * x;
          const wz = f.z + f.rz * x;
          const h = this.height(s, x, true);
          pos.push(wx, h, wz);
          uv.push(wx / 12, wz / 12);
          const n = fbm(wx / 40, wz / 40, this.seed + 3, 3);
          tmpC.copy(cGround).lerp(cGround2, clamp(n * 1.6 - 0.3, 0, 1));
          const g = fbm(wx / 25 + 7, wz / 25, this.seed + 4, 2);
          if (g > 0.55) tmpC.lerp(cGrass, clamp((g - 0.55) * 4, 0, 0.8));
          const ax = Math.abs(x);
          if (ax < 12) tmpC.lerp(cDirt, (1 - smoothstep(8, 12, ax)) * 0.6);
          tmpC.lerp(cFar, smoothstep(80, 230, ax) * 0.55);
          const lake = this.lakeDepth(s, x);
          if (lake > 0.02) tmpC.lerp(cShore, clamp(lake * 2, 0, 1));
          if (this.flatZone(s, x) > 0.5 && ax > 9) tmpC.lerp(cDirt, 0.35);
          col.push(tmpC.r, tmpC.g, tmpC.b);
        }
      }
      const nc = cols.length;
      for (let r = 0; r < rows - 1; r++) {
        for (let ci = 0; ci < nc - 1; ci++) {
          const a = r * nc + ci;
          const b = a + 1;
          const c = a + nc;
          const d = c + 1;
          idx.push(a, b, c, b, d, c);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      g.computeBoundingSphere();
      const gm = new THREE.Mesh(g, groundMat);
      gm.receiveShadow = true;
      group.add(gm);

      // дорога
      const rp = [];
      const ruv = [];
      const ri = [];
      const rstep = 2;
      const r0 = Math.max(c0, -32);
      const r1 = Math.min(c1, this.L + 26);
      if (r1 <= r0) {
        this.chunks.push({ s0: c0, s1: c1, ground: gm, road: null });
        continue;
      }
      const rrows = Math.ceil((r1 - r0) / rstep) + 1;
      const rx = [-ROAD_HALF, 0, ROAD_HALF];
      for (let r = 0; r < rrows; r++) {
        const s = Math.min(r1, r0 + r * rstep);
        const f = this.frame(s, _fr);
        for (let k = 0; k < 3; k++) {
          rp.push(f.x + f.rx * rx[k], f.y + 0.04, f.z + f.rz * rx[k]);
          ruv.push(1 - k / 2, s / 14);
        }
      }
      for (let r = 0; r < rrows - 1; r++) {
        for (let k = 0; k < 2; k++) {
          const a = r * 3 + k;
          ri.push(a, a + 1, a + 3, a + 1, a + 4, a + 3);
        }
      }
      const rg = new THREE.BufferGeometry();
      rg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
      rg.setAttribute('uv', new THREE.Float32BufferAttribute(ruv, 2));
      rg.setIndex(ri);
      rg.computeVertexNormals();
      rg.computeBoundingSphere();
      const rm = new THREE.Mesh(rg, roadMat);
      rm.receiveShadow = true;
      group.add(rm);
      this.chunks.push({ s0: c0, s1: c1, ground: gm, road: rm });
    }

    // вода
    const bf = this.frame(this.bridgeS, {});
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(1, 48),
      new THREE.MeshPhongMaterial({ color: new THREE.Color(biome.water), shininess: 90, specular: 0x88aacc, transparent: true, opacity: 0.88 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.scale.set(165, this.bridgeLen * 0.7, 1);
    water.rotation.z = -bf.yaw + Math.PI / 2;
    water.position.set(bf.x, this.waterY, bf.z);
    // масштаб по осям круга: x — поперёк дороги, y — вдоль
    water.rotation.order = 'XYZ';
    water.rotation.set(-Math.PI / 2, 0, bf.yaw);
    water.scale.set(160, this.bridgeLen * 0.72, 1);
    water.receiveShadow = true;
    group.add(water);
    this.water = water;

    scene.add(group);
    this.group = group;
    return group;
  }
}

const _fr = {};
const _fr2 = {};

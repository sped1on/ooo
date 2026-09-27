// 2.5D-доска 8×8 для шахмат и шашек. Наследует у BoardView рендерер,
// свет, камеру, анимации и ввод; своё — доска, фигуры и подсветки.

import * as THREE from 'three';
import { BoardView } from './board3d.js';
import { board8Materials, pieceMaterial, pieceFaceted } from './materials.js';
import { glowTexture } from './textures.js';

const TOP = 0.14; // высота верхней грани клеток
const FRAME8 = 0.62;

// ---------- Геометрия фигур ----------

const BASE = [
  [0, 0],
  [0.34, 0],
  [0.35, 0.035],
  [0.33, 0.075],
  [0.27, 0.095],
  [0.26, 0.12],
];

const PROFILES = {
  p: [...BASE, [0.2, 0.15], [0.14, 0.22], [0.11, 0.33], [0.1, 0.37], [0.17, 0.4], [0.17, 0.42], [0.1, 0.44], [0, 0.44]],
  r: [...BASE, [0.22, 0.15], [0.19, 0.22], [0.17, 0.46], [0.24, 0.5], [0.24, 0.64], [0, 0.64]],
  b: [...BASE, [0.21, 0.15], [0.14, 0.26], [0.1, 0.46], [0.17, 0.49], [0.17, 0.51], [0.1, 0.53], [0.15, 0.61], [0.165, 0.69], [0.12, 0.77], [0.06, 0.81], [0, 0.83]],
  q: [...BASE, [0.23, 0.15], [0.15, 0.3], [0.11, 0.56], [0.2, 0.6], [0.2, 0.63], [0.12, 0.66], [0.17, 0.78], [0.21, 0.85], [0.15, 0.87], [0, 0.88]],
  k: [...BASE, [0.24, 0.15], [0.16, 0.3], [0.12, 0.6], [0.21, 0.64], [0.21, 0.67], [0.13, 0.7], [0.17, 0.83], [0.2, 0.92], [0, 0.94]],
  n: [...BASE, [0.22, 0.15], [0.21, 0.22], [0, 0.22]],
  man: [[0, 0], [0.37, 0], [0.39, 0.02], [0.39, 0.1], [0.37, 0.125], [0.3, 0.125], [0.28, 0.11], [0.2, 0.11], [0.18, 0.125], [0, 0.125]],
};

function merge(list) {
  const geos = list.map((g) => (g.index ? g.toNonIndexed() : g));
  const out = new THREE.BufferGeometry();
  for (const attr of ['position', 'normal', 'uv']) {
    const arrays = geos.map((g) => g.getAttribute(attr));
    if (arrays.some((a) => !a)) continue;
    const total = arrays.reduce((s, a) => s + a.array.length, 0);
    const data = new Float32Array(total);
    let off = 0;
    for (const a of arrays) {
      data.set(a.array, off);
      off += a.array.length;
    }
    out.setAttribute(attr, new THREE.BufferAttribute(data, arrays[0].itemSize));
  }
  return out;
}

function knightHead() {
  const s = new THREE.Shape();
  const pts = [
    [-0.17, 0.2],
    [0.17, 0.2],
    [0.15, 0.34],
    [0.07, 0.44],
    [0.2, 0.5],
    [0.25, 0.58],
    [0.22, 0.66],
    [0.08, 0.78],
    [0.06, 0.86],
    [0.01, 0.8],
    [-0.08, 0.78],
    [-0.17, 0.62],
    [-0.2, 0.42],
  ];
  s.moveTo(...pts[0]);
  for (const p of pts.slice(1)) s.lineTo(...p);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03, bevelSegments: 3, curveSegments: 4 });
  g.translate(0, 0, -0.08);
  return g;
}

const geoCache = new Map();
export function pieceGeometry(type, faceted = false) {
  const key = `${type}:${faceted}`;
  if (geoCache.has(key)) return geoCache.get(key);
  const seg = faceted ? 8 : 48;
  const lathe = (pts) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
  const parts = [];
  if (type === 'king8' || type === 'kingc') {
    // Дамка — две шашки и корона
    const a = lathe(PROFILES.man);
    const b = lathe(PROFILES.man);
    b.translate(0, 0.13, 0);
    const crown = new THREE.TorusGeometry(0.16, 0.035, 8, 24);
    crown.rotateX(Math.PI / 2);
    crown.translate(0, 0.27, 0);
    parts.push(a, b, crown);
  } else if (type === 'man') {
    parts.push(lathe(PROFILES.man));
  } else {
    parts.push(lathe(PROFILES[type]));
    if (type === 'p') {
      const head = faceted ? new THREE.IcosahedronGeometry(0.13, 0) : new THREE.SphereGeometry(0.13, 32, 20);
      head.translate(0, 0.53, 0);
      parts.push(head);
    } else if (type === 'r') {
      for (let i = 0; i < 4; i++) {
        const m = new THREE.BoxGeometry(0.1, 0.09, 0.1);
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        m.translate(Math.cos(a) * 0.18, 0.68, Math.sin(a) * 0.18);
        parts.push(m);
      }
    } else if (type === 'b') {
      const top = new THREE.SphereGeometry(0.04, 16, 10);
      top.translate(0, 0.86, 0);
      parts.push(top);
    } else if (type === 'q') {
      for (let i = 0; i < 8; i++) {
        const b = new THREE.SphereGeometry(0.035, 12, 8);
        const a = (i / 8) * Math.PI * 2;
        b.translate(Math.cos(a) * 0.18, 0.87, Math.sin(a) * 0.18);
        parts.push(b);
      }
      const top = new THREE.SphereGeometry(0.065, 20, 12);
      top.translate(0, 0.93, 0);
      parts.push(top);
    } else if (type === 'k') {
      const v = new THREE.BoxGeometry(0.06, 0.22, 0.06);
      v.translate(0, 1.04, 0);
      const h = new THREE.BoxGeometry(0.17, 0.06, 0.06);
      h.translate(0, 1.06, 0);
      parts.push(v, h);
    } else if (type === 'n') {
      parts.push(knightHead());
    }
  }
  const g = merge(parts);
  g.computeVertexNormals();
  geoCache.set(key, g);
  return g;
}

function labelTexture(text, color) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  ctx.font = 'bold 44px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 32, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Клетки одного цвета одной геометрией, UV — по всей доске
function cellsGeometry(cells) {
  const box = new THREE.BoxGeometry(1, TOP, 1).toNonIndexed();
  const bp = box.attributes.position.array;
  const bn = box.attributes.normal.array;
  const vc = bp.length / 3;
  const pos = new Float32Array(cells.length * bp.length);
  const nor = new Float32Array(cells.length * bn.length);
  const uv = new Float32Array(cells.length * vc * 2);
  cells.forEach(([r, c], k) => {
    for (let i = 0; i < vc; i++) {
      const o = (k * vc + i) * 3;
      const x = bp[i * 3] + c - 3.5;
      const z = bp[i * 3 + 2] + r - 3.5;
      pos[o] = x;
      pos[o + 1] = bp[i * 3 + 1] + TOP / 2;
      pos[o + 2] = z;
      nor[o] = bn[i * 3];
      nor[o + 1] = bn[i * 3 + 1];
      nor[o + 2] = bn[i * 3 + 2];
      uv[(k * vc + i) * 2] = (x + 4) / 8;
      uv[(k * vc + i) * 2 + 1] = 1 - (z + 4) / 8;
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

// Доска 8×8 с рамкой и подписями (для вида и превью магазина)
export function buildBoard8Mesh(skinId, { size, labels = true } = {}) {
  const g = new THREE.Group();
  const mats = board8Materials(skinId, size);
  const light = [];
  const dark = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) ((r + c) % 2 ? dark : light).push([r, c]);
  const lm = new THREE.Mesh(cellsGeometry(light), mats.light);
  const dm = new THREE.Mesh(cellsGeometry(dark), mats.dark);
  lm.receiveShadow = dm.receiveShadow = true;
  g.add(lm, dm);
  const fw = 8 + FRAME8 * 2;
  const frameH = TOP + 0.04;
  const long = new THREE.BoxGeometry(fw, frameH, FRAME8);
  const side = new THREE.BoxGeometry(FRAME8, frameH, 8);
  for (const [geo, x, z] of [[long, 0, -(4 + FRAME8 / 2)], [long, 0, 4 + FRAME8 / 2], [side, -(4 + FRAME8 / 2), 0], [side, 4 + FRAME8 / 2, 0]]) {
    const m = new THREE.Mesh(geo, mats.frame);
    m.position.set(x, frameH / 2, z);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  }
  const base = new THREE.Mesh(new THREE.BoxGeometry(fw + 0.1, 0.3, fw + 0.1), mats.base);
  base.position.y = -0.15;
  base.receiveShadow = true;
  g.add(base);
  if (labels) {
    const color = mats.skin.label || '#e6e9f0';
    const geo = new THREE.PlaneGeometry(0.34, 0.34);
    const put = (text, x, z) => {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: labelTexture(text, color), transparent: true, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, frameH + 0.005, z);
      g.add(m);
    };
    for (let i = 0; i < 8; i++) {
      put('abcdefgh'[i], i - 3.5, 4 + FRAME8 / 2);
      put(String(8 - i), -(4 + FRAME8 / 2), i - 3.5);
    }
  }
  return g;
}

export function createPieceMesh(kind, skinId, type, color) {
  const skinKind = kind === 'chess' ? 'chessPieces' : 'checkersPieces';
  const gtype = kind === 'chess' ? type : type === 'king' ? 'king8' : 'man';
  const mesh = new THREE.Mesh(pieceGeometry(gtype, pieceFaceted(skinKind, skinId, color)), pieceMaterial(skinKind, skinId, color));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const s = kind === 'chess' ? 0.95 : 1;
  mesh.scale.setScalar(s);
  // Кони смотрят в сторону соперника
  if (gtype === 'n') mesh.rotation.y = color === 0 ? Math.PI / 2 : -Math.PI / 2;
  return mesh;
}

export class Board8View extends BoardView {
  constructor(canvas, opts = {}) {
    super(canvas, opts);
    this.kind = 'chess';
    this.frameW = FRAME8;
    this.skins8 = { board8: 'c-wood', pieces: 'c-classic' };
    this.pieceMeshes = new Map();
    this.overlays = [];
    this.redLight.intensity = 0;
    this.blueLight.intensity = 0;
    this.n = 8;
    this._buildBoard();
    this._resize();
  }

  setKind(kind) {
    if (this.kind === kind) return;
    this.kind = kind;
    this.clearPieces();
  }

  setSkins8(sk) {
    const prev = this.skins8;
    this.skins8 = { ...this.skins8, ...sk };
    if (prev.board8 !== this.skins8.board8) this._buildBoard();
    if (prev.pieces !== this.skins8.pieces) {
      const saved = [...this.pieceMeshes.entries()].map(([sq, m]) => ({ sq, ...m.userData }));
      this.clearPieces();
      for (const p of saved) this._addPiece(p.sq, p.type, p.color);
    }
  }

  // Базовый класс вызывает это при смене скинов Коридора — здесь не нужно
  setSkins() {}

  setSize() {}

  _buildPawns() {}

  _buildBoard() {
    const g = this.boardGroup;
    g.clear();
    g.add(buildBoard8Mesh(this.skins8.board8));
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 16),
      new THREE.MeshBasicMaterial({ map: glowTexture(), color: '#000000', transparent: true, opacity: 0.85, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.32;
    g.add(shadow);
    this.underGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshBasicMaterial({ map: glowTexture(), color: this.accent || '#2f5dff', transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.underGlow.rotation.x = -Math.PI / 2;
    this.underGlow.position.y = -0.34;
    g.add(this.underGlow);
    this.pickPlane = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshBasicMaterial({ visible: false }));
    this.pickPlane.rotation.x = -Math.PI / 2;
    this.pickPlane.position.y = TOP;
    g.add(this.pickPlane);
    const sc = this.keyLight.shadow.camera;
    sc.left = sc.bottom = -6;
    sc.right = sc.top = 6;
    sc.near = 1;
    sc.far = 40;
    sc.updateProjectionMatrix();
    this.ghost = null;
  }

  sqPos(sq) {
    return new THREE.Vector3((sq & 7) - 3.5, TOP, (sq >> 3) - 3.5);
  }

  clearPieces() {
    this.pieceMeshes.forEach((m) => this.root.remove(m));
    this.pieceMeshes.clear();
  }

  _addPiece(sq, type, color) {
    const m = createPieceMesh(this.kind, this.skins8.pieces, type, color);
    m.position.copy(this.sqPos(sq));
    m.userData = { type, color };
    this.root.add(m);
    this.pieceMeshes.set(sq, m);
    return m;
  }

  // Полная синхронизация с позицией (без анимации)
  syncPieces(game) {
    const want = new Map(game.pieces().map((p) => [p.sq, p]));
    for (const [sq, m] of this.pieceMeshes) {
      const p = want.get(sq);
      if (!p || p.type !== m.userData.type || p.color !== m.userData.color) {
        this.root.remove(m);
        this.pieceMeshes.delete(sq);
      }
    }
    for (const [sq, p] of want) if (!this.pieceMeshes.has(sq)) this._addPiece(sq, p.type, p.color);
  }

  // Анимация хода. captures — клетки снятых фигур, after — позиция после хода
  animateMove(from, to, { path = [to], captures = [], hop = false, after = null, extra = [] } = {}) {
    const mesh = this.pieceMeshes.get(from);
    if (!mesh) {
      if (after) this.syncPieces(after);
      return Promise.resolve();
    }
    this.pieceMeshes.delete(from);
    const victims = captures.map((sq) => {
      const v = this.pieceMeshes.get(sq);
      this.pieceMeshes.delete(sq);
      return v;
    }).filter(Boolean);
    const others = extra.map(([f, t]) => {
      const m = this.pieceMeshes.get(f);
      this.pieceMeshes.delete(f);
      if (m) this.pieceMeshes.set(t, m);
      return m ? { m, from: m.position.clone(), to: this.sqPos(t) } : null;
    }).filter(Boolean);
    this.pieceMeshes.set(to, mesh);
    const points = [mesh.position.clone(), ...path.map((sq) => this.sqPos(sq))];
    const segs = points.length - 1;
    const dur = this.animations ? 260 + segs * 180 : 0;
    const finish = () => {
      victims.forEach((v) => this.root.remove(v));
      if (after) this.syncPieces(after);
    };
    if (!dur) {
      mesh.position.copy(points[points.length - 1]);
      others.forEach((o) => o.m.position.copy(o.to));
      finish();
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      let hit = 0;
      this.tween(dur, (k) => {
        const f = Math.min(segs - 1e-6, k * segs);
        const i = Math.floor(f);
        const t = f - i;
        const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
        mesh.position.lerpVectors(points[i], points[i + 1], e);
        mesh.position.y = TOP + Math.sin(Math.PI * t) * (hop || captures.length ? 0.55 : 0.18);
        // Снятые фигуры исчезают, когда через них «перепрыгнули»
        while (hit < victims.length && hit < Math.floor(k * segs + 0.5)) {
          const v = victims[hit++];
          const y0 = v.position.y;
          this.tween(380, (q) => {
            v.position.y = y0 + q * 0.8;
            v.scale.setScalar(Math.max(0.01, 1 - q));
          });
        }
        others.forEach((o) => o.m.position.lerpVectors(o.from, o.to, e));
      }, () => {
        mesh.position.copy(points[points.length - 1]);
        this.shake(captures.length ? 0.04 : 0);
        finish();
        resolve();
      });
    });
  }

  // ---------- Подсветки ----------

  _overlay(sq, color, opacity, kind = 'square') {
    let mesh;
    if (kind === 'star') {
      const shape = new THREE.Shape();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 0.16 : 0.36;
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      shape.closePath();
      mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false }));
    } else if (kind === 'dot') {
      mesh = new THREE.Mesh(new THREE.CircleGeometry(0.14, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
    } else if (kind === 'ring') {
      mesh = new THREE.Mesh(new THREE.RingGeometry(0.38, 0.47, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
    } else {
      mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
    }
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(this.sqPos(sq));
    mesh.position.y = TOP + 0.004 + this.overlays.length * 0.0005;
    this.fxGroup.add(mesh);
    this.overlays.push(mesh);
    return mesh;
  }

  clearOverlays() {
    this.overlays.forEach((m) => {
      this.fxGroup.remove(m);
      m.geometry.dispose();
      m.material.dispose();
    });
    this.overlays = [];
  }

  // state: { last: [from,to], selected, targets: [{sq, capture}], check }
  highlight({ last = null, selected = null, targets = [], check = null, hint = null, stars = [], goals = [] } = {}) {
    this.clearOverlays();
    for (const sq of stars) this._overlay(sq, '#ffc93d', 0.95, 'star');
    for (const sq of goals) this._overlay(sq, '#3db8ff', 0.45);
    if (last) for (const sq of last) this._overlay(sq, '#ffd54a', 0.32);
    if (check !== null && check >= 0) {
      const g = this._overlay(check, '#ff2d3d', 0.55);
      g.material.map = glowTexture();
    }
    if (selected !== null) this._overlay(selected, '#4dff9a', 0.4);
    if (hint !== null) this._overlay(hint, '#4db8ff', 0.5);
    for (const t of targets) this._overlay(t.sq, t.capture ? '#ff5a5a' : '#1f8f4a', t.capture ? 0.85 : 0.75, t.capture ? 'ring' : 'dot');
  }

  showMoves() {}

  clearMoves() {
    this.clearOverlays();
  }

  // Клетка под указателем
  _pick(e) {
    if (!this.pickPlane) return null;
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObject(this.pickPlane)[0];
    if (!hit) return null;
    const local = this.root.worldToLocal(hit.point.clone());
    const c = Math.floor(local.x + 4);
    const r = Math.floor(local.z + 4);
    if (r < 0 || r > 7 || c < 0 || c > 7) return null;
    return { sq: r * 8 + c };
  }

  screenPosSq(sq) {
    const v = this.sqPos(sq);
    this.root.localToWorld(v);
    v.project(this.camera);
    const rect = this.canvas.getBoundingClientRect();
    return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
  }

  celebrateAt(sq, color) {
    const mesh = this.pieceMeshes.get(sq);
    if (!mesh) return;
    this.pawns = [mesh, mesh];
    mesh.userData.glow = { material: { opacity: 0 } };
    this.celebrate(color);
    this.pawns = [];
  }
}

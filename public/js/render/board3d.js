// 2.5D-сцена поля: плитки, борозды, стены, фишки, свечение финишных линий,
// подсветка ходов и «призрак» стены. Используется в меню, правилах и в игре.

import * as THREE from 'three';
import { wallMaterial, wallGlowColor, fieldMaterials, pawnMaterial, pawnIsFaceted, finishTileMaterial, finishMaterial, finishGlow } from './materials.js';
import { glowTexture, stripGlowTexture } from './textures.js';
import { PLAYER_COLORS } from '../data/skins.js';

export const GAP = 0.2;
const TILE = 1 - GAP;
const TILE_H = 0.18;
const WALL_H = 0.5;
const WALL_T = GAP * 0.8;
const FRAME_W = 0.32;
const PAWN_SCALE = 1.45;

const ease = {
  outCubic: (k) => 1 - (1 - k) ** 3,
  inOutCubic: (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2),
  outBounce: (k) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (k < 1 / d1) return n1 * k * k;
    if (k < 2 / d1) return n1 * (k -= 1.5 / d1) * k + 0.75;
    if (k < 2.5 / d1) return n1 * (k -= 2.25 / d1) * k + 0.9375;
    return n1 * (k -= 2.625 / d1) * k + 0.984375;
  },
  outBack: (k) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * (k - 1) ** 3 + c1 * (k - 1) ** 2;
  },
};

// ---------- Общие геометрии ----------

let pawnGeo = null;
let pawnGeoFlat = null;
function pawnGeometry(faceted) {
  if (!pawnGeo) {
    const pts = [
      [0, 0],
      [0.3, 0],
      [0.31, 0.03],
      [0.3, 0.07],
      [0.24, 0.1],
      [0.2, 0.13],
      [0.15, 0.2],
      [0.115, 0.32],
      [0.105, 0.4],
      [0.19, 0.44],
      [0.195, 0.47],
      [0.12, 0.5],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const body = new THREE.LatheGeometry(pts, 40);
    const head = new THREE.SphereGeometry(0.16, 32, 20);
    head.translate(0, 0.62, 0);
    pawnGeo = mergeGeometries([body, head]);
    const bodyF = new THREE.LatheGeometry(pts, 8);
    const headF = new THREE.IcosahedronGeometry(0.17, 0);
    headF.translate(0, 0.62, 0);
    pawnGeoFlat = mergeGeometries([bodyF.toNonIndexed(), headF]);
    pawnGeoFlat.computeVertexNormals();
  }
  return faceted ? pawnGeoFlat : pawnGeo;
}

// Минимальное объединение геометрий (позиции, нормали, uv)
function mergeGeometries(list) {
  const geos = list.map((g) => (g.index ? g.toNonIndexed() : g));
  const out = new THREE.BufferGeometry();
  for (const attr of ['position', 'normal', 'uv']) {
    const arrays = geos.map((g) => g.getAttribute(attr));
    if (arrays.some((a) => !a)) continue;
    const itemSize = arrays[0].itemSize;
    const total = arrays.reduce((s, a) => s + a.array.length, 0);
    const data = new Float32Array(total);
    let off = 0;
    for (const a of arrays) {
      data.set(a.array, off);
      off += a.array.length;
    }
    out.setAttribute(attr, new THREE.BufferAttribute(data, itemSize));
  }
  return out;
}

// Стена стоит точно в борозде: длина — две клетки плюс борозда между ними,
// концы совпадают с краями плиток
const WALL_L = 2 * TILE + GAP;
const wallGeo = boxWithWorldUV(new THREE.BoxGeometry(WALL_L, WALL_H, WALL_T), WALL_L, WALL_H, WALL_T, WALL_H);

// UV пропорционально размерам граней, чтобы текстура не растягивалась
function boxWithWorldUV(geo, sx, sy, sz, unit = 1) {
  const uv = geo.attributes.uv;
  const dims = [
    [sz, sy], // +x
    [sz, sy], // -x
    [sx, sz], // +y
    [sx, sz], // -y
    [sx, sy], // +z
    [sx, sy], // -z
  ];
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, (uv.getX(k) * dims[f][0]) / unit, (uv.getY(k) * dims[f][1]) / unit);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

// Плитки поля одной геометрией. planar=true — UV сверху по всей доске
// (одна картина на всё поле), иначе у каждой плитки своя UV 0..1
function tilesGeometry(n, cells, planar) {
  const box = new THREE.BoxGeometry(TILE, TILE_H, TILE).toNonIndexed();
  const bp = box.attributes.position.array;
  const bn = box.attributes.normal.array;
  const bu = box.attributes.uv.array;
  const vc = bp.length / 3;
  const pos = new Float32Array(cells.length * bp.length);
  const nor = new Float32Array(cells.length * bn.length);
  const uvs = new Float32Array(cells.length * vc * 2);
  const h = (n - 1) / 2;
  cells.forEach(([x, y], c) => {
    const ox = x - h;
    const oz = y - h;
    for (let i = 0; i < vc; i++) {
      const px = bp[i * 3] + ox;
      const py = bp[i * 3 + 1] + TILE_H / 2;
      const pz = bp[i * 3 + 2] + oz;
      const o = (c * vc + i) * 3;
      pos[o] = px;
      pos[o + 1] = py;
      pos[o + 2] = pz;
      nor[o] = bn[i * 3];
      nor[o + 1] = bn[i * 3 + 1];
      nor[o + 2] = bn[i * 3 + 2];
      const u = (c * vc + i) * 2;
      if (planar) {
        uvs[u] = (px + n / 2) / n;
        uvs[u + 1] = 1 - (pz + n / 2) / n;
      } else {
        uvs[u] = bu[i * 2];
        uvs[u + 1] = bu[i * 2 + 1];
      }
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  return g;
}

let hazardTex = null;
function hazardMaterial() {
  if (!hazardTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#16171a';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#f2b822';
    for (let i = -4; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 32, 128);
      ctx.lineTo(i * 32 + 16, 128);
      ctx.lineTo(i * 32 + 16 + 128, 0);
      ctx.lineTo(i * 32 + 128, 0);
      ctx.fill();
    }
    hazardTex = new THREE.CanvasTexture(c);
    hazardTex.colorSpace = THREE.SRGBColorSpace;
    hazardTex.wrapS = hazardTex.wrapT = THREE.RepeatWrapping;
  }
  return new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.6 });
}

// Украшения рамки по теме поля
function buildDecor(g, n, skin, frameH) {
  const type = skin.decor;
  if (!type) return;
  const A = n / 2 + FRAME_W / 2;
  const col = new THREE.Color(skin.decorColor || '#888');
  const rnd = (i, k) => {
    const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const corners = [[-A, -A], [A, -A], [-A, A], [A, A]];
  // Точки вдоль рамки (без зон финишных линий посередине верх/низ)
  const along = [];
  for (let i = 0; i <= n; i += 2) {
    const t = i - n / 2;
    along.push([-A, t], [A, t]);
  }
  const add = (mesh, x, z, y = frameH) => {
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    g.add(mesh);
    return mesh;
  };
  switch (type) {
    case 'bolts': {
      const geo = new THREE.CylinderGeometry(0.055, 0.055, 0.04, 16);
      const mat = new THREE.MeshStandardMaterial({ color: '#b8bec8', metalness: 1, roughness: 0.3 });
      for (const [x, z] of corners) add(new THREE.Mesh(geo, mat), x, z, frameH + 0.02);
      for (const [x, z] of along) add(new THREE.Mesh(geo, mat), x, z, frameH + 0.02);
      break;
    }
    case 'lights': {
      const geo = new THREE.BoxGeometry(0.1, 0.05, 0.3);
      const mat = new THREE.MeshBasicMaterial({ color: col, toneMapped: false });
      for (const [x, z] of along) add(new THREE.Mesh(geo, mat), x, z, frameH + 0.02);
      const cgeo = new THREE.BoxGeometry(0.22, 0.12, 0.22);
      for (const [x, z] of corners) add(new THREE.Mesh(cgeo, mat), x, z, frameH + 0.05);
      break;
    }
    case 'hazard': {
      const mat = hazardMaterial();
      const geo = new THREE.BoxGeometry(FRAME_W * 0.8, 0.03, n * 0.28);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) add(new THREE.Mesh(geo, mat), sx * A, sz * n * 0.3, frameH + 0.01);
      }
      break;
    }
    case 'rocks':
    case 'icerocks': {
      const mat = new THREE.MeshStandardMaterial({ color: col, roughness: type === 'icerocks' ? 0.2 : 0.9, flatShading: true });
      let i = 0;
      for (const [x, z] of [...corners, ...along.filter((_, k) => k % 3 === 0)]) {
        const r = 0.12 + rnd(i, 1) * 0.16;
        const m = add(new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), mat), x + (rnd(i, 2) - 0.5) * 0.3, z + (rnd(i, 3) - 0.5) * 0.3, frameH + r * 0.4);
        m.rotation.set(rnd(i, 4) * 3, rnd(i, 5) * 3, 0);
        m.scale.y = 0.7;
        i++;
      }
      break;
    }
    case 'crystals': {
      const mat = new THREE.MeshPhysicalMaterial({ color: col, emissive: col, emissiveIntensity: 0.6, roughness: 0.1, transparent: true, opacity: 0.85, flatShading: true });
      let i = 0;
      for (const [x, z] of [...corners, ...corners, ...along.filter((_, k) => k % 2 === 0)]) {
        const hgt = 0.35 + rnd(i, 1) * 0.55;
        const m = add(new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), mat), x + (rnd(i, 2) - 0.5) * 0.25, z + (rnd(i, 3) - 0.5) * 0.25, frameH + hgt * 0.4);
        m.scale.set(1, hgt / 0.24, 1);
        m.rotation.set((rnd(i, 4) - 0.5) * 0.6, rnd(i, 5) * 3, (rnd(i, 6) - 0.5) * 0.6);
        i++;
      }
      break;
    }
    case 'bushes':
    case 'flowers': {
      const leaf = new THREE.MeshStandardMaterial({ color: '#2f7a2c', roughness: 0.9, flatShading: true });
      const petal = new THREE.MeshStandardMaterial({ color: '#ff6fb0', roughness: 0.6, emissive: '#ff3c8a', emissiveIntensity: 0.2 });
      let i = 0;
      for (const [x, z] of [...corners, ...along]) {
        const r = 0.1 + rnd(i, 1) * 0.1;
        add(new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), leaf), x + (rnd(i, 2) - 0.5) * 0.2, z + (rnd(i, 3) - 0.5) * 0.3, frameH + r * 0.5);
        if (type === 'flowers' && rnd(i, 4) > 0.3) add(new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), petal), x + (rnd(i, 5) - 0.5) * 0.2, z + (rnd(i, 6) - 0.5) * 0.3, frameH + r + 0.02);
        i++;
      }
      break;
    }
    case 'pillars': {
      const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.9 });
      const geo = new THREE.BoxGeometry(0.4, 0.5, 0.4);
      for (const [x, z] of corners) add(new THREE.Mesh(geo, mat), x, z, frameH + 0.2);
      break;
    }
    case 'spikes': {
      const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.5, metalness: 0.3 });
      const geo = new THREE.ConeGeometry(0.07, 0.3, 6);
      for (const [x, z] of [...corners, ...along]) add(new THREE.Mesh(geo, mat), x, z, frameH + 0.15);
      break;
    }
    default:
  }
}

// Построить доску: основание, плитки, рамка, декор, финишные линии.
// Возвращает группу и ссылки на финишные линии (для анимации свечения).
export function buildBoardMesh(n, skins, { checkerRows = true, surfSize } = {}) {
  const g = new THREE.Group();
  const mats = fieldMaterials(skins.field, surfSize);
  const A = n / 2;
  const frameH = 0.26;

  // Основание: его верх — дно борозд между плитками
  const baseSize = n + FRAME_W * 2;
  const base = new THREE.Mesh(new THREE.BoxGeometry(baseSize, 0.5, baseSize), [mats.base, mats.base, mats.groove, mats.base, mats.base, mats.base]);
  base.position.y = -0.25;
  base.receiveShadow = true;
  g.add(base);

  // Рамка
  const fl = n + FRAME_W * 2;
  const long = boxWithWorldUV(new THREE.BoxGeometry(fl, frameH, FRAME_W), fl, frameH, FRAME_W, 1.2);
  const side = boxWithWorldUV(new THREE.BoxGeometry(FRAME_W, frameH, n), FRAME_W, frameH, n, 1.2);
  for (const [geo, x, z] of [[long, 0, -(A + FRAME_W / 2)], [long, 0, A + FRAME_W / 2], [side, -(A + FRAME_W / 2), 0], [side, A + FRAME_W / 2, 0]]) {
    const m = new THREE.Mesh(geo, mats.frame);
    m.position.set(x, frameH / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  }

  // Плитки: одна картина на всё поле; стартовые ряды — клетчатые
  const main = [];
  const rows = [];
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) (checkerRows && (y === 0 || y === n - 1) ? rows : main).push([x, y]);
  }
  const tiles = new THREE.Mesh(tilesGeometry(n, main, true), mats.surface);
  tiles.receiveShadow = true;
  g.add(tiles);
  if (rows.length) {
    const fr = new THREE.Mesh(tilesGeometry(n, rows, false), finishTileMaterial());
    fr.receiveShadow = true;
    g.add(fr);
  }

  buildDecor(g, n, mats.skin, frameH);

  // Финишные линии на рамке: сверху — красного игрока, снизу — синего
  const stripW = FRAME_W * 0.5;
  const stripGeo = boxWithWorldUV(new THREE.BoxGeometry(n, 0.06, stripW), n, 0.06, stripW, stripW * 2);
  const glowGeo = new THREE.PlaneGeometry(n + 0.8, 1);
  const strips = [];
  for (const [player, z] of [[1, -(A + FRAME_W / 2)], [0, A + FRAME_W / 2]]) {
    const col = new THREE.Color(finishGlow(skins.finish, player));
    const strip = new THREE.Mesh(stripGeo, finishMaterial(skins.finish, player));
    strip.position.set(0, frameH + 0.03, z);
    g.add(strip);
    const glow = new THREE.Mesh(
      glowGeo,
      new THREE.MeshBasicMaterial({ map: stripGlowTexture(), color: col, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.set(0, frameH + 0.07, z);
    g.add(glow);
    const spill = new THREE.Mesh(glowGeo, glow.material.clone());
    spill.rotation.x = -Math.PI / 2;
    spill.material.opacity = 0.2;
    spill.scale.set(1, 1.4, 1);
    spill.position.set(0, TILE_H + 0.01, z + (player === 1 ? 0.6 : -0.6));
    g.add(spill);
    strips[player] = { strip, glow, spill, color: col };
  }
  return { group: g, strips };
}

export function createPawnMesh(skinId, player) {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(pawnGeometry(pawnIsFaceted(skinId)), pawnMaterial(skinId, player));
  mesh.castShadow = true;
  mesh.scale.setScalar(PAWN_SCALE);
  group.add(mesh);
  // Цветное кольцо у основания — сторона игрока видна при любом скине
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.03, 12, 56),
    new THREE.MeshBasicMaterial({ color: PLAYER_COLORS[player], toneMapped: false }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.03;
  group.add(ring);
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 1.5),
    new THREE.MeshBasicMaterial({ map: glowTexture(), color: PLAYER_COLORS[player], transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.01;
  group.add(glow);
  group.userData = { mesh, glow };
  return group;
}

export function createWallMesh(skinId) {
  const mesh = new THREE.Mesh(wallGeo, wallMaterial(skinId));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  // Светящиеся стены отбрасывают цветной ореол на поле
  const glowColor = wallGlowColor(skinId);
  if (glowColor) {
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(WALL_L + 0.5, 0.8),
      new THREE.MeshBasicMaterial({ map: stripGlowTexture(), color: glowColor, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -WALL_H / 2 + TILE_H + 0.015;
    mesh.add(glow);
  }
  return mesh;
}

// Простое окружение для отражений металла/стекла (аналог RoomEnvironment)
const envCache = new WeakMap();
function environmentFor(renderer) {
  if (envCache.has(renderer)) return envCache.get(renderer);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1c2744');
  const box = new THREE.BoxGeometry(1, 1, 1);
  const add = (color, intensity, pos, scale) => {
    const m = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity) }));
    m.position.set(...pos);
    m.scale.set(...scale);
    scene.add(m);
  };
  add('#ffffff', 5, [0, 6, 0], [8, 0.1, 8]);
  add('#8fbcff', 3, [-6, 2, 0], [0.1, 4, 8]);
  add('#ffb0b8', 2.5, [6, 2, 0], [0.1, 4, 8]);
  add('#c8d4ec', 2.2, [0, 2, -6], [8, 4, 0.1]);
  add('#6d7fa6', 1.4, [0, 2, 6], [8, 4, 0.1]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(scene, 0.04).texture;
  pmrem.dispose();
  envCache.set(renderer, tex);
  return tex;
}

export function createRenderer(canvas, opts = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: !!opts.preserve,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.maxDpr || 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = opts.shadows !== false;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  return renderer;
}

export { environmentFor };

// ---------- Вид поля ----------

export class BoardView {
  constructor(canvas, { interactive = false, sway = false, tilt = 55 } = {}) {
    this.canvas = canvas;
    this.interactive = interactive;
    this.sway = sway;
    this.tilt = tilt;
    this.renderer = createRenderer(canvas);
    this.scene = new THREE.Scene();
    this.scene.environment = environmentFor(this.renderer);
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.boardGroup = new THREE.Group();
    this.wallsGroup = new THREE.Group();
    this.fxGroup = new THREE.Group();
    this.root.add(this.boardGroup, this.wallsGroup, this.fxGroup);
    this.tweens = [];
    this.n = 0;
    this.skins = { field: 'c-graphite', walls: 'c-grey', pawns: 'c-player', pawnsOpp: 'c-player', finish: 'c-player', mySeat: 0 };
    this.wallMeshes = new Map();
    this.pawns = [];
    this.markers = [];
    this.flipped = false;
    this.animations = true;
    this.t0 = performance.now();
    this.hover = null;
    this.handlers = {};
    this.orientation = 'h';
    this.ghostEnabled = false;
    this.shakeT = 0;
    this._setupLights();
    this._resize = this._resize.bind(this);
    this._ro = new ResizeObserver(this._resize);
    this._ro.observe(canvas.parentElement || canvas);
    this._setupInput();
    this.running = false;
  }

  // Перенести холст в другой контейнер (один WebGL-контекст на все экраны)
  mount(container, { interactive = false, sway = false } = {}) {
    this.interactive = interactive;
    this.sway = sway;
    if (!sway) this.root.rotation.y = this.flipped ? Math.PI : 0;
    if (this.canvas.parentElement !== container) {
      container.appendChild(this.canvas);
      this._ro.disconnect();
      this._ro.observe(container);
    }
    this.hover = null;
    this._resize();
  }

  _setupLights() {
    const hemi = new THREE.HemisphereLight('#9ab8ff', '#0a0f1c', 0.55);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight('#ffffff', 1.7);
    key.position.set(-5, 12, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    this.keyLight = key;
    this.scene.add(key, key.target);
    const rim = new THREE.DirectionalLight('#7aa2ff', 0.6);
    rim.position.set(6, 5, -8);
    this.scene.add(rim);
    this.redLight = new THREE.PointLight(PLAYER_COLORS[1], 3, 6, 1.6);
    this.blueLight = new THREE.PointLight(PLAYER_COLORS[0], 3, 6, 1.6);
    this.root.add(this.redLight, this.blueLight);
  }

  on(event, fn) {
    this.handlers[event] = fn;
  }

  emit(event, ...args) {
    this.handlers[event]?.(...args);
  }

  // Мировые координаты центра клетки / перекрёстка
  cellPos(x, y) {
    const h = (this.n - 1) / 2;
    return new THREE.Vector3(x - h, TILE_H, y - h);
  }

  wallPos(x, y) {
    const h = (this.n - 1) / 2;
    return new THREE.Vector3(x - h + 0.5, WALL_H / 2, y - h + 0.5);
  }

  // skins: { field, walls, pawns, pawnsOpp, finish }
  setSkins(skins) {
    const prev = this.skins;
    this.skins = { ...this.skins, ...skins };
    if (!this.n) return;
    if (prev.field !== this.skins.field || prev.finish !== this.skins.finish) this._buildBoard();
    if (prev.walls !== this.skins.walls || prev.wallsOpp !== this.skins.wallsOpp || prev.mySeat !== this.skins.mySeat) {
      for (const [key, m] of this.wallMeshes) {
        const nm = createWallMesh(this.wallSkinFor(m.userData.player));
        nm.userData.player = m.userData.player;
        nm.position.copy(m.position);
        nm.rotation.copy(m.rotation);
        this.wallsGroup.remove(m);
        this.wallsGroup.add(nm);
        this.wallMeshes.set(key, nm);
      }
    }
    if (prev.pawns !== this.skins.pawns || prev.pawnsOpp !== this.skins.pawnsOpp || prev.mySeat !== this.skins.mySeat) this._buildPawns();
  }

  setSize(n) {
    if (this.n === n) return;
    this.n = n;
    if (!n) return;
    this._buildBoard();
    this._buildPawns();
    this.clearWalls();
    this._resize();
  }

  setFlipped(flip) {
    this.flipped = flip;
    this.root.rotation.y = flip ? Math.PI : 0;
  }

  // Цвет подсветки под доской (из скина фона)
  setAccent(color) {
    this.accent = color;
    if (this.underGlow) this.underGlow.material.color.set(color);
  }

  _buildBoard() {
    const g = this.boardGroup;
    g.traverse((o) => {
      if (o.geometry && o.geometry !== wallGeo) o.geometry.dispose();
    });
    g.clear();
    const n = this.n;
    const A = n / 2;
    const built = buildBoardMesh(n, this.skins, { checkerRows: this.checkerRows !== false });
    g.add(built.group);
    this.strips = built.strips;

    // Мягкая тень и цветное свечение под доской — доска «стоит» в сцене
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(n * 1.9, n * 1.9),
      new THREE.MeshBasicMaterial({ map: glowTexture(), color: '#000000', transparent: true, opacity: 0.85, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.52;
    g.add(shadow);
    this.underGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(n * 2.4, n * 2.4),
      new THREE.MeshBasicMaterial({ map: glowTexture(), color: this.accent || '#2f5dff', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.underGlow.rotation.x = -Math.PI / 2;
    this.underGlow.position.y = -0.55;
    g.add(this.underGlow);

    this.redLight.color.copy(built.strips[1].color);
    this.blueLight.color.copy(built.strips[0].color);
    this.redLight.position.set(0, 1.2, -A);
    this.blueLight.position.set(0, 1.2, A);
    this.redLight.distance = this.blueLight.distance = Math.max(6, n * 0.8);

    // Плоскость для выбора клеток мышью
    this.pickPlane = new THREE.Mesh(new THREE.PlaneGeometry(n + 2, n + 2), new THREE.MeshBasicMaterial({ visible: false }));
    this.pickPlane.rotation.x = -Math.PI / 2;
    this.pickPlane.position.y = TILE_H;
    g.add(this.pickPlane);

    // Тени: подгоняем камеру света под размер поля
    const sc = this.keyLight.shadow.camera;
    sc.left = sc.bottom = -(A + 1.5);
    sc.right = sc.top = A + 1.5;
    sc.near = 1;
    sc.far = 40;
    sc.updateProjectionMatrix();

    this._buildGhost();
  }

  _buildPawns() {
    this.pawns.forEach((p) => this.root.remove(p));
    const old = this.pawns.map((p) => p.position.clone());
    const mine = this.skins.mySeat ?? 0;
    this.pawns = [0, 1].map((pl) => {
      const skin = pl === mine ? this.skins.pawns : this.skins.pawnsOpp || 'c-player';
      const m = createPawnMesh(skin, pl);
      this.root.add(m);
      return m;
    });
    if (old.length === 2) this.pawns.forEach((p, i) => p.position.copy(old[i]));
    else if (this.n) {
      const mid = (this.n - 1) >> 1;
      this.pawns[0].position.copy(this.cellPos(mid, this.n - 1));
      this.pawns[1].position.copy(this.cellPos(mid, 0));
    }
  }

  _buildGhost() {
    if (this.ghost) this.fxGroup.remove(this.ghost);
    this.ghostMat = new THREE.MeshStandardMaterial({
      color: '#3dff8a',
      emissive: '#3dff8a',
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    this.ghost = new THREE.Mesh(wallGeo, this.ghostMat);
    this.ghost.visible = false;
    this.fxGroup.add(this.ghost);
  }

  clearWalls() {
    this.wallMeshes.forEach((m) => this.wallsGroup.remove(m));
    this.wallMeshes.clear();
  }

  // Синхронизировать сцену с состоянием игры (без анимации)
  syncState(game) {
    this.setSize(game.n);
    const keep = new Set();
    for (const w of game.walls) {
      const key = `${w.x},${w.y},${w.o}`;
      keep.add(key);
      if (!this.wallMeshes.has(key)) this.addWall(w, false);
    }
    for (const [key, m] of this.wallMeshes) {
      if (!keep.has(key)) {
        this.wallsGroup.remove(m);
        this.wallMeshes.delete(key);
      }
    }
    game.pawns.forEach((p, i) => {
      this.pawns[i].position.copy(this.cellPos(p.x, p.y));
    });
  }

  // Стены соперника — его скином (бот, онлайн), свои — своим
  wallSkinFor(player) {
    const mine = this.skins.mySeat ?? 0;
    return player === undefined || player === mine || !this.skins.wallsOpp ? this.skins.walls : this.skins.wallsOpp;
  }

  addWall(w, animate = true) {
    const key = `${w.x},${w.y},${w.o}`;
    if (this.wallMeshes.has(key)) return;
    const mesh = createWallMesh(this.wallSkinFor(w.player));
    mesh.userData.player = w.player;
    const pos = this.wallPos(w.x, w.y);
    mesh.position.copy(pos);
    mesh.rotation.y = w.o === 'v' ? Math.PI / 2 : 0;
    this.wallsGroup.add(mesh);
    this.wallMeshes.set(key, mesh);
    if (animate && this.animations) {
      mesh.position.y = pos.y + 3;
      this.tween(520, (k) => {
        mesh.position.y = pos.y + 3 * (1 - ease.outBounce(k));
      }, () => {
        this.shake(0.06);
        this.emit('wallLanded');
      });
    }
  }

  removeWall(w) {
    const key = `${w.x},${w.y},${w.o}`;
    const m = this.wallMeshes.get(key);
    if (m) {
      this.wallsGroup.remove(m);
      this.wallMeshes.delete(key);
    }
  }

  movePawn(player, x, y, jump = false) {
    const pawn = this.pawns[player];
    const from = pawn.position.clone();
    const to = this.cellPos(x, y);
    if (!this.animations) {
      pawn.position.copy(to);
      return Promise.resolve();
    }
    const hop = jump ? 1.1 : 0.55;
    return new Promise((resolve) => {
      this.tween(jump ? 480 : 340, (k) => {
        const e = ease.inOutCubic(k);
        pawn.position.lerpVectors(from, to, e);
        pawn.position.y = to.y + Math.sin(Math.PI * k) * hop;
        const squash = 1 - Math.sin(Math.PI * k) * 0.08;
        pawn.userData.mesh.scale.set(PAWN_SCALE / squash ** 0.5, PAWN_SCALE * squash, PAWN_SCALE / squash ** 0.5);
      }, () => {
        pawn.userData.mesh.scale.setScalar(PAWN_SCALE);
        resolve();
      });
    });
  }

  // Подсветка допустимых ходов
  showMoves(moves, player) {
    this.clearMoves();
    const col = new THREE.Color(PLAYER_COLORS[player]);
    for (const m of moves) {
      const g = new THREE.Group();
      const disc = new THREE.Mesh(
        new THREE.BoxGeometry(TILE * 0.86, 0.02, TILE * 0.86),
        new THREE.MeshStandardMaterial({
          color: col,
          emissive: col,
          emissiveIntensity: 0.9,
          transparent: true,
          opacity: 0.42,
          depthWrite: false,
        }),
      );
      const halo = new THREE.Mesh(
        new THREE.PlaneGeometry(1.2, 1.2),
        new THREE.MeshBasicMaterial({
          map: glowTexture(),
          color: col,
          transparent: true,
          opacity: 0.45,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = 0.02;
      g.add(disc, halo);
      g.position.copy(this.cellPos(m.x, m.y));
      g.position.y += 0.012;
      g.userData.cell = m;
      this.fxGroup.add(g);
      this.markers.push(g);
    }
  }

  clearMoves() {
    this.markers.forEach((m) => {
      this.fxGroup.remove(m);
      m.traverse((o) => {
        if (o.material) o.material.dispose();
        if (o.geometry) o.geometry.dispose();
      });
    });
    this.markers = [];
  }

  // Призрак стены: valid=true — зелёный, false — красный, null — скрыть
  showGhost(w, valid) {
    if (!w) {
      this.ghost.visible = false;
      return;
    }
    const pos = this.wallPos(w.x, w.y);
    this.ghost.position.copy(pos);
    this.ghost.rotation.y = w.o === 'v' ? Math.PI / 2 : 0;
    const c = valid ? '#3dff8a' : '#ff3d4d';
    this.ghostMat.color.set(c);
    this.ghostMat.emissive.set(c);
    this.ghost.visible = true;
  }

  pulseStrip(player, on) {
    this.activeStrip = on ? player : -1;
  }

  shake(amount) {
    if (this.animations) this.shakeT = amount;
  }

  tween(duration, update, done) {
    this.tweens.push({ t0: performance.now(), duration, update, done });
  }

  // ---------- Ввод ----------

  _setupInput() {
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    const el = this.canvas;
    el.addEventListener('pointermove', (e) => {
      if (!this.interactive) return;
      const t = this._pick(e);
      this.hover = t;
      this.emit('hover', t, e);
    });
    el.addEventListener('pointerleave', () => {
      this.hover = null;
      this.emit('hover', null);
    });
    let down = null;
    el.addEventListener('pointerdown', (e) => {
      if (!this.interactive) return;
      down = { x: e.clientX, y: e.clientY, button: e.button };
    });
    el.addEventListener('pointerup', (e) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 12;
      const button = down.button;
      down = null;
      if (moved) return;
      if (button === 2) {
        this.emit('rotate');
        return;
      }
      const t = this._pick(e);
      this.emit('click', t, e);
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener(
      'wheel',
      (e) => {
        if (this.interactive && Math.abs(e.deltaY) > 20) this.emit('rotate');
      },
      { passive: true },
    );
  }

  // Что под указателем: клетка и ближайший перекрёсток с ориентацией
  _pick(e) {
    if (!this.n || !this.pickPlane) return null;
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObject(this.pickPlane)[0];
    if (!hit) return null;
    const local = this.root.worldToLocal(hit.point.clone());
    const h = (this.n - 1) / 2;
    const fx = local.x + h;
    const fy = local.z + h;
    const n = this.n;
    const cx = Math.round(fx);
    const cy = Math.round(fy);
    const cell = cx >= 0 && cy >= 0 && cx < n && cy < n ? { x: cx, y: cy } : null;
    const clamp = (v) => Math.max(0, Math.min(n - 2, v));
    const wx = clamp(Math.round(fx - 0.5));
    const wy = clamp(Math.round(fy - 0.5));
    // Ориентация по борозде под указателем
    const dV = Math.abs(fx - (Math.floor(fx) + 0.5)); // до вертикальной борозды
    const dH = Math.abs(fy - (Math.floor(fy) + 0.5)); // до горизонтальной
    let o = this.orientation;
    if (Math.min(dV, dH) < 0.22 && Math.abs(dV - dH) > 0.06) o = dV < dH ? 'v' : 'h';
    const inside = fx > -0.6 && fy > -0.6 && fx < n - 0.4 && fy < n - 0.4;
    return { cell, wall: inside ? { x: wx, y: wy, o } : null, onGroove: Math.min(dV, dH) < 0.22 };
  }

  // ---------- Камера и цикл отрисовки ----------

  setTilt(deg) {
    this.tilt = deg;
    this._placeCamera();
  }

  _resize() {
    const parent = this.canvas.parentElement || this.canvas;
    const w = Math.max(1, parent.clientWidth);
    const h = Math.max(1, parent.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this._placeCamera();
    if (!this.running) this.render();
  }

  // Отступы (px) под интерфейс сверху и снизу, чтобы поле не пряталось под HUD
  setPadding(fn) {
    this.padFn = fn;
    this._resize();
  }

  _placeCamera() {
    const n = this.n || 9;
    const size = new THREE.Vector2();
    this.renderer.getSize(size);
    const pad = this.padFn ? this.padFn() : { top: 0, bottom: 0 };
    const availH = Math.max(80, size.y - pad.top - pad.bottom);
    const shift = (pad.top - pad.bottom) / 2;
    if (shift) this.camera.setViewOffset(size.x, size.y, 0, -shift, size.x, size.y);
    else this.camera.clearViewOffset();
    const R = n / 2 + (this.frameW ?? FRAME_W) + 0.45;
    const th = THREE.MathUtils.degToRad(this.tilt);
    const tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * (availH / size.y);
    const aspect = size.x / availH;
    const halfW = R * 1.1;
    const halfH = R * (Math.sin(th) * 0.95 + 0.12) + 0.4;
    const d = Math.max(halfH / tanV, halfW / (tanV * aspect)) + R * Math.cos(th) * 0.55;
    this.camDist = d;
    this.camera.position.set(0, Math.sin(th) * d, Math.cos(th) * d);
    this.camera.lookAt(0, -0.2, 0.15);
    this.camera.updateProjectionMatrix();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.renderer.setAnimationLoop(() => this._frame());
  }

  stop() {
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  _frame() {
    const now = performance.now();
    const t = (now - this.t0) / 1000;
    this.tweens = this.tweens.filter((tw) => {
      const k = Math.min(1, (now - tw.t0) / tw.duration);
      tw.update(k);
      if (k >= 1) {
        tw.done?.();
        return false;
      }
      return true;
    });
    if (this.sway) {
      this.root.rotation.y = (this.flipped ? Math.PI : 0) + Math.sin(t * 0.25) * 0.1;
    }
    // Пульс подсветки ходов
    const pulse = 0.75 + Math.sin(t * 4) * 0.25;
    for (const m of this.markers) {
      m.children[0].material.opacity = 0.3 + pulse * 0.2;
      m.children[1].scale.setScalar(0.9 + pulse * 0.15);
    }
    // Мягкое «дыхание» свечения фишек и финишей
    this.pawns.forEach((p, i) => {
      p.userData.glow.material.opacity = 0.3 + Math.sin(t * 2 + i * 2) * 0.07;
    });
    if (this.strips) {
      this.strips.forEach((s, i) => {
        const boost = this.activeStrip === 1 - i ? 0.35 + Math.sin(t * 5) * 0.25 : 0;
        s.glow.material.opacity = 0.5 + Math.sin(t * 1.5 + i) * 0.08 + boost;
      });
    }
    if (this.ghost?.visible) this.ghostMat.opacity = 0.45 + Math.sin(t * 6) * 0.12;
    if (this.shakeT > 0) {
      this.shakeT *= 0.88;
      if (this.shakeT < 0.002) this.shakeT = 0;
      this.root.position.set((Math.random() - 0.5) * this.shakeT, 0, (Math.random() - 0.5) * this.shakeT);
    }
    this.render();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  // Экранные координаты клетки (для всплывающих подсказок)
  screenPos(x, y) {
    const v = this.cellPos(x, y);
    this.root.localToWorld(v);
    v.project(this.camera);
    const rect = this.canvas.getBoundingClientRect();
    return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
  }

  // Эффект победы: вспышка и «салют» из частиц
  celebrate(player) {
    const col = new THREE.Color(PLAYER_COLORS[player]);
    const count = 160;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const vel = [];
    const p = this.pawns[player].position;
    for (let i = 0; i < count; i++) {
      pos.set([p.x, p.y + 0.7, p.z], i * 3);
      const a = Math.random() * Math.PI * 2;
      const s = 2 + Math.random() * 4;
      vel.push([Math.cos(a) * s * 0.5, 3 + Math.random() * 5, Math.sin(a) * s * 0.5]);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.28,
      map: glowTexture(),
      color: col,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    this.root.add(pts);
    let last = 0;
    this.tween(2200, (k) => {
      const dt = (k - last) * 2.2;
      last = k;
      const arr = geo.attributes.position.array;
      for (let i = 0; i < count; i++) {
        vel[i][1] -= 9.8 * dt;
        arr[i * 3] += vel[i][0] * dt;
        arr[i * 3 + 1] += vel[i][1] * dt;
        arr[i * 3 + 2] += vel[i][2] * dt;
      }
      geo.attributes.position.needsUpdate = true;
      mat.opacity = 1 - k;
    }, () => {
      this.root.remove(pts);
      geo.dispose();
      mat.dispose();
    });
    const pawn = this.pawns[player];
    const y0 = pawn.position.y;
    this.tween(900, (k) => {
      pawn.position.y = y0 + Math.sin(k * Math.PI * 2) * 0.25 * (1 - k);
      pawn.rotation.y = ease.outCubic(k) * Math.PI * 2;
    });
  }

  dispose() {
    this.stop();
    this._ro.disconnect();
    this.renderer.dispose();
  }
}

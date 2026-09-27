// Превью скинов для магазина. Стены, финиш и фон — плоские образцы текстур
// (как на листах скинов), поле, фишки и наборы — 3D-рендеры.

import * as THREE from 'three';
import { createRenderer, environmentFor, createPawnMesh, createWallMesh, buildBoardMesh } from './board3d.js';
import { genTexture } from './textures.js';
import { buildBoard8Mesh, createPieceMesh } from './board8.js';
import { findSkin, PLAYER_COLORS } from '../data/skins.js';

const W = 360;
const H = 280;
let renderer = null;
let scene = null;
let camera = null;
const cache = new Map();

function setup() {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  renderer = createRenderer(c, { preserve: true, maxDpr: 1, shadows: true });
  renderer.setSize(W, H, false);
  renderer.setClearColor(0x000000, 0);
  scene = new THREE.Scene();
  scene.environment = environmentFor(renderer);
  scene.add(new THREE.HemisphereLight('#a9c2ff', '#0a0f1c', 0.8));
  const key = new THREE.DirectionalLight('#ffffff', 2.2);
  key.position.set(-3, 7, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = key.shadow.camera.bottom = -4;
  key.shadow.camera.right = key.shadow.camera.top = 4;
  scene.add(key);
  const rim = new THREE.DirectionalLight('#8fb0ff', 1.1);
  rim.position.set(4, 3, -4);
  scene.add(rim);
  camera = new THREE.PerspectiveCamera(32, W / H, 0.1, 60);
}

function card(bg = null) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  if (bg) {
    ctx.drawImage(bg, 0, 0, W, H);
  } else {
    const g = ctx.createRadialGradient(W / 2, H * 0.45, 10, W / 2, H / 2, W * 0.7);
    g.addColorStop(0, '#1f2d52');
    g.addColorStop(1, '#0a1020');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  return { c, ctx };
}

function shoot(content, camPos, target, bg) {
  if (!renderer) setup();
  scene.add(content);
  camera.position.set(...camPos);
  camera.lookAt(...target);
  renderer.render(scene, camera);
  scene.remove(content);
  const { c, ctx } = card(bg);
  ctx.drawImage(renderer.domElement, 0, 0);
  return c.toDataURL('image/png');
}

function floorShadow() {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ opacity: 0.5 }));
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  return m;
}

// Полоса текстуры со свечением и объёмом (для стен и финиша)
function bar(ctx, tex, x, y, w, h, glow, rotate = false) {
  ctx.save();
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 34;
    ctx.fillStyle = glow;
    ctx.fillRect(x, y, w, h);
  }
  ctx.shadowBlur = 0;
  const pattern = ctx.createPattern(tex, 'repeat');
  const scale = Math.min(w, h) / tex.width;
  // Для вертикальной стены поворачиваем текстуру: узор идёт вдоль стены
  const m = new DOMMatrix().translate(x, y);
  pattern.setTransform(rotate ? m.translate(w, 0).rotate(90).scale(scale * 1.6) : m.scale(scale * 1.6));
  ctx.fillStyle = pattern;
  ctx.fillRect(x, y, w, h);
  // Объём: свет слева/сверху, тень справа/снизу
  const vertical = h > w;
  const g = vertical ? ctx.createLinearGradient(x, 0, x + w, 0) : ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(255,255,255,0.28)');
  g.addColorStop(0.35, 'rgba(255,255,255,0)');
  g.addColorStop(0.75, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

function wallThumb(skin) {
  const { c, ctx } = card();
  const tex = genTexture(skin.r, skin.p, 256).map;
  const glow = skin.glowColor || (skin.glow ? '#ffffff' : null);
  bar(ctx, tex, W / 2 - 26, 28, 52, H - 56, glow && skin.glow ? glow : null, true);
  return c.toDataURL('image/png');
}

function finishThumb(skin) {
  const { c, ctx } = card();
  if (skin.plain) {
    const cols = skin.glowColor ? [skin.glowColor, skin.glowColor] : [PLAYER_COLORS[1], PLAYER_COLORS[0]];
    cols.forEach((col, i) => {
      ctx.save();
      ctx.shadowColor = col;
      ctx.shadowBlur = 30;
      ctx.fillStyle = col;
      ctx.fillRect(40, H / 2 - 50 + i * 80, W - 80, 18);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(40, H / 2 - 47 + i * 80, W - 80, 4);
      ctx.restore();
    });
  } else {
    const tex = genTexture(skin.r, skin.p, 256).map;
    bar(ctx, tex, 30, H / 2 - 20, W - 60, 40, skin.glowColor);
  }
  return c.toDataURL('image/png');
}

function backgroundThumb(skin) {
  const tex = genTexture(skin.r, skin.p, 512).map;
  const { c, ctx } = card(tex);
  if (skin.dim) {
    ctx.fillStyle = `rgba(0,0,0,${1 - skin.dim})`;
    ctx.fillRect(0, 0, W, H);
  }
  return c.toDataURL('image/png');
}

// Фишка крупным планом — чтобы скин было хорошо видно
function pawnThumb(skin) {
  const g = new THREE.Group();
  g.add(floorShadow());
  const p = createPawnMesh(skin.id, 0);
  p.userData.glow.visible = false;
  p.scale.setScalar(1.75);
  g.add(p);
  return shoot(g, [0, 1.75, 4.1], [0, 0.95, 0]);
}

// Шахматные фигуры: белые и чёрные король, ферзь и конь
function chessPiecesThumb(skin) {
  const g = new THREE.Group();
  g.add(floorShadow());
  const set = [['k', 0, -0.55, 0.1], ['n', 0, -1.3, 0.55], ['q', 1, 0.55, -0.1], ['n', 1, 1.3, 0.35]];
  for (const [type, color, x, z] of set) {
    const m = createPieceMesh('chess', skin.id, type, color);
    m.scale.setScalar(1.6);
    m.position.set(x, 0, z);
    g.add(m);
  }
  return shoot(g, [0, 2.9, 5.6], [0, 0.7, 0]);
}

function checkersPiecesThumb(skin) {
  const g = new THREE.Group();
  g.add(floorShadow());
  const set = [['man', 0, -0.9, 0.3], ['king', 0, -0.2, -0.4], ['man', 1, 0.9, 0.3], ['king', 1, 0.5, -0.5]];
  for (const [type, color, x, z] of set) {
    const m = createPieceMesh('checkers', skin.id, type, color);
    m.scale.setScalar(1.5);
    m.position.set(x, 0, z);
    g.add(m);
  }
  return shoot(g, [0, 3.1, 3.9], [0, 0.1, 0]);
}

function board8Thumb(skin) {
  const g = buildBoard8Mesh(skin.id, { size: 512, labels: false });
  const pieces = [[3, 3, 0], [4, 4, 1], [2, 5, 1], [5, 2, 0]];
  for (const [r, c, color] of pieces) {
    const m = createPieceMesh('checkers', 'c-classic', 'man', color);
    m.position.set(c - 3.5, 0.14, r - 3.5);
    g.add(m);
  }
  return shoot(g, [0, 11, 8.2], [0, -0.6, 0.3]);
}

// Мини-доска 5×5 со скинами (для поля и наборов)
function boardThumb(skins, bgSkin) {
  const built = buildBoardMesh(5, { walls: 'c-grey', pawns: 'c-player', finish: 'c-player', ...skins }, { checkerRows: false, surfSize: 512 });
  const g = built.group;
  const pawns = [0, 1].map((pl) => {
    const m = createPawnMesh(pl === 0 ? skins.pawns || 'c-player' : 'c-player', pl);
    m.position.set(0, 0.18, pl ? -2 : 2);
    g.add(m);
    return m;
  });
  if (skins.walls) {
    for (const [x, z, rot] of [[-0.5, 0.5, 0], [1, -0.5, Math.PI / 2]]) {
      const w = createWallMesh(skins.walls);
      w.position.set(x, 0.25, z);
      w.rotation.y = rot;
      g.add(w);
    }
  }
  const bg = bgSkin ? genTexture(bgSkin.r, bgSkin.p, 512).map : null;
  const url = shoot(g, [0, 7.2, 6.4], [0, -0.35, 0.2], bg);
  pawns.forEach((p) => g.remove(p));
  return url;
}

export function skinThumb(kind, skin) {
  const key = `${kind}:${skin.id}`;
  if (cache.has(key)) return cache.get(key);
  let url;
  if (kind === 'walls') url = wallThumb(skin);
  else if (kind === 'finish') url = finishThumb(skin);
  else if (kind === 'background') url = backgroundThumb(skin);
  else if (kind === 'pawns') url = pawnThumb(skin);
  else if (kind === 'chessPieces') url = chessPiecesThumb(skin);
  else if (kind === 'checkersPieces') url = checkersPiecesThumb(skin);
  else if (kind === 'board8') url = board8Thumb(skin);
  else url = boardThumb({ field: skin.id });
  cache.set(key, url);
  return url;
}

export function setThumb(set) {
  const key = `set:${set.id}`;
  if (cache.has(key)) return cache.get(key);
  const url = boardThumb(set.skins, findSkin('background', set.skins.background));
  cache.set(key, url);
  return url;
}

export function hasThumb(kind, id) {
  return cache.has(`${kind}:${id}`);
}

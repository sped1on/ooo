// Рисунки баллончиком на машинах: слой краски поверх кузова (развёртка 512×512).
// Хранится только в браузере игрока (localStorage).

import * as THREE from 'three';

export const SPRAY_SIZE = 512;
const KEY = 'zroad_spray_';
const layers = new Map();

export function sprayLayer(carId) {
  let l = layers.get(carId);
  if (!l) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SPRAY_SIZE;
    const ctx = canvas.getContext('2d');
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    l = { canvas, ctx, tex, dirty: false, empty: true };
    layers.set(carId, l);
  }
  return l;
}

// Текстура для материала: пустая 1×1, пока на машине ничего не нарисовано (экономия памяти)
let EMPTY = null;
export function sprayTexFor(carId) {
  const l = layers.get(carId);
  if (l) return l.tex;
  if (!EMPTY) {
    EMPTY = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
    EMPTY.needsUpdate = true;
  }
  return EMPTY;
}

// Загрузить сохранённые рисунки для списка машин
export function loadSprays(ids) {
  return Promise.all(
    ids.map(
      (id) =>
        new Promise((resolve) => {
          let url = null;
          try {
            url = localStorage.getItem(KEY + id);
          } catch {
            url = null;
          }
          if (!url) {
            resolve();
            return;
          }
          const img = new Image();
          img.onload = () => {
            const l = sprayLayer(id);
            l.ctx.drawImage(img, 0, 0);
            l.tex.needsUpdate = true;
            l.empty = false;
            resolve();
          };
          img.onerror = () => resolve();
          img.src = url;
        }),
    ),
  );
}

export function saveSpray(carId) {
  const l = layers.get(carId);
  if (!l || !l.dirty) return;
  l.dirty = false;
  try {
    if (l.empty) localStorage.removeItem(KEY + carId);
    else localStorage.setItem(KEY + carId, l.canvas.toDataURL('image/png'));
  } catch {
    // нет места или приватный режим
  }
}

export function clearSpray(carId) {
  const l = sprayLayer(carId);
  l.ctx.clearRect(0, 0, SPRAY_SIZE, SPRAY_SIZE);
  l.tex.needsUpdate = true;
  l.empty = true;
  l.dirty = true;
  saveSpray(carId);
}

// Пятно краски: мягкое ядро и мелкие брызги по краю, как у настоящего баллончика
export function sprayDab(carId, u, v, color, size) {
  const l = sprayLayer(carId);
  const ctx = l.ctx;
  const x = u * SPRAY_SIZE;
  const y = (1 - v) * SPRAY_SIZE;
  const g = ctx.createRadialGradient(x, y, 0, x, y, size);
  g.addColorStop(0, color);
  g.addColorStop(0.55, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = g;
  ctx.fillRect(x - size, y - size, size * 2, size * 2);
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = color;
  const n = Math.round(size * 1.2);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = size * (0.7 + Math.random() * 0.55);
    ctx.fillRect(x + Math.cos(a) * r, y + Math.sin(a) * r, 1.2, 1.2);
  }
  ctx.globalAlpha = 1;
  l.tex.needsUpdate = true;
  l.empty = false;
  l.dirty = true;
}

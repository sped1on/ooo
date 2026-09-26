// Процедурные текстуры для скинов: всё рисуется на canvas, без внешних файлов.

import * as THREE from 'three';

const SIZE = 256;

// Детерминированный шум значений
function makeNoise(seed = 1) {
  const perm = new Uint8Array(512);
  let s = seed * 9301 + 49297;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const vals = Array.from({ length: 256 }, () => rnd());
  const fade = (t) => t * t * (3 - 2 * t);
  // Периодичный шум (период = period клеток), чтобы текстура тайлилась
  const noise = (x, y, period = 256) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const h = (a, b) => vals[perm[(((a % period) + period) % period & 255) + perm[(((b % period) + period) % period) & 255]]];
    const u = fade(xf);
    const v = fade(yf);
    const a = h(xi, yi) + (h(xi + 1, yi) - h(xi, yi)) * u;
    const b = h(xi, yi + 1) + (h(xi + 1, yi + 1) - h(xi, yi + 1)) * u;
    return a + (b - a) * v;
  };
  const fbm = (x, y, oct = 4, period = 8) => {
    let sum = 0;
    let amp = 0.5;
    let f = 1;
    for (let o = 0; o < oct; o++) {
      sum += amp * noise(x * f, y * f, period * f);
      amp *= 0.5;
      f *= 2;
    }
    return sum / (1 - 0.5 ** oct);
  };
  return { noise, fbm, rnd };
}

function hex(c) {
  const col = new THREE.Color(c);
  return [col.r * 255, col.g * 255, col.b * 255];
}

function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function canvas(size = SIZE) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

// Заполнить canvas попиксельно функцией (u, v) -> [r, g, b]
function paint(fn, size = SIZE) {
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = fn(x / size, y / size);
      const i = (y * size + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function toTexture(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// Расстояние до границы ячеек Вороного — для трещин лавы и льда
function voronoiEdge(u, v, cells) {
  const pts = cells.pts;
  let d1 = 9;
  let d2 = 9;
  for (let ox = -1; ox <= 1; ox++) {
    for (let oy = -1; oy <= 1; oy++) {
      for (const p of pts) {
        const dx = u - (p[0] + ox);
        const dy = v - (p[1] + oy);
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < d1) {
          d2 = d1;
          d1 = d;
        } else if (d < d2) d2 = d;
      }
    }
  }
  return d2 - d1;
}

function makeCells(n, rnd) {
  return { pts: Array.from({ length: n }, () => [rnd(), rnd()]) };
}

const cache = new Map();

// Возвращает { map, emissiveMap?, roughnessMap? } для типа текстуры и параметров
export function getTextures(tex, skin, seed = 1) {
  const key = `${tex}|${skin.color}|${skin.dark || ''}|${skin.glow || ''}|${skin.vein || ''}|${seed}`;
  if (cache.has(key)) return cache.get(key);
  const res = build(tex, skin, seed);
  cache.set(key, res);
  return res;
}

function build(tex, skin, seed) {
  const { fbm, noise, rnd } = makeNoise(seed * 17 + tex.length);
  const base = hex(skin.color);
  switch (tex) {
    case 'plain':
    case 'tile': {
      const dark = mix(base, [0, 0, 0], 0.25);
      const light = mix(base, [255, 255, 255], 0.12);
      const map = paint((u, v) => {
        const n = fbm(u * 8, v * 8, 4, 8);
        // лёгкая фаска по краю
        const edge = Math.min(u, v, 1 - u, 1 - v);
        const bevel = edge < 0.04 ? 1.12 : 1;
        return mix(dark, light, n).map((c) => Math.min(255, c * bevel));
      });
      return { map: toTexture(map) };
    }
    case 'wood': {
      const dark = hex(skin.dark || '#5a3314');
      const map = paint((u, v) => {
        const w = fbm(u * 2, v * 12, 4, 2) * 6;
        const ring = (Math.sin((v * 22 + w) * Math.PI) + 1) / 2;
        const grain = noise(u * 180, v * 12, 256) * 0.25;
        return mix(base, dark, Math.pow(ring, 2.5) * 0.8 + grain);
      });
      return { map: toTexture(map) };
    }
    case 'stone': {
      const cells = makeCells(14, rnd);
      const dark = mix(base, [0, 0, 0], 0.55);
      const light = mix(base, [255, 255, 255], 0.2);
      const map = paint((u, v) => {
        const n = fbm(u * 6, v * 6, 5, 6);
        const e = voronoiEdge(u, v, cells);
        const crack = e < 0.012 ? 0.7 : 0;
        const speck = noise(u * 256, v * 256, 256) > 0.85 ? 0.15 : 0;
        return mix(mix(dark, light, n + speck), [10, 10, 12], crack);
      });
      return { map: toTexture(map) };
    }
    case 'sand': {
      const dark = mix(base, [60, 40, 10], 0.35);
      const map = paint((u, v) => {
        const dunes = (Math.sin((v * 10 + fbm(u * 3, v * 3, 3, 3) * 3) * Math.PI) + 1) / 2;
        const grain = noise(u * 256, v * 256, 256);
        return mix(base, dark, dunes * 0.35 + grain * 0.25);
      });
      return { map: toTexture(map) };
    }
    case 'metal': {
      const light = mix(base, [255, 255, 255], 0.3);
      const dark = mix(base, [0, 0, 0], 0.3);
      const map = paint((u, v) => {
        const brushed = noise(u * 2, v * 256, 256) * 0.6 + fbm(u * 4, v * 4, 3, 4) * 0.4;
        const edge = Math.min(u, v, 1 - u, 1 - v);
        return mix(dark, light, brushed * (edge < 0.03 ? 1.3 : 1));
      });
      const rough = paint((u, v) => {
        const r = 90 + noise(u * 2, v * 200, 256) * 80;
        return [r, r, r];
      });
      return { map: toTexture(map), roughnessMap: toTexture(rough, false) };
    }
    case 'ice': {
      const cells = makeCells(9, rnd);
      const deep = mix(base, [0, 10, 40], 0.45);
      const light = mix(base, [255, 255, 255], 0.55);
      const map = paint((u, v) => {
        const n = fbm(u * 4, v * 4, 4, 4);
        const e = voronoiEdge(u, v, cells);
        const crack = Math.max(0, 1 - e / 0.02);
        const edge = Math.min(u, v, 1 - u, 1 - v);
        const rim = Math.max(0, 1 - edge / 0.08) * 0.6;
        return mix(mix(deep, light, n * 0.7 + rim), [255, 255, 255], crack * 0.8);
      });
      return { map: toTexture(map), emissiveMap: toTexture(map) };
    }
    case 'lava': {
      const cells = makeCells(12, rnd);
      const glow = hex(skin.glow || '#ff5a14');
      const hot = mix(glow, [255, 230, 120], 0.5);
      const map = paint((u, v) => {
        const n = fbm(u * 6, v * 6, 4, 6);
        const e = voronoiEdge(u, v, cells);
        const t = Math.max(0, 1 - e / 0.035);
        return mix(mix(base, [60, 50, 50], n * 0.6), hot, t);
      });
      const emit = paint((u, v) => {
        const e = voronoiEdge(u, v, cells);
        const t = Math.max(0, 1 - e / 0.04);
        return mix([0, 0, 0], mix(glow, [255, 220, 120], t * t), Math.pow(t, 1.5));
      });
      return { map: toTexture(map), emissiveMap: toTexture(emit) };
    }
    case 'neon':
    case 'grid': {
      const glow = hex(skin.glow || '#b04dff');
      const isGrid = tex === 'grid';
      const shade = (u, v) => {
        const edge = Math.min(u, v, 1 - u, 1 - v);
        let t = Math.max(0, 1 - edge / (isGrid ? 0.05 : 0.07));
        t = Math.pow(t, 2.2);
        if (!isGrid) {
          // центральная светящаяся жила
          const mid = Math.abs(v - 0.5);
          t = Math.max(t, Math.max(0, 1 - mid / 0.025) * 0.8);
        }
        return t;
      };
      const map = paint((u, v) => mix(mix(base, [0, 0, 0], 0.1 * fbm(u * 6, v * 6, 3, 6)), glow, shade(u, v)));
      const emit = paint((u, v) => mix([0, 0, 0], glow, shade(u, v)));
      return { map: toTexture(map), emissiveMap: toTexture(emit) };
    }
    case 'marble': {
      const vein = hex(skin.vein || '#6d7480');
      const map = paint((u, v) => {
        const n = fbm(u * 3, v * 3, 5, 3);
        const t = Math.abs(Math.sin((u * 3 + v * 2 + n * 4) * Math.PI));
        const veins = Math.pow(1 - t, 8);
        return mix(mix(base, [255, 255, 255], n * 0.3), vein, veins * 0.85);
      });
      return { map: toTexture(map) };
    }
    case 'space': {
      const map = paint((u, v) => {
        const neb = fbm(u * 3, v * 3, 5, 3);
        let c = mix(base, [70, 30, 120], Math.pow(neb, 2.5) * 0.9);
        c = mix(c, [20, 90, 160], Math.pow(fbm(u * 3 + 5, v * 3 + 9, 4, 3), 3) * 0.6);
        const star = noise(u * 256, v * 256, 256);
        if (star > 0.93) c = mix(c, [255, 255, 255], (star - 0.93) / 0.07);
        return c;
      });
      return { map: toTexture(map), emissiveMap: toTexture(map) };
    }
    case 'grass': {
      const dark = mix(base, [0, 30, 0], 0.4);
      const light = mix(base, [200, 255, 120], 0.25);
      const map = paint((u, v) => {
        const n = fbm(u * 5, v * 5, 4, 5);
        const blades = noise(u * 256, v * 64, 256);
        return mix(dark, light, n * 0.6 + blades * 0.4);
      });
      return { map: toTexture(map) };
    }
    case 'chess': {
      // Клетки поля красятся в шахматном порядке через seed (0 / 1)
      const colr = seed % 2 ? hex(skin.dark) : base;
      const map = paint((u, v) => {
        const n = fbm(u * 6, v * 6, 4, 6);
        return mix(colr, mix(colr, [255, 255, 255], 0.2), n * 0.5);
      });
      return { map: toTexture(map) };
    }
    default:
      return { map: null };
  }
}

// Радиальное свечение для «ореолов» (аддитивное смешивание)
let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = canvas(128);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

// Вытянутое свечение для финишных линий
let stripTex = null;
export function stripGlowTexture() {
  if (stripTex) return stripTex;
  const c = canvas(64);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  stripTex = new THREE.CanvasTexture(c);
  return stripTex;
}

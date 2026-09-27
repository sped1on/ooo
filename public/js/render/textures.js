// Процедурные текстуры высокого разрешения: всё рисуется на canvas, без файлов.
// genTexture(recipe, params, size) -> { map: canvas, emissive: canvas|null }
// Большинство рецептов бесшовные по горизонтали и вертикали — их можно
// повторять вдоль стен и по полю.

import * as THREE from 'three';

// ---------- Шум ----------

function hash(x, y, s) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const wrap = (i, p) => ((i % p) + p) % p;
const fade = (t) => t * t * (3 - 2 * t);

// Периодичный шум значений: период p клеток
function vnoise(x, y, p, s) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const u = fade(x - xi);
  const v = fade(y - yi);
  const x0 = wrap(xi, p);
  const x1 = wrap(xi + 1, p);
  const y0 = wrap(yi, p);
  const y1 = wrap(yi + 1, p);
  const a = hash(x0, y0, s);
  const b = hash(x1, y0, s);
  const c = hash(x0, y1, s);
  const d = hash(x1, y1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// Фрактальный шум; u, v в [0,1), f — базовая частота (целая, для бесшовности)
function fbm(u, v, f, oct = 4, s = 1) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let o = 0; o < oct; o++) {
    sum += amp * vnoise(u * f, v * f, f, s + o * 17);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

// Клеточный шум (Уорли) на сетке g×g, бесшовный
function worley(u, v, g, s = 1) {
  const x = u * g;
  const y = v * g;
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let f1 = 9;
  let f2 = 9;
  let id = 0;
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const cx = xi + ox;
      const cy = yi + oy;
      const wx = wrap(cx, g);
      const wy = wrap(cy, g);
      const px = cx + hash(wx, wy, s);
      const py = cy + hash(wx, wy, s + 7);
      const d = Math.hypot(px - x, py - y);
      if (d < f1) {
        f2 = f1;
        f1 = d;
        id = hash(wx, wy, s + 13);
      } else if (d < f2) f2 = d;
    }
  }
  return { f1, f2, id };
}

// ---------- Цвет ----------

function rgb(c) {
  const col = new THREE.Color(c);
  return [col.r * 255, col.g * 255, col.b * 255];
}

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const smooth = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const BLACK = [0, 0, 0];
const WHITE = [255, 255, 255];

function canvas(S) {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  return c;
}

// Попиксельная отрисовка: fn(u, v) -> [r, g, b]
function pix(S, fn) {
  const c = canvas(S);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  const d = img.data;
  let i = 0;
  for (let y = 0; y < S; y++) {
    const v = (y + 0.5) / S;
    for (let x = 0; x < S; x++) {
      const col = fn((x + 0.5) / S, v);
      d[i] = col[0];
      d[i + 1] = col[1];
      d[i + 2] = col[2];
      d[i + 3] = 255;
      i += 4;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// Объёмная фаска по краю плитки
function bevel(c, w = 0.035, k = 1) {
  const ctx = c.getContext('2d');
  const S = c.width;
  const b = Math.max(2, S * w);
  const edge = (x0, y0, x1, y1, color) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    return g;
  };
  ctx.fillStyle = edge(0, 0, 0, b, `rgba(255,255,255,${0.28 * k})`);
  ctx.fillRect(0, 0, S, b);
  ctx.fillStyle = edge(0, 0, b, 0, `rgba(255,255,255,${0.18 * k})`);
  ctx.fillRect(0, 0, b, S);
  ctx.fillStyle = edge(0, S, 0, S - b, `rgba(0,0,0,${0.45 * k})`);
  ctx.fillRect(0, S - b, S, b);
  ctx.fillStyle = edge(S, 0, S - b, 0, `rgba(0,0,0,${0.35 * k})`);
  ctx.fillRect(S - b, 0, b, S);
  return c;
}

// ---------- Рецепты ----------
// Каждый возвращает { map, emissive? }. p — параметры скина.

const R = {};

// Однотонный цвет (бесплатные скины): лёгкая фактура, чтобы не выглядело пластмассой
R.plain = (S, p) => {
  const base = rgb(p.c);
  const map = pix(S, (u, v) => {
    const n = fbm(u, v, 6, 3, 3) - 0.5;
    return mul(base, 1 + n * 0.08);
  });
  return { map: p.bevel ? bevel(map) : map, emissive: p.glow ? pix(64, () => rgb(p.glow)) : null };
};

R.stone = (S, p) => {
  const base = rgb(p.c || '#8b9099');
  const dark = mul(base, 0.55);
  const light = mix(base, WHITE, 0.25);
  const slabs = p.slabs ?? 2;
  const map = pix(S, (u, v) => {
    const n = fbm(u, v, 4, 5, 11);
    const fine = vnoise(u * 64, v * 64, 64, 5);
    let col = mix(dark, light, clamp01(n * 1.25 - 0.1 + (fine - 0.5) * 0.15));
    const w = worley(u, v, 5, 21);
    const crack = 1 - smooth(0.0, 0.025, w.f2 - w.f1);
    if (fbm(u, v, 3, 2, 31) > 0.52) col = mix(col, mul(base, 0.3), crack * 0.8);
    // Швы между плитами
    const su = (u * slabs) % 1;
    const sv = (v * slabs) % 1;
    const seam = Math.min(su, 1 - su, sv, 1 - sv);
    if (slabs > 1) col = mix(col, mul(base, 0.35), 1 - smooth(0.004, 0.016, seam));
    if (slabs > 1 && seam > 0.016 && seam < 0.03) col = mix(col, light, 0.25);
    return col;
  });
  return { map: bevel(map) };
};

R.concrete = (S, p) => {
  const base = rgb(p.c || '#9a9c9f');
  const map = pix(S, (u, v) => {
    const n = fbm(u, v, 3, 5, 41);
    const grain = vnoise(u * 128, v * 128, 128, 42);
    let col = mul(base, 0.82 + n * 0.3 + (grain - 0.5) * 0.12);
    if (hash(Math.floor(u * 160), Math.floor(v * 160), 43) > 0.985) col = mul(col, 0.6);
    return col;
  });
  return { map: bevel(map, 0.03, 0.8) };
};

R.granite = (S, p) => {
  const base = rgb(p.c || '#5d6068');
  const specks = [mul(base, 0.35), mix(base, WHITE, 0.45), mix(base, [160, 110, 90], 0.4)];
  const map = pix(S, (u, v) => {
    const n = fbm(u, v, 4, 4, 51);
    let col = mul(base, 0.75 + n * 0.45);
    const h = hash(Math.floor(u * 170), Math.floor(v * 170), 52);
    if (h > 0.82) col = mix(col, specks[Math.floor(h * 1000) % 3], 0.75);
    return col;
  });
  return { map: bevel(map, 0.03, 0.8) };
};

R.marble = (S, p) => {
  const base = rgb(p.c || '#eceef2');
  const vein = rgb(p.c2 || '#5d6470');
  const map = pix(S, (u, v) => {
    const n = fbm(u, v, 3, 6, 61);
    const t = Math.abs(Math.sin((u + v * 0.6 + n * 2.2) * Math.PI * 3));
    const t2 = Math.abs(Math.sin((u * 0.4 - v + fbm(u, v, 4, 5, 62) * 3) * Math.PI * 5));
    const veins = Math.pow(1 - t, 14) * 0.9 + Math.pow(1 - t2, 30) * 0.5;
    const cloud = fbm(u, v, 2, 4, 63);
    return mix(mul(base, 0.92 + cloud * 0.1), vein, clamp01(veins));
  });
  return { map: bevel(map, 0.03, 0.7) };
};

R.sand = (S, p) => {
  const base = rgb(p.c || '#d8b47c');
  const dark = mix(base, [120, 80, 30], 0.35);
  const light = mix(base, WHITE, 0.25);
  const map = pix(S, (u, v) => {
    const warp = fbm(u, v, 2, 3, 71) * 1.6;
    const rip = (Math.sin((v * 7 + warp) * Math.PI * 2) + 1) / 2;
    const grain = hash(Math.floor(u * S), Math.floor(v * S), 72);
    let col = mix(dark, light, rip * 0.35 + fbm(u, v, 5, 3, 73) * 0.5);
    col = mul(col, 0.92 + grain * 0.14);
    return col;
  });
  return { map: bevel(map, 0.03, 0.6) };
};

R.sandstone = (S, p) => {
  const base = rgb(p.c || '#d9b98a');
  const map = pix(S, (u, v) => {
    const warp = fbm(u, v, 3, 4, 81) * 0.08;
    const band = (Math.sin((v + warp) * Math.PI * 2 * 9) + 1) / 2;
    const n = fbm(u, v, 6, 3, 82);
    const grain = hash(Math.floor(u * S), Math.floor(v * S), 83);
    return mul(mix(base, mul(base, 0.78), band * 0.45 + n * 0.25), 0.94 + grain * 0.1);
  });
  return { map: bevel(map, 0.03, 0.7) };
};

R.wood = (S, p) => {
  const base = rgb(p.c || '#b07038');
  const dark = rgb(p.c2 || '#5b3314');
  const planks = p.planks ?? 3;
  const map = pix(S, (u, v) => {
    const row = Math.floor(v * planks);
    const pv = (v * planks) % 1;
    const off = hash(row, 0, 91);
    const tone = 0.85 + hash(row, 1, 92) * 0.3;
    const uu = (u + off) % 1;
    const warp = fbm(uu, pv / planks, 2, 3, 93 + row) * 2.5;
    const ring = (Math.sin((pv * 3 + warp) * Math.PI * 6) + 1) / 2;
    const fibers = vnoise(uu * 4, pv * 90, 4, 94 + row);
    let col = mix(base, dark, Math.pow(ring, 3) * 0.55 + fibers * 0.25);
    col = mul(col, tone);
    // Сучок
    const kx = hash(row, 2, 95);
    const kd = Math.hypot((uu - kx) * 3, (pv - 0.5) * 1.2);
    if (kd < 0.12) col = mix(col, mul(dark, 0.7), (1 - kd / 0.12) * 0.8);
    // Щель между досками
    const gap = Math.min(pv, 1 - pv);
    col = mix(col, mul(dark, 0.35), 1 - smooth(0.01, 0.05, gap));
    return col;
  });
  return { map: p.bevel === false ? map : bevel(map, 0.03, 0.8) };
};

R.metal = (S, p) => {
  const base = rgb(p.c || '#8f98a6');
  const plates = p.plates ?? 2;
  const c = pix(S, (u, v) => {
    const brushed = vnoise(u * 3, v * 220, 3, 101) * 0.6 + fbm(u, v, 4, 3, 102) * 0.4;
    const su = (u * plates) % 1;
    const sv = (v * plates) % 1;
    let col = mul(base, 0.78 + brushed * 0.35);
    const seam = Math.min(su, 1 - su, sv, 1 - sv);
    if (plates > 1) {
      col = mix(col, mul(base, 0.3), 1 - smooth(0.004, 0.012, seam));
      if (seam > 0.012 && seam < 0.03) col = mix(col, WHITE, 0.18 * (1 - (seam - 0.012) / 0.018));
    }
    return col;
  });
  if (p.rivets !== false) {
    const ctx = c.getContext('2d');
    const n = plates;
    const r = S * 0.018;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        for (const [a, b] of [[0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]]) {
          const x = ((i + a) / n) * S;
          const y = ((j + b) / n) * S;
          const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
          g.addColorStop(0, 'rgba(255,255,255,0.95)');
          g.addColorStop(0.5, `rgb(${mul(base, 0.95).map(Math.round)})`);
          g.addColorStop(1, 'rgba(0,0,0,0.8)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
  return { map: bevel(c, 0.03, 1) };
};

R.brushed = (S, p) => {
  const base = rgb(p.c || '#c0c8d4');
  const map = pix(S, (u, v) => {
    const b = vnoise(u * 2, v * 300, 2, 111) * 0.5 + vnoise(u * 4, v * 90, 4, 112) * 0.3 + fbm(u, v, 3, 2, 113) * 0.2;
    const sheen = Math.pow((Math.sin((u * 0.8 + v * 0.3) * Math.PI * 2) + 1) / 2, 3) * 0.25;
    return mix(mul(base, 0.72 + b * 0.4), WHITE, sheen);
  });
  return { map };
};

R.ice = (S, p) => {
  const base = rgb(p.c || '#5bb8f5');
  const deep = mix(base, [0, 20, 70], 0.5);
  const light = mix(base, WHITE, 0.6);
  const map = pix(S, (u, v) => {
    const n = fbm(u, v, 3, 5, 121);
    const w = worley(u, v, 4, 122);
    const crack = 1 - smooth(0.0, 0.03, w.f2 - w.f1);
    const w2 = worley(u, v, 9, 123);
    const crack2 = 1 - smooth(0.0, 0.02, w2.f2 - w2.f1);
    let col = mix(deep, light, clamp01(n * 0.9 + w.f1 * 0.35));
    col = mix(col, WHITE, crack * 0.85 + crack2 * 0.25);
    return col;
  });
  const emissive = pix(S / 2, (u, v) => {
    const w = worley(u, v, 4, 122);
    const crack = 1 - smooth(0.0, 0.03, w.f2 - w.f1);
    return mul(mix(base, WHITE, 0.5), 0.12 + crack * 0.5);
  });
  return { map: p.bevel === false ? map : bevel(map, 0.03, 0.8), emissive };
};

R.lava = (S, p) => {
  const glow = rgb(p.glow || '#ff5a14');
  const hot = mix(glow, [255, 235, 140], 0.55);
  const rock = rgb(p.c || '#241815');
  const cells = p.big ? 4 : 6;
  const heat = (u, v) => {
    const w = worley(u, v, cells, 131);
    const e = w.f2 - w.f1;
    const t = 1 - smooth(0.0, 0.07, e);
    const flick = fbm(u, v, 4, 3, 132);
    return clamp01(t * (0.7 + flick * 0.6));
  };
  const map = pix(S, (u, v) => {
    const t = heat(u, v);
    const n = fbm(u, v, 6, 4, 133);
    const base = mul(rock, 0.7 + n * 0.7);
    return mix(base, mix(glow, hot, t * t), t);
  });
  const emissive = pix(S, (u, v) => {
    const t = heat(u, v);
    return mix(BLACK, mix(glow, hot, t), Math.pow(t, 1.3));
  });
  return { map, emissive };
};

R.grass = (S, p) => {
  const base = rgb(p.c || '#3f8f37');
  const c = pix(S, (u, v) => mul(base, 0.6 + fbm(u, v, 5, 4, 141) * 0.55));
  const ctx = c.getContext('2d');
  const count = Math.floor(S * S * 0.012);
  for (let i = 0; i < count; i++) {
    const x = hash(i, 1, 142) * S;
    const y = hash(i, 2, 143) * S;
    const len = S * (0.02 + hash(i, 3, 144) * 0.035);
    const ang = -Math.PI / 2 + (hash(i, 4, 145) - 0.5) * 1.1;
    const shade = 0.55 + hash(i, 5, 146) * 0.8;
    const col = mul(base, shade).map((x) => Math.min(255, Math.round(x)));
    ctx.strokeStyle = `rgb(${col})`;
    ctx.lineWidth = Math.max(1, S / 300);
    for (const dx of [0, S, -S]) {
      for (const dy of [0, S, -S]) {
        if ((dx || dy) && x + dx > -len && x + dx < S + len && y + dy > -len && y + dy < S + len) {
          // бесшовность: рисуем копии у краёв
        } else if (dx || dy) continue;
        ctx.beginPath();
        ctx.moveTo(x + dx, y + dy);
        ctx.quadraticCurveTo(x + dx + Math.cos(ang) * len * 0.5 + len * 0.15, y + dy + Math.sin(ang) * len * 0.5, x + dx + Math.cos(ang) * len, y + dy + Math.sin(ang) * len);
        ctx.stroke();
      }
    }
  }
  return { map: bevel(c, 0.03, 0.6) };
};

R.leaves = (S, p) => {
  const base = rgb(p.c || '#2f7a2c');
  const c = pix(S, (u, v) => mul(base, 0.3 + fbm(u, v, 4, 3, 151) * 0.3));
  const ctx = c.getContext('2d');
  const count = 140;
  for (let i = 0; i < count; i++) {
    const x = hash(i, 1, 152) * S;
    const y = hash(i, 2, 153) * S;
    const r = S * (0.05 + hash(i, 3, 154) * 0.05);
    const a = hash(i, 4, 155) * Math.PI * 2;
    const shade = 0.6 + hash(i, 5, 156) * 0.8;
    for (const [dx, dy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
      ctx.save();
      ctx.translate(x + dx, y + dy);
      ctx.rotate(a);
      const g = ctx.createLinearGradient(-r, 0, r, 0);
      g.addColorStop(0, `rgb(${mul(base, shade * 0.7).map(Math.round)})`);
      g.addColorStop(1, `rgb(${mul(base, shade * 1.3).map((x) => Math.min(255, Math.round(x)))})`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(0,0,0,0.25)`;
      ctx.lineWidth = Math.max(1, S / 400);
      ctx.beginPath();
      ctx.moveTo(-r, 0);
      ctx.lineTo(r, 0);
      ctx.stroke();
      ctx.restore();
    }
  }
  return { map: c };
};

R.brick = (S, p) => {
  const base = rgb(p.c || '#a34a32');
  const mortar = rgb(p.c2 || '#cfc6b8');
  const rows = p.rows ?? 4;
  const cols = 2;
  const map = pix(S, (u, v) => {
    const r = Math.floor(v * rows);
    const shift = r % 2 ? 0.5 / cols : 0;
    const bu = ((u + shift) * cols) % 1;
    const bv = (v * rows) % 1;
    const bi = Math.floor(((u + shift) % 1) * cols);
    const tone = 0.78 + hash(bi, r, 161) * 0.35;
    const n = fbm(u, v, 8, 3, 162);
    const edge = Math.min(bu * 2, (1 - bu) * 2, bv, 1 - bv);
    const inside = smooth(0.04, 0.07, edge);
    let col = mul(base, tone * (0.85 + n * 0.3));
    // Затенение к краям кирпича
    col = mul(col, 0.85 + smooth(0.07, 0.2, edge) * 0.15);
    const m = mul(mortar, 0.8 + n * 0.3);
    return mix(m, col, inside);
  });
  return { map };
};

R.tile = (S, p) => {
  const base = rgb(p.c || '#dfe3ea');
  const grout = rgb(p.c2 || '#8c939e');
  const n2 = p.grid ?? 2;
  const map = pix(S, (u, v) => {
    const tu = (u * n2) % 1;
    const tv = (v * n2) % 1;
    const edge = Math.min(tu, 1 - tu, tv, 1 - tv);
    const tone = 0.93 + hash(Math.floor(u * n2), Math.floor(v * n2), 171) * 0.1;
    let col = mul(base, tone * (0.95 + fbm(u, v, 4, 3, 172) * 0.08));
    // Блик глазури
    col = mix(col, WHITE, Math.pow(clamp01(1 - (tu + tv) * 0.9), 3) * 0.3);
    col = mul(col, 0.88 + smooth(0.02, 0.08, edge) * 0.12);
    return mix(grout, col, smooth(0.012, 0.022, edge));
  });
  return { map };
};

R.cobble = (S, p) => {
  const base = rgb(p.c || '#7b7f86');
  const map = pix(S, (u, v) => {
    const w = worley(u, v, 5, 181);
    const e = w.f2 - w.f1;
    const tone = 0.7 + w.id * 0.45;
    const dome = clamp01(1 - w.f1 * 1.4);
    let col = mul(base, tone * (0.65 + dome * 0.5) * (0.9 + fbm(u, v, 8, 3, 182) * 0.2));
    return mix(mul(base, 0.18), col, smooth(0.03, 0.09, e));
  });
  return { map };
};

R.soil = (S, p) => {
  const base = rgb(p.c || '#6b4a2f');
  const map = pix(S, (u, v) => {
    const n = fbm(u, v, 4, 5, 191);
    let col = mul(base, 0.65 + n * 0.6);
    const w = worley(u, v, 12, 192);
    if (w.f1 < 0.2 && w.id > 0.65) col = mix(col, mix(base, [180, 170, 150], 0.5), (1 - w.f1 / 0.2) * 0.7);
    return col;
  });
  return { map: bevel(map, 0.03, 0.5) };
};

R.carpet = (S, p) => {
  const base = rgb(p.c || '#8e1b22');
  const orn = rgb(p.c2 || '#d8a94a');
  const map = pix(S, (u, v) => {
    const weave = (vnoise(u * 180, v * 4, 180, 201) + vnoise(u * 4, v * 180, 4, 202)) / 2;
    let col = mul(base, 0.7 + weave * 0.45 + fbm(u, v, 3, 3, 203) * 0.15);
    const b = Math.min(u, 1 - u, v, 1 - v);
    if (b > 0.06 && b < 0.09) col = mix(col, orn, 0.8);
    const du = Math.abs(u - 0.5);
    const dv = Math.abs(v - 0.5);
    if (Math.abs(du + dv - 0.22) < 0.018 || Math.abs(du + dv - 0.12) < 0.012) col = mix(col, orn, 0.75);
    return col;
  });
  return { map };
};

R.rubber = (S, p) => {
  const base = rgb(p.c || '#22252b');
  const map = pix(S, (u, v) => {
    const g = 6;
    const cu = (u * g) % 1 - 0.5;
    const cv = (v * g) % 1 - 0.5;
    const d = Math.hypot(cu, cv);
    let col = mul(base, 0.9 + fbm(u, v, 8, 2, 211) * 0.2);
    if (d < 0.26) {
      const sh = (-cu - cv) * 1.6;
      col = mul(col, 1.25 + sh * 0.6);
    } else if (d < 0.3) col = mul(col, 0.6);
    return col;
  });
  return { map: bevel(map, 0.03, 0.8) };
};

R.plastic = (S, p) => {
  const base = rgb(p.c || '#3b4150');
  const map = pix(S, (u, v) => {
    const g = Math.pow(clamp01(1 - Math.hypot(u - 0.3, v - 0.25) * 1.3), 2) * 0.22;
    return mix(mul(base, 0.95 + fbm(u, v, 4, 2, 221) * 0.06), WHITE, g);
  });
  return { map: bevel(map, 0.04, 1) };
};

R.pixel = (S, p) => {
  const pal = (p.palette || ['#1d2b53', '#29366f', '#3b5dc9', '#41a6f6', '#73eff7', '#0e1a36']).map(rgb);
  const g = p.grid ?? 8;
  const map = pix(S, (u, v) => {
    const i = Math.floor(u * g);
    const j = Math.floor(v * g);
    const h = hash(i, j, 231);
    const n = fbm(i / g, j / g, 2, 2, 232);
    const col = pal[Math.min(pal.length - 1, Math.floor((h * 0.5 + n * 0.8) * pal.length) % pal.length)];
    const cu = (u * g) % 1;
    const cv = (v * g) % 1;
    const shade = cu < 0.1 || cv < 0.1 ? 1.15 : cu > 0.9 || cv > 0.9 ? 0.8 : 1;
    return mul(col, shade);
  });
  return { map };
};

R.neongrid = (S, p) => {
  const glow = rgb(p.glow || '#a64dff');
  const base = rgb(p.c || '#0d0820');
  const lines = p.lines ?? 2;
  const lineAt = (u, v) => {
    const lu = (u * lines) % 1;
    const lv = (v * lines) % 1;
    const d = Math.min(lu, 1 - lu, lv, 1 - lv);
    return Math.max(1 - smooth(0.004, 0.02, d), (1 - smooth(0.0, 0.09, d)) * 0.35);
  };
  const map = pix(S, (u, v) => mix(mul(base, 0.8 + fbm(u, v, 4, 3, 241) * 0.4), mix(glow, WHITE, 0.3), lineAt(u, v)));
  const emissive = pix(S, (u, v) => mul(glow, lineAt(u, v)));
  return { map, emissive };
};

// Неоновая жила по центру (для стен и финиша)
R.neon = (S, p) => {
  const glow = rgb(p.glow || '#b04dff');
  const base = rgb(p.c || '#140b26');
  const core = (u, v) => {
    const d = Math.abs(v - 0.5);
    const edge = Math.min(v, 1 - v);
    return Math.max(1 - smooth(0.02, 0.07, d), (1 - smooth(0.0, 0.2, d)) * 0.35, (1 - smooth(0.0, 0.05, edge)) * 0.6);
  };
  const map = pix(S, (u, v) => mix(mul(base, 0.85 + fbm(u, v, 4, 2, 251) * 0.3), mix(glow, WHITE, 0.35), core(u, v)));
  const emissive = pix(S, (u, v) => mix(BLACK, mix(glow, WHITE, 0.2 * core(u, v)), core(u, v)));
  return { map, emissive };
};

R.techno = (S, p) => {
  const glow = rgb(p.glow || '#22e4ff');
  const base = rgb(p.c || '#06121f');
  const c = pix(S, (u, v) => mul(base, 0.8 + fbm(u, v, 4, 3, 261) * 0.5));
  const e = canvas(S);
  const draw = (ctx, color, blur) => {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(1.5, S / 180);
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    for (let i = 0; i < 14; i++) {
      let x = Math.round(hash(i, 1, 262) * 8) / 8 * S;
      let y = Math.round(hash(i, 2, 263) * 8) / 8 * S;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 3; k++) {
        const dir = Math.floor(hash(i, k + 3, 264) * 4);
        const len = (1 + Math.floor(hash(i, k + 9, 265) * 3)) * S / 8;
        if (dir === 0) x += len;
        else if (dir === 1) y += len;
        else if (dir === 2) { x += len * 0.7; y += len * 0.7; } else y -= len;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, S / 70, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeRect(S * 0.02, S * 0.02, S * 0.96, S * 0.96);
  };
  const col = `rgb(${glow.map(Math.round)})`;
  draw(c.getContext('2d'), col, S / 40);
  const ectx = e.getContext('2d');
  ectx.fillStyle = '#000';
  ectx.fillRect(0, 0, S, S);
  draw(ectx, col, S / 30);
  return { map: c, emissive: e };
};

R.space = (S, p) => {
  const c1 = rgb(p.c || '#0a0a24');
  const neb1 = rgb(p.c2 || '#7a2ad8');
  const neb2 = rgb(p.c3 || '#1b7ad8');
  const map = pix(S, (u, v) => {
    const a = Math.pow(fbm(u, v, 3, 6, 271), 2.2);
    const b = Math.pow(fbm(u, v, 2, 6, 272), 2.6);
    let col = mix(c1, neb1, clamp01(a * 1.8));
    col = mix(col, neb2, clamp01(b * 1.6));
    const h = hash(Math.floor(u * S * 0.5), Math.floor(v * S * 0.5), 273);
    if (h > 0.994) col = mix(col, WHITE, (h - 0.994) / 0.006);
    const w = worley(u, v, 10, 274);
    if (w.id > 0.9) col = mix(col, WHITE, Math.pow(clamp01(1 - w.f1 * 9), 3));
    if (p.galaxy) {
      // Спиральные рукава галактики
      const dx = u - 0.5;
      const dy = v - 0.5;
      const r = Math.hypot(dx, dy);
      const arm = (Math.sin(Math.atan2(dy, dx) * 2 - r * 22) + 1) / 2;
      const bright = Math.pow(arm, 4) * clamp01(1 - r * 2) * (0.6 + fbm(u, v, 6, 3, 275) * 0.8);
      col = mix(col, mix(neb1, WHITE, 0.4), clamp01(bright));
      col = mix(col, [255, 240, 255], Math.pow(clamp01(1 - r * 9), 2));
    }
    return col;
  });
  return { map, emissive: map };
};

R.crystal = (S, p) => {
  const base = rgb(p.c || '#7d4dff');
  const cells = p.cells ?? 4;
  const map = pix(S, (u, v) => {
    const w = worley(u, v, cells, 281);
    const facet = 0.55 + w.id * 0.6;
    const edge = 1 - smooth(0.0, 0.03, w.f2 - w.f1);
    let col = mul(base, facet);
    col = mix(col, WHITE, edge * 0.7 + Math.pow(clamp01(1 - w.f1 * 2.5), 4) * 0.4);
    return col;
  });
  const emissive = pix(S / 2, (u, v) => {
    const w = worley(u, v, cells, 281);
    const edge = 1 - smooth(0.0, 0.03, w.f2 - w.f1);
    return mul(mix(base, WHITE, 0.3), 0.25 + edge * 0.7);
  });
  return { map, emissive };
};

R.gold = (S, p) => {
  const base = rgb(p.c || '#e2b33c');
  const map = pix(S, (u, v) => {
    const w = worley(u, v, 3, 291);
    const facet = 0.75 + w.id * 0.4;
    const edge = 1 - smooth(0.0, 0.015, w.f2 - w.f1);
    return mix(mul(base, facet * (0.9 + fbm(u, v, 6, 2, 292) * 0.2)), mix(base, WHITE, 0.7), edge * 0.8);
  });
  return { map };
};

R.glass = (S, p) => {
  const base = rgb(p.c || '#9fd6ff');
  const map = pix(S, (u, v) => {
    const streak = Math.pow((Math.sin((u * 1.2 + v * 0.8) * Math.PI * 3) + 1) / 2, 8);
    return mix(mul(base, 0.8 + fbm(u, v, 3, 2, 301) * 0.2), WHITE, streak * 0.5);
  });
  return { map };
};

R.grating = (S, p) => {
  const base = rgb(p.c || '#6c737e');
  const map = pix(S, (u, v) => {
    const g = 5;
    const a = ((u + v) * g) % 1;
    const b = ((u - v + 1) * g) % 1;
    const bar = Math.max(1 - smooth(0.06, 0.12, Math.min(a, 1 - a)), 1 - smooth(0.06, 0.12, Math.min(b, 1 - b)));
    const back = [12, 14, 18];
    return mix(back, mul(base, 0.8 + fbm(u, v, 6, 2, 311) * 0.3), bar);
  });
  return { map };
};

R.rope = (S, p) => {
  const base = rgb(p.c || '#a47a4a');
  const map = pix(S, (u, v) => {
    const t = ((u * 6 + v * 3) % 1);
    const twist = Math.sin(t * Math.PI);
    const fib = vnoise(u * 40, v * 160, 40, 321);
    return mul(base, 0.45 + twist * 0.7 + (fib - 0.5) * 0.2);
  });
  return { map };
};

// ---------- Фоны (атмосфера вокруг доски) ----------

R.waves = (S, p) => {
  const base = rgb(p.c || '#0a0620');
  const cols = [rgb('#ff3ccf'), rgb('#3c7bff'), rgb('#7a3cff'), rgb('#22e4ff')];
  return {
    map: pix(S, (u, v) => {
      let col = mul(base, 0.8 + fbm(u, v, 2, 3, 331) * 0.5);
      cols.forEach((c, i) => {
        const y = 0.5 + Math.sin((u * 1.4 + i * 0.37) * Math.PI * 2) * (0.12 + i * 0.03) + (i - 1.5) * 0.08;
        const d = Math.abs(v - y);
        col = mix(col, c, Math.pow(clamp01(1 - d / 0.08), 2.5) * 0.85);
        col = mix(col, WHITE, Math.pow(clamp01(1 - d / 0.008), 2) * 0.6);
      });
      return col;
    }),
  };
};

R.digital = (S, p) => {
  const glow = rgb(p.glow || '#22c7ff');
  const base = rgb(p.c || '#030b16');
  return {
    map: pix(S, (u, v) => {
      let col = mul(base, 0.8 + fbm(u, v, 3, 3, 341) * 0.5);
      const g = 12;
      const lu = (u * g) % 1;
      const lv = (v * g) % 1;
      const d = Math.min(lu, 1 - lu, lv, 1 - lv);
      col = mix(col, glow, (1 - smooth(0.0, 0.05, d)) * 0.35);
      const cell = hash(Math.floor(u * g), Math.floor(v * g), 342);
      if (cell > 0.93) col = mix(col, glow, 0.25);
      const node = Math.hypot(lu - Math.round(lu), lv - Math.round(lv));
      if (hash(Math.round(u * g), Math.round(v * g), 343) > 0.8) col = mix(col, WHITE, Math.pow(clamp01(1 - node / 0.12), 2));
      return col;
    }),
  };
};

R.flame = (S) => ({
  map: pix(S, (u, v) => {
    const n = fbm(u + fbm(u, v, 3, 3, 351) * 0.2, v * 1.2, 4, 5, 352);
    const h = clamp01((1 - v) * 0.2 + n * 1.2 - 0.3 + v * 0.6);
    const pal = [[20, 2, 0], [150, 20, 0], [255, 90, 10], [255, 190, 60], [255, 250, 200]];
    const x = h * (pal.length - 1);
    const i = Math.min(pal.length - 2, Math.floor(x));
    return mix(pal[i], pal[i + 1], x - i);
  }),
});

R.camo = (S) => {
  const pal = ['#3d4a2c', '#5a6b3b', '#2a2b1f', '#7a7550'].map(rgb);
  return {
    map: pix(S, (u, v) => {
      const a = fbm(u, v, 3, 4, 361);
      const b = fbm(u, v, 3, 4, 362);
      const i = a > 0.56 ? 1 : b > 0.58 ? 2 : a < 0.4 ? 3 : 0;
      return mul(pal[i], 0.9 + vnoise(u * 90, v * 90, 90, 363) * 0.15);
    }),
  };
};

R.rainbow = (S) => ({
  map: pix(S, (u, v) => {
    const g = 16;
    const i = Math.floor(u * g);
    const j = Math.floor(v * g);
    const hue = (((i + j) / (g * 2)) + hash(i, j, 371) * 0.04) % 1;
    const c = new THREE.Color().setHSL(hue, 0.85, 0.5 + (hash(i, j, 372) - 0.5) * 0.12);
    return [c.r * 255, c.g * 255, c.b * 255];
  }),
});

R.fantasy = (S) => {
  const c = pix(S, (u, v) => mix([20, 10, 60], [60, 30, 140], fbm(u, v, 3, 4, 381)));
  const ctx = c.getContext('2d');
  for (let i = 0; i < 60; i++) {
    const x = hash(i, 1, 382) * S;
    const y = hash(i, 2, 383) * S;
    const r = S * (0.04 + hash(i, 3, 384) * 0.1);
    const a = hash(i, 4, 385) * Math.PI;
    const hue = 0.62 + hash(i, 5, 386) * 0.2;
    const col = new THREE.Color().setHSL(hue, 0.8, 0.45 + hash(i, 6, 387) * 0.25);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    const g = ctx.createLinearGradient(-r, 0, r, 0);
    g.addColorStop(0, `#${col.clone().multiplyScalar(0.5).getHexString()}`);
    g.addColorStop(0.5, `#${col.getHexString()}`);
    g.addColorStop(1, `#${col.clone().lerp(new THREE.Color('#ffffff'), 0.5).getHexString()}`);
    ctx.fillStyle = g;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.6);
    ctx.lineTo(r * 0.45, 0);
    ctx.lineTo(0, r * 1.6);
    ctx.lineTo(-r * 0.45, 0);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#e6d9ff';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
  return { map: c };
};

R.ocean = (S) => ({
  map: pix(S, (u, v) => {
    const w = worley(u + fbm(u, v, 2, 2, 391) * 0.1, v, 6, 392);
    const caustic = Math.pow(1 - smooth(0.0, 0.12, w.f2 - w.f1), 2);
    const deep = mix([2, 20, 50], [10, 80, 130], fbm(u, v, 2, 4, 393));
    return mix(deep, [120, 220, 255], caustic * 0.5);
  }),
});

R.desert = (S) => ({
  map: pix(S, (u, v) => {
    const sky = mix([250, 190, 120], [120, 70, 60], clamp01(v * 2));
    let col = sky;
    for (let i = 0; i < 4; i++) {
      const y = 0.45 + i * 0.13 + Math.sin(u * Math.PI * 2 * (1 + i * 0.5) + i) * 0.04 + fbm(u, 0.3 * i, 3, 2, 400 + i) * 0.05;
      if (v > y) col = mul(mix([214, 160, 95], [150, 95, 50], i / 4), 0.85 + fbm(u, v, 6, 2, 410 + i) * 0.25);
    }
    return col;
  }),
});

R.forest = (S) => {
  const c = pix(S, (u, v) => mix([4, 18, 10], [18, 60, 30], fbm(u, v, 3, 4, 421)));
  const ctx = c.getContext('2d');
  for (let i = 0; i < 90; i++) {
    const x = hash(i, 1, 422) * S;
    const y = hash(i, 2, 423) * S;
    const r = S * (0.01 + hash(i, 3, 424) * 0.05);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const light = hash(i, 4, 425) > 0.7;
    g.addColorStop(0, light ? 'rgba(220,255,160,0.5)' : 'rgba(80,170,70,0.4)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return { map: c };
};

// Однотонный фон с мягким градиентом
R.backdrop = (S, p) => {
  const a = rgb(p.c);
  const b = rgb(p.c2 || p.c);
  return {
    map: pix(S, (u, v) => {
      const d = Math.hypot(u - 0.6, v - 0.4);
      return mul(mix(mix(a, WHITE, 0.08), b, clamp01(d * 1.3)), 0.98 + vnoise(u * 200, v * 200, 200, 431) * 0.04);
    }),
  };
};

// Трёхцветная финишная лента
R.tricolor = (S) => ({
  map: pix(S, (u) => (u < 0.33 ? [40, 90, 255] : u < 0.66 ? [235, 238, 245] : [230, 40, 55])),
  emissive: pix(S / 4, (u) => (u < 0.33 ? [20, 50, 180] : u < 0.66 ? [90, 90, 100] : [170, 20, 30])),
});

// Шахматная доска (для клетчатых полей)
R.checker = (S, p) => {
  const a = rgb(p.c || '#e9ecf2');
  const b = rgb(p.c2 || '#15171c');
  const k = p.grid ?? 4;
  const c = canvas(S);
  const ctx = c.getContext('2d');
  const s = S / k;
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      ctx.fillStyle = `rgb(${((i + j) % 2 ? b : a).map(Math.round)})`;
      ctx.fillRect(i * s, j * s, s, s);
    }
  }
  return { map: c };
};

// ---------- Поверхности досок ----------

R.dunes = (S, p) => {
  const base = rgb(p.c || '#d99a5a');
  const light = mix(base, [255, 235, 190], 0.45);
  const dark = mix(base, [110, 55, 20], 0.45);
  const map = pix(S, (u, v) => {
    const warp = fbm(u, v, 2, 3, 441) * 2.2;
    const x = (v * 5 + u * 1.5 + warp) % 1;
    // Острый гребень: пологий склон и крутой обрыв
    const ridge = x < 0.75 ? x / 0.75 : 1 - (x - 0.75) / 0.25;
    const grain = hash(Math.floor(u * S), Math.floor(v * S), 442);
    let col = mix(dark, light, ridge * 0.85 + fbm(u, v, 8, 2, 443) * 0.15);
    const ripples = (Math.sin((v * 60 + u * 12 + warp * 4) * Math.PI) + 1) / 2;
    return mul(col, 0.93 + ripples * 0.06 + grain * 0.06);
  });
  return { map };
};

R.portal = (S, p) => {
  const glow = rgb(p.glow || '#3d8bff');
  const base = rgb(p.c || '#0a1030');
  const light = (u, v) => {
    const dx = u - 0.5;
    const dy = v - 0.5;
    const r = Math.hypot(dx, dy);
    const a = Math.atan2(dy, dx);
    const ring = Math.exp(-(((r - 0.26) / 0.012) ** 2)) + Math.exp(-(((r - 0.2) / 0.006) ** 2)) * 0.7;
    const runes = r > 0.21 && r < 0.25 && Math.sin(a * 24) > 0.6 && hash(Math.floor((a + 4) * 4), 0, 451) > 0.3 ? 0.7 : 0;
    const swirl = Math.pow(clamp01(1 - r / 0.2), 1.5) * (0.4 + 0.6 * ((Math.sin(a * 5 + r * 40) + 1) / 2));
    const veins = (1 - smooth(0.0, 0.02, worley(u, v, 7, 452).f2 - worley(u, v, 7, 452).f1)) * fbm(u, v, 3, 2, 453) * 0.8;
    return clamp01(ring + runes + swirl * 0.8 + veins * 0.5);
  };
  const map = pix(S, (u, v) => {
    const n = fbm(u, v, 4, 5, 454);
    return mix(mul(base, 0.7 + n * 0.7), mix(glow, WHITE, 0.4), light(u, v));
  });
  const emissive = pix(S / 2, (u, v) => mul(glow, light(u, v)));
  return { map, emissive };
};

R.swamp = (S, p) => {
  const base = rgb(p.c || '#4d5e33');
  const water = [28, 40, 30];
  const map = pix(S, (u, v) => {
    const n = fbm(u, v, 4, 5, 461);
    const puddle = smooth(0.55, 0.6, fbm(u, v, 3, 4, 462));
    const moss = fbm(u, v, 12, 3, 463);
    let col = mul(mix(base, [90, 80, 45], moss * 0.5), 0.6 + n * 0.6);
    col = mix(col, mix(water, [70, 90, 70], fbm(u, v, 6, 2, 464) * 0.4), puddle * 0.85);
    return col;
  });
  return { map };
};

R.mystic = (S, p) => {
  const glow = rgb(p.glow || '#2fb8ff');
  const wood = R.wood(S, { c: p.c || '#3a2a22', c2: '#140c08', planks: 9, bevel: false }).map;
  const light = (u, v) => {
    const w = worley(u + fbm(u, v, 3, 2, 471) * 0.08, v, 5, 472);
    const crack = 1 - smooth(0.0, 0.012, w.f2 - w.f1);
    const mask = smooth(0.45, 0.6, fbm(u, v, 3, 3, 473));
    return crack * mask;
  };
  const ctx = wood.getContext('2d');
  const over = pix(S, (u, v) => mul(glow, light(u, v)));
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(over, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  return { map: wood, emissive: over };
};

R.scales = (S, p) => {
  const base = rgb(p.c || '#6a1a1c');
  const glow = rgb(p.glow || '#ff2a1a');
  const g = p.grid ?? 18;
  const scale = (u, v) => {
    const row = Math.floor(v * g);
    const off = row % 2 ? 0.5 : 0;
    const cu = (u * g + off) % 1;
    const cv = (v * g) % 1;
    // Чешуйка — полукруг, «смотрящий» вниз
    const d = Math.hypot(cu - 0.5, (cv - 0.05) * 0.9);
    return { d, row, id: hash(Math.floor(u * g + off), row, 481) };
  };
  const map = pix(S, (u, v) => {
    const s = scale(u, v);
    const inside = s.d < 0.62 ? 1 : 0;
    const shade = clamp01(1 - s.d / 0.62);
    let col = mul(base, (0.35 + shade * 0.9) * (0.8 + s.id * 0.4));
    const rim = 1 - smooth(0.52, 0.62, s.d);
    col = mix(mul(base, 0.15), col, inside ? rim : 0);
    return col;
  });
  const emissive = pix(S / 2, (u, v) => {
    const s = scale(u, v);
    const edge = Math.exp(-(((s.d - 0.6) / 0.03) ** 2));
    return mul(glow, edge * 0.5 * fbm(u, v, 3, 2, 482));
  });
  return { map, emissive };
};

R.techgrid = (S, p) => {
  const glow = rgb(p.glow || '#1ec8e8');
  const base = rgb(p.c || '#0a1a26');
  const g = 9;
  const line = (u, v) => {
    const cu = (u * g) % 1;
    const cv = (v * g) % 1;
    // Восьмиугольные ячейки: срезанные углы
    const dx = Math.abs(cu - 0.5);
    const dy = Math.abs(cv - 0.5);
    const oct = Math.max(dx, dy, (dx + dy) * 0.72);
    return Math.exp(-(((oct - 0.44) / 0.012) ** 2));
  };
  const map = pix(S, (u, v) => mix(mul(base, 0.8 + fbm(u, v, 4, 3, 491) * 0.5), mix(glow, WHITE, 0.3), line(u, v) * 0.9));
  const emissive = pix(S, (u, v) => mul(glow, line(u, v)));
  return { map, emissive };
};

R.ruins = (S, p) => {
  const stone = R.stone(S, { c: p.c || '#7a7c78', slabs: 9 }).map;
  const ctx = stone.getContext('2d');
  const moss = pix(S, (u, v) => [70 + fbm(u, v, 20, 2, 501) * 40, 110 + fbm(u, v, 20, 2, 502) * 50, 40]);
  const mask = pix(S, (u, v) => {
    const m = smooth(0.52, 0.66, fbm(u, v, 4, 4, 503));
    return [m * 255, m * 255, m * 255];
  });
  // Мох поверх камня по маске
  const mctx = moss.getContext('2d');
  mctx.globalCompositeOperation = 'destination-in';
  const maskAlpha = canvas(S);
  const ma = maskAlpha.getContext('2d');
  const md = mask.getContext('2d').getImageData(0, 0, S, S);
  for (let i = 0; i < md.data.length; i += 4) md.data[i + 3] = md.data[i];
  ma.putImageData(md, 0, 0);
  mctx.drawImage(maskAlpha, 0, 0);
  ctx.globalAlpha = 0.85;
  ctx.drawImage(moss, 0, 0);
  ctx.globalAlpha = 1;
  return { map: stone };
};

R.snow = (S, p) => {
  const base = rgb(p.c || '#e8eef6');
  const shadow = [150, 175, 210];
  const map = pix(S, (u, v) => {
    const n = fbm(u, v, 3, 5, 511);
    let col = mix(shadow, base, smooth(0.25, 0.7, n) * 0.8 + 0.2);
    const sp = hash(Math.floor(u * S), Math.floor(v * S), 512);
    if (sp > 0.997) col = WHITE;
    return col;
  });
  return { map };
};

// ---------- Кэш и доступ ----------

const cache = new Map();

export function genTexture(recipe, params = {}, size = 512) {
  const key = `${recipe}|${size}|${JSON.stringify(params)}`;
  if (cache.has(key)) return cache.get(key);
  const fn = R[recipe] || R.plain;
  const out = fn(size, params);
  const res = { map: out.map, emissive: out.emissive || null };
  cache.set(key, res);
  return res;
}

const texCache = new WeakMap();
export function toTexture(canvasEl, srgb = true) {
  if (texCache.has(canvasEl)) return texCache.get(canvasEl);
  const t = new THREE.CanvasTexture(canvasEl);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  texCache.set(canvasEl, t);
  return t;
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

// Вытянутое свечение для финишных линий и неоновых стен
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

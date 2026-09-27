// Процедурные текстуры на canvas (никаких внешних картинок).

import * as THREE from 'three';
import { Rng, fbm } from './util.js';
import { setTexFactory } from './geo.js';

const cache = new Map();

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function toTex(c, repeat = true, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

function cached(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

function speckle(ctx, w, h, n, colors, rMin, rMax, rng, alpha = 0.3) {
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = alpha * rng.f(0.3, 1);
    ctx.fillStyle = rng.pick(colors);
    const r = rng.f(rMin, rMax);
    ctx.beginPath();
    ctx.arc(rng.f(0, w), rng.f(0, h), r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Асфальт: 512×512 соответствует 14×14 м дороги
export function asphaltTex() {
  return cached('asphalt', () => {
    const c = canvas(512, 512);
    const ctx = c.getContext('2d');
    const rng = new Rng(7);
    const img = ctx.createImageData(512, 512);
    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        const n = fbm(x / 40, y / 40, 3, 4) * 0.6 + Math.random() * 0.4;
        const v = 70 + n * 38;
        const i = (y * 512 + x) * 4;
        img.data[i] = v;
        img.data[i + 1] = v * 0.98;
        img.data[i + 2] = v * 0.95;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // заплатки
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = rng.chance(0.5) ? 'rgba(30,30,32,0.35)' : 'rgba(120,115,105,0.18)';
      ctx.fillRect(rng.f(60, 420), rng.f(0, 480), rng.f(30, 90), rng.f(20, 70));
    }
    // трещины
    ctx.strokeStyle = 'rgba(20,20,20,0.55)';
    for (let i = 0; i < 14; i++) {
      ctx.lineWidth = rng.f(0.8, 2);
      ctx.beginPath();
      let x = rng.f(40, 470);
      let y = rng.f(0, 512);
      ctx.moveTo(x, y);
      for (let k = 0; k < 8; k++) {
        x += rng.f(-14, 14);
        y += rng.f(-18, 18);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // песок на обочинах
    const grd = ctx.createLinearGradient(0, 0, 512, 0);
    grd.addColorStop(0, 'rgba(150,125,90,0.75)');
    grd.addColorStop(0.07, 'rgba(150,125,90,0.0)');
    grd.addColorStop(0.93, 'rgba(150,125,90,0.0)');
    grd.addColorStop(1, 'rgba(150,125,90,0.75)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 512, 512);
    // краевые линии (стёртые)
    ctx.fillStyle = 'rgba(225,220,205,0.55)';
    ctx.fillRect(50, 0, 7, 512);
    ctx.fillRect(455, 0, 7, 512);
    // жёлтая пунктирная осевая
    ctx.fillStyle = 'rgba(232,186,40,0.85)';
    for (let y = 0; y < 512; y += 128) ctx.fillRect(252, y + 10, 8, 70);
    // стирание разметки
    speckle(ctx, 512, 512, 500, ['#3a3a3a', '#555'], 1, 4, rng, 0.35);
    return toTex(c);
  });
}

// Детальная текстура земли (оттенки серого — цвет задают вершины)
export function groundTex() {
  return cached('ground', () => {
    const c = canvas(256, 256);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(256, 256);
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const n = fbm(x / 22, y / 22, 11, 4);
        const v = 200 + (n - 0.5) * 70 + (Math.random() - 0.5) * 36;
        const i = (y * 256 + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const rng = new Rng(5);
    speckle(ctx, 256, 256, 260, ['#8a8a8a', '#fff'], 0.6, 2.2, rng, 0.35);
    return toTex(c);
  });
}

// Грязь, царапины и ржавчина для кузова (умножается на цвет краски)
export function grimeTex(rust = 0.5) {
  const key = `grime${Math.round(rust * 10)}`;
  return cached(key, () => {
    const c = canvas(512, 512);
    const ctx = c.getContext('2d');
    const rng = new Rng(21 + Math.round(rust * 10));
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(0, 0, 512, 512);
    // лёгкая неоднородность
    const img = ctx.getImageData(0, 0, 512, 512);
    for (let y = 0; y < 512; y += 1) {
      for (let x = 0; x < 512; x += 1) {
        const n = fbm(x / 60, y / 60, 4, 3);
        const i = (y * 512 + x) * 4;
        const k = 0.9 + n * 0.1;
        img.data[i] *= k;
        img.data[i + 1] *= k;
        img.data[i + 2] *= k;
      }
    }
    ctx.putImageData(img, 0, 0);
    // ржавые пятна
    const spots = Math.round(40 * rust);
    for (let i = 0; i < spots; i++) {
      const x = rng.f(0, 512);
      const y = rng.f(0, 512);
      const r = rng.f(6, 34);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(110,52,22,0.85)');
      g.addColorStop(0.6, 'rgba(140,72,30,0.5)');
      g.addColorStop(1, 'rgba(140,72,30,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    speckle(ctx, 512, 512, Math.round(300 * rust) + 60, ['#5a3a20', '#7a4a24', '#3a2a1a'], 0.8, 3, rng, 0.5);
    // царапины
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 40; i++) {
      ctx.lineWidth = rng.f(0.5, 1.4);
      ctx.beginPath();
      const x = rng.f(0, 512);
      const y = rng.f(0, 512);
      ctx.moveTo(x, y);
      ctx.lineTo(x + rng.f(-40, 40), y + rng.f(-8, 8));
      ctx.stroke();
    }
    // грязь снизу (текстура тянется по высоте кузова)
    const dg = ctx.createLinearGradient(0, 512, 0, 300);
    dg.addColorStop(0, 'rgba(90,70,45,0.55)');
    dg.addColorStop(1, 'rgba(90,70,45,0)');
    ctx.fillStyle = dg;
    ctx.fillRect(0, 300, 512, 212);
    return toTex(c);
  });
}

export function camoTex() {
  return cached('camo', () => {
    const c = canvas(256, 256);
    const ctx = c.getContext('2d');
    const rng = new Rng(99);
    ctx.fillStyle = '#b8b890';
    ctx.fillRect(0, 0, 256, 256);
    const cols = ['#6f6a3a', '#4a4a2a', '#8a7a4a', '#2f3a22'];
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = rng.pick(cols);
      ctx.beginPath();
      const x = rng.f(0, 256);
      const y = rng.f(0, 256);
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2;
        const r = rng.f(10, 30);
        ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.6);
      }
      ctx.fill();
    }
    return toTex(c);
  });
}

// Надпись на стене/табличке
export function textTex(text, opts = {}) {
  const key = `text:${text}:${JSON.stringify(opts)}`;
  return cached(key, () => {
    const w = opts.w || 512;
    const h = opts.h || 128;
    const c = canvas(w, h);
    const ctx = c.getContext('2d');
    if (opts.bg) {
      ctx.fillStyle = opts.bg;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.font = `${opts.weight || 700} ${opts.size || 80}px Oswald, Arial Narrow, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = opts.color || '#ddd';
    if (opts.rotate) {
      ctx.translate(w / 2, h / 2);
      ctx.rotate(opts.rotate);
      ctx.fillText(text, 0, 0);
    } else ctx.fillText(text, w / 2, h / 2);
    if (opts.worn) {
      ctx.globalCompositeOperation = 'destination-out';
      const rng = new Rng(3);
      speckle(ctx, w, h, 220, ['#000'], 1, 5, rng, 0.6);
    }
    return toTex(c, false);
  });
}

// Бетон/штукатурка для стен гаража
export function concreteTex(base = '#6a6e72', seed = 1) {
  return cached(`concrete${base}${seed}`, () => {
    const c = canvas(256, 256);
    const ctx = c.getContext('2d');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 256, 256);
    const rng = new Rng(seed);
    speckle(ctx, 256, 256, 900, ['#000', '#fff'], 0.5, 2.5, rng, 0.08);
    for (let i = 0; i < 18; i++) {
      const x = rng.f(0, 256);
      const y = rng.f(0, 256);
      const g = ctx.createRadialGradient(x, y, 0, x, y, rng.f(20, 60));
      g.addColorStop(0, 'rgba(40,30,20,0.18)');
      g.addColorStop(1, 'rgba(40,30,20,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);
    }
    return toTex(c);
  });
}

// Пол гаража с жёлтой разметкой
export function garageFloorTex() {
  return cached('gfloor', () => {
    const c = canvas(1024, 1024);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#4b4d50';
    ctx.fillRect(0, 0, 1024, 1024);
    const rng = new Rng(8);
    speckle(ctx, 1024, 1024, 2500, ['#000', '#888'], 0.5, 3, rng, 0.12);
    for (let i = 0; i < 12; i++) {
      const x = rng.f(0, 1024);
      const y = rng.f(0, 1024);
      const g = ctx.createRadialGradient(x, y, 0, x, y, rng.f(40, 120));
      g.addColorStop(0, 'rgba(15,12,10,0.4)');
      g.addColorStop(1, 'rgba(15,12,10,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1024, 1024);
    }
    // плитки
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 1024; i += 128) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 1024);
      ctx.moveTo(0, i);
      ctx.lineTo(1024, i);
      ctx.stroke();
    }
    // жёлтые полосы
    ctx.fillStyle = '#d8a818';
    ctx.globalAlpha = 0.85;
    ctx.fillRect(250, 120, 14, 780);
    ctx.fillRect(760, 120, 14, 780);
    for (let x = 300; x < 730; x += 60) {
      ctx.save();
      ctx.translate(x, 900);
      ctx.rotate(-0.6);
      ctx.fillRect(0, 0, 18, 70);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    return toTex(c, false);
  });
}

// Циферблат приборной панели
export function gaugeTex() {
  return cached('gauge', () => {
    const c = canvas(256, 128);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#121416';
    ctx.fillRect(0, 0, 256, 128);
    for (const cx of [64, 192]) {
      ctx.fillStyle = '#1d2024';
      ctx.beginPath();
      ctx.arc(cx, 64, 56, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#cfd4da';
      ctx.lineWidth = 3;
      for (let i = 0; i <= 10; i++) {
        const a = Math.PI * 0.8 + (i / 10) * Math.PI * 1.4;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * 44, 64 + Math.sin(a) * 44);
        ctx.lineTo(cx + Math.cos(a) * 52, 64 + Math.sin(a) * 52);
        ctx.stroke();
      }
      ctx.strokeStyle = '#e8492a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, 64);
      ctx.lineTo(cx + Math.cos(Math.PI * 1.3) * 40, 64 + Math.sin(Math.PI * 1.3) * 40);
      ctx.stroke();
    }
    return toTex(c, false);
  });
}

// Мягкое круглое пятно (частицы, тени)
export function blobTex() {
  return cached('blob', () => {
    const c = canvas(64, 64);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return toTex(c, false, false);
  });
}

// Сетка (решётка на окна)
export function meshTex() {
  return cached('mesh', () => {
    const c = canvas(128, 128);
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 128, 128);
    ctx.strokeStyle = '#9aa0a6';
    ctx.lineWidth = 5;
    for (let i = -128; i < 256; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 128, 128);
      ctx.moveTo(i + 128, 0);
      ctx.lineTo(i, 128);
      ctx.stroke();
    }
    return toTex(c);
  });
}

// Гофрированный металл
export function metalSheetTex(base = '#7c8288') {
  return cached(`sheet${base}`, () => {
    const c = canvas(256, 256);
    const ctx = c.getContext('2d');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 16) {
      const g = ctx.createLinearGradient(x, 0, x + 16, 0);
      g.addColorStop(0, 'rgba(255,255,255,0.12)');
      g.addColorStop(0.5, 'rgba(0,0,0,0.18)');
      g.addColorStop(1, 'rgba(255,255,255,0.12)');
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, 16, 256);
    }
    const rng = new Rng(4);
    for (let i = 0; i < 10; i++) {
      const x = rng.f(0, 256);
      const y = rng.f(0, 256);
      const g = ctx.createRadialGradient(x, y, 0, x, y, rng.f(10, 50));
      g.addColorStop(0, 'rgba(120,60,25,0.5)');
      g.addColorStop(1, 'rgba(120,60,25,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);
    }
    return toTex(c);
  });
}

// ------------------------------ материалы построек ------------------------------
// Светлые текстуры с деталями; цвет задают вершины модели.

function rustSpots(ctx, w, h, rng, n, a = 0.5) {
  for (let i = 0; i < n; i++) {
    const x = rng.f(0, w);
    const y = rng.f(0, h);
    const r = rng.f(8, 40);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(120,58,22,${a})`);
    g.addColorStop(0.7, `rgba(150,80,35,${a * 0.5})`);
    g.addColorStop(1, 'rgba(150,80,35,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

function streaks(ctx, w, h, rng, n, col) {
  for (let i = 0; i < n; i++) {
    const x = rng.f(0, w);
    const y = rng.f(0, h * 0.6);
    const len = rng.f(20, 90);
    const g = ctx.createLinearGradient(x, y, x, y + len);
    g.addColorStop(0, col);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, rng.f(1.5, 4), len);
  }
}

export function materialTex(key) {
  return cached(`mat:${key}`, () => {
    const S = 256;
    const c = canvas(S, S);
    const ctx = c.getContext('2d');
    const rng = new Rng(key.length * 97 + key.charCodeAt(0));
    switch (key) {
      case 'metal': {
        // профнастил: вертикальные волны, ржавчина, потёки
        ctx.fillStyle = '#d6d6d4';
        ctx.fillRect(0, 0, S, S);
        for (let x = 0; x < S; x += 16) {
          const g = ctx.createLinearGradient(x, 0, x + 16, 0);
          g.addColorStop(0, 'rgba(255,255,255,0.35)');
          g.addColorStop(0.35, 'rgba(0,0,0,0.05)');
          g.addColorStop(0.6, 'rgba(0,0,0,0.28)');
          g.addColorStop(1, 'rgba(255,255,255,0.3)');
          ctx.fillStyle = g;
          ctx.fillRect(x, 0, 16, S);
        }
        rustSpots(ctx, S, S, rng, 16, 0.55);
        streaks(ctx, S, S, rng, 40, 'rgba(110,55,20,0.45)');
        // стык листов и заклёпки
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(0, 126, S, 3);
        ctx.fillStyle = 'rgba(40,30,20,0.6)';
        for (let x = 8; x < S; x += 32) {
          ctx.beginPath();
          ctx.arc(x, 120, 2, 0, Math.PI * 2);
          ctx.arc(x, 250, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'roofm': {
        ctx.fillStyle = '#cfcfcc';
        ctx.fillRect(0, 0, S, S);
        for (let y = 0; y < S; y += 21) {
          const g = ctx.createLinearGradient(0, y, 0, y + 21);
          g.addColorStop(0, 'rgba(255,255,255,0.3)');
          g.addColorStop(0.6, 'rgba(0,0,0,0.3)');
          g.addColorStop(1, 'rgba(255,255,255,0.25)');
          ctx.fillStyle = g;
          ctx.fillRect(0, y, S, 21);
        }
        rustSpots(ctx, S, S, rng, 22, 0.6);
        break;
      }
      case 'wood':
      case 'plank': {
        // доски с щелями, волокнами и сучками
        ctx.fillStyle = '#e2d6c4';
        ctx.fillRect(0, 0, S, S);
        const n = key === 'wood' ? 8 : 4;
        const hh = S / n;
        for (let i = 0; i < n; i++) {
          const y = i * hh;
          ctx.fillStyle = `rgba(${rng.i(80, 120)},${rng.i(55, 80)},30,${rng.f(0.05, 0.22)})`;
          ctx.fillRect(0, y, S, hh);
          ctx.strokeStyle = 'rgba(70,45,25,0.18)';
          ctx.lineWidth = 1;
          for (let k = 0; k < 7; k++) {
            ctx.beginPath();
            const yy = y + rng.f(2, hh - 2);
            ctx.moveTo(0, yy);
            for (let x = 0; x <= S; x += 32) ctx.lineTo(x, yy + rng.f(-1.5, 1.5));
            ctx.stroke();
          }
          if (rng.chance(0.5)) {
            ctx.fillStyle = 'rgba(70,40,20,0.45)';
            ctx.beginPath();
            ctx.ellipse(rng.f(20, 236), y + hh / 2, rng.f(3, 6), rng.f(2, 4), 0, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = 'rgba(30,20,12,0.7)';
          ctx.fillRect(0, y + hh - 2, S, 2);
          // гвозди и торцы
          const cut = rng.f(40, 220);
          ctx.fillRect(cut, y, 2, hh);
          ctx.fillStyle = 'rgba(40,40,40,0.8)';
          ctx.fillRect(cut + 5, y + 4, 2, 2);
          ctx.fillRect(cut - 6, y + hh - 7, 2, 2);
        }
        break;
      }
      case 'brick': {
        ctx.fillStyle = '#d8d2c8';
        ctx.fillRect(0, 0, S, S);
        const bh = 16;
        const bw = 42;
        for (let row = 0; row < S / bh; row++) {
          const off = row % 2 ? bw / 2 : 0;
          for (let x = -bw; x < S + bw; x += bw) {
            const v = rng.f(0.75, 1.05);
            ctx.fillStyle = `rgb(${Math.round(200 * v)},${Math.round(150 * v)},${Math.round(125 * v)})`;
            ctx.fillRect(x + off + 1.5, row * bh + 1.5, bw - 3, bh - 3);
          }
        }
        rustSpots(ctx, S, S, rng, 6, 0.25);
        speckle(ctx, S, S, 500, ['#000', '#fff'], 0.5, 1.5, rng, 0.12);
        break;
      }
      case 'concrete':
      default: {
        ctx.fillStyle = '#d4d2cc';
        ctx.fillRect(0, 0, S, S);
        speckle(ctx, S, S, 1400, ['#000', '#fff'], 0.5, 2, rng, 0.08);
        for (let i = 0; i < 10; i++) {
          const x = rng.f(0, S);
          const y = rng.f(0, S);
          const g = ctx.createRadialGradient(x, y, 0, x, y, rng.f(20, 70));
          g.addColorStop(0, 'rgba(60,55,45,0.22)');
          g.addColorStop(1, 'rgba(60,55,45,0)');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, S, S);
        }
        streaks(ctx, S, S, rng, 20, 'rgba(60,55,45,0.25)');
        // швы плит
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(0, S - 2, S, 2);
        ctx.fillRect(S - 2, 0, 2, S);
        break;
      }
    }
    return toTex(c);
  });
}

setTexFactory(materialTex);

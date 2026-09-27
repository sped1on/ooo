// Фон вокруг доски: картинка из скина «Фон» и лёгкие частицы на 2D-canvas.

import { genTexture } from './textures.js';
import { findSkin } from '../data/skins.js';

let img = null;
let fx = null;
let ctx = null;
let particles = [];
let type = null;
let accent = '#6b8cff';
let running = false;
let enabled = true;
let current = null;

function ensure() {
  if (img) return;
  const bg = document.querySelector('.bg');
  img = document.createElement('img');
  img.className = 'bg-img';
  img.alt = '';
  fx = document.createElement('canvas');
  fx.className = 'bg-fx';
  bg.append(img, fx);
  ctx = fx.getContext('2d');
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    fx.width = Math.round(innerWidth * dpr);
    fx.height = Math.round(innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    spawnAll();
  };
  addEventListener('resize', resize);
  resize();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) loop();
  });
}

export function applyBackground(id, { animate = true } = {}) {
  ensure();
  enabled = animate;
  const skin = findSkin('background', id);
  if (current !== skin.id) {
    current = skin.id;
    const tex = genTexture(skin.r, skin.p, 1024).map;
    img.src = tex.toDataURL('image/jpeg', 0.92);
    img.style.opacity = String(skin.dim ?? 1);
  }
  accent = skin.accent || '#6b8cff';
  type = skin.particles || null;
  spawnAll();
  loop();
  return skin;
}

const rand = (a, b) => a + Math.random() * (b - a);

function spawn(initial) {
  const w = innerWidth;
  const h = innerHeight;
  const p = { x: rand(0, w), y: initial ? rand(0, h) : h + 10, t: rand(0, 6.28) };
  switch (type) {
    case 'stars':
      Object.assign(p, { y: rand(0, h), r: rand(0.5, 1.8), vx: 0, vy: 0, tw: rand(0.5, 2) });
      break;
    case 'embers':
      Object.assign(p, { r: rand(1, 2.6), vx: rand(-0.2, 0.2), vy: rand(-0.9, -0.3), life: rand(0.5, 1) });
      break;
    case 'snow':
      Object.assign(p, { y: initial ? rand(0, h) : -10, r: rand(1, 3), vx: rand(-0.3, 0.3), vy: rand(0.3, 1) });
      break;
    case 'bubbles':
      Object.assign(p, { r: rand(2, 6), vx: rand(-0.1, 0.1), vy: rand(-0.6, -0.2) });
      break;
    case 'sparks':
      Object.assign(p, { y: rand(0, h), r: rand(0.8, 2.2), vx: rand(-0.15, 0.15), vy: rand(-0.25, 0.1), tw: rand(1, 3) });
      break;
    case 'digital':
      Object.assign(p, { r: rand(2, 5), vx: 0, vy: rand(-0.6, -0.2) });
      break;
    case 'leaves':
      Object.assign(p, { y: initial ? rand(0, h) : -10, r: rand(3, 6), vx: rand(0.1, 0.5), vy: rand(0.3, 0.8), rot: rand(0, 6) });
      break;
    default:
      Object.assign(p, { y: rand(0, h), r: rand(0.6, 1.6), vx: rand(-0.08, 0.08), vy: rand(-0.12, -0.02) });
  }
  return p;
}

function spawnAll() {
  if (!fx) return;
  const area = innerWidth * innerHeight;
  const density = { stars: 1 / 5000, embers: 1 / 16000, snow: 1 / 9000, bubbles: 1 / 25000, sparks: 1 / 14000, digital: 1 / 20000, leaves: 1 / 40000 }[type] ?? 1 / 22000;
  const count = Math.min(260, Math.round(area * density));
  particles = Array.from({ length: count }, () => spawn(true));
}

function loop() {
  if (running || !fx) return;
  running = true;
  let last = performance.now();
  const step = (now) => {
    if (document.hidden) {
      running = false;
      return;
    }
    const dt = Math.min(3, (now - last) / 16.7);
    last = now;
    draw(dt, now / 1000);
    if (enabled) requestAnimationFrame(step);
    else running = false;
  };
  requestAnimationFrame(step);
}

function draw(dt, t) {
  const w = innerWidth;
  const h = innerHeight;
  ctx.clearRect(0, 0, w, h);
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.y < -20 || p.y > h + 20 || p.x < -20 || p.x > w + 20) {
      particles[i] = spawn(false);
      continue;
    }
    ctx.globalAlpha = 1;
    switch (type) {
      case 'stars': {
        ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(t * p.tw + p.t));
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 6.283);
        ctx.fill();
        break;
      }
      case 'embers': {
        const a = Math.max(0, Math.min(1, (p.y / h) * 1.4));
        ctx.globalAlpha = a;
        ctx.fillStyle = '#ffb347';
        ctx.shadowColor = '#ff6a1a';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x + Math.sin(t * 2 + p.t) * 2, p.y, p.r, 0, 6.283);
        ctx.fill();
        ctx.shadowBlur = 0;
        break;
      }
      case 'snow':
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x + Math.sin(t + p.t) * 6, p.y, p.r, 0, 6.283);
        ctx.fill();
        break;
      case 'bubbles':
        ctx.globalAlpha = 0.45;
        ctx.strokeStyle = '#bfeaff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x + Math.sin(t + p.t) * 4, p.y, p.r, 0, 6.283);
        ctx.stroke();
        break;
      case 'digital':
        ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 3 + p.t);
        ctx.fillStyle = accent;
        ctx.fillRect(p.x, p.y, p.r, p.r);
        break;
      case 'leaves':
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = '#5fbf4a';
        ctx.save();
        ctx.translate(p.x + Math.sin(t + p.t) * 10, p.y);
        ctx.rotate(p.rot + t);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.r, p.r * 0.45, 0, 0, 6.283);
        ctx.fill();
        ctx.restore();
        break;
      case 'sparks':
        ctx.globalAlpha = 0.25 + 0.75 * Math.abs(Math.sin(t * p.tw + p.t));
        ctx.fillStyle = accent;
        ctx.shadowColor = accent;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 6.283);
        ctx.fill();
        ctx.shadowBlur = 0;
        break;
      default:
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = '#cfe0ff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 6.283);
        ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

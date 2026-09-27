// 3D-превью предметов для магазинов: модель рендерится в текстуру и сохраняется как картинка.

import * as THREE from 'three';
import { CarModel, buildBumper, buildGrille, buildWheel, buildCarWeapon, SPECS } from '../world/cars.js';
import { buildGun, vestGeo, helmetGeo, medkitGeo } from '../world/guns.js';
import { makePickup } from '../game/pickups.js';
import { findCar, ARMOR, MEDKITS } from '../data/catalog.js';
import * as P from '../world/props.js';
import { vcMat, geoMesh, matsFor } from '../engine/geo.js';

const W = 320;
const H = 220;
let renderer = null;
let scene = null;
let camera = null;
let rt = null;
const cache = new Map();
const queue = [];
let busy = false;

export function initThumbs(r) {
  renderer = r;
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#dfe8f4', '#3a3530', 1.4));
  const d = new THREE.DirectionalLight('#fff4e0', 2.2);
  d.position.set(4, 6, 5);
  scene.add(d);
  const back = new THREE.DirectionalLight('#8ab4ff', 1.2);
  back.position.set(-5, 3, -4);
  scene.add(back);
  camera = new THREE.PerspectiveCamera(30, W / H, 0.05, 100);
  rt = new THREE.WebGLRenderTarget(W, H, { samples: 4 });
  rt.texture.colorSpace = THREE.SRGBColorSpace;
}

function frame(obj, az = 0.75, el = 0.3, fill = 1) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const r = Math.max(size.x, size.y * 1.3, size.z) * 0.52 / fill;
  const dist = r / Math.tan((camera.fov * Math.PI) / 360) * 1.05;
  camera.position.set(center.x + Math.sin(az) * Math.cos(el) * dist, center.y + Math.sin(el) * dist, center.z + Math.cos(az) * Math.cos(el) * dist);
  camera.lookAt(center);
}

function renderObj(obj, opts = {}) {
  scene.add(obj);
  frame(obj, opts.az, opts.el, opts.fill);
  const prevTarget = renderer.getRenderTarget();
  const prevClear = renderer.getClearColor(new THREE.Color());
  const prevAlpha = renderer.getClearAlpha();
  renderer.setRenderTarget(rt);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(scene, camera);
  const buf = new Uint8Array(W * H * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf);
  renderer.setRenderTarget(prevTarget);
  renderer.setClearColor(prevClear, prevAlpha);
  scene.remove(obj);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const src = (H - 1 - y) * W * 4;
    img.data.set(buf.subarray(src, src + W * 4), y * W * 4);
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}

function build(key) {
  const [kind, id, extra] = key.split(':');
  switch (kind) {
    case 'car': {
      const m = new CarModel(findCar(id), { paint: extra || 'factory' });
      return [m.group, { az: 0.85, el: 0.22 }];
    }
    case 'paint': {
      const m = new CarModel(findCar(extra), { paint: id });
      return [m.group, { az: 0.85, el: 0.22 }];
    }
    case 'bumper': {
      const spec = SPECS.pickup;
      const g = buildBumper(id, spec) || new THREE.Group();
      return [g, { az: 0.5, el: 0.25 }];
    }
    case 'grille': {
      const spec = SPECS.sedan;
      const g = buildGrille(id, spec) || new THREE.Group();
      return [g, { az: 0.6, el: 0.2 }];
    }
    case 'wheels': {
      const g = buildWheel(0.42, 0.3, id);
      return [g, { az: 1.2, el: 0.15 }];
    }
    case 'weapon': {
      const w = buildCarWeapon(id);
      w.pivot.rotation.y = -0.2;
      return [w.group, { az: 1.1, el: 0.25 }];
    }
    case 'gun': {
      const g = buildGun(id);
      return [g, { az: 1.57, el: 0.12, fill: 1.1 }];
    }
    case 'vest': {
      const m = new THREE.Mesh(vestGeo(ARMOR.find((a) => a.id === id)), vcMat());
      return [m, { az: 0.4, el: 0.15 }];
    }
    case 'helmet': {
      const m = new THREE.Mesh(helmetGeo(ARMOR.find((a) => a.id === id)), vcMat());
      return [m, { az: 0.5, el: 0.3 }];
    }
    case 'med': {
      const m = new THREE.Mesh(medkitGeo(MEDKITS.find((a) => a.id === id)), vcMat());
      return [m, { az: 0.5, el: 0.3 }];
    }
    case 'pickup': {
      const g = makePickup(id);
      g.children[1].visible = false;
      return [g, { az: 0.6, el: 0.35 }];
    }
    case 'crate': {
      const m = geoMesh(P.crate(0).build());
      return [m, { az: 0.6, el: 0.35 }];
    }
    default:
      return [new THREE.Group(), {}];
  }
}

// Возвращает картинку сразу (если есть) или ставит в очередь и вызывает cb
export function thumb(key, cb) {
  if (cache.has(key)) return cache.get(key);
  queue.push({ key, cb });
  if (!busy) pump();
  return null;
}

function pump() {
  busy = true;
  const t0 = performance.now();
  while (queue.length && performance.now() - t0 < 14) {
    const { key, cb } = queue.shift();
    if (!cache.has(key)) {
      try {
        const [obj, opts] = build(key);
        cache.set(key, renderObj(obj, opts));
      } catch (e) {
        console.warn('thumb', key, e);
        cache.set(key, '');
      }
    }
    cb?.(cache.get(key));
  }
  if (queue.length) requestAnimationFrame(pump);
  else busy = false;
}

// Картинка в <img>, которая сама появится, когда превью будет готово
export function thumbImg(key, cls = 'thumb') {
  const img = document.createElement('img');
  img.className = cls;
  img.alt = '';
  img.draggable = false;
  const url = thumb(key, (u) => {
    if (u) img.src = u;
  });
  if (url) img.src = url;
  return img;
}

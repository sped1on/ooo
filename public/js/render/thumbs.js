// Превью скинов для магазина: небольшие 3D-рендеры в картинки.

import * as THREE from 'three';
import { createRenderer, environmentFor, createPawnMesh, createWallMesh } from './board3d.js';
import { fieldMaterials } from './materials.js';

const W = 240;
const H = 180;
let renderer = null;
let scene = null;
let camera = null;
const cache = new Map();

function setup() {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  renderer = createRenderer(canvas, { preserve: true, maxDpr: 1, shadows: true });
  renderer.setSize(W, H, false);
  scene = new THREE.Scene();
  scene.environment = environmentFor(renderer);
  scene.add(new THREE.HemisphereLight('#9ab8ff', '#0a0f1c', 0.7));
  const key = new THREE.DirectionalLight('#ffffff', 2.4);
  key.position.set(-3, 6, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(512, 512);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#8fb0ff', 1);
  rim.position.set(4, 3, -4);
  scene.add(rim);
  camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 50);
}

function shoot(content, camPos, target) {
  if (!renderer) setup();
  scene.add(content);
  camera.position.set(...camPos);
  camera.lookAt(...target);
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  scene.remove(content);
  return url;
}

function floor() {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.ShadowMaterial({ opacity: 0.45 }),
  );
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  return m;
}

export function skinThumb(kind, skin) {
  const key = `${kind}:${skin.id}`;
  if (cache.has(key)) return cache.get(key);
  const g = new THREE.Group();
  let url;
  if (kind === 'walls') {
    g.add(floor());
    const offsets = [
      [-0.45, 0, -0.35, 0],
      [0.35, 0, 0.1, 0],
      [-0.2, 0, 0.55, 0],
    ];
    offsets.forEach(([x, , z]) => {
      const w = createWallMesh(skin.id);
      w.scale.set(0.8, 1.2, 2.2);
      w.position.set(x, 0.32, z);
      g.add(w);
    });
    g.rotation.y = -0.5;
    url = shoot(g, [2.3, 2.1, 2.9], [0, 0.2, 0]);
  } else if (kind === 'field') {
    const mats = fieldMaterials(skin.id);
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.3, 3.3), mats.base);
    base.position.y = -0.15;
    g.add(base);
    const geo = new THREE.BoxGeometry(0.8, 0.18, 0.8);
    for (let x = -1; x <= 1; x++) {
      for (let z = -1; z <= 1; z++) {
        const m = new THREE.Mesh(geo, mats.tiles[mats.tiles.length > 1 ? (x + z + 2) % 2 : 0]);
        m.position.set(x, 0.09, z);
        m.receiveShadow = true;
        g.add(m);
      }
    }
    g.rotation.y = 0.35;
    url = shoot(g, [0, 3.4, 3.0], [0, -0.1, 0.1]);
  } else {
    g.add(floor());
    [0, 1].forEach((pl) => {
      const p = createPawnMesh(skin.id, pl);
      p.scale.setScalar(1.6);
      p.position.set(pl ? 0.42 : -0.42, 0, pl ? -0.1 : 0.15);
      g.add(p);
    });
    url = shoot(g, [0, 1.5, 3.2], [0, 0.55, 0]);
  }
  cache.set(key, url);
  return url;
}

// Небо, горы на горизонте, свет и туман для открытых сцен.

import * as THREE from 'three';
import { GeoBuilder } from '../engine/geo.js';
import { Rng } from '../engine/util.js';

export function makeSky(biome) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(biome.skyTop) },
      bottom: { value: new THREE.Color(biome.skyBottom) },
      sunDir: { value: new THREE.Vector3(0.4, 0.5, 0.6).normalize() },
      sunCol: { value: new THREE.Color(biome.sun) },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }`,
    fragmentShader: `uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunCol; varying vec3 vDir;
      void main(){
        float h = clamp(vDir.y * 1.6 + 0.12, 0.0, 1.0);
        vec3 c = mix(bottom, top, pow(h, 0.8));
        float s = max(dot(normalize(vDir), sunDir), 0.0);
        c += sunCol * (pow(s, 400.0) * 1.6 + pow(s, 12.0) * 0.25);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 12), mat);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  return sky;
}

export function makeMountains(biome, seed = 1) {
  const b = new GeoBuilder();
  const r = new Rng(seed);
  const base = new THREE.Color(biome.far).lerp(new THREE.Color(biome.fog), 0.45);
  const n = 34;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r.f(-0.05, 0.05);
    const d = r.f(620, 760);
    const h = r.f(60, 170);
    const c = base.clone().multiplyScalar(r.f(0.85, 1.08));
    b.cone(r.f(90, 180), h, 5, c, { x: Math.cos(a) * d, y: h / 2 - 20, z: Math.sin(a) * d, ry: r.f(0, 3) });
    if (biome.name === 'Снега' || r.chance(0.3)) b.cone(r.f(30, 45), h * 0.3, 5, '#f0f4f8', { x: Math.cos(a) * d, y: h * 0.86 - 20, z: Math.sin(a) * d });
  }
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  const m = new THREE.Mesh(b.build(), mat);
  m.frustumCulled = false;
  return m;
}

export function makeLights(scene, biome, shadows, shadowSize = 60) {
  const hemi = new THREE.HemisphereLight(biome.hemi[0], biome.hemi[1], 1.35);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(biome.sun, 2.4);
  sun.position.set(40, 60, 30);
  if (shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const c = sun.shadow.camera;
    c.left = -shadowSize;
    c.right = shadowSize;
    c.top = shadowSize;
    c.bottom = -shadowSize;
    c.near = 1;
    c.far = 220;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.04;
  }
  scene.add(sun);
  scene.add(sun.target);
  return { hemi, sun, offset: new THREE.Vector3(40, 60, 30) };
}

// Держим солнце и тени рядом с точкой интереса
export function followSun(lights, p) {
  lights.sun.position.set(p.x + lights.offset.x, p.y + lights.offset.y, p.z + lights.offset.z);
  lights.sun.target.position.set(p.x, p.y, p.z);
}

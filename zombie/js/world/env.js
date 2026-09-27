// Небо, горы на горизонте, свет и туман для открытых сцен.

import * as THREE from 'three';
import { GeoBuilder } from '../engine/geo.js';
import { Rng } from '../engine/util.js';

// Время суток и погода поверх палитры местности
const TIMES = {
  sunset: { skyTop: '#2f3f7a', skyBottom: '#ff9a5c', fog: '#d49a80', sun: '#ffb070', hemiTop: '#ffc8a8', hemiI: 1.05, sunI: 2.1, sunPos: [80, 20, -35] },
  dawn: { skyTop: '#5a78b0', skyBottom: '#ffc8b0', fog: '#dcc4c0', sun: '#ffd4b0', hemiTop: '#ffe0d0', hemiI: 1.1, sunI: 1.7, sunPos: [-75, 22, 40] },
  overcast: { skyTop: '#6f7884', skyBottom: '#a8aeb4', fog: '#9ea4aa', sun: '#dde2e8', hemiTop: '#d8dee4', hemiI: 1.55, sunI: 0.65 },
  night: { skyTop: '#02050e', skyBottom: '#141d30', fog: '#0c121e', sun: '#9ab0e0', hemiTop: '#4a5a80', hemiBottom: '#0c0e12', hemiI: 0.6, sunI: 0.5, sunPos: [-30, 55, 40], night: true },
};

export function levelEnv(biome, params = {}) {
  const env = { ...biome, hemiI: 1.35, sunI: 2.4, sunPos: [40, 60, 30], fogNear: 70, fogK: 1 };
  const t = TIMES[params.time];
  if (t) {
    Object.assign(env, t);
    env.hemi = [t.hemiTop || biome.hemi[0], t.hemiBottom || biome.hemi[1]];
  }
  if (params.weather === 'rain') {
    const c = new THREE.Color(env.skyTop).lerp(new THREE.Color('#5a6470'), env.night ? 0.2 : 0.65);
    env.skyTop = '#' + c.getHexString();
    env.skyBottom = '#' + new THREE.Color(env.skyBottom).lerp(new THREE.Color(env.night ? '#101620' : '#8a929a'), 0.6).getHexString();
    env.fog = '#' + new THREE.Color(env.fog).lerp(new THREE.Color(env.night ? '#0a0e14' : '#8a9096'), 0.6).getHexString();
    env.sunI *= 0.45;
    env.hemiI *= env.night ? 0.9 : 1.05;
    env.fogNear = 30;
    env.fogK = 0.7;
    env.roadColor = 0x9a9a9a;
  } else if (params.weather === 'snow') {
    if (!env.night) {
      env.fog = '#d0d8e2';
      env.skyBottom = '#dce4ee';
      env.skyTop = '#8a9ab0';
      env.sunI *= 0.6;
    }
    env.fogNear = 25;
    env.fogK = 0.6;
    env.roadColor = 0xf0f4f8;
    env.roadEmissive = env.night ? '#1a2028' : '#4a5058';
  } else if (params.weather === 'fog') {
    env.fogNear = 6;
    env.fogK = 0.36;
  }
  if (env.night) {
    env.far = '#' + new THREE.Color(biome.far).multiplyScalar(0.18).getHexString();
    env.fogNear = Math.min(env.fogNear, 25);
    env.fogK = Math.min(env.fogK, 0.55);
  }
  return env;
}

export function makeSky(biome) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(biome.skyTop) },
      bottom: { value: new THREE.Color(biome.skyBottom) },
      sunDir: { value: new THREE.Vector3(...(biome.sunPos || [0.4, 0.5, 0.6])).normalize() },
      sunCol: { value: new THREE.Color(biome.sun) },
      night: { value: biome.night ? 1 : 0 },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }`,
    fragmentShader: `uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunCol; uniform float night; varying vec3 vDir;
      float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y * 1.6 + 0.12, 0.0, 1.0);
        vec3 c = mix(bottom, top, pow(h, 0.8));
        float s = max(dot(d, sunDir), 0.0);
        if (night > 0.5) {
          // луна и звёзды
          c += sunCol * (smoothstep(0.9995, 0.9997, s) * 1.4 + pow(s, 60.0) * 0.12);
          vec3 q = floor(d * 720.0);
          float st = hash(q);
          c += vec3(0.85, 0.9, 1.0) * step(0.9985, st) * smoothstep(0.02, 0.25, d.y) * (0.5 + 0.5 * hash(q + 3.1));
        } else {
          c += sunCol * (pow(s, 400.0) * 1.6 + pow(s, 12.0) * 0.25);
        }
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

export function makeMountains(biome, seed = 1, tall = false) {
  const b = new GeoBuilder();
  const r = new Rng(seed);
  const base = new THREE.Color(biome.far).lerp(new THREE.Color(biome.fog), 0.45);
  const cap = new THREE.Color(biome.night ? '#3a4454' : '#f0f4f8');
  const n = tall ? 42 : 34;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r.f(-0.05, 0.05);
    const d = r.f(620, 760);
    const h = tall ? r.f(180, 380) : r.f(60, 170);
    const c = base.clone().multiplyScalar(r.f(0.85, 1.08));
    const rad = tall ? r.f(110, 200) : r.f(90, 180);
    b.cone(rad, h, 5, c, { x: Math.cos(a) * d, y: h / 2 - 20, z: Math.sin(a) * d, ry: r.f(0, 3) });
    if (biome.name === 'Снега' || tall || r.chance(0.3)) b.cone(rad * 0.3, h * 0.3, 5, cap, { x: Math.cos(a) * d, y: h * 0.86 - 20, z: Math.sin(a) * d });
  }
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  const m = new THREE.Mesh(b.build(), mat);
  m.frustumCulled = false;
  return m;
}

export function makeLights(scene, biome, shadows, shadowSize = 60) {
  const hemi = new THREE.HemisphereLight(biome.hemi[0], biome.hemi[1], biome.hemiI ?? 1.35);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(biome.sun, biome.sunI ?? 2.4);
  const sp = biome.sunPos || [40, 60, 30];
  sun.position.set(sp[0], sp[1], sp[2]);
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
  return { hemi, sun, offset: new THREE.Vector3(sp[0], sp[1], sp[2]), hemiI: hemi.intensity, sunI: sun.intensity };
}

// Держим солнце и тени рядом с точкой интереса
export function followSun(lights, p) {
  lights.sun.position.set(p.x + lights.offset.x, p.y + lights.offset.y, p.z + lights.offset.z);
  lights.sun.target.position.set(p.x, p.y, p.z);
}

// Дождь и снег: частицы в коробке вокруг камеры, движение считается в шейдере (дёшево)
export class Weather {
  constructor(scene, type, amount = 1) {
    this.type = type;
    const rain = type === 'rain';
    const n = Math.round((rain ? 2600 : 3600) * amount);
    const box = rain ? new THREE.Vector3(60, 34, 60) : new THREE.Vector3(56, 30, 56);
    const r = new Rng(5);
    const pos = new Float32Array(n * (rain ? 6 : 3));
    const end = new Float32Array(n * (rain ? 2 : 1));
    for (let i = 0; i < n; i++) {
      const x = r.f(0, box.x);
      const y = r.f(0, box.y);
      const z = r.f(0, box.z);
      if (rain) {
        pos.set([x, y, z, x, y, z], i * 6);
        end[i * 2] = 0;
        end[i * 2 + 1] = 1;
      } else {
        pos.set([x, y, z], i * 3);
        end[i] = r.f(0, 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    this.uniforms = {
      uTime: { value: 0 },
      uCam: { value: new THREE.Vector3() },
      uBox: { value: box },
      uCol: { value: new THREE.Color(rain ? '#a8b8c8' : '#ffffff') },
      uSize: { value: 1 },
    };
    const vs = `
      attribute float aEnd; uniform float uTime; uniform vec3 uCam; uniform vec3 uBox; uniform float uSize; varying float vA;
      void main(){
        vec3 p = position;
        ${rain ? 'vec3 vel = vec3(1.5, -26.0, 0.8);' : 'vec3 vel = vec3(0.6 + sin(aEnd * 40.0 + uTime) * 0.9, -2.4 - aEnd * 1.4, cos(aEnd * 30.0 + uTime * 0.7) * 0.8);'}
        p += vel * uTime;
        p = mod(p - uCam + uBox * 0.5, uBox) + uCam - uBox * 0.5;
        ${rain ? 'p -= vel * 0.035 * aEnd;' : ''}
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float d = -mv.z;
        vA = smoothstep(1.5, 4.0, d) * (1.0 - smoothstep(18.0, 30.0, d));
        ${rain ? '' : 'gl_PointSize = clamp(uSize * (0.6 + aEnd * 0.8) / max(d, 0.5), 1.0, 24.0);'}
      }`;
    const fs = rain
      ? `uniform vec3 uCol; varying float vA; void main(){ gl_FragColor = vec4(uCol, 0.42 * vA); }`
      : `uniform vec3 uCol; varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.15, length(c)); gl_FragColor = vec4(uCol, a * 0.9 * vA); }`;
    const mat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: vs, fragmentShader: fs, transparent: true, depthWrite: false, fog: false });
    this.mesh = rain ? new THREE.LineSegments(g, mat) : new THREE.Points(g, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    scene.add(this.mesh);
  }

  update(dt, cam) {
    this.uniforms.uTime.value = (this.uniforms.uTime.value + dt) % 1000;
    this.uniforms.uCam.value.copy(cam.position);
    // размер снежинки ~6 см в пикселях экрана
    const hpx = (window.innerHeight || 720) * Math.min(window.devicePixelRatio || 1, 2);
    this.uniforms.uSize.value = (0.06 * hpx) / (2 * Math.tan(((cam.fov || 60) * Math.PI) / 360));
  }
}

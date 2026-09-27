// Сцены меню: база снаружи (главное меню) и гараж изнутри.

import * as THREE from 'three';
import { GeoBuilder, vcMat, geoMesh, matsFor } from '../engine/geo.js';
import { Rng, damp, fbm } from '../engine/util.js';
import { concreteTex, garageFloorTex, textTex, metalSheetTex, groundTex } from '../engine/textures.js';
import { makeSky, makeMountains, makeLights } from './env.js';
import { CarModel } from './cars.js';
import * as P from './props.js';
import { BIOMES } from '../data/catalog.js';

// ------------------------------ главное меню: база снаружи ------------------------------

export class MenuScene {
  constructor(biomeKey, quality, baseName) {
    this.biomeKey = biomeKey;
    const biome = BIOMES[biomeKey];
    const scene = (this.scene = new THREE.Scene());
    scene.fog = new THREE.Fog(biome.fog, 60, 380);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
    this.sky = makeSky(biome);
    scene.add(this.sky);
    const mt = makeMountains(biome, 3);
    mt.position.y = -25;
    scene.add(mt);
    this.lights = makeLights(scene, biome, quality.shadows, 40);
    this.lights.sun.position.set(-30, 40, 45);
    this.lights.sun.target.position.set(0, 0, -5);

    // земля с холмами
    const size = 700;
    const seg = 90;
    const g = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const col = [];
    const c1 = new THREE.Color(biome.ground);
    const c2 = new THREE.Color(biome.ground2);
    const c3 = new THREE.Color(biome.grass);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const d = Math.hypot(x, z + 10);
      let h = (fbm(x / 60, z / 60, 4, 3) - 0.5) * 6 * Math.min(1, Math.max(0, (d - 40) / 40));
      h += Math.max(0, d - 120) * 0.12;
      pos.setY(i, h);
      tmp.copy(c1).lerp(c2, fbm(x / 30, z / 30, 2, 3));
      if (fbm(x / 20, z / 20, 7, 2) > 0.58) tmp.lerp(c3, 0.6);
      col.push(tmp.r, tmp.g, tmp.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const ground = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, map: groundTex() }));
    ground.material.map.repeat.set(40, 40);
    ground.receiveShadow = true;
    scene.add(ground);
    // дорога от ворот
    const road = new GeoBuilder();
    road.box(8, 0.05, 140, '#6a6258', { y: 0.03, z: 70 });
    scene.add(geoMesh(road.build()));

    // база
    const base = geoMesh(P.baseModel('#2f5f9e').build());
    base.castShadow = true;
    base.receiveShadow = true;
    scene.add(base);
    const dg = P.gateDoor().build();
    const l = geoMesh(dg);
    l.position.x = -P.BASE.gateHalf;
    l.rotation.y = 1.5;
    const r = geoMesh(dg);
    r.position.x = P.BASE.gateHalf;
    r.rotation.y = Math.PI - 1.5;
    scene.add(l, r);
    // название базы на воротах
    const nameSign = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.62), new THREE.MeshBasicMaterial({ map: textTex((baseName || 'База 1').toUpperCase(), { color: '#f2c21b', size: 84 }), transparent: true }));
    nameSign.position.set(0, 5.2, 0.37);
    scene.add(nameSign);

    // деревья вокруг
    const rng = new Rng(biomeKey.length * 11);
    const sc = new GeoBuilder();
    for (let i = 0; i < 70; i++) {
      const a = rng.f(0, Math.PI * 2);
      const d = rng.f(40, 150);
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d - 20;
      if (Math.abs(x) < 10 && z > 0) continue;
      const t = rng.pick(biome.trees);
      const v = rng.i(0, 2);
      const m =
        t === 'spruce' ? P.spruce(v) : t === 'snowspruce' ? P.spruce(v, true) : t === 'pine' ? P.pine(v) : t === 'birch' ? P.birch(v) : t === 'autumn' ? P.birch(v, true) : t === 'dead' ? P.deadTree(v) : P.bush(v, biome.grass);
      sc.merge(m, { x, z, y: Math.max(0, d - 120) * 0.12, s: rng.f(0.8, 1.3), ry: rng.f(0, 6) });
    }
    for (let i = 0; i < 20; i++) {
      const a = rng.f(0, Math.PI * 2);
      const d = rng.f(25, 90);
      sc.merge(P.rock(rng.i(0, 3)), { x: Math.cos(a) * d, z: Math.sin(a) * d, s: rng.f(0.5, 1.8) });
    }
    sc.merge(P.wreck(2), { x: 12, z: 16, ry: 0.7 });
    sc.merge(P.barrels(3, 1), { x: -8, z: 9 });
    sc.merge(P.tires(), { x: 7, z: 5 });
    sc.merge(P.roadSign(1), { x: 6, z: 22, ry: Math.PI });
    const scm = geoMesh(sc.build());
    scm.castShadow = true;
    scm.receiveShadow = true;
    scene.add(scm);

    this.carPos = new THREE.Vector3(0, 0, 13);
    this.car = null;
    this.t = 0;
  }

  setCar(def, equip, weaponModel) {
    if (this.car) {
      this.scene.remove(this.car.group);
      this.car.dispose();
    }
    this.car = new CarModel(def, { ...equip, weaponModel });
    this.car.group.position.copy(this.carPos);
    this.car.group.rotation.y = 1.25;
    this.scene.add(this.car.group);
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    // на узких экранах отодвигаем камеру
    this.camera.fov = w / h < 1 ? 62 : 45;
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    this.t += dt;
    const a = Math.sin(this.t * 0.08) * 0.18;
    const portrait = this.camera.aspect < 1;
    const d = portrait ? 15 : 10.5;
    const cx = this.carPos.x + Math.sin(0.7 + a) * d;
    const cz = this.carPos.z + Math.cos(0.7 + a) * d;
    this.camera.position.set(cx, 2.6, cz);
    this.camera.lookAt(this.carPos.x - (portrait ? 0 : 3.6), 2.1, this.carPos.z - 5.5);
    this.sky.position.copy(this.camera.position);
  }
}

// ------------------------------ гараж ------------------------------

export class GarageScene {
  constructor(quality) {
    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color('#15181c');
    scene.fog = new THREE.Fog('#15181c', 18, 40);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    this.quality = quality;
    const W = 22;
    const D = 18;
    const H = 7;
    // пол
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: garageFloorTex(), roughness: 0.7, metalness: 0.1 }));
    floor.receiveShadow = true;
    scene.add(floor);
    // стены
    const wallTex = concreteTex('#5d6166', 3);
    wallTex.repeat.set(4, 1.5);
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95 });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(W, H), wallMat);
    back.position.set(0, H / 2, -D / 2);
    back.receiveShadow = true;
    scene.add(back);
    const sheet = metalSheetTex('#5a6068');
    sheet.repeat.set(3, 1);
    const sideMat = new THREE.MeshStandardMaterial({ map: sheet, roughness: 0.8, metalness: 0.3 });
    for (const sx of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(D, H), sideMat);
      w.position.set(sx * W / 2, H / 2, 0);
      w.rotation.y = -sx * Math.PI / 2;
      w.receiveShadow = true;
      scene.add(w);
    }
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 1 }));
    ceil.position.y = H;
    scene.add(ceil);
    // надпись GARAGE
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshStandardMaterial({ map: textTex('GARAGE', { size: 96, color: '#c8ccd0', worn: true }), transparent: true, roughness: 0.9 }));
    sign.position.set(-3.2, 4.6, -D / 2 + 0.02);
    scene.add(sign);
    // гаечные ключи
    const icon = new GeoBuilder();
    for (const r of [0.7, -0.7]) {
      icon.box(0.22, 1.7, 0.04, '#9aa0a6', { x: -3.2, y: 2.9, z: -D / 2 + 0.05, rz: r });
      icon.torus(0.22, 0.07, 6, 10, '#9aa0a6', { x: -3.2 + Math.sin(-r) * 0.9, y: 2.9 + Math.cos(r) * 0.9, z: -D / 2 + 0.05 });
    }
    // стеллажи и хлам
    const props = new GeoBuilder();
    props.merge(icon);
    const shelf = (x, z, ry) => {
      const b = new GeoBuilder();
      for (const sx of [-1.2, 1.2]) for (const sz of [-0.3, 0.3]) b.box(0.06, 2.6, 0.06, '#3a3e44', { x: sx, y: 1.3, z: sz });
      const rng = new Rng(Math.round(x * 10));
      for (let i = 0; i < 4; i++) {
        b.box(2.5, 0.05, 0.7, '#4a4e54', { y: 0.2 + i * 0.75 });
        for (let k = 0; k < 4; k++) {
          if (rng.chance(0.3)) continue;
          const c = rng.pick(['#8a6a3a', '#3a5a7a', '#8a3a2a', '#5a6a3a', '#b8a060']);
          b.box(rng.f(0.3, 0.55), rng.f(0.25, 0.5), 0.5, c, { x: -0.9 + k * 0.6, y: 0.2 + i * 0.75 + 0.2 });
        }
      }
      props.merge(b, { x, z, ry });
    };
    shelf(3.5, -D / 2 + 0.5, 0);
    shelf(6.4, -D / 2 + 0.5, 0);
    shelf(W / 2 - 0.5, -4, -Math.PI / 2);
    shelf(-W / 2 + 0.5, -5, Math.PI / 2);
    // ящик с инструментами
    props.box(1.6, 1.1, 0.7, '#b8261e', { x: -8.5, y: 0.6, z: -7.5 });
    for (let i = 0; i < 4; i++) props.box(1.5, 0.03, 0.02, '#2a2a2a', { x: -8.5, y: 0.3 + i * 0.22, z: -7.14 });
    props.box(1.7, 0.1, 0.75, '#2a2a2a', { x: -8.5, y: 1.18, z: -7.5 });
    props.merge(P.tires(), { x: 8.5, z: 5 });
    props.merge(P.tires(), { x: -9, z: 4, ry: 1 });
    props.merge(P.barrels(3, 0), { x: 9, z: -1 });
    props.merge(P.crates(), { x: -9, z: -1, ry: 0.3 });
    // верстак
    props.box(3, 0.1, 1, '#5a4a3a', { x: 0.5, y: 1.0, z: -D / 2 + 0.7 });
    for (const sx of [-1.4, 1.4]) props.box(0.1, 1, 0.9, '#3a3e44', { x: 0.5 + sx, y: 0.5, z: -D / 2 + 0.7 });
    props.box(0.6, 0.3, 0.4, '#3a5a7a', { x: 0.1, y: 1.2, z: -D / 2 + 0.7 });
    // трубы под потолком
    props.box(W, 0.2, 0.2, '#3a3e44', { y: H - 0.4, z: -D / 2 + 0.4 });
    props.box(0.2, 0.2, D, '#3a3e44', { x: -W / 2 + 0.4, y: H - 0.6 });
    const pm = geoMesh(props.build());
    pm.castShadow = true;
    pm.receiveShadow = true;
    scene.add(pm);
    // поворотный круг
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.08, 48), new THREE.MeshStandardMaterial({ color: 0x3a3d42, metalness: 0.6, roughness: 0.4 }));
    plate.position.y = 0.04;
    plate.receiveShadow = true;
    scene.add(plate);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.05, 6, 64).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xd8a818 }));
    ring.position.y = 0.09;
    scene.add(ring);

    // свет
    this.hemi = new THREE.HemisphereLight('#c8d4e0', '#2a2622', 0.7);
    scene.add(this.hemi);
    this.lamps = [];
    const lampGeo = new THREE.BoxGeometry(2.4, 0.12, 0.3);
    for (const [x, z] of [[-4, -2], [4, -2], [0, 3]]) {
      const tube = new THREE.Mesh(lampGeo, new THREE.MeshBasicMaterial({ color: 0xfff6e0 }));
      tube.position.set(x, H - 0.2, z);
      scene.add(tube);
      this.lamps.push(tube);
    }
    this.spot = new THREE.SpotLight('#fff2dc', 90, 30, 0.75, 0.5, 1.4);
    this.spot.position.set(0, H - 0.3, 1);
    this.spot.target.position.set(0, 0, 0);
    if (quality.shadows) {
      this.spot.castShadow = true;
      this.spot.shadow.mapSize.set(1024, 1024);
      this.spot.shadow.bias = -0.0005;
    }
    scene.add(this.spot, this.spot.target);
    this.fill = new THREE.PointLight('#8ab4ff', 18, 20, 1.5);
    this.fill.position.set(-6, 3, 6);
    scene.add(this.fill);
    this.warm = new THREE.PointLight('#ffb070', 14, 18, 1.5);
    this.warm.position.set(7, 2.5, -4);
    scene.add(this.warm);

    this.turn = new THREE.Group();
    scene.add(this.turn);
    this.car = null;
    this.rot = -0.6;
    this.rotV = 0;
    this.drag = false;
    this.light = 1;
    this.lightTarget = 1;
    this.flicker = 0;
    this.focus = 'car';
    this.t = 0;
  }

  setCar(def, equip, weaponModel) {
    if (this.car) {
      this.turn.remove(this.car.group);
      this.car.dispose();
    }
    this.car = new CarModel(def, { ...equip, weaponModel });
    this.turn.add(this.car.group);
    this.car.group.position.y = 0.08;
    this.carLen = this.car.spec.L;
  }

  // Эффект «включения света» после приезда на базу
  lightsOn() {
    this.light = 0;
    this.lightTarget = 1;
    this.flicker = 1.4;
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 1 ? 60 : 38;
    this.camera.updateProjectionMatrix();
    this.portrait = w / h < 1;
  }

  update(dt) {
    this.t += dt;
    const idle = this.t - (this.lastTouch || -99) > 3;
    if (!this.drag) {
      // инерция после броска, затем медленное автовращение
      this.rotV = damp(this.rotV, idle ? 0.12 : 0, idle ? 0.8 : 2.5, dt);
      this.rot += this.rotV * dt;
    }
    this.turn.rotation.y = this.rot;
    // свет
    if (this.flicker > 0) {
      this.flicker -= dt;
      const on = this.flicker < 0.35 || Math.sin(this.t * 40) * Math.sin(this.t * 17) > 0.2;
      this.light = on ? Math.min(1, this.light + dt * 3) : 0.05;
    } else this.light = damp(this.light, this.lightTarget, 4, dt);
    const k = this.light;
    this.spot.intensity = 90 * k;
    this.hemi.intensity = 0.15 + 0.55 * k;
    this.fill.intensity = 18 * k;
    this.warm.intensity = 14 * k;
    for (const l of this.lamps) l.material.color.setScalar(0.15 + 0.85 * k);
    const L = this.carLen || 4.5;
    const d = ((this.portrait ? 12 : 8.2) + (L - 4.5) * 0.8) * (this.zoom || 1);
    const off = this.portrait ? 0 : 0.9;
    const el = this.pitch ?? 0.2;
    const ty = 0.9;
    this.camera.position.set(off - 0.3 + Math.sin(0.55) * d * Math.cos(el), ty + Math.sin(el) * d, Math.cos(0.55) * d * Math.cos(el));
    this.camera.lookAt(off - 0.3, ty, 0);
  }

  // Вращение мышью/пальцем: dx — по горизонтали (поворот машины), dy — наклон камеры
  onDrag(dx, dy = 0) {
    this.lastTouch = this.t;
    this.rot += dx * 0.01;
    this.rotV = dx * 0.6;
    this.pitch = Math.min(0.75, Math.max(0.02, (this.pitch ?? 0.2) + dy * 0.004));
  }

  onZoom(f) {
    this.lastTouch = this.t;
    this.zoom = Math.min(1.45, Math.max(0.6, (this.zoom || 1) * f));
  }
}

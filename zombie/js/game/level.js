// Поездка от базы к базе: езда, стрельба, зомби, бандиты, заправка пешком, кат-сцены.

import * as THREE from 'three';
import { Rng, clamp, lerp, damp, smoothstep, angleDiff } from '../engine/util.js';
import { Track, ArcadeTrack, ROAD_HALF, BRANCH_HALF } from '../world/track.js';
import { buildLevelWorld } from '../world/level-world.js';
import { makeSky, makeMountains, makeLights, followSun, levelEnv, Weather } from '../world/env.js';
import { CarModel, Cockpit, buildCarWeapon } from '../world/cars.js';
import { Humans, ZTYPES, poseRig } from '../world/characters.js';
import { ViewModel } from '../world/guns.js';
import { Particles } from '../engine/particles.js';
import { canopyTex } from '../engine/textures.js';
import { makePickup, makeObstacle, OBSTACLE_SIZE, projectileMesh, PICKUP_COLORS } from './pickups.js';
import { BIOMES, baseInfo, levelParams, MEDKITS, pickZombieType } from '../data/catalog.js';
import { sfx, engineStart, engineSet, engineStop } from '../engine/audio.js';
import { BASE } from '../world/props.js';

const V3 = () => new THREE.Vector3();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _fr = {};
const _col = new THREE.Color();

const RES_KINDS = ['wood', 'metal', 'cloth', 'ammo'];

export class Level {
  constructor(opts) {
    this.o = opts;
    this.dest = opts.dest;
    this.info = baseInfo(opts.dest);
    this.fromInfo = baseInfo(opts.dest - 1);
    this.biome = BIOMES[this.info.biome];
    this.params = levelParams(opts.dest);
    this.rng = new Rng(opts.dest * 977 + 13);
    // аркада: своя карта, сложность растёт с пройденными километрами
    this.arcade = opts.arcade || null;
    if (this.arcade) {
      const m = this.arcade;
      this.info = { n: 0, name: 'Аркада', sub: m.name, biome: m.biome };
      this.fromInfo = this.info;
      this.biome = BIOMES[m.biome];
      this.params = { ...levelParams(2), ...m, forks: 0, title: m.name };
      this.rng = new Rng((Date.now() % 100000) + 7);
    }
    this.t = 0;
    this.state = 'map';
    this.paused = false;
    this.input = { steer: 0, brake: false, gas: false, fire: false, moveX: 0, moveY: 0 };
    this.notices = [];
    this.shake = 0;
    this.stats = { kills: 0, brutes: 0, bosses: 0, bandits: 0, footKills: 0, crates: 0, distance: 0, cash: 0, wood: 0, metal: 0, cloth: 0, ammo: 0, refueled: false };
    this.inv = { ...opts.inv };
    this.revives = 0;
    this.build();
  }

  // ------------------------------ сборка сцены ------------------------------

  build() {
    const o = this.o;
    const q = o.quality;
    const scene = (this.scene = new THREE.Scene());
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.05, 2400);
    const pr = this.params;
    const env = (this.env = levelEnv(this.biome, pr));
    this.fog = new THREE.Fog(env.fog, env.fogNear, q.fogFar * env.fogK);
    scene.background = new THREE.Color(env.fog);

    this.sky = makeSky(env);
    scene.add(this.sky);
    this.mountains = makeMountains(env, this.dest, pr.terrain === 'mountain' || pr.terrain === 'canyon');
    scene.add(this.mountains);
    this.lights = makeLights(scene, env, q.shadows, 55);

    // длиннее, если есть развилки и трамплины
    let L = pr.length + (pr.forks || 0) * 120 + (pr.jumps || 0) * 50;
    if (this.arcade) {
      this.track = new ArcadeTrack({ seed: 4000 + this.arcade.id.length * 97, hillAmp: pr.hillAmp, terrain: pr.terrain, jumps: pr.jumps });
      L = this.track.L;
    } else this.track = new Track({ seed: this.dest * 131 + 7, length: L, stationS: Math.round(L * 0.5), bridgeS: Math.round(L * 0.38), campS: Math.round(L * 0.8), curvy: pr.curvy, hillAmp: pr.hillAmp, terrain: pr.terrain, forks: pr.forks, jumps: pr.jumps });
    this.L = L;
    this.track.buildMeshes(this.biome, scene, env);
    const prevPreset = levelParams(Math.max(2, this.dest - 1));
    this.world = buildLevelWorld(scene, this.track, this.biome, pr, this.rng, { detail: q.detail, fromName: this.fromInfo.name, toName: this.info.name, fromBase: this.dest > 2 ? prevPreset.base : 0, arcade: !!this.arcade });
    if (pr.weather === 'rain' || pr.weather === 'snow') this.weather = new Weather(scene, pr.weather, q.particles);
    if (env.night && this.world.canopy) this.world.canopy.material.emissive = new THREE.Color('#6a5a40');
    this.buildRoute();
    // лесной покров до горизонта — виден на карте уровня
    const ct = canopyTex();
    ct.repeat.set(60, 60);
    const cc = new THREE.Color('#ffffff');
    if (this.biome.name === 'Снега') cc.set('#c8d4d8');
    if (this.biome.name === 'Пустоши' || this.biome.name === 'Степь') cc.set('#d8d0a0');
    this.canopy = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: ct, color: cc, fog: false }));
    const bc = this.routeBox.getCenter(new THREE.Vector3());
    this.canopy.position.set(bc.x, this.routeBox.min.y - 6, bc.z);
    this.canopy.renderOrder = -5;
    scene.add(this.canopy);

    // машина
    this.carModel = new CarModel(o.stats.car, { ...o.equip, weaponModel: o.stats.weapon.model });
    scene.add(this.carModel.group);
    this.cockpit = new Cockpit(this.carModel);
    this.carModel.body.add(this.cockpit.group);
    if (env.night || pr.weather === 'fog') {
      // фары: конус света вперёд и слабая подсветка вокруг машины
      const hl = new THREE.SpotLight('#fff0d0', env.night ? 260 : 90, 75, 0.55, 0.65, 1.3);
      hl.position.set(0, 1.0, this.carModel.frontZ - 0.3);
      hl.target.position.set(0, -1.2, this.carModel.frontZ + 20);
      this.carModel.body.add(hl, hl.target);
      if (q.detail >= 0.8) {
        const glow = new THREE.PointLight('#ffe0b0', env.night ? 6 : 2, 9, 1.5);
        glow.position.set(0, 2.2, 0);
        this.carModel.body.add(glow);
      }
      this.headlights = hl;
    }
    const st = o.stats;
    this.car = {
      s: this.arcade ? 4 : BASE.carStartZ,
      x: 0,
      v: 0,
      ang: 0,
      yaw: 0,
      hp: Math.max(1, Math.round(st.hp * (o.carHpFrac ?? 1))),
      maxHp: st.hp,
      fuel: st.fuel,
      maxFuel: st.fuel,
      slowT: 0,
      grabT: 0,
      bump: 0,
      bumpV: 0,
      roll: 0,
      pitch: 0,
      y: 0,
      vy: 0,
      air: false,
    };
    this.fuelRate = this.arcade ? st.fuel / 1150 : (st.fuel * 0.72) / (L * 0.5);
    this.camMode = o.settings.camera === 'chase' || innerWidth < innerHeight ? 'chase' : 'cockpit';

    // оружие машины
    const w = st.weapon;
    this.wpn = {
      def: w,
      mag: w.mag,
      reserve: w.mag * (3 + (o.armory || 0)) + (o.ammoBoxes || 0) * w.mag,
      cd: 0,
      reload: 0,
      target: null,
      yaw: 0,
      flameT: 0,
    };
    // ручное оружие
    this.gun = { def: o.gun, mag: o.gun.mag, cd: 0, reload: 0 };

    this.humans = new Humans(scene);
    this.fx = new Particles(scene, q.particles);
    this.projectiles = [];
    this.acid = [];
    this.myMines = [];

    // сущности
    const sp = this.world.spawns;
    this.pending = {
      zombies: sp.zombies.sort((a, b) => a.s - b.s),
      pickups: sp.pickups.sort((a, b) => a.s - b.s),
      obstacles: [...sp.obstacles, ...sp.mines.map((m) => ({ ...m, kind: 'mine' })), ...sp.spikes.map((m) => ({ ...m, kind: 'spikes' }))].sort((a, b) => a.s - b.s),
    };
    this.idx = { zombies: 0, pickups: 0, obstacles: 0 };
    this.zombies = [];
    this.pickups = [];
    this.obstacles = [];
    this.turrets = [];
    // бандиты стоят в лагере с начала
    for (const b of sp.bandits) this.spawnZombie({ s: b.s, x: b.x, type: 'bandit' }, true);
    for (const t of sp.turrets) this.spawnTurret(t);

    this.station = this.world.station;
    this.stationDone = !!this.arcade;
    this.pumpProgress = 0;
    this.player = null;
    this.warned = {};
    this.updateCarTransform(0);
    this.snapCamera = true;
  }

  // Пунктир маршрута для карты уровня
  buildRoute() {
    const tr = this.track;
    const pts = [];
    const uvs = [];
    const idx = [];
    const half = 5;
    let row = 0;
    for (let s = -20; s <= this.L + 20; s += 4) {
      const f = tr.frame(s, _fr);
      const y = f.y + 1.2;
      const rx = tr.routeX(s);
      pts.push(f.x + f.rx * (rx - half), y, f.z + f.rz * (rx - half), f.x + f.rx * (rx + half), y, f.z + f.rz * (rx + half));
      uvs.push(0, s / 30, 1, s / 30);
      if (row > 0) {
        const a = (row - 1) * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
      row++;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffd21a';
    ctx.fillRect(2, 0, 12, 36);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapT = THREE.RepeatWrapping;
    this.routeTex = tex;
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5, fog: false, depthWrite: false, depthTest: false }));
    m.renderOrder = 5;
    this.route = m;
    this.scene.add(m);
    // рамка для камеры карты
    const box = new THREE.Box3();
    for (let s = -40; s <= this.L + 40; s += 20) {
      const f = tr.frame(s, _fr);
      box.expandByPoint(new THREE.Vector3(f.x, f.y, f.z));
    }
    this.routeBox = box;
    const a = tr.frame(0, {});
    const b = tr.frame(this.L, {});
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const l = Math.hypot(dx, dz);
    this.mapView = { dirX: dz / l, dirZ: -dx / l, zoom: 1, rot: 0, panS: 0.5 };
  }

  // ------------------------------ вспомогательное ------------------------------

  notice(text, time = 2.2, kind = '') {
    if (this.notices.some((n) => n.text === text)) return;
    this.notices.push({ text, t: time, kind });
  }

  wpos(s, x, y = 0, out = _v) {
    this.track.toWorld(s, x, out);
    out.y += y;
    return out;
  }

  setCam(pos, look, fov, snap = false) {
    const cam = this.camera;
    if (snap || this.snapCamera) {
      cam.position.copy(pos);
      cam.lookAt(look);
      this.snapCamera = false;
    } else {
      const k = this.camBlend < 1 ? 1 - Math.exp(-6 * this.dtCam) : 1;
      cam.position.lerp(pos, k);
      const q0 = cam.quaternion.clone();
      cam.lookAt(look);
      const q1 = cam.quaternion.clone();
      cam.quaternion.copy(q0).slerp(q1, k);
    }
    // на узких (портретных) экранах расширяем обзор по вертикали
    const aspect = cam.aspect || 1.6;
    if (aspect < 1.3) {
      const hf = 2 * Math.atan(Math.tan((fov * Math.PI) / 360) * 1.3);
      fov = Math.min(88, (2 * Math.atan(Math.tan(hf / 2) / aspect) * 180) / Math.PI);
    }
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = lerp(cam.fov, fov, this.camBlend < 1 ? 0.1 : 1);
      cam.updateProjectionMatrix();
    }
    if (this.shake > 0 && this.o.settings.shake !== false) {
      const s = this.shake * 0.12;
      cam.position.x += (Math.random() - 0.5) * s;
      cam.position.y += (Math.random() - 0.5) * s;
      cam.position.z += (Math.random() - 0.5) * s;
    }
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.fx.setScale(h, this.camera.fov);
    this.vw = w;
    this.vh = h;
  }

  // ------------------------------ сущности ------------------------------

  spawnZombie(d, force = false) {
    const slot = this.humans.alloc(d.type, this.rng);
    if (!slot) return null;
    const T = ZTYPES[d.type];
    const P = this.params;
    const mul = d.type === 'bandit' ? 1 + (this.dest - 2) * 0.1 : T.boss ? P.bossMul : P.hpMul;
    const hp = Math.round(T.hp * mul);
    const z = {
      type: d.type,
      T,
      s: d.s,
      x: d.x,
      y: 0,
      hp,
      maxHp: hp,
      slot,
      state: T.boss ? 'chase' : 'idle',
      phase: this.rng.f(0, 6),
      yaw: this.rng.f(0, 6.28),
      wander: this.rng.f(0, 6.28),
      atkT: this.rng.f(0, 1),
      shootT: this.rng.f(0.5, 2),
      spitT: this.rng.f(1, 3),
      summonT: 5,
      dead: null,
      burn: 0,
      station: !!d.station,
      groanT: this.rng.f(2, 10),
      stun: 0,
      latch: null,
      boss: !!T.boss,
      mode: 'walk',
      modeT: 0,
      sc: T.boss ? T.scale : T.scale * this.rng.f(0.9, 1.1),
      spd: (T.boss ? 1 : this.rng.f(0.85, 1.15)) * (d.type === 'bandit' ? 1 : P.speedMul),
      dmg: T.dmg * (d.type === 'bandit' ? 1 : P.dmgMul),
    };
    this.zombies.push(z);
    void force;
    return z;
  }

  spawnTurret(t) {
    const w = buildCarWeapon('mg2');
    const g = new THREE.Group();
    const tripod = new THREE.Group();
    const legM = new THREE.MeshStandardMaterial({ color: 0x2a2c30, metalness: 0.5, roughness: 0.5 });
    for (let i = 0; i < 3; i++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6), legM);
      const a = (i / 3) * Math.PI * 2;
      leg.position.set(Math.cos(a) * 0.45, 0.7, Math.sin(a) * 0.45);
      leg.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
      tripod.add(leg);
    }
    g.add(tripod);
    w.group.position.y = 1.3;
    g.add(w.group);
    this.wpos(t.s, t.x);
    g.position.copy(_v);
    this.scene.add(g);
    this.turrets.push({ s: t.s, x: t.x, hp: 260 + this.dest * 20, maxHp: 260, mesh: g, w, cd: 1, burst: 0, dead: false });
  }

  activate() {
    const c = this.car;
    const ahead = this.state === 'map' ? -1e9 : (this.player ? this.player.s : c.s) + 170;
    const P = this.pending;
    if (this.arcade && this.state !== 'map') this.arcadeSpawn(ahead + 30);
    const bs = this.world.spawns.boss;
    if (bs && !this.bossSpawned && this.state !== 'map' && c.s > bs.s - 150) {
      this.bossSpawned = true;
      const z = this.spawnZombie({ s: bs.s, x: bs.x, type: bs.type });
      if (z) {
        this.boss = z;
        this.notice(`Босс: ${z.T.name}!`, 3, 'bad');
        sfx.alarm();
        sfx.groan();
      }
    }
    while (this.idx.zombies < P.zombies.length && P.zombies[this.idx.zombies].s < ahead) {
      const d = P.zombies[this.idx.zombies];
      if (!this.spawnZombie(d)) break;
      this.idx.zombies++;
    }
    while (this.idx.pickups < P.pickups.length && P.pickups[this.idx.pickups].s < ahead) {
      const d = P.pickups[this.idx.pickups++];
      this.addPickup(d.s, d.x, d.kind, d.dy);
    }
    while (this.idx.obstacles < P.obstacles.length && P.obstacles[this.idx.obstacles].s < ahead) {
      const d = P.obstacles[this.idx.obstacles++];
      const m = makeObstacle(d);
      this.wpos(d.s, d.x);
      m.position.copy(_v);
      this.track.frame(d.s, _fr);
      m.rotation.y = _fr.yaw + (d.yaw || 0) + (d.kind === 'spikes' ? Math.PI / 2 : 0);
      this.scene.add(m);
      const size = OBSTACLE_SIZE[d.kind] || [0.6, 0.6];
      let hl = size[0];
      let hw = size[1];
      if (d.kind === 'wreck' && Math.abs(Math.sin(d.yaw || 0)) > 0.5) [hl, hw] = [1.3, 2.0];
      if (d.kind === 'spikes') [hl, hw] = [0.4, 3.0];
      const hp = d.kind === 'barrel' ? 20 : d.kind === 'crate' ? 25 : d.kind === 'mine' ? 10 : 1e9;
      const ob = { ...d, mesh: m, hl, hw, hp, alive: true };
      if (d.kind === 'mine') {
        const light = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff2a1a }));
        light.position.y = 0.24;
        m.add(light);
        ob.light = light;
      }
      this.obstacles.push(ob);
    }
  }

  addPickup(s, x, kind, dy = 0) {
    const m = makePickup(kind);
    this.wpos(s, x);
    m.position.copy(_v);
    this.scene.add(m);
    this.pickups.push({ s, x, kind, mesh: m, alive: true, bob: this.rng.f(0, 6), dy });
  }

  // ------------------------------ основной цикл ------------------------------

  update(dt) {
    if (this.paused) return;
    dt = Math.min(dt, 0.05);
    this.t += dt;
    this.dtCam = dt;
    this.camBlend = Math.min(1, (this.camBlend ?? 1) + dt * 0.7);
    this.shake = Math.max(0, this.shake - dt * 2.5);
    for (const n of this.notices) n.t -= dt;
    this.notices = this.notices.filter((n) => n.t > 0);

    switch (this.state) {
      case 'map':
        this.updateMap(dt);
        break;
      case 'intro':
        this.updateIntro(dt);
        break;
      case 'drive':
        this.updateDrive(dt);
        break;
      case 'stationIn':
        this.updateStationIn(dt);
        break;
      case 'foot':
        this.updateFoot(dt);
        break;
      case 'stationOut':
        this.updateStationOut(dt);
        break;
      case 'arrive':
        this.updateArrive(dt);
        break;
      case 'dead':
        this.updateDeadCam(dt);
        break;
      default:
        break;
    }
    if (this.state !== 'map') {
      this.activate();
      this.updateZombies(dt);
      this.updateTurrets(dt);
      this.updateObstacles(dt);
      this.updatePickups(dt);
      this.updateProjectiles(dt);
      this.updateAcid(dt);
      this._prevAng = this.car.ang;
    }
    this.humans.commit();
    this.fx.update(dt);
    if (this.weather) {
      this.weather.mesh.visible = this.state !== 'map';
      this.weather.update(dt, this.camera);
    }
    if (this.params.storm && this.state !== 'map') this.updateStorm(dt);
    // небо и горы вокруг камеры
    this.sky.position.copy(this.camera.position);
    this.mountains.position.set(this.camera.position.x, this.state === 'map' ? this.routeBox.min.y - 30 : this.camera.position.y - 60, this.camera.position.z);
    // ворота баз
    for (const b of this.world.bases) {
      if (this.camera.position.distanceToSquared(b.group.position) < 150 * 150 || this.state === 'map') b.flag.update(dt);
      b.left.rotation.y = b.open * 1.65;
      b.right.rotation.y = Math.PI - b.open * 1.65;
      b.garageDoor.position.y = 2.4 + b.garageOpen * 4.2;
      b.garageDoor.visible = b.garageOpen < 0.98;
    }
  }

  // Гроза: редкие вспышки молний с громом
  updateStorm(dt) {
    const L = this.lights;
    this.flashT = (this.flashT ?? 6) - dt;
    if (this.flashT <= 0) {
      this.flashT = 7 + Math.random() * 10;
      this.flash = 1;
      setTimeout(() => sfx.thunder?.(), 250 + Math.random() * 900);
    }
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 2.6);
      const k = this.flash > 0.55 || (this.flash > 0.2 && this.flash < 0.35) ? this.flash : this.flash * 0.3;
      L.hemi.intensity = L.hemiI + k * 3.2;
      this.scene.background.set(this.env.fog).lerp(_col.set('#8a9ab8'), k * 0.6);
    } else if (L.hemi.intensity !== L.hemiI) {
      L.hemi.intensity = L.hemiI;
      this.scene.background.set(this.env.fog);
    }
  }

  // ------------------------------ карта уровня ------------------------------

  updateMap(dt) {
    this.scene.fog = null;
    // карта всегда «днём», даже если поездка ночью
    this.lights.hemi.intensity = Math.max(1.35, this.lights.hemiI);
    this.lights.sun.intensity = Math.max(2.2, this.lights.sunI);
    this.route.visible = true;
    this.canopy.visible = true;
    this.sky.visible = false;
    this.mountains.visible = false;
    this.scene.background.set('#1d3a1f');
    this.routeTex.offset.y -= dt * 0.8;
    const mv = this.mapView;
    const box = this.routeBox;
    const size = box.getSize(_v2);
    const ext = Math.max(size.x, size.z);
    const center = box.getCenter(new THREE.Vector3());
    const dirX = Math.cos(mv.rot) * mv.dirX - Math.sin(mv.rot) * mv.dirZ;
    const dirZ = Math.sin(mv.rot) * mv.dirX + Math.cos(mv.rot) * mv.dirZ;
    const aspect = this.camera.aspect || 1.6;
    const dist = (ext * 0.72 * mv.zoom) / Math.min(1.4, aspect * 0.8);
    const pos = new THREE.Vector3(center.x - dirX * dist * 0.62, center.y + dist * 0.85, center.z - dirZ * dist * 0.62);
    this.camera.far = 6000;
    this.setCam(pos, center, 42, true);
    this.camera.updateProjectionMatrix();
    followSun(this.lights, center);
    this.lights.sun.castShadow = false;
    this.carModel.group.visible = false;
  }

  mapMarkers() {
    const out = [];
    const cam = this.camera;
    cam.updateMatrixWorld();
    const add = (p, s, x, h = 8) => {
      this.wpos(s, x, h, _v2);
      _v2.project(cam);
      if (_v2.z > 1) return;
      out.push({ ...p, sx: (_v2.x * 0.5 + 0.5) * this.vw, sy: (-_v2.y * 0.5 + 0.5) * this.vh });
    };
    for (const p of this.world.pois) add(p, p.s, p.x, p.type === 'base' ? 14 : 8);
    return out;
  }

  // Схема маршрута для мини-карты (нормированные точки)
  routeSketch(n = 40) {
    const pts = [];
    const box = this.routeBox;
    for (let i = 0; i <= n; i++) {
      const s = (i / n) * this.L;
      const f = this.track.frame(s, _fr);
      pts.push({ x: f.x, z: f.z, s });
    }
    return { pts, box };
  }

  startIntro() {
    this.state = 'intro';
    this.introT = 0;
    this.scene.fog = this.fog;
    this.route.visible = false;
    this.canopy.visible = false;
    this.sky.visible = true;
    this.mountains.visible = true;
    this.scene.background.set(this.env.fog);
    this.lights.hemi.intensity = this.lights.hemiI;
    this.lights.sun.intensity = this.lights.sunI;
    this.camera.far = 2400;
    this.camera.updateProjectionMatrix();
    this.carModel.group.visible = true;
    this.lights.sun.castShadow = this.o.quality.shadows;
    this.world.startBase.garageOpen = 0;
    this.snapCamera = true;
    this.cockpit.visible = false;
    this.engineOn = false;
    sfx.gate();
  }

  // Аркада: сразу за рулём, без карты и кат-сцены
  startArcade() {
    this.scene.fog = this.fog;
    this.route.visible = false;
    this.canopy.visible = false;
    this.sky.visible = true;
    this.mountains.visible = true;
    this.scene.background.set(this.env.fog);
    this.lights.hemi.intensity = this.lights.hemiI;
    this.lights.sun.intensity = this.lights.sunI;
    this.lights.sun.castShadow = this.o.quality.shadows;
    this.camera.far = 2400;
    this.camera.updateProjectionMatrix();
    this.carModel.group.visible = true;
    this.state = 'drive';
    this.car.v = 10;
    this.camBlend = this.camMode === 'cockpit' ? 1 : 0;
    this.snapCamera = true;
    this.genS = 60;
    this.nextFuelS = 320;
    this.nextRepairS = 900;
    this.nextAmmoS = 200;
    this.nextBossS = 1800;
    this.arcK = -1;
    engineStart();
    this.engineOn = true;
    this.notice('Аркада: проедь как можно дальше!', 3);
    this.o.onEvent?.('drive');
  }

  // Появление зомби, препятствий и припасов впереди (аркада)
  arcadeSpawn(ahead) {
    const c = this.car;
    const tr = this.track;
    const rng = this.rng;
    const P = this.pending;
    const pr = this.params;
    // сложность растёт каждые 700 м
    const k = Math.floor(Math.max(0, c.s) / 700);
    if (k !== this.arcK) {
      this.arcK = k;
      const lp = levelParams(2 + k);
      Object.assign(pr, { mix: lp.mix, hpMul: lp.hpMul, speedMul: lp.speedMul, dmgMul: lp.dmgMul, zombieDensity: lp.zombieDensity, bossMul: lp.bossMul });
      if (k > 0) this.notice(`Уровень угрозы ${k + 1}: зомби сильнее!`, 2.5, 'bad');
    }
    const rampAt = (a, b) => {
      const out = [];
      const lap = Math.floor(a / tr.P);
      for (const r of tr.ramps) for (const lp of [lap - 1, lap, lap + 1]) {
        const rs = lp * tr.P + r.s;
        if (rs + r.len + 40 > a && rs - 25 < b) out.push({ ...r, s: rs });
      }
      return out;
    };
    while (this.genS < ahead) {
      const s0 = this.genS;
      const s1 = s0 + 40;
      this.genS = s1;
      const zs = [];
      const ps = [];
      const os = [];
      const ramps = rampAt(s0, s1);
      for (const r of ramps) {
        const end = r.s + r.len;
        if (end + 5.5 < s0 || end + 5.5 >= s1) continue;
        for (const x of [-2.6, 2.6]) os.push({ kind: 'wreck', s: end + 5.5, x, v: rng.i(0, 4), yaw: Math.PI / 2 + rng.f(-0.15, 0.15) });
        const vy = 22 * ((r.h * 1.35) / r.len);
        for (let i = 0; i < 8; i++) {
          const d = 1.5 + i * 1.9;
          const t = d / 22;
          ps.push({ s: end + d, x: 0, kind: 'cash', dy: Math.max(0, r.h + vy * t - 11 * t * t) });
        }
      }
      if (!ramps.length) {
        const nz = Math.round(40 * pr.zombieDensity * 1.25 + rng.f(0, 1.5));
        for (let i = 0; i < nz; i++) zs.push({ s: rng.f(s0, s1), x: rng.f(-15, 15), type: pickZombieType(pr.mix, rng.next()) });
        if (rng.chance(0.08 + Math.min(0.1, k * 0.02))) {
          const hs = rng.f(s0, s1);
          for (let i = 0; i < 8 + k * 2; i++) zs.push({ s: hs + rng.f(-12, 12), x: rng.f(-10, 10), type: pickZombieType(pr.mix, rng.next()) });
          this.notice('Впереди орда!', 2, 'bad');
        }
        if (rng.chance(0.35)) {
          const s = rng.f(s0 + 5, s1 - 5);
          const r = rng.next();
          if (r < 0.3) os.push({ kind: 'wreck', s, x: rng.sign() * rng.f(1.5, 4.5), v: rng.i(0, 4), yaw: rng.f(-0.8, 0.8) });
          else if (r < 0.5) os.push({ kind: 'block', s, x: rng.sign() * 3.5, v: rng.i(0, 1) });
          else if (r < 0.75) os.push({ kind: 'barrel', s, x: rng.f(-5, 5) });
          else os.push({ kind: 'crate', s, x: rng.f(-5, 5) });
        }
        if (k >= 1 && rng.chance(Math.min(0.35, 0.08 * k))) os.push({ kind: 'mine', s: rng.f(s0, s1), x: rng.f(-6, 6) });
        if (rng.chance(0.35)) {
          const x = rng.f(-4.5, 4.5);
          const s = rng.f(s0, s1 - 15);
          for (let i = 0; i < 5; i++) ps.push({ s: s + i * 3, x, kind: 'cash' });
        } else if (rng.chance(0.4)) ps.push({ s: rng.f(s0, s1), x: rng.f(-5, 5), kind: rng.pick(['wood', 'metal', 'cloth', 'ammo', 'metal']) });
      }
      if (s0 >= this.nextFuelS) {
        this.nextFuelS += rng.f(300, 420);
        ps.push({ s: s0 + 20, x: rng.f(-4, 4), kind: 'fuel' });
      }
      if (s0 >= this.nextAmmoS) {
        this.nextAmmoS += rng.f(220, 320);
        ps.push({ s: s0 + 10, x: rng.f(-4, 4), kind: 'ammo' });
      }
      if (s0 >= this.nextRepairS) {
        this.nextRepairS += rng.f(800, 1000);
        ps.push({ s: s0 + 30, x: rng.f(-4, 4), kind: 'repair' });
      }
      const bySort = (a, b) => a.s - b.s;
      P.zombies.push(...zs.sort(bySort));
      P.pickups.push(...ps.sort(bySort));
      P.obstacles.push(...os.sort(bySort));
    }
    // уже появившиеся записи больше не нужны
    for (const key of ['zombies', 'pickups', 'obstacles']) {
      if (this.idx[key] > 400) {
        P[key].splice(0, this.idx[key]);
        this.idx[key] = 0;
      }
    }
    // босс каждые ~2 км
    const b = this.boss;
    if ((!b || b.dead || b.gone) && c.s > this.nextBossS - 150) {
      const types = ['tank', 'queen', 'butcher'];
      const z = this.spawnZombie({ s: this.nextBossS, x: 0, type: types[Math.floor(this.nextBossS / 2000) % 3] });
      this.nextBossS += 2200;
      if (z) {
        this.boss = z;
        this.notice(`Босс: ${z.T.name}!`, 3, 'bad');
        sfx.alarm();
        sfx.groan();
      }
    }
  }

  // ------------------------------ вступление ------------------------------

  updateIntro(dt) {
    const c = this.car;
    this.introT += dt;
    const t = this.introT;
    const b = this.world.startBase;
    // ворота гаража поднимаются, внутри горит свет; затем мотор, выезд и ворота базы
    b.garageOpen = smoothstep(0.3, 2.2, t);
    b.open = smoothstep(2.6, 4.4, t);
    if (t > 1.0 && !this.engineOn) {
      this.engineOn = true;
      engineStart();
    }
    if (t > 2.4) c.v = Math.min(c.v + dt * 4.5, 11);
    c.s += c.v * dt;
    this.carModel.update(dt, c.v, 0);
    this.updateCarTransform(dt);
    engineSet(0.05 + c.v / 30, c.v > 0.5 ? 0.6 : 0.2);
    const cp = this.carModel.group.position;
    if (t < 4.2) {
      // план 1: у ворот гаража, камера медленно отъезжает
      const k = smoothstep(0, 4.2, t);
      const p = this.wpos(-24 + k * 3, 3.6 - k * 1.2, 1.7 + k * 0.4, new THREE.Vector3());
      const look = this.wpos(-35 + k * 8, 0, 1.4, new THREE.Vector3());
      this.setCam(p, look, 52, t < 0.05);
    } else {
      // план 2: снаружи у ворот базы
      const p = this.wpos(16, -7.5, 1.6, new THREE.Vector3());
      this.setCam(p, _v2.copy(cp).add(new THREE.Vector3(0, 1, 0)), 50, t < 4.22);
    }
    if (c.s > 14) {
      this.state = 'drive';
      this.camBlend = this.camMode === 'cockpit' ? 1 : 0;
      this.snapCamera = true;
      this.o.onEvent?.('drive');
    }
    followSun(this.lights, cp);
  }

  // ------------------------------ езда ------------------------------

  updateDrive(dt) {
    const c = this.car;
    const st = this.o.stats;
    const inp = this.input;
    const tr = this.track;

    // скорость
    const off = tr.roadDist(c.s, c.x) > 0.6 && !c.air;
    let maxV = st.speed * (off ? 0.7 : 1) * (c.slowT > 0 ? 0.6 : 1);
    if (inp.gas) maxV *= 1.08;
    if (c.fuel <= 0) maxV = 0;
    if (c.grabT > 0) maxV *= 0.75;
    if (c.air) c.v = Math.max(0, c.v - 0.4 * dt);
    else if (inp.brake) c.v = Math.max(0, c.v - 16 * dt);
    else if (c.v < maxV) c.v = Math.min(maxV, c.v + (2.2 + (maxV - c.v) * 0.35) * dt);
    else c.v = Math.max(maxV, c.v - 6 * dt);
    c.slowT = Math.max(0, c.slowT - dt);
    c.grabT = Math.max(0, c.grabT - dt);

    if (this.autopilot) this.autoSteer();
    // руль
    // дрифт: машину заносит, кузов разворачивает боком, скорость немного падает
    const drifting = inp.drift && c.v > 9 && Math.abs(inp.steer) > 0.1 && !c.air;
    const grip = this.params.slippery || 1;
    const target = c.air ? c.ang : clamp(inp.steer, -1, 1) * (drifting ? 0.5 : 0.36) * (0.75 + 0.25 * st.handling);
    c.ang = damp(c.ang, target, (drifting ? 3 : 4.5) * st.handling * grip, dt);
    c.drift = damp(c.drift || 0, drifting ? clamp(inp.steer, -1, 1) * 0.6 : 0, drifting ? 3.5 : 5, dt);
    if (drifting) {
      c.v = Math.max(8, c.v - 2.2 * dt);
      this.driftTime = (this.driftTime || 0) + dt;
      if (Math.random() < 0.8) {
        for (const sx of [-1, 1]) this.fx.dust(this.carModel.group.localToWorld(new THREE.Vector3(sx * 0.8, 0.2, this.carModel.rearZ + 0.6)), { x: 0, y: 0.6, z: 0 }, 1, '#d8d4cc');
      }
      if (!this._skid || this.t - this._skid > 0.35) {
        this._skid = this.t;
        sfx.skid();
      }
    }
    const ds = c.v * Math.cos(c.ang) * dt;
    c.s += ds;
    c.x += c.v * Math.sin(c.ang) * dt;
    this.stats.distance += Math.max(0, ds);
    if (c.fuel > 0) {
      c.fuel = Math.max(0, c.fuel - this.fuelRate * Math.max(0, ds));
      if (c.fuel <= 0) {
        if (this.inv.fuel > 0) this.useFuel();
        else this.notice('Бензин кончился!', 2, 'bad');
      }
    }
    if (c.fuel <= 0 && c.v < 0.3 && this.state === 'drive') this.fail('fuel');

    // границы дороги (на развилке — островок между ветками)
    let lo = -12.5;
    let hi = 12.5;
    const fo = tr.laneOff(c.s);
    if (tr.onBridge(c.s)) {
      lo = -(ROAD_HALF - 0.9);
      hi = ROAD_HALF - 0.9;
    } else if (fo > 0) {
      hi = fo + tr.laneHalf(fo) + 5.5;
      lo = -hi;
      const inner = fo - tr.laneHalf(fo) - 1.0;
      if (inner > 0.2) {
        if (c.x >= 0) lo = inner;
        else hi = -inner;
      }
    }
    if (c.x < lo || c.x > hi) {
      const side = c.x > hi ? 1 : -1;
      c.x = clamp(c.x, lo, hi);
      if (Math.sign(c.ang) === side) c.ang *= -0.25;
      c.v *= 0.985;
      if (tr.onBridge(c.s)) {
        this.fx.sparks(this.wpos(c.s + 1, c.x + side * 1, 0.6), 2);
        if (Math.random() < 0.1) sfx.hit();
      }
    }
    // подсказки: развилка и трамплин впереди
    const fk = tr.forkAt(c.s + 120);
    if (fk && this.warnedFork !== fk) {
      this.warnedFork = fk;
      this.notice(fk.side > 0 ? 'Развилка: держись ПРАВЕЕ ➜' : '⬅ Развилка: держись ЛЕВЕЕ', 3.5);
      sfx.alarm();
    }
    const rp = tr.ramps.find((r) => r.s - c.s > 0 && r.s - c.s < 90);
    if (rp && this.warnedRamp !== rp) {
      this.warnedRamp = rp;
      this.notice('Трамплин! Разгонись посильнее', 2.5);
    }
    if (off && c.v > 5) {
      c.bumpV += (Math.random() - 0.5) * c.v * 0.05;
      if (Math.random() < 0.5) this.fx.dust(this.wpos(c.s - 2, c.x, 0.3), { x: 0, y: 0.5, z: 0 }, 1, this.biome.ground);
    } else if (c.v > 12 && Math.random() < 0.25) {
      this.fx.dust(this.wpos(c.s - 2.2, c.x + (Math.random() - 0.5) * 1.6, 0.2), { x: 0, y: 0.3, z: 0 }, 0.6, '#9a8a70');
    }

    this.carModel.update(dt, c.v, c.ang / 0.36);
    this.cockpit.update(inp.steer * 0.8 + c.ang);
    this.updateCarTransform(dt);
    this.carCollisions(dt);
    this.updateCarWeapon(dt);
    engineSet(0.2 + (c.v / st.speed) * 0.8, inp.brake ? 0.2 : 0.7);

    // дым при повреждениях
    const hpK = c.hp / c.maxHp;
    if (hpK < 0.45 && Math.random() < (0.45 - hpK) * 1.2) this.fx.smoke(this.carModel.group.localToWorld(this.carModel.hoodPoint.clone()), hpK < 0.2);
    if (hpK < 0.18 && Math.random() < 0.3) this.fx.fire(this.carModel.group.localToWorld(this.carModel.hoodPoint.clone()), { x: 0, y: 2, z: 0 }, 1);

    this.driveCamera(dt);

    // сюжетные точки
    if (this.arcade) {
      if (c.hp <= 0) this.carDestroyed();
      return;
    }
    const S = this.station.s;
    if (!this.stationDone) {
      if (c.s > S - 160 && !this.warned.st) {
        this.warned.st = true;
        this.notice('Впереди заправка — бак почти пуст', 3.5);
        sfx.alarm();
      }
      if (c.s > S - 60) this.enterStation();
    }
    if (c.s > this.track.campS - 130 && !this.warned.camp) {
      this.warned.camp = true;
      this.notice('Лагерь бандитов! Мины на дороге!', 3.5, 'bad');
      sfx.alarm();
    }
    if (c.s > this.L - 45) this.startArrive();
    if (c.hp <= 0) this.carDestroyed();
  }

  // Простой автопилот (для отладки и записи роликов): объезжает препятствия
  autoSteer() {
    const c = this.car;
    const hw = this.carModel.spec.W / 2;
    let want = 0;
    let block = null;
    for (const o of this.obstacles) {
      if (!o.alive || o.kind === 'crate' || o.kind === 'spikes') continue;
      const ds = o.s - c.s;
      if (ds < 0 || ds > 35) continue;
      if (Math.abs(o.x - c.x) < hw + o.hw + 1.2 && (!block || ds < block.s - c.s)) block = o;
    }
    const bz = this.boss && !this.boss.dead && this.boss.s - c.s > 0 && this.boss.s - c.s < 30 ? this.boss : null;
    if (bz && !block) block = { s: bz.s, x: bz.x, hw: 1.6 };
    if (block) want = block.x > 0 || (block.x === 0 && c.x < 0) ? block.x - block.hw - hw - 1.5 : block.x + block.hw + hw + 1.5;
    else {
      const pk = this.pickups.find((p) => p.alive && p.s - c.s > 8 && p.s - c.s < 40);
      if (pk) want = pk.x;
    }
    const base = this.track.routeX(c.s + 18);
    if (!block && base !== 0) want = base;
    want = clamp(want, base - 5, base + 5);
    this.input.steer = clamp((want - c.x) * 0.5, -1, 1);
    this.input.fire = true;
    if (c.hp < c.maxHp * 0.35) this.useRepair();
  }

  updateCarTransform(dt) {
    const c = this.car;
    const tr = this.track;
    tr.frame(c.s, _fr);
    const g = this.carModel.group;
    const gy = tr.height(c.s, c.x);
    const G = 22;
    if (this.state === 'drive' && dt > 0) {
      if (c.air) {
        c.vy -= G * dt;
        c.y += c.vy * dt;
        c.airT += dt;
        if (c.y <= gy) this.land(gy);
      } else {
        const pred = c.y + (c.gvy || 0) * dt - 0.5 * G * dt * dt;
        if ((c.gvy || 0) > 2 && c.v > 6 && gy < pred - 0.05) {
          // земля ушла из-под колёс — летим
          c.air = true;
          c.airT = 0;
          c.vy = c.gvy - G * dt;
          c.y = pred;
        } else {
          // скорость земли по вертикали (не больше, чем даёт уклон трамплина)
          const cap = Math.max(1, c.v * 0.35);
          c.gvy = Math.abs(gy - c.y) > 2 ? 0 : clamp((gy - c.y) / dt, -cap, cap);
          c.y = gy;
        }
      }
    } else {
      c.air = false;
      c.gvy = 0;
      c.y = gy;
    }
    const y = c.y;
    this.wpos(c.s, c.x, 0, g.position);
    g.position.y = y;
    const yaw = _fr.yaw - c.ang - (c.drift || 0);
    c.yaw = yaw;
    g.rotation.set(0, yaw, 0);
    // подвеска
    c.bumpV += (-c.bump * 60 - c.bumpV * 8) * dt;
    c.bump += c.bumpV * dt;
    const b = this.carModel.body;
    b.position.y = c.bump * 0.5;
    if (c.air) c.pitch = damp(c.pitch, -Math.atan2(c.vy, Math.max(8, c.v)) * 0.6, 3, dt);
    else c.pitch = damp(c.pitch, -Math.atan(_fr.slope) + c.bump * 0.3, 6, dt);
    c.roll = damp(c.roll, -c.ang * c.v * 0.012, 5, dt);
    b.rotation.set(c.pitch, 0, c.roll);
  }

  // Приземление после прыжка
  land(gy) {
    const c = this.car;
    const impact = -c.vy;
    c.air = false;
    c.y = gy;
    c.vy = 0;
    c.gvy = 0;
    if (impact > 4) {
      c.bumpV -= Math.min(9, impact * 0.55);
      this.shake = Math.max(this.shake, Math.min(0.7, impact * 0.045));
      sfx.landing();
      for (let i = 0; i < 6; i++) this.fx.dust(this.wpos(c.s + (Math.random() - 0.5) * 3, c.x + (Math.random() - 0.5) * 2, 0.2), { x: (Math.random() - 0.5) * 3, y: 1.2, z: 0 }, 1.2, '#b8b0a0');
      if (impact > 14) this.damageCar((impact - 14) * 2.5, true);
    }
    if (c.airT > 0.45) {
      // награда за прыжок
      const bonus = Math.round(20 + c.airT * 40);
      this.stats.cash += bonus;
      this.stats.jumps = (this.stats.jumps || 0) + 1;
      this.notice(`Прыжок! +${bonus}`, 1.6);
      sfx.coin();
    }
  }

  driveCamera(dt) {
    const g = this.carModel.group;
    const c = this.car;
    const cockpitMode = this.camMode === 'cockpit';
    this.cockpit.visible = cockpitMode;
    if (cockpitMode) {
      const eye = this.carModel.body.localToWorld(this.cockpit.eye.clone());
      const look = this.carModel.body.localToWorld(this.cockpit.eye.clone().add(new THREE.Vector3(-c.ang * 6, -0.9, 12)));
      this.setCam(eye, look, 74);
      // в кабине камера жёстко привязана к машине
      if (this.camBlend >= 1) {
        this.camera.position.copy(eye);
        this.camera.lookAt(look);
      }
    } else {
      const fwd = new THREE.Vector3(Math.sin(c.yaw), 0, Math.cos(c.yaw));
      const pos = g.position.clone().addScaledVector(fwd, -8.6).add(new THREE.Vector3(0, 3.7, 0));
      const look = g.position.clone().addScaledVector(fwd, 7).add(new THREE.Vector3(0, 1.2, 0));
      if (!this._chase) this._chase = { pos: pos.clone(), look: look.clone() };
      this._chase.pos.lerp(pos, 1 - Math.exp(-8 * dt));
      this._chase.look.lerp(look, 1 - Math.exp(-10 * dt));
      this.setCam(this._chase.pos, this._chase.look, 62);
    }
    followSun(this.lights, g.position);
  }

  toggleCamera() {
    this.camMode = this.camMode === 'cockpit' ? 'chase' : 'cockpit';
    this._chase = null;
    this.snapCamera = true;
    return this.camMode;
  }

  damageCar(n, silent = false) {
    const c = this.car;
    if (this.state !== 'drive' && this.state !== 'stationIn' && this.state !== 'stationOut') return;
    c.hp = Math.max(0, c.hp - n);
    this.shake = Math.min(1.5, this.shake + n * 0.04);
    if (!silent) this.o.onEvent?.('hurt');
  }

  carCollisions(dt) {
    const c = this.car;
    const spec = this.carModel.spec;
    const hl = spec.L / 2;
    const hw = spec.W / 2;
    const st = this.o.stats;
    // высоко в прыжке машина пролетает над зомби и препятствиями
    const hAir = c.air ? c.y - this.track.height(c.s, c.x) : 0;
    if (hAir > 1.0) {
      for (const p of this.pickups) {
        if (!p.alive || Math.abs(p.s - c.s) > hl + 1.2 || Math.abs(p.x - c.x) > hw + 1.2) continue;
        if (Math.abs((p.dy || 0) - hAir) < 2.4) this.collect(p);
      }
      return;
    }
    // зомби и бандиты
    let latched = 0;
    for (const z of this.zombies) if (z.latch && !z.dead) latched++;
    for (const z of this.zombies) {
      if (z.dead || z.latch || (z.station && this.state === 'foot')) continue;
      const ds = z.s - c.s;
      const dx = z.x - c.x;
      const r = 0.35 * z.sc;
      if (Math.abs(ds) > hl + r || Math.abs(dx) > hw + r) continue;
      const frontal = ds > hl - 0.7;
      const ram = st.ram * (c.v / 18);
      if (z.boss) {
        // удар о босса: машину отбрасывает, босс получает часть урона
        if (this.t - (z.hitT || -9) > 0.8) {
          z.hitT = this.t;
          this.hurtZombie(z, ram * 2, null, 'car');
          this.damageCar((z.mode === 'charge' ? 1.4 : 0.5) * z.dmg * (1 - st.armor * 0.5));
          sfx.crash();
          this.fx.blood(this.entityPos(z, _v2), null, 2);
          c.v = -4;
          c.s -= 1.5;
          c.bumpV += 6;
          z.stun = 2;
          z.mode = 'recover';
          z.modeT = 2.2;
        }
        c.s = Math.min(c.s, z.s - hl - r - 0.1);
        continue;
      }
      if (z.T.crawl && c.v > 2) {
        this.killZombie(z, { s: c.v * 0.3, x: 0, y: 1 }, 'car');
        c.bumpV += 2;
        continue;
      }
      if (frontal && c.v > 5) {
        if (ram * 3 >= z.hp || (z.type !== 'brute' && z.type !== 'armored')) {
          this.killZombie(z, { s: c.v * 0.9 + 4, x: (dx >= 0 ? 0.5 : -0.5) * c.v * 0.4, y: 4 + c.v * 0.25 }, 'car');
          this.damageCar(Math.max(0.5, z.T.mass * 3 * (1 - st.armor)), true);
          c.v *= 1 - 0.035 * z.T.mass;
          c.bumpV += 1.5 * z.T.mass;
          sfx.splat();
          if (st.spikes) this.fx.sparks(this.wpos(z.s, z.x, 0.5), 3);
        } else {
          // крепкий зомби выдержал удар
          this.hurtZombie(z, ram * 3, null, 'car');
          z.s += 2.5;
          z.stun = 1;
          c.v *= 0.55;
          this.damageCar(12 * (1 - st.armor));
          sfx.crash();
        }
      } else if (latched < 4 && z.type !== 'bandit' && z.type !== 'brute' && (c.v < 16 || z.T.speed > 3)) {
        // зомби цепляется за машину сбоку и рвёт её
        z.latch = { side: Math.sign(dx) || 1, off: clamp(ds, -hl * 0.6, hl * 0.6), grip: z.type === 'butcher' ? 999 : 1.6 };
        latched++;
        z.atkT = 0.6;
        if (!this.warned.latch || this.t - this.warned.latch > 8) {
          this.warned.latch = this.t;
          this.notice('Зомби вцепился! Виляй рулём!', 2.2, 'bad');
        }
        sfx.groan();
      } else if (c.v > 5) {
        this.killZombie(z, { s: c.v * 0.5, x: Math.sign(dx) * 4, y: 3 }, 'car');
        sfx.splat();
      }
    }
    // препятствия
    for (const o of this.obstacles) {
      if (!o.alive) continue;
      const ds = o.s - c.s;
      const dx = o.x - c.x;
      if (Math.abs(ds) > hl + o.hl || Math.abs(dx) > hw + o.hw) continue;
      switch (o.kind) {
        case 'wreck':
        case 'block': {
          const push = dx >= 0 ? -1 : 1;
          if (this.t - (o.hitT || -9) > 0.7) {
            o.hitT = this.t;
            const dmg = Math.max(3, c.v * 1.4) * (1 - st.armor);
            this.damageCar(dmg);
            sfx.crash();
            this.fx.sparks(this.wpos(c.s + hl, c.x, 0.7), 10);
            c.v *= 0.3;
            c.bumpV += 3;
            this.shakeOffAll(8);
          } else c.v = Math.min(c.v, 3);
          // выталкиваем назад и в сторону, чтобы машина соскальзывала с препятствия
          if (Math.abs(ds) > hl + o.hl - 0.8) {
            c.s = o.s - (hl + o.hl) - 0.05;
            c.x += push * 0.35;
          } else c.x = o.x + push * (hw + o.hw + 0.05);
          break;
        }
        case 'crate':
          this.breakCrate(o);
          c.v *= 0.93;
          break;
        case 'barrel':
          this.explode(o.s, o.x, 5.5, 110, 'barrel');
          this.removeObstacle(o);
          break;
        case 'mine':
          this.explode(o.s, o.x, 4.5, 60, 'mine');
          this.removeObstacle(o);
          c.bumpV += 8;
          break;
        case 'spikes':
          if (!o.hit) {
            o.hit = true;
            if (!st.spikes) {
              this.damageCar(10);
              c.slowT = 4;
              this.notice('Шины пробиты!', 2, 'bad');
            }
            sfx.crash();
            this.fx.sparks(this.wpos(o.s, c.x, 0.3), 12);
          }
          break;
        default:
          break;
      }
    }
    // подбор
    for (const p of this.pickups) {
      if (!p.alive) continue;
      const ds = p.s - c.s;
      const dx = p.x - c.x;
      if (Math.abs(ds) < hl + 1.2 && Math.abs(dx) < hw + 1.2 && (p.dy || 0) - hAir < 2.2) this.collect(p);
    }
    // турели не таранятся, но их можно объехать
    void dt;
  }

  cargo() {
    return this.stats.wood + this.stats.metal + this.stats.cloth + this.stats.ammo;
  }

  collect(p) {
    const k = p.kind;
    if (RES_KINDS.includes(k) && this.cargo() >= this.o.stats.trunk) {
      this.notice('Багажник полон!', 1.5, 'bad');
      if (k !== 'ammo') return;
    }
    p.alive = false;
    this.scene.remove(p.mesh);
    const pos = this.wpos(p.s, p.x, 1);
    this.fx.pickup(pos, PICKUP_COLORS[k]);
    switch (k) {
      case 'cash': {
        const n = 15 + this.dest * 5;
        this.stats.cash += n;
        sfx.coin();
        break;
      }
      case 'wood':
      case 'metal':
      case 'cloth':
        this.stats[k] += 1 + (this.rng.chance(0.3) ? 1 : 0);
        sfx.pickup();
        if (k === 'metal') {
          const heal = Math.round(this.car.maxHp * 0.03);
          this.car.hp = Math.min(this.car.maxHp, this.car.hp + heal);
        }
        break;
      case 'ammo':
        if (this.cargo() < this.o.stats.trunk) this.stats.ammo += 1;
        this.wpn.reserve += this.wpn.def.mag;
        this.notice('+1 магазин', 1.2);
        sfx.reload();
        break;
      case 'fuel':
        this.car.fuel = Math.min(this.car.maxFuel, this.car.fuel + this.car.maxFuel * 0.25);
        this.notice('+25% топлива', 1.2);
        sfx.pickup();
        break;
      case 'repair':
        this.car.hp = Math.min(this.car.maxHp, this.car.hp + this.car.maxHp * 0.2);
        this.notice('Ремонт +20%', 1.2);
        sfx.pickup();
        break;
      default:
        break;
    }
  }

  breakCrate(o) {
    if (!o.alive) return;
    this.removeObstacle(o);
    this.stats.crates++;
    const pos = this.wpos(o.s, o.x, 0.5);
    this.fx.emit({ pos, count: 14, spread: 4, up: 4, color: '#a07840', color2: '#6a4a28', life: [0.5, 1], size: [0.15, 0.3], gravity: 12 });
    sfx.hit();
    const n = this.rng.i(1, 2);
    for (let i = 0; i < n; i++) this.addPickup(o.s + 2 + i * 1.5, clamp(o.x + this.rng.f(-1, 1), -11, 11), this.rng.pick(['wood', 'metal', 'cloth', 'cash', 'ammo', 'wood']));
  }

  removeObstacle(o) {
    o.alive = false;
    this.scene.remove(o.mesh);
  }

  // ------------------------------ оружие машины ------------------------------

  findTarget(fromS, fromX, range, yaw, cone, preferFoot = false) {
    let best = null;
    let bestScore = Infinity;
    const consider = (e, s, x, bias) => {
      const ds = s - fromS;
      const dx = x - fromX;
      const d = Math.hypot(ds, dx);
      if (d > range || d < 0.5) return;
      const a = Math.atan2(dx, ds);
      if (cone < Math.PI && Math.abs(angleDiff(yaw, a)) > cone) return;
      const score = d + bias;
      if (score < bestScore) {
        bestScore = score;
        best = e;
      }
    };
    for (const z of this.zombies) if (!z.dead) consider(z, z.s, z.x, z.latch ? -25 : z.boss ? -8 : z.type === 'bandit' && !preferFoot ? -6 : 0);
    for (const t of this.turrets) if (!t.dead) consider(t, t.s, t.x, -4);
    for (const o of this.obstacles) if (o.alive && (o.kind === 'barrel' || o.kind === 'crate' || o.kind === 'mine')) consider(o, o.s, o.x, o.kind === 'barrel' ? 6 : 14);
    return best;
  }

  entityPos(e, out = new THREE.Vector3()) {
    if (e.T) return this.wpos(e.s, e.x, (e.T.crawl ? 0.35 : 1.1) * e.sc + (e.y || 0), out);
    if (e.w) return this.wpos(e.s, e.x, 1.5, out);
    return this.wpos(e.s, e.x, 0.5, out);
  }


  damageEntity(e, dmg, dir, src = 'gun') {
    if (e.T) {
      this.hurtZombie(e, dmg, dir, src);
    } else if (e.w) {
      e.hp -= dmg;
      this.fx.sparks(this.entityPos(e), 3);
      if (e.hp <= 0 && !e.dead) {
        e.dead = true;
        this.explode(e.s, e.x, 4, 40, 'turret');
        e.mesh.rotation.z = 1.2;
        e.mesh.position.y -= 0.6;
        this.notice('Турель уничтожена!', 1.5);
      }
    } else if (e.kind === 'barrel') {
      e.hp -= dmg;
      if (e.hp <= 0 && e.alive) {
        this.removeObstacle(e);
        this.explode(e.s, e.x, 5.5, 110, 'barrel');
      }
    } else if (e.kind === 'crate') {
      e.hp -= dmg;
      if (e.hp <= 0) this.breakCrate(e);
    } else if (e.kind === 'mine') {
      if (e.alive) {
        this.removeObstacle(e);
        this.explode(e.s, e.x, 4.5, 60, 'mine');
      }
    }
  }

  updateCarWeapon(dt) {
    const w = this.wpn;
    const d = w.def;
    const c = this.car;
    const model = this.carModel;
    w.cd -= dt;
    if (w.reload > 0) {
      w.reload -= dt;
      if (w.reload <= 0) {
        const n = Math.min(d.mag, w.reserve);
        w.mag = n;
        w.reserve -= n;
      }
    }
    // цель
    const aimYaw = c.ang * -0 + 0;
    w.target = this.findTarget(c.s + 1, c.x, d.range, aimYaw - c.ang * 0, 1.0);
    if (w.target && (w.target.dead || w.target.alive === false)) w.target = null;
    // поворот турели
    const piv = model.weapon?.pivot;
    let desired = 0;
    if (w.target) {
      const tp = this.entityPos(w.target, _v2);
      const local = model.body.worldToLocal(tp.clone());
      desired = Math.atan2(local.x, local.z);
    }
    w.yaw = damp(w.yaw, desired, 10, dt);
    if (piv) piv.rotation.y = w.yaw;
    if (model.weapon?.spin) model.spinRate = this.input.fire || d.auto ? 30 : damp(model.spinRate || 0, 0, 2, dt);

    const wantFire = (this.input.fire || d.auto || this.o.settings.autofire) && (this.input.fire || w.target);
    if (!wantFire || w.reload > 0) {
      if (d.kind === 'flame') w.flameT = 0;
      return;
    }
    if (w.mag <= 0) {
      if (w.reserve > 0) {
        w.reload = d.kind === 'bullet' ? 1.6 : 2.0;
        sfx.reload();
      } else if (!this.warned.ammo) {
        this.warned.ammo = true;
        this.notice('Патроны кончились!', 2, 'bad');
      }
      return;
    }
    if (w.cd > 0) return;
    w.cd = 1 / d.rate;
    w.mag--;
    const muzzle = model.weapon ? model.weapon.muzzle.getWorldPosition(new THREE.Vector3()) : model.group.position.clone().add(new THREE.Vector3(0, 2, 0));
    const fwd = new THREE.Vector3(Math.sin(c.yaw + w.yaw), 0, Math.cos(c.yaw + w.yaw));
    const tgt = w.target;
    const tpos = tgt ? this.entityPos(tgt, new THREE.Vector3()) : muzzle.clone().addScaledVector(fwd, d.range * 0.8).setY(muzzle.y - 1);
    this.fireWeapon(d, muzzle, tpos, tgt, fwd, true);
  }

  fireWeapon(d, muzzle, tpos, tgt, fwd, fromCar) {
    const kind = d.kind;
    const dist = muzzle.distanceTo(tpos);
    switch (kind) {
      case 'bullet': {
        this.fx.muzzle(muzzle, fwd, 1);
        sfx.shot('bullet');
        const miss = Math.random() < d.spread * dist * 0.12;
        const end = tpos.clone();
        if (miss || !tgt) end.add(new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5), (Math.random() - 0.5) * 2));
        this.fx.tracer(muzzle, end, d.pierce ? '#ffb040' : '#ffe08a', 0.07);
        if (tgt && !miss) {
          this.damageEntity(tgt, d.dmg, fwd);
          if (d.pierce) this.pierceLine(muzzle, tpos, d.dmg * 0.8, d.pierce, tgt);
        } else if (!tgt) this.fx.dust(end, { x: 0, y: 1, z: 0 }, 0.5, '#8a7a60');
        break;
      }
      case 'flame': {
        const v = fwd.clone().multiplyScalar(16);
        v.y = 1;
        this.fx.fire(muzzle, { x: v.x, y: v.y, z: v.z }, 4);
        if (Math.random() < 0.3) sfx.shot('flame');
        // урон по конусу
        const c = this.car;
        const yaw = Math.atan2(fwd.x, fwd.z) - this.track.frame(c.s, _fr).yaw;
        for (const z of this.zombies) {
          if (z.dead) continue;
          const ds = z.s - c.s;
          const dx = z.x - c.x;
          const dd = Math.hypot(ds, dx);
          if (dd > d.range) continue;
          if (Math.abs(angleDiff(-yaw, Math.atan2(dx, ds))) > 0.4) continue;
          z.burn = 2.5;
          this.hurtZombie(z, d.dmg, fwd, 'fire');
        }
        for (const o of this.obstacles) if (o.alive && o.kind === 'barrel' && Math.hypot(o.s - c.s, o.x - c.x) < d.range) this.damageEntity(o, d.dmg);
        break;
      }
      case 'shock': {
        sfx.shot('shock');
        if (!tgt) {
          this.lightning(muzzle, tpos);
          break;
        }
        let from = muzzle;
        let cur = tgt;
        const hit = new Set();
        for (let i = 0; i < (d.chain || 3) && cur; i++) {
          const p = this.entityPos(cur, new THREE.Vector3());
          this.lightning(from, p);
          this.damageEntity(cur, d.dmg * (1 - i * 0.12), fwd, 'shock');
          if (cur.T) cur.stun = 1.2;
          hit.add(cur);
          from = p;
          let next = null;
          let bd = 7;
          for (const z of this.zombies) {
            if (z.dead || hit.has(z)) continue;
            const dd = Math.hypot(z.s - cur.s, z.x - cur.x);
            if (dd < bd) {
              bd = dd;
              next = z;
            }
          }
          cur = next;
        }
        break;
      }
      case 'laser': {
        sfx.shot('laser');
        const end = muzzle.clone().add(tpos.clone().sub(muzzle).normalize().multiplyScalar(d.range));
        this.fx.tracer(muzzle, end, '#5ab8ff', 0.18);
        this.fx.tracer(muzzle.clone().add(new THREE.Vector3(0, 0.03, 0)), end, '#c8ecff', 0.12);
        this.fx.emit({ pos: muzzle, count: 4, spread: 0.5, color: '#9ad8ff', color2: '#3a8aff', life: [0.1, 0.2], size: [0.4, 0.7], glow: true });
        this.pierceLine(muzzle, end, d.dmg, 99, null);
        break;
      }
      case 'cannon': {
        this.fx.muzzle(muzzle, fwd, 3);
        this.fx.emit({ pos: muzzle, count: 6, spread: 1, color: '#6a6660', color2: '#3a3836', life: [0.5, 1], size: [0.6, 1.2], grow: 1.5, alpha: 0.6 });
        sfx.shot('cannon');
        this.fx.tracer(muzzle, tpos, '#ffd070', 0.1);
        this.shake += fromCar ? 0.25 : 0.1;
        const pr = this.track.project(tpos.x, tpos.z, tgt ? tgt.s : this.car.s + 30);
        this.explode(pr.s, pr.x, d.splash || 2.5, d.dmg, 'cannon', true);
        if (tgt) this.damageEntity(tgt, d.dmg * 0.5, fwd);
        break;
      }
      case 'rocket':
      case 'grenade':
      case 'mortar':
      case 'mine': {
        sfx.shot(kind);
        this.fx.muzzle(muzzle, fwd, 1.5);
        const pr = tgt ? { s: tgt.s, x: tgt.x } : this.track.project(tpos.x, tpos.z, this.car.s + 20);
        if (kind === 'mine') {
          pr.s = this.car.s + this.rng.f(14, 22);
          pr.x = tgt ? tgt.x : this.car.x + this.rng.f(-3, 3);
        }
        // упреждение для машины: цель к моменту попадания окажется ближе
        const flight = kind === 'rocket' ? dist / 45 : kind === 'grenade' ? 0.75 : kind === 'mortar' ? 1.25 : 0.7;
        const mesh = projectileMesh(kind === 'mine' ? 'mine' : kind === 'rocket' ? 'rocket' : 'grenade');
        mesh.position.copy(muzzle);
        this.scene.add(mesh);
        this.projectiles.push({
          kind,
          mesh,
          from: muzzle.clone(),
          ts: pr.s,
          tx: pr.x,
          t: 0,
          T: flight,
          arc: kind === 'rocket' ? 0.5 : kind === 'mortar' ? 14 : kind === 'mine' ? 3 : 5,
          dmg: d.dmg,
          splash: d.splash || 4,
          owner: fromCar ? 'car' : 'player',
        });
        break;
      }
      default:
        break;
    }
  }

  lightning(a, b) {
    const n = 5;
    let prev = a.clone();
    for (let i = 1; i <= n; i++) {
      const p = a.clone().lerp(b, i / n);
      if (i < n) p.add(new THREE.Vector3((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8));
      this.fx.tracer(prev, p, '#8ad0ff', 0.15);
      prev = p;
    }
    this.fx.emit({ pos: b, count: 6, spread: 2, color: '#bfe6ff', color2: '#3a8aff', life: [0.1, 0.3], size: [0.15, 0.3], glow: true });
  }

  // Урон всем, кто на линии выстрела
  pierceLine(a, b, dmg, max, skip) {
    const pa = this.track.project(a.x, a.z, this.car.s);
    const pb = this.track.project(b.x, b.z, pa.s + 30);
    const ls = pb.s - pa.s;
    const lx = pb.x - pa.x;
    const len2 = ls * ls + lx * lx || 1;
    let n = 0;
    for (const z of this.zombies) {
      if (z.dead || z === skip) continue;
      const t = ((z.s - pa.s) * ls + (z.x - pa.x) * lx) / len2;
      if (t < 0 || t > 1) continue;
      const d = Math.hypot(pa.s + ls * t - z.s, pa.x + lx * t - z.x);
      if (d < 0.9 * z.T.scale) {
        this.hurtZombie(z, dmg, null);
        if (++n >= max) break;
      }
    }
  }

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.t += dt / p.T;
      const k = Math.min(1, p.t);
      const to = this.wpos(p.ts, p.tx, p.kind === 'mine' ? 0.05 : 0.3, _v2);
      const pos = p.from.clone().lerp(to, k);
      pos.y += Math.sin(k * Math.PI) * p.arc;
      const prev = p.mesh.position.clone();
      p.mesh.position.copy(pos);
      if (pos.distanceToSquared(prev) > 1e-6) p.mesh.lookAt(pos.clone().add(pos.clone().sub(prev)));
      if (p.kind === 'rocket') this.fx.fire(pos, { x: 0, y: 0, z: 0 }, 1);
      if (p.kind === 'rocket' || p.kind === 'mortar') this.fx.smoke(pos);
      if (k >= 1) {
        this.projectiles.splice(i, 1);
        if (p.kind === 'mine') {
          p.mesh.position.copy(to);
          p.mesh.rotation.set(0, 0, 0);
          this.myMines.push({ s: p.ts, x: p.tx, mesh: p.mesh, t: 14, dmg: p.dmg, splash: p.splash });
        } else {
          this.scene.remove(p.mesh);
          this.explode(p.ts, p.tx, p.splash, p.dmg, p.owner, true);
        }
      }
    }
    // мины игрока
    for (let i = this.myMines.length - 1; i >= 0; i--) {
      const m = this.myMines[i];
      m.t -= dt;
      let boom = m.t <= 0;
      if (!boom) {
        for (const z of this.zombies) {
          if (!z.dead && Math.hypot(z.s - m.s, z.x - m.x) < 2.2) {
            boom = true;
            break;
          }
        }
      }
      if (boom) {
        this.scene.remove(m.mesh);
        this.myMines.splice(i, 1);
        this.explode(m.s, m.x, m.splash, m.dmg, 'car', true);
      }
    }
  }

  // Взрыв: friendly — не ранит свою машину и игрока
  explode(s, x, radius, dmg, src, friendly = false) {
    const pos = this.wpos(s, x, 0.8, new THREE.Vector3());
    this.fx.explosion(pos, radius > 5 ? 1.4 : 1);
    sfx.explosion(radius > 5 ? 1.3 : 1);
    for (const z of this.zombies) {
      if (z.dead) continue;
      const d = Math.hypot(z.s - s, z.x - x);
      if (d > radius) continue;
      const k = 1 - (d / radius) * 0.6;
      const dir = { s: (z.s - s) / (d || 1), x: (z.x - x) / (d || 1) };
      this.hurtZombie(z, dmg * k, null, 'explosion', { s: dir.s * 9 * k, x: dir.x * 9 * k, y: 7 * k });
    }
    for (const t of this.turrets) if (!t.dead && Math.hypot(t.s - s, t.x - x) < radius) this.damageEntity(t, dmg * 0.8);
    for (const o of this.obstacles) {
      if (!o.alive) continue;
      const d = Math.hypot(o.s - s, o.x - x);
      if (d < radius && (o.kind === 'barrel' || o.kind === 'crate' || o.kind === 'mine')) {
        // цепная реакция с небольшой задержкой
        setTimeout(() => this.damageEntity(o, 999), 80 + d * 30);
      }
    }
    // машина
    const c = this.car;
    const dc = this.player ? 99 : Math.hypot(c.s - s, c.x - x);
    if (!friendly && dc < radius + 1.5) {
      this.damageCar(dmg * 0.3 * (1 - dc / (radius + 1.5)) * (1 - this.o.stats.armor * 0.5));
      c.bumpV += 5;
    }
    this.shake += Math.max(0, 1 - dc / 30) * 0.8;
    if (this.player && !friendly) {
      const dp = Math.hypot(this.player.s - s, this.player.x - x);
      if (dp < radius) this.hurtPlayer(dmg * 0.4 * (1 - dp / radius));
    }
  }

  // ------------------------------ зомби ------------------------------

  hurtZombie(z, dmg, dir, src = 'gun', knock = null) {
    if (z.dead) return;
    // броня гасит пули, но не взрывы, огонь и таран
    if (z.T.armor && (src === 'gun' || src === 'shock' || src === 'melee')) {
      dmg *= 1 - z.T.armor;
      if (Math.random() < 0.5) this.fx.sparks(this.entityPos(z, _v2).add(new THREE.Vector3(0, 0.5 * z.sc, 0)), 2);
    }
    z.hp -= dmg;
    this.humans.hit(z.slot);
    const p = this.entityPos(z, new THREE.Vector3());
    this.fx.blood(p, dir, src === 'explosion' ? 2 : 0.6, !!z.T.toxic);
    if (z.hp <= 0) {
      const v = knock || (dir ? { s: 2, x: 0, y: 2 } : { s: 1, x: 0, y: 2 });
      this.killZombie(z, v, src);
    } else if (z.state === 'idle') z.state = 'chase';
  }

  // Сбросить всех, кто вцепился в машину
  shakeOffAll(force = 6) {
    const c = this.car;
    for (const z of this.zombies) {
      if (!z.latch || z.dead) continue;
      const side = z.latch.side;
      z.latch = null;
      if (c.v > 9) this.killZombie(z, { s: c.v * 0.4, x: side * force, y: 3 }, 'car');
      else {
        z.x = c.x + side * (this.carModel.spec.W / 2 + 1.2);
        z.stun = 1.5;
        this.hurtZombie(z, 20, null, 'car');
      }
    }
  }

  killZombie(z, vel, src) {
    if (z.dead) return;
    z.latch = null;
    z.dead = { vs: vel.s || 0, vx: vel.x || 0, vy: vel.y || 0, rx: 0, spin: (vel.s || 0) * 0.6 + 2, t: 0, lie: Math.random() < 0.5 ? -1 : 1 };
    z.hp = 0;
    if (z.type === 'bandit') {
      this.stats.bandits++;
    } else {
      this.stats.kills++;
      if (z.type === 'brute') this.stats.brutes++;
      if (this.player) this.stats.footKills++;
    }
    this.stats.cash += z.boss ? 0 : z.type === 'brute' || z.type === 'armored' ? 20 : z.type === 'bandit' ? 25 : 5;
    const p = this.entityPos(z, new THREE.Vector3());
    this.fx.blood(p, null, src === 'car' ? 2.5 : 1.5, !!z.T.toxic);
    if (z.T.toxic) {
      this.fx.emit({ pos: p, count: 16, spread: 2.5, up: 1, color: '#9aff3a', color2: '#3a6a10', life: [0.8, 1.6], size: [0.8, 1.6], grow: 1.5, alpha: 0.5 });
      if (this.player && Math.hypot(this.player.s - z.s, this.player.x - z.x) < 3) this.poisonPlayer(6);
    }
    if (z.T.explode && !z.exploded) {
      z.exploded = true;
      this.explode(z.s, z.x, 4.5, 55 * this.params.dmgMul, 'exploder');
    }
    if (z.boss) {
      this.stats.bosses = (this.stats.bosses || 0) + 1;
      this.bossKilled = true;
      this.fx.explosion(p, 1.2);
      this.fx.blood(p, null, 6, !!z.T.toxic);
      sfx.explosion(1.2);
      sfx.win();
      this.notice(`${z.T.name} повержен!`, 3);
      for (let i = 0; i < 8; i++) this.addPickup(z.s + this.rng.f(-3, 5), clamp(z.x + this.rng.f(-4, 4), -6, 6), this.rng.pick(['cash', 'cash', 'metal', 'repair', 'ammo', 'wood']));
      if (this.boss === z) this.boss = null;
    }
    if (src === 'car') sfx.splat();
    this.o.onEvent?.('kill', z);
  }

  // Кислотный плевок: летит по дуге и разбрызгивается
  spit(z, count = 1) {
    const c = this.car;
    const pl = this.player;
    for (let i = 0; i < count; i++) {
      const from = this.entityPos(z, new THREE.Vector3()).add(new THREE.Vector3(0, 0.6 * z.sc, 0));
      let ts;
      let tx;
      if (pl) {
        ts = pl.s + this.rng.f(-1, 1) * (i ? 2 : 0.5);
        tx = pl.x + this.rng.f(-1, 1) * (i ? 2 : 0.5);
      } else {
        const lead = Math.min(18, c.v * 0.9);
        ts = c.s + lead + this.rng.f(-1.5, 1.5) + i * 2;
        tx = c.x + this.rng.f(-1, 1) * (i ? 2 : 0.6);
      }
      const mesh = new THREE.Mesh(this.acidGeo ||= new THREE.IcosahedronGeometry(0.22, 1), this.acidMat ||= new THREE.MeshBasicMaterial({ color: 0x9aff3a }));
      mesh.position.copy(from);
      this.scene.add(mesh);
      this.acid.push({ mesh, from, ts, tx, t: 0, T: 0.9, dmg: 6 * this.params.dmgMul });
    }
    sfx.splat();
  }

  updateAcid(dt) {
    const c = this.car;
    for (let i = this.acid.length - 1; i >= 0; i--) {
      const a = this.acid[i];
      a.t += dt / a.T;
      const k = Math.min(1, a.t);
      const to = this.wpos(a.ts, a.tx, 0.4, _v2);
      a.mesh.position.copy(a.from).lerp(to, k);
      a.mesh.position.y += Math.sin(k * Math.PI) * 3;
      if (Math.random() < 0.5) this.fx.emit({ pos: a.mesh.position, count: 1, spread: 0.2, color: '#b8ff5a', color2: '#3a6a10', life: [0.2, 0.4], size: [0.15, 0.3] });
      if (k >= 1) {
        this.scene.remove(a.mesh);
        this.acid.splice(i, 1);
        this.fx.emit({ pos: to, count: 18, spread: 2.5, up: 2, color: '#b8ff5a', color2: '#2a5a10', life: [0.4, 0.9], size: [0.2, 0.5], gravity: 8 });
        const pl = this.player;
        if (pl) {
          if (Math.hypot(pl.s - a.ts, pl.x - a.tx) < 1.8) {
            this.hurtPlayer(a.dmg * 1.3);
            this.poisonPlayer(6);
          }
        } else if (Math.abs(c.s - a.ts) < this.carModel.spec.L / 2 + 1 && Math.abs(c.x - a.tx) < this.carModel.spec.W / 2 + 1) {
          this.damageCar(a.dmg * (1 - this.o.stats.armor * 0.4));
          this.fx.smoke(to, false);
        }
      }
    }
  }

  updateZombies(dt) {
    const c = this.car;
    const pl = this.player;
    const tS = pl ? pl.s : c.s;
    const tX = pl ? pl.x : c.x;
    const humans = this.humans;
    const tr = this.track;
    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const z = this.zombies[i];
      const T = z.T;
      const rig = z.slot.rig;
      // выгрузка позади
      if (z.s < tS - 60 && !(z.type === 'bandit' && z.s > tS - 90)) {
        z.gone = true;
        humans.free(z.slot);
        this.zombies.splice(i, 1);
        continue;
      }
      if (z.dead) {
        const d = z.dead;
        d.t += dt;
        if (d.vy !== 0 || z.y > 0) {
          z.s += d.vs * dt;
          z.x += d.vx * dt;
          z.y += d.vy * dt;
          d.vy -= 20 * dt;
          d.rx += d.spin * dt;
          if (z.y <= 0) {
            z.y = 0;
            if (Math.abs(d.vy) > 3) {
              d.vy = -d.vy * 0.25;
              d.vs *= 0.5;
              d.vx *= 0.5;
            } else {
              d.vy = 0;
              d.vs = 0;
              d.vx = 0;
            }
          }
        }
        if (d.vy === 0 && z.y <= 0) {
          const targetRx = (Math.PI / 2) * d.lie;
          d.rx = damp(d.rx % (Math.PI * 2), targetRx, 6, dt);
        }
        if (d.t > 7) z.y -= dt * 0.25;
        if (d.t > 9.5) {
          humans.free(z.slot);
          this.zombies.splice(i, 1);
          continue;
        }
        tr.toWorld(z.s, z.x, rig.root.position);
        rig.root.position.y += z.y + 0.25;
        rig.root.rotation.set(d.rx, z.yaw, 0, 'YXZ');
        rig.root.scale.setScalar(z.sc);
        rig.armL.rotation.set(-2.6, 0, 0.6);
        rig.armR.rotation.set(-2.4, 0, -0.5);
        rig.legL.rotation.set(-0.3, 0, 0.3);
        rig.legR.rotation.set(0.2, 0, -0.3);
        rig.torso.rotation.set(0, 0, 0);
        rig.head.rotation.set(0.3, 0.4, 0);
        humans.sync(z.slot, dt);
        continue;
      }
      // горение
      if (z.burn > 0) {
        z.burn -= dt;
        this.hurtZombie(z, 12 * dt, null, 'fire');
        if (Math.random() < 0.5) this.fx.fire(this.entityPos(z, _v2), { x: 0, y: 2, z: 0 }, 1);
        if (z.dead) continue;
      }
      z.atkT -= dt;
      z.stun = Math.max(0, z.stun - dt);
      // вцепился в машину: держится сбоку и рвёт её, пока его не стряхнут
      if (z.latch) {
        const L2 = z.latch;
        if (this.state !== 'drive' && this.state !== 'stationOut') {
          z.latch = null;
        } else {
          const jerk = Math.abs(c.ang - (this._prevAng ?? c.ang)) / Math.max(dt, 1e-3);
          L2.grip -= jerk * dt * 1.4;
          z.s = c.s + L2.off;
          z.x = c.x + L2.side * (this.carModel.spec.W / 2 + 0.3);
          z.yaw = c.yaw + (L2.side > 0 ? -Math.PI / 2 : Math.PI / 2);
          if (z.atkT <= 0) {
            z.atkT = 1.1;
            this.damageCar(z.dmg * 0.6 * (1 - this.o.stats.armor));
            sfx.hit();
            this.fx.sparks(this.entityPos(z, _v2), 2);
          }
          if (L2.grip <= 0) {
            const side = L2.side;
            z.latch = null;
            if (c.v > 9) this.killZombie(z, { s: c.v * 0.3, x: side * 7, y: 3 }, 'car');
            else z.stun = 1.2;
            continue;
          }
          tr.toWorld(z.s, z.x, rig.root.position);
          rig.root.position.y += 0.25;
          rig.root.rotation.set(0, z.yaw, 0);
          rig.root.scale.setScalar(z.sc);
          poseRig(rig, this.t + z.phase, { phase: z.phase, moving: false, attack: true, zombieArms: true, lean: 0.35 });
          rig.legL.rotation.x = -0.6;
          rig.legR.rotation.x = 0.4;
          humans.sync(z.slot, dt);
          continue;
        }
      }
      const ds = tS - z.s;
      const dx = tX - z.x;
      const dist = Math.hypot(ds, dx);
      let moving = false;
      let spd = 0;
      let dirS = 0;
      let dirX = 0;
      let attack = false;
      let aim = false;
      if (z.type === 'bandit') {
        // бандит: держит позицию и стреляет
        if (dist < 62) {
          aim = true;
          dirS = ds;
          dirX = dx;
          z.shootT -= dt;
          if (z.shootT <= 0 && this.state !== 'arrive') {
            z.shootT = this.rng.f(1.0, 1.8);
            this.enemyShot(z, 1.8 + Math.max(0, this.dest - 2) * 0.45);
          }
        } else if (Math.random() < 0.01) z.wander = this.rng.f(0, 6.28);
      } else {
        const aggro = z.boss ? 120 : T.speed > 3 ? 60 : 45;
        if (z.state === 'idle' && dist < aggro) z.state = 'chase';
        // плевуны и королева плюются кислотой
        if (T.spit && dist < (z.boss ? 36 : 26) && dist > 4 && z.stun <= 0 && this.state !== 'arrive' && this.state !== 'stationIn') {
          z.spitT -= dt;
          if (z.spitT <= 0) {
            z.spitT = z.boss ? 2.4 : this.rng.f(2.8, 3.8);
            this.spit(z, z.boss ? 3 : 1);
          }
        }
        // королева призывает бегунов
        if (z.type === 'queen' && dist < 45) {
          z.summonT -= dt;
          if (z.summonT <= 0) {
            z.summonT = 7;
            for (let k = 0; k < 2; k++) {
              const m = this.spawnZombie({ s: z.s + this.rng.f(-3, 3), x: z.x + this.rng.f(-3, 3), type: 'runner', station: z.station });
              if (m) m.state = 'chase';
            }
            this.fx.emit({ pos: this.entityPos(z, _v2), count: 20, spread: 3, up: 2, color: '#9aff3a', color2: '#3a6a10', life: [0.6, 1.2], size: [0.5, 1], alpha: 0.6 });
          }
        }
        // взрывной подрывается рядом с целью
        if (T.explode && dist < (pl ? 2.2 : this.carModel.spec.W / 2 + 1.6)) {
          this.killZombie(z, { s: 0, x: 0, y: 2 }, 'self');
          continue;
        }
        if (z.stun > 0) {
          moving = false;
        } else if (z.state === 'idle') {
          z.wander += this.rng.f(-0.5, 0.5) * dt;
          dirS = Math.cos(z.wander);
          dirX = Math.sin(z.wander);
          spd = 0.4;
          moving = true;
        } else {
          dirS = ds;
          dirX = dx;
          // впереди машины зомби выходят на её полосу, чтобы перехватить
          if (!pl && ds < 0 && dist > 6) dirX = dx * 3;
          const reach = pl ? 1.0 * z.sc : this.carModel.spec.W / 2 + 0.5;
          spd = T.speed * z.spd;
          // Танк разгоняется и таранит
          if (z.type === 'tank') {
            z.modeT -= dt;
            if (z.mode === 'walk' && dist < 38 && z.modeT <= 0) {
              z.mode = 'charge';
              z.modeT = 2.2;
              z.chargeDir = { s: ds / (dist || 1), x: dx / (dist || 1) };
              sfx.groan();
              this.notice('Танк несётся на тебя!', 1.5, 'bad');
            } else if (z.mode === 'charge') {
              spd = 9 * this.params.speedMul;
              dirS = z.chargeDir.s;
              dirX = z.chargeDir.x;
              this.shake = Math.max(this.shake, 0.25);
              if (z.modeT <= 0) {
                z.mode = 'recover';
                z.modeT = 1.6;
              }
            } else if (z.mode === 'recover') {
              spd = 0;
              if (z.modeT <= 0) {
                z.mode = 'walk';
                z.modeT = 2.5;
              }
            }
          }
          if (dist > reach || z.mode === 'charge') {
            moving = spd > 0;
          } else {
            attack = true;
            if (pl && z.atkT <= 0) {
              z.atkT = z.boss ? 1.4 : 1.1;
              this.hurtPlayer(z.dmg);
              if (T.toxic) this.poisonPlayer(8);
            }
          }
          if (z.type === 'queen' && dist < 16) moving = false;
        }
        z.groanT -= dt;
        if (z.groanT <= 0) {
          z.groanT = this.rng.f(6, 14);
          if (dist < 30) sfx.groan();
        }
      }
      const dl = Math.hypot(dirS, dirX) || 1;
      if (moving && spd > 0) {
        z.s += (dirS / dl) * spd * dt;
        z.x += (dirX / dl) * spd * dt;
        z.phase += dt * spd * 3.2;
        if (!pl) z.x = clamp(z.x, -16, 16);
      } else z.phase += dt * 2;
      // поворот
      tr.frame(z.s, _fr);
      if (dirS || dirX) {
        const wx = _fr.fx * dirS + _fr.rx * dirX;
        const wz = _fr.fz * dirS + _fr.rz * dirX;
        const yaw = Math.atan2(wx, wz);
        z.yaw += angleDiff(z.yaw, yaw) * Math.min(1, dt * 6);
      }
      // расталкивание (на заправке)
      if (pl && this.zombies.length < 60) {
        for (const o of this.zombies) {
          if (o === z || o.dead) continue;
          const a = z.s - o.s;
          const b = z.x - o.x;
          const d2 = a * a + b * b;
          if (d2 < 0.5 && d2 > 1e-4) {
            const d = Math.sqrt(d2);
            z.s += (a / d) * (0.71 - d) * 0.5;
            z.x += (b / d) * (0.71 - d) * 0.5;
          }
        }
        this.stationCollide(z, 0.35);
      }
      // зомби обходят препятствия, а не проходят сквозь них
      for (const o of this.obstacles) {
        if (!o.alive || o.kind === 'mine' || o.kind === 'spikes') continue;
        const ds2 = z.s - o.s;
        const dx2 = z.x - o.x;
        const hs = o.hl + 0.35;
        const hx = o.hw + 0.35;
        if (Math.abs(ds2) < hs && Math.abs(dx2) < hx) {
          if (hx - Math.abs(dx2) < hs - Math.abs(ds2)) z.x = o.x + Math.sign(dx2 || 1) * hx;
          else z.s = o.s + Math.sign(ds2 || 1) * hs;
        }
      }
      tr.toWorld(z.s, z.x, rig.root.position);
      rig.root.rotation.set(0, z.yaw, 0);
      rig.root.scale.setScalar(z.sc);
      poseRig(rig, this.t + z.phase, {
        phase: z.phase,
        moving,
        attack,
        aim,
        zombieArms: z.type !== 'bandit',
        lean: z.type === 'bandit' ? 0.02 : z.mode === 'charge' ? 0.6 : 0.2,
        headZ: z.type === 'bandit' ? 0 : Math.sin(z.phase * 0.3) * 0.2,
      });
      if (T.crawl) {
        // ползёт на руках, волоча ноги
        rig.root.rotation.set(1.3, z.yaw, 0, 'YXZ');
        rig.root.position.y += 0.22;
        rig.torso.rotation.set(0, 0, Math.sin(z.phase) * 0.1);
        rig.armL.rotation.set(-2.6 + Math.sin(z.phase) * 0.5, 0, 0.2);
        rig.armR.rotation.set(-2.6 - Math.sin(z.phase) * 0.5, 0, -0.2);
        rig.legL.rotation.set(0.15, 0, 0.1);
        rig.legR.rotation.set(0.1, 0, -0.1);
        rig.head.rotation.set(-0.6, 0, 0);
      }
      humans.sync(z.slot, dt);
    }
  }

  enemyShot(z, dmg) {
    const from = this.wpos(z.s, z.x, 1.4, new THREE.Vector3());
    const pl = this.player;
    const to = pl ? this.wpos(pl.s, pl.x, 1.1, new THREE.Vector3()) : this.carModel.group.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, 1 + Math.random(), (Math.random() - 0.5) * 3));
    const hit = Math.random() < (pl ? 0.45 : 0.5);
    if (!hit) to.add(new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 2, (Math.random() - 0.5) * 4));
    this.fx.tracer(from, to, '#ff9a5a', 0.09);
    this.fx.muzzle(from, to.clone().sub(from).normalize(), 0.8);
    sfx.shot('pistol');
    if (!hit) return;
    if (pl) this.hurtPlayer(dmg);
    else {
      this.damageCar(dmg * (1 - this.o.stats.armor * 0.5));
      this.fx.sparks(to, 3);
    }
  }

  updateTurrets(dt) {
    const c = this.car;
    const tS = this.player ? this.player.s : c.s;
    const tX = this.player ? this.player.x : c.x;
    for (const t of this.turrets) {
      if (t.dead) {
        if (Math.random() < 0.2) this.fx.smoke(this.wpos(t.s, t.x, 1.5), true);
        continue;
      }
      const ds = tS - t.s;
      const dx = tX - t.x;
      const d = Math.hypot(ds, dx);
      if (d > 85) continue;
      this.track.frame(t.s, _fr);
      const wx = _fr.fx * ds + _fr.rx * dx;
      const wz = _fr.fz * ds + _fr.rz * dx;
      const yaw = Math.atan2(wx, wz);
      t.w.pivot.rotation.y = damp(t.w.pivot.rotation.y, angleDiff(0, yaw), 5, dt);
      t.cd -= dt;
      if (t.cd <= 0) {
        if (t.burst <= 0) {
          t.burst = 6;
          t.cd = 1.6;
        } else {
          t.burst--;
          t.cd = 0.12;
          const from = t.w.muzzle.getWorldPosition(new THREE.Vector3());
          const pl = this.player;
          const to = pl ? this.wpos(pl.s, pl.x, 1, new THREE.Vector3()) : this.carModel.group.position.clone().add(new THREE.Vector3(0, 1, 0));
          const hit = Math.random() < 0.45;
          if (!hit) to.add(new THREE.Vector3((Math.random() - 0.5) * 5, Math.random() * 2, (Math.random() - 0.5) * 5));
          this.fx.tracer(from, to, '#ff7a3a', 0.08);
          this.fx.muzzle(from, to.clone().sub(from).normalize(), 1);
          sfx.shot('bullet');
          if (hit) {
            if (pl) this.hurtPlayer(3);
            else this.damageCar((1 + Math.max(0, this.dest - 2) * 0.2) * (1 - this.o.stats.armor * 0.5), true);
          }
        }
      }
    }
  }

  updateObstacles(dt) {
    const tS = this.player ? this.player.s : this.car.s;
    for (const o of this.obstacles) {
      if (!o.alive) continue;
      if (o.light) o.light.visible = Math.sin(this.t * 8 + o.s) > 0;
      if (o.s < tS - 60) this.removeObstacle(o);
    }
    this.obstacles = this.obstacles.filter((o) => o.alive);
    void dt;
  }

  updatePickups(dt) {
    const tS = this.player ? this.player.s : this.car.s;
    for (const p of this.pickups) {
      if (!p.alive) continue;
      p.bob += dt;
      const it = p.mesh.userData.item;
      it.rotation.y += dt * 2;
      it.position.y = 0.9 + (p.dy || 0) + Math.sin(p.bob * 3) * 0.15;
      if (p.s < tS - 40) {
        p.alive = false;
        this.scene.remove(p.mesh);
      }
    }
    this.pickups = this.pickups.filter((p) => p.alive);
  }

  // ------------------------------ заправка ------------------------------

  enterStation() {
    this.state = 'stationIn';
    this.stIn = { s0: this.car.s, x0: this.car.x, v0: this.car.v, t: 0 };
    this.camBlend = 0;
    this.notice('Заправка', 2);
    this.o.onEvent?.('cutscene', true);
  }

  updateStationIn(dt) {
    const c = this.car;
    const tgt = this.station.car;
    const k = this.stIn;
    k.t += dt;
    const total = tgt.s - k.s0;
    const u = clamp((c.s - k.s0) / total, 0, 1);
    const remain = tgt.s - c.s;
    c.v = Math.max(1.2, Math.min(k.v0, Math.sqrt(Math.max(0, remain)) * 2.4));
    if (remain < 0.4) c.v = 0;
    const nx = lerp(k.x0, tgt.x, smoothstep(0, 0.85, u));
    const ds = c.v * dt;
    c.ang = Math.atan2(nx - c.x, Math.max(0.01, ds) * 3) * 0.6;
    c.s = Math.min(tgt.s, c.s + ds);
    c.x = nx;
    this.carModel.update(dt, c.v, c.ang * 2);
    this.cockpit.update(c.ang * 2);
    this.updateCarTransform(dt);
    engineSet(0.2 + c.v / 40, 0.3);
    const cp = this.carModel.group.position;
    const cam = this.wpos(this.station.s + 6, -4, 5, new THREE.Vector3());
    this.setCam(cam, _v2.copy(cp).add(new THREE.Vector3(0, 1, 0)), 52);
    followSun(this.lights, cp);
    if (c.v === 0 || k.t > 9) {
      c.v = 0;
      if (!k.stopT) k.stopT = this.t;
      if (this.t - k.stopT > 0.8) this.exitCar();
    }
  }

  exitCar() {
    const c = this.car;
    this.state = 'foot';
    this.cockpit.visible = false;
    engineSet(0.05, 0);
    const o = this.o;
    // вид от первого лица: в руках — выбранное оружие
    this.vm = new ViewModel(o.gun.model, o.gun.cat === 'melee');
    this.camera.add(this.vm.group);
    if (!this.camera.parent) this.scene.add(this.camera);
    const armor = o.armor || 0;
    const ps = c.s;
    const px = c.x - 1.9;
    // сразу смотрим на ближайшую колонку
    const pump = this.station.pumps.reduce((a, b2) => (Math.hypot(b2.s - ps, b2.x - px) < Math.hypot(a.s - ps, a.x - px) ? b2 : a));
    this.track.frame(ps, _fr);
    const wx = _fr.fx * (pump.s - ps) + _fr.rx * (pump.x - px);
    const wz = _fr.fz * (pump.s - ps) + _fr.rz * (pump.x - px);
    this.player = {
      s: ps,
      x: px,
      yaw: Math.atan2(wx, wz),
      pitch: -0.05,
      hp: 100,
      maxHp: 100,
      poison: 0,
      dmgMul: 1 - Math.min(0.7, armor / 140),
      hurtT: 0,
      target: null,
      eye: new THREE.Vector3(),
    };
    this.pumpProgress = 0;
    this.wave = { left: this.params.stationWave, t: 2 };
    this.world.canopy.material.opacity = 1;
    this.world.canopy.material.depthWrite = true;
    // маркер цели над колонкой / машиной
    const mk = new THREE.Group();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.7, 12), new THREE.MeshBasicMaterial({ color: 0xffd21a }));
    cone.rotation.x = Math.PI;
    mk.add(cone);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.06, 6, 24).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd21a, transparent: true, opacity: 0.6 }));
    ring.position.y = -2.3;
    mk.add(ring);
    this.marker = mk;
    this.scene.add(mk);
    this.camBlend = 1;
    this.snapCamera = true;
    this.notice('Дойди до колонки и заправь машину!', 3);
    this.o.onEvent?.('cutscene', false);
    this.o.onEvent?.('foot');
    sfx.gate();
  }

  stationCollide(e, r) {
    const S = this.station.s;
    // колонки
    for (const p of this.station.pumps) {
      const ds = e.s - p.s;
      const dx = e.x - p.x;
      const hs = 1.7 + r;
      const hx = 0.8 + r;
      if (Math.abs(ds) < hs && Math.abs(dx) < hx) {
        if (hx - Math.abs(dx) < hs - Math.abs(ds)) e.x = p.x + Math.sign(dx || 1) * hx;
        else e.s = p.s + Math.sign(ds || 1) * hs;
      }
    }
    // магазин
    if (e.x < -26 + r && e.x > -34 - r && Math.abs(e.s - S) < 7 + r) {
      const pushX = e.x - (-26 + r);
      if (Math.abs(pushX) < 1.2) e.x = -26 + r;
      else e.s = S + Math.sign(e.s - S || 1) * (7 + r);
    }
    // машина
    const c = this.car;
    const hl = this.carModel.spec.L / 2 + r;
    const hw = this.carModel.spec.W / 2 + r;
    const ds = e.s - c.s;
    const dx = e.x - c.x;
    if (Math.abs(ds) < hl && Math.abs(dx) < hw) {
      if (hw - Math.abs(dx) < hl - Math.abs(ds)) e.x = c.x + Math.sign(dx || 1) * hw;
      else e.s = c.s + Math.sign(ds || 1) * hl;
    }
  }

  updateFoot(dt) {
    const p = this.player;
    const inp = this.input;
    const S = this.station.s;
    const g = this.o.gun;
    // волна зомби
    const w = this.wave;
    if (w.left > 0) {
      w.t -= dt;
      if (w.t <= 0) {
        w.t = this.rng.f(0.9, 1.8);
        const n = Math.min(w.left, this.rng.i(1, 3));
        for (let i = 0; i < n; i++) {
          const side = this.rng.i(0, 3);
          let s;
          let x;
          if (side === 0) {
            s = S + this.rng.f(-40, 40);
            x = -46;
          } else if (side === 1) {
            s = S - 44;
            x = this.rng.f(-40, 5);
          } else if (side === 2) {
            s = S + 44;
            x = this.rng.f(-40, 5);
          } else {
            s = S + this.rng.f(-35, 35);
            x = 12;
          }
          const t0 = pickZombieType(this.params.mix, this.rng.next());
          const type = t0 === 'crawler' ? 'runner' : t0;
          const z = this.spawnZombie({ s, x, type, station: true });
          if (z) {
            z.state = 'chase';
            w.left--;
          }
        }
      }
    }
    if (w.left <= 0 && this.params.stationBoss && !this.stationBoss) {
      this.stationBoss = this.spawnZombie({ s: S + 40, x: -30, type: 'butcher', station: true });
      if (this.stationBoss) {
        this.boss = this.stationBoss;
        this.notice('Босс: Мясник!', 3, 'bad');
        sfx.alarm();
      }
    }
    // обзор: мышь / палец / стрелки
    const sens = this.o.settings.sens || 1;
    p.yaw -= (inp.lookX || 0) * 0.0026 * sens + (inp.turn || 0) * 2.2 * dt;
    p.pitch = clamp(p.pitch - (inp.lookY || 0) * 0.0026 * sens, -0.95, 0.9);
    // движение относительно взгляда
    const mx = clamp(inp.moveX, -1, 1);
    const my = clamp(inp.moveY, -1, 1);
    const ml = Math.min(1, Math.hypot(mx, my));
    const speed = 5.0;
    if (ml > 0.08) {
      const fx = Math.sin(p.yaw);
      const fz = Math.cos(p.yaw);
      const rx = -fz;
      const rz = fx;
      const k = speed * dt / Math.max(1, Math.hypot(mx, my));
      const wx = (fx * my + rx * mx) * k;
      const wz = (fz * my + rz * mx) * k;
      this.track.frame(p.s, _fr);
      p.s += wx * _fr.fx + wz * _fr.fz;
      p.x += wx * _fr.rx + wz * _fr.rz;
    }
    p.s = clamp(p.s, S - 44, S + 44);
    p.x = clamp(p.x, -44, 8);
    this.stationCollide(p, 0.4);
    // камера на уровне глаз
    const vm = this.vm;
    const bob = ml > 0.08 ? Math.abs(Math.sin(vm.bob)) * 0.05 : 0;
    this.wpos(p.s, p.x, 1.62 + bob, p.eye);
    const cam = this.camera;
    cam.position.copy(p.eye);
    cam.rotation.set(p.pitch, p.yaw + Math.PI, 0, 'YXZ');
    if (this.shake > 0 && this.o.settings.shake !== false) {
      cam.rotation.x += (Math.random() - 0.5) * this.shake * 0.03;
      cam.rotation.y += (Math.random() - 0.5) * this.shake * 0.03;
    }
    const fov = 70;
    if (Math.abs(cam.fov - fov) > 0.1) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    cam.updateMatrixWorld();
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    // что под прицелом и лёгкий доводчик
    const melee = g.cat === 'melee';
    const range = melee ? g.range + 0.8 : g.range;
    let inSight = null;
    let assist = null;
    let assistOff = Infinity;
    const aimPos = new THREE.Vector3();
    for (const z of this.zombies) {
      if (z.dead) continue;
      this.entityPos(z, aimPos);
      if (!z.T.crawl) aimPos.y += 0.15 * z.sc;
      const to = aimPos.clone().sub(p.eye);
      const dist = to.length();
      if (dist > range + 1) continue;
      to.divideScalar(dist);
      const off = Math.acos(clamp(fwd.dot(to), -1, 1));
      const size = Math.atan((0.42 * z.sc) / dist) + (melee ? 0.5 : 0.02);
      if (off < size && (!inSight || dist < inSight.dist)) inSight = { z, dist, pos: aimPos.clone() };
      if (off < 0.13 && off < assistOff) {
        assistOff = off;
        assist = { z, to: to.clone() };
      }
    }
    if (assist && !melee) {
      // доводка: плавно и слабо, почти незаметно
      const want = Math.atan2(assist.to.x, assist.to.z);
      const wantPitch = Math.asin(clamp(assist.to.y, -1, 1));
      const k = Math.min(1, dt * 2.2) * (1 - assistOff / 0.13) * 0.55;
      p.yaw += angleDiff(p.yaw, want) * k;
      p.pitch += (wantPitch - p.pitch) * k;
    }
    p.target = inSight ? inSight.z : null;
    // стрельба: сама, когда зомби в прицеле
    const gs = this.gun;
    gs.cd -= dt;
    if (gs.reload > 0) {
      gs.reload -= dt;
      if (gs.reload <= 0) gs.mag = g.mag;
    }
    const wantFire = inp.fire || !!inSight;
    if (wantFire && gs.cd <= 0 && gs.reload <= 0) {
      if (melee) {
        gs.cd = 60 / g.rpm;
        vm.kick();
        sfx.shot('melee');
        for (const z of this.zombies) {
          if (z.dead) continue;
          const to = this.entityPos(z, aimPos).sub(p.eye);
          const d = to.length();
          if (d < range && fwd.dot(to.normalize()) > 0.55) {
            this.hurtZombie(z, g.dmg, null, 'melee', { s: (z.s - p.s) / (d || 1) * 4, x: (z.x - p.x) / (d || 1) * 4, y: 3 });
          }
        }
      } else if (gs.mag > 0) {
        gs.cd = 60 / g.rpm;
        gs.mag--;
        vm.kick(g.cat === 'shotgun' || g.cat === 'sniper' || g.cat === 'rocket' ? 1.4 : 0.6);
        const muzzle = vm.muzzle.getWorldPosition(new THREE.Vector3());
        const tpos = inSight ? inSight.pos : p.eye.clone().addScaledVector(fwd, g.range);
        this.firePersonal(g, muzzle, tpos, inSight ? inSight.z : null, fwd);
        if (gs.mag <= 0) {
          gs.reload = 1.5;
          sfx.reload();
        }
      }
    }
    vm.update(dt, ml > 0.08, speed * ml, gs.reload > 0);
    // заправка
    let nearPump = false;
    for (const pp of this.station.pumps) if (Math.hypot(pp.s - p.s, pp.x - p.x) < 2.6) nearPump = true;
    this.nearPump = nearPump;
    if (this.pumpProgress < 1) {
      if (nearPump) {
        this.pumpProgress = Math.min(1, this.pumpProgress + dt / 8);
        this.car.fuel = lerp(this.car.fuel, this.car.maxFuel, (dt / 8) * 1.5);
        if (Math.random() < dt * 4) sfx.fuel();
        if (this.pumpProgress >= 1) {
          this.car.fuel = this.car.maxFuel;
          this.stats.refueled = true;
          this.notice('Бак полный! Возвращайся в машину', 3);
          sfx.win();
        }
      }
    }
    this.canEnter = this.pumpProgress >= 1 && Math.hypot(p.s - this.car.s, p.x - this.car.x) < 3.6;
    // маркер: над ближайшей колонкой, потом над машиной
    let goal;
    if (this.pumpProgress < 1) goal = this.station.pumps.reduce((a, b2) => (Math.hypot(b2.s - p.s, b2.x - p.x) < Math.hypot(a.s - p.s, a.x - p.x) ? b2 : a));
    else goal = { s: this.car.s, x: this.car.x };
    this.goalDist = Math.hypot(goal.s - p.s, goal.x - p.x);
    this.wpos(goal.s, goal.x, 3.2 + Math.sin(this.t * 3) * 0.2, this.marker.position);
    this.marker.rotation.y += dt * 2;
    this.marker.visible = !(this.pumpProgress < 1 && nearPump);
    // яд
    if (p.poison > 0) {
      p.poison -= dt;
      this.hurtPlayer(2.2 * dt, true);
    }
    p.hurtT = Math.max(0, p.hurtT - dt);
    followSun(this.lights, p.eye);
    if (p.hp <= 0) this.fail('player');
  }

  firePersonal(g, muzzle, tpos, tgt, fwd) {
    const cat = g.cat;
    if (cat === 'rocket') {
      this.fireWeapon({ kind: g.model === 'rpg' ? 'rocket' : 'grenade', dmg: g.dmg, splash: g.splash }, muzzle, tpos, tgt, fwd, false);
      return;
    }
    sfx.shot(cat === 'shotgun' ? 'shotgun' : cat === 'pistol' ? 'pistol' : g.model === 'laser' ? 'laser' : 'bullet');
    this.fx.muzzle(muzzle, fwd, cat === 'shotgun' ? 1.5 : 0.8);
    const pellets = g.pellets || 1;
    const acc = g.acc / 100;
    for (let i = 0; i < pellets; i++) {
      const spread = (1 - acc) * 3;
      const end = tpos.clone().add(new THREE.Vector3((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread * 0.5, (Math.random() - 0.5) * spread));
      this.fx.tracer(muzzle, end, g.model === 'laser' ? '#e07aff' : '#ffe08a', g.model === 'laser' ? 0.12 : 0.06);
      if (tgt && Math.random() < 0.5 + acc * 0.5) this.damageEntity(tgt, g.dmg, fwd, 'gun');
    }
    if (g.pierce && tgt) this.pierceLine(muzzle, tpos.clone().add(tpos.clone().sub(muzzle).normalize().multiplyScalar(g.range)), g.dmg * 0.8, g.pierce, tgt);
  }

  hurtPlayer(n, silent = false) {
    const p = this.player;
    if (!p || this.state !== 'foot') return;
    p.hp = Math.max(0, p.hp - n * p.dmgMul);
    if (!silent) {
      p.hurtT = 0.3;
      this.shake += 0.2;
      sfx.hurt();
      this.o.onEvent?.('hurt');
    }
  }

  poisonPlayer(t) {
    if (!this.player) return;
    this.player.poison = Math.max(this.player.poison, t);
    this.notice('Отравление!', 1.5, 'bad');
  }

  enterCar() {
    if (!this.canEnter || this.state !== 'foot') return;
    this.camera.remove(this.vm.group);
    this.scene.remove(this.marker);
    this.vm = null;
    this.playerResult = { hp: this.player.hp };
    this.player = null;
    this.stationDone = true;
    this.state = 'stationOut';
    this.stOut = { s0: this.car.s, x0: this.car.x };
    this.camBlend = 0;
    this.stats.refueled = true;
    sfx.gate();
    this.o.onEvent?.('drive');
  }

  updateStationOut(dt) {
    const c = this.car;
    const k = this.stOut;
    c.v = Math.min(this.o.stats.speed * 0.6, c.v + dt * 5);
    const u = clamp((c.s - k.s0) / 45, 0, 1);
    const nx = lerp(k.x0, 0, smoothstep(0.05, 1, u));
    const ds = c.v * dt;
    c.ang = Math.atan2(nx - c.x, Math.max(0.01, ds) * 3) * 0.6;
    c.s += ds;
    c.x = nx;
    this.carModel.update(dt, c.v, c.ang * 2);
    this.cockpit.update(c.ang * 2);
    this.updateCarTransform(dt);
    this.updateCarWeapon(dt);
    this.carCollisions(dt);
    engineSet(0.3 + c.v / 30, 0.7);
    this.driveCamera(dt);
    if (u >= 1) {
      c.ang = 0;
      this.state = 'drive';
    }
  }

  // ------------------------------ прибытие ------------------------------

  startArrive() {
    this.state = 'arrive';
    this.arr = { t: 0, s0: this.car.s, x0: this.car.x, v0: Math.max(this.car.v, 8) };
    this.cockpit.visible = false;
    this.snapCamera = true;
    this.o.onEvent?.('cutscene', true);
    sfx.gate();
  }

  updateArrive(dt) {
    const c = this.car;
    const a = this.arr;
    a.t += dt;
    const base = this.world.endBase;
    base.open = smoothstep(0, 1.6, a.t);
    const stopS = this.L - BASE.carStartZ - 12; // перед гаражом
    const remain = stopS - c.s;
    c.v = Math.max(0, Math.min(a.v0, Math.sqrt(Math.max(0, remain)) * 2.2));
    const u = clamp((c.s - a.s0) / 30, 0, 1);
    const nx = lerp(a.x0, 0, smoothstep(0, 1, u));
    const ds = c.v * dt;
    c.ang = Math.atan2(nx - c.x, Math.max(0.01, ds) * 3) * 0.5;
    c.s += ds;
    c.x = nx;
    this.carModel.update(dt, c.v, c.ang * 2);
    this.updateCarTransform(dt);
    engineSet(0.15 + c.v / 40, 0.2);
    // камера внутри базы смотрит на въезд
    const cam = this.wpos(this.L + 20, 8, 2.8, new THREE.Vector3());
    const cp = this.carModel.group.position;
    this.setCam(cam, _v2.copy(cp).add(new THREE.Vector3(0, 1.2, 0)), 48);
    followSun(this.lights, cp);
    if (c.v < 0.2 && remain < 1.5) {
      if (!a.stopT) {
        a.stopT = a.t;
        engineStop();
      }
      if (a.t - a.stopT > 1.2 && !a.done) {
        a.done = true;
        this.o.onEvent?.('arrived', this.result());
      }
    }
  }

  // ------------------------------ поражение ------------------------------

  carDestroyed() {
    this.explode(this.car.s, this.car.x, 3, 0, 'car', true);
    this.fail('car');
  }

  fail(reason) {
    if (this.state === 'dead') return;
    this.prevState = this.state === 'foot' ? 'foot' : 'drive';
    this.state = 'dead';
    this.failReason = reason;
    this.deadT = 0;
    engineStop();
    this.o.onEvent?.('dead', reason);
  }

  updateDeadCam(dt) {
    this.deadT += dt;
    if (this.player) {
      // игрок падает на землю
      const p = this.player;
      const cam = this.camera;
      const k = Math.min(1, this.deadT * 1.5);
      this.wpos(p.s, p.x, 1.62 - k * 1.35, cam.position);
      cam.rotation.set(p.pitch * (1 - k) + k * 0.2, p.yaw + Math.PI, k * 1.2, 'YXZ');
      if (this.vm) this.vm.group.visible = false;
      return;
    }
    const target = this.carModel.group.position;
    const a = this.deadT * 0.3;
    const pos = target.clone().add(new THREE.Vector3(Math.sin(a) * 9, 5, Math.cos(a) * 9));
    this.setCam(pos, target.clone().add(new THREE.Vector3(0, 1, 0)), 55);
    if (Math.random() < 0.6) this.fx.smoke(this.carModel.group.localToWorld(this.carModel.hoodPoint.clone()), true);
  }

  revive() {
    this.revives++;
    const c = this.car;
    if (this.prevState === 'foot' && this.player) {
      this.player.hp = this.player.maxHp * 0.7;
      this.player.poison = 0;
      if (this.vm) this.vm.group.visible = true;
      this.state = 'foot';
    } else {
      c.hp = Math.max(c.hp, c.maxHp * 0.6);
      c.fuel = Math.max(c.fuel, c.maxFuel * 0.35);
      this.state = 'drive';
      engineStart();
    }
    // отбрасываем ближайших зомби
    const tS = this.player ? this.player.s : c.s;
    const tX = this.player ? this.player.x : c.x;
    for (const z of this.zombies) {
      if (z.dead) continue;
      const d = Math.hypot(z.s - tS, z.x - tX);
      if (d < 14 && z.type !== 'bandit') this.killZombie(z, { s: (z.s - tS) * 0.8, x: (z.x - tX) * 0.8, y: 6 }, 'explosion');
    }
    this.fx.explosion(this.wpos(tS, tX, 1, new THREE.Vector3()), 0.6);
    this.camBlend = 0;
  }

  // ------------------------------ действия игрока ------------------------------

  useRepair() {
    if (this.state !== 'drive' || this.inv.repair <= 0) return false;
    const c = this.car;
    if (c.hp >= c.maxHp) return false;
    this.inv.repair--;
    this.usedRepair = (this.usedRepair || 0) + 1;
    c.hp = Math.min(c.maxHp, c.hp + c.maxHp * 0.4);
    this.fx.emit({ pos: this.carModel.group.position.clone().add(new THREE.Vector3(0, 1.5, 0)), count: 20, spread: 2, up: 2, color: '#7aff7a', color2: '#ffffff', life: [0.5, 1], size: [0.2, 0.4], glow: true });
    sfx.buy();
    return true;
  }

  useFuel() {
    if (this.inv.fuel <= 0) return false;
    const c = this.car;
    if (c.fuel >= c.maxFuel * 0.98) return false;
    this.inv.fuel--;
    this.usedFuel = (this.usedFuel || 0) + 1;
    c.fuel = Math.min(c.maxFuel, c.fuel + c.maxFuel * 0.5);
    this.notice('Канистра: +50% топлива', 1.5);
    sfx.fuel();
    return true;
  }

  useMed() {
    const p = this.player;
    if (!p || this.state !== 'foot') return null;
    const missing = 1 - p.hp / p.maxHp;
    if (missing < 0.02 && p.poison <= 0) return null;
    let pick = null;
    if (p.poison > 0 && this.inv.med4 > 0) pick = MEDKITS[3];
    if (!pick) {
      const avail = MEDKITS.filter((m) => this.inv[m.id] > 0);
      pick = avail.find((m) => m.heal >= missing) || avail[avail.length - 1];
    }
    if (!pick) return null;
    this.inv[pick.id]--;
    this.usedMeds = this.usedMeds || {};
    this.usedMeds[pick.id] = (this.usedMeds[pick.id] || 0) + 1;
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * pick.heal);
    if (pick.cure) p.poison = 0;
    this.fx.emit({ pos: this.wpos(p.s, p.x, 1.2), count: 16, spread: 1.5, up: 2, color: '#7aff7a', color2: '#ffffff', life: [0.5, 1], size: [0.15, 0.3], glow: true });
    sfx.buy();
    return pick;
  }

  medCount() {
    return MEDKITS.reduce((a, m) => a + (this.inv[m.id] || 0), 0);
  }

  // ------------------------------ данные для интерфейса ------------------------------

  hud() {
    const c = this.car;
    const p = this.player;
    const w = this.wpn;
    let objective = `Доберись до базы ${this.dest}`;
    if (this.state === 'foot') {
      if (this.pumpProgress < 1) objective = this.nearPump ? `Заправка: ${Math.round(this.pumpProgress * 100)}%` : `Подойди к колонке · ${Math.round(this.goalDist || 0)} м`;
      else objective = `Вернись в машину · ${Math.round(this.goalDist || 0)} м`;
    }
    let distText = null;
    let progress = clamp(c.s / this.L, 0, 1);
    let killGoal = this.params.killGoal;
    if (this.arcade) {
      const d = this.stats.distance;
      objective = `Аркада · рекорд ${(this.o.arcadeBest / 1000 || 0).toFixed(2)} км`;
      distText = `${(d / 1000).toFixed(2)} км`;
      progress = this.o.arcadeBest > 0 ? clamp(d / this.o.arcadeBest, 0, 1) : clamp((d % 1000) / 1000, 0, 1);
      killGoal = Math.max(25, Math.ceil((this.stats.kills + 1) / 25) * 25);
    }
    return {
      distText,
      state: this.state,
      hp: c.hp,
      maxHp: c.maxHp,
      fuel: c.fuel,
      maxFuel: c.maxFuel,
      speed: Math.abs(c.v),
      mag: this.state === 'foot' ? this.gun.mag : w.mag,
      magMax: this.state === 'foot' ? this.o.gun.mag : w.def.mag,
      reserve: this.state === 'foot' ? '∞' : w.reserve,
      reloading: this.state === 'foot' ? this.gun.reload > 0 : w.reload > 0,
      melee: this.o.gun.cat === 'melee',
      kills: this.stats.kills,
      killGoal,
      progress,
      distLeft: Math.max(0, Math.round(this.L - c.s)),
      objective,
      notices: this.notices,
      php: p ? p.hp : 0,
      pmax: p ? p.maxHp : 100,
      poison: p ? p.poison > 0 : false,
      pump: this.pumpProgress,
      canEnter: !!this.canEnter,
      repair: this.inv.repair,
      canisters: this.inv.fuel,
      meds: this.medCount(),
      cash: this.stats.cash,
      cargo: this.cargo(),
      trunk: this.o.stats.trunk,
      camMode: this.camMode,
      hurt: p ? p.hurtT : 0,
      aimed: p ? !!p.target : false,
      autoWeapon: !!w.def.auto,
      boss: this.boss && !this.boss.dead && Math.abs(this.boss.s - (p ? p.s : c.s)) < 110 ? { name: this.boss.T.name, hp: this.boss.hp, max: this.boss.maxHp } : null,
    };
  }

  drawMinimap(ctx, size) {
    const c = this.car;
    const p = this.player;
    const cs = p ? p.s : c.s;
    const cx = p ? p.x : c.x;
    const scale = p ? 2.2 : 0.9;
    const tr = this.track;
    const r = size / 2;
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(r, r, r - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(20,30,40,0.85)';
    ctx.fillRect(0, 0, size, size);
    // система координат: машина в центре, дорога вверх
    const f0 = tr.frame(cs, {});
    const rot = p ? angleDiff(f0.yaw, p.yaw) : 0;
    const cr = Math.cos(rot);
    const sr = Math.sin(rot);
    const toMap0 = (s, x) => {
      const f = tr.frame(s, _fr);
      const wx = f.x + f.rx * x - (f0.x + f0.rx * cx);
      const wz = f.z + f.rz * x - (f0.z + f0.rz * cx);
      const u = wx * f0.rx + wz * f0.rz;
      const v = wx * f0.fx + wz * f0.fz;
      return [u, v];
    };
    // поворот карты по направлению взгляда
    const toMap = (s, x) => {
      const [u, v] = toMap0(s, x);
      const u2 = u * cr + v * sr;
      const v2 = -u * sr + v * cr;
      return [r + u2 * scale, r - v2 * scale];
    };
    ctx.strokeStyle = 'rgba(160,160,150,0.9)';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const span = r / scale + 10;
    const hasFork = tr.forks.some((f) => f.s1 > cs - span && f.s0 < cs + span);
    // дорога; на развилке — две ветки и жёлтая линия маршрута по правильной
    for (const sd of hasFork ? [-1, 1] : [1]) {
      ctx.lineWidth = (hasFork ? BRANCH_HALF : ROAD_HALF) * 2 * scale;
      ctx.beginPath();
      for (let s = cs - span; s <= cs + span; s += 4) {
        const [x, y] = toMap(s, sd * tr.laneOff(s));
        if (s === cs - span) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    if (hasFork) {
      ctx.strokeStyle = '#ffd21a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let s = cs - span; s <= cs + span; s += 4) {
        const [x, y] = toMap(s, tr.routeX(s));
        if (s === cs - span) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // объекты
    const dot = (s, x, col, rad = 3) => {
      if (Math.abs(s - cs) > span) return;
      const [px, py] = toMap(s, x);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(px, py, rad, 0, Math.PI * 2);
      ctx.fill();
    };
    for (const pk of this.pickups) dot(pk.s, pk.x, '#5fd34a', 2);
    for (const o of this.obstacles) if (o.kind === 'mine') dot(o.s, o.x, '#ffb01a', 2);
    for (const z of this.zombies) if (!z.dead) dot(z.s, z.x, z.type === 'bandit' ? '#ff8a2a' : '#ff2a2a', z.type === 'brute' ? 4 : 2.6);
    for (const t of this.turrets) if (!t.dead) dot(t.s, t.x, '#ff8a2a', 4);
    if (!this.stationDone) dot(this.station.s, -20, '#3aa0ff', 6);
    if (p) for (const pp of this.station.pumps) dot(pp.s, pp.x, '#3aa0ff', 3);
    if (!this.arcade) dot(this.L, 0, '#ffd21a', 6);
    else if (this.boss && !this.boss.dead && !this.boss.gone) dot(this.boss.s, this.boss.x, '#ff2a2a', 6);
    if (p) dot(c.s, c.x, '#ffffff', 4);
    ctx.restore();
    // стрелка
    ctx.fillStyle = '#ffd21a';
    ctx.beginPath();
    ctx.moveTo(r, r - 8);
    ctx.lineTo(r + 6, r + 6);
    ctx.lineTo(r, r + 3);
    ctx.lineTo(r - 6, r + 6);
    ctx.closePath();
    ctx.fill();
  }

  result() {
    const st = this.stats;
    const bonus = st.kills >= this.params.killGoal ? Math.round(this.params.reward * 0.5) : 0;
    return {
      dest: this.dest,
      collected: { wood: st.wood, metal: st.metal, cloth: st.cloth, ammo: st.ammo },
      cash: st.cash + this.params.reward + bonus + (this.bossKilled ? this.params.bossReward.cash : 0),
      baseReward: this.params.reward,
      bonus,
      picked: st.cash,
      kills: st.kills,
      killGoal: this.params.killGoal,
      brutes: st.brutes,
      bandits: st.bandits,
      footKills: st.footKills,
      crates: st.crates,
      distance: Math.round(st.distance),
      refueled: st.refueled,
      carHpFrac: this.car.hp / this.car.maxHp,
      used: { repair: this.usedRepair || 0, fuel: this.usedFuel || 0, meds: this.usedMeds || {} },
      xp: 40 + st.kills * 2 + st.bandits * 4 + (st.bosses || 0) * 50,
      bosses: st.bosses || 0,
      jumps: st.jumps || 0,
      bossCash: this.bossKilled ? this.params.bossReward.cash : 0,
      bossGold: this.bossKilled ? this.params.bossReward.gold : 0,
    };
  }

  dispose() {
    engineStop();
    this.scene.traverse((o) => {
      if (o.geometry && !o.geometry.userData?.shared) o.geometry.dispose?.();
    });
    this.humans.dispose(this.scene);
  }
}

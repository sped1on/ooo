// Точка входа: рендер, экраны, переходы между меню, гаражом, картой уровня и поездкой.

import * as THREE from 'three';
import { store, S, carStats, gunStats, armorTotal, give, levelInfo } from './state/save.js';
import { initPlatform, loadCloud, loadingReady, gameplayStart, gameplayStop, onPause, showFullscreenAd, deviceType, playerName, submitScore, pendingPurchases } from './platform/yandex.js';
import { unlockAudio, setAudioSettings, setPaused, playMusic, stopMusic, sfx, engineMute } from './engine/audio.js';
import { MenuScene, GarageScene } from './world/scenes.js';
import { Level } from './game/level.js';
import { initThumbs } from './ui/thumbs.js';
import { h, ui, modal, toast, rewardAd } from './ui/dom.js';
import { icon } from './ui/icons.js';
import { menuScreen, repairModal } from './ui/menu.js';
import { garageScreen } from './ui/garage.js';
import { carShopScreen, gearScreen } from './ui/shops.js';
import { rewardsScreen, tasksScreen, settingsScreen } from './ui/misc.js';
import { mapScreen, hudScreen } from './ui/hud.js';
import { baseInfo, findCar, findArmor, PURCHASES, RESOURCES } from './data/catalog.js';
import { fmt } from './engine/util.js';

const QUALITY = {
  low: { pr: 1, shadows: false, particles: 0.45, detail: 0.5, fogFar: 250 },
  mid: { pr: 1.5, shadows: true, particles: 0.75, detail: 0.8, fogFar: 320 },
  high: { pr: 2, shadows: true, particles: 1, detail: 1, fogFar: 400 },
};

const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

const app = {
  renderer: null,
  menu: null,
  garage: null,
  level: null,
  screen: null,
  screenName: '',
  view: 'menu', // какая 3D-сцена рисуется
  touchInput: { left: false, right: false, brake: false, fire: false, joyX: 0, joyY: 0, lookDX: 0, lookDY: 0 },
  keys: new Set(),
  mouseFire: false,
  paused: false,
  thumbs: {},
};
window.app = app;

function qualityKey() {
  const q = S().settings.quality;
  if (q !== 'auto') return q;
  return deviceType() === 'desktop' && !isTouch ? 'high' : 'low';
}
app.quality = () => QUALITY[qualityKey()];

// ------------------------------ запуск ------------------------------

async function boot() {
  const bar = document.querySelector('#loading .lbar i');
  const step = (p) => (bar.style.width = `${p}%`);
  step(10);
  await initPlatform();
  step(30);
  const cloud = await loadCloud();
  store.load(cloud);
  const nm = playerName();
  if (nm) S().name = nm;
  setAudioSettings({ sound: S().settings.sound, music: S().settings.music });
  step(45);
  // недоставленные покупки
  for (const id of await pendingPurchases()) {
    const p = PURCHASES.find((x) => x.id === id);
    if (p) give({ gold: p.gold });
  }

  const canvas = document.getElementById('gl');
  const q = app.quality();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: q.pr > 1 || !isTouch, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  app.renderer = renderer;
  initThumbs(renderer);
  applyRendererQuality();
  step(60);

  buildMenuScene();
  step(80);
  app.garage = new GarageScene(q);
  app.garage.setCar(findCar(S().car), S().equip, carStats().weapon.model);
  step(95);

  window.addEventListener('resize', resize);
  resize();
  bindInput();
  onPause((p) => {
    setPaused(p);
    if (p && app.level && app.screenName === 'game' && !app.paused) app.pause();
  });
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('pointerdown', () => unlockAudio(), { once: false });

  app.go('menu');
  requestAnimationFrame(loop);
  // первый кадр отрисован — снимаем заставку
  setTimeout(() => {
    step(100);
    document.getElementById('loading').classList.add('hide');
    loadingReady();
  }, 150);
  store.save();
}

function applyRendererQuality() {
  const q = app.quality();
  app.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pr));
  app.renderer.shadowMap.enabled = q.shadows;
}

function buildMenuScene() {
  const info = baseInfo(S().base);
  app.menu = new MenuScene(info.biome, app.quality(), info.name);
  app.menu.setCar(findCar(S().car), S().equip, carStats().weapon.model);
  app.menu.biomeBase = S().base;
  app.baseThumbUrl = null;
  resize();
}

function resize() {
  const w = window.innerWidth;
  const hgt = window.innerHeight;
  app.renderer?.setSize(w, hgt, false);
  app.w = w;
  app.h = hgt;
  app.menu?.resize(w, hgt);
  app.garage?.resize(w, hgt);
  app.level?.resize(w, hgt);
}

// ------------------------------ цикл ------------------------------

let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const r = app.renderer;
  if (app.view === 'level' && app.level) {
    if (!app.paused) {
      applyInput();
      app.level.update(dt);
    }
    r.render(app.level.scene, app.level.camera);
  } else if (app.view === 'garage') {
    app.garage.update(dt);
    r.render(app.garage.scene, app.garage.camera);
  } else if (app.view === 'black') {
    r.clear();
  } else {
    app.menu.update(dt);
    r.render(app.menu.scene, app.menu.camera);
  }
  app.screen?.onFrame?.(dt);
}

// ------------------------------ экраны ------------------------------

const VIEW = { menu: 'menu', rewards: 'menu', tasks: 'menu', settings: 'menu', garage: 'garage', shop: 'garage', gear: 'garage', results: 'garage', map: 'level', game: 'level' };

app.go = (name, opts) => {
  app.screen?.onLeave?.();
  app.screen?.remove();
  app.screenName = name;
  app.view = VIEW[name] || 'menu';
  let el;
  switch (name) {
    case 'menu':
      if (app.menu.biomeBase !== S().base) buildMenuScene();
      el = menuScreen(app);
      break;
    case 'garage':
      el = garageScreen(app, opts);
      break;
    case 'shop':
      el = carShopScreen(app, opts);
      break;
    case 'gear':
      el = gearScreen(app);
      break;
    case 'rewards':
      el = rewardsScreen(app);
      break;
    case 'tasks':
      el = tasksScreen(app);
      break;
    case 'settings':
      el = settingsScreen(app);
      break;
    case 'map':
      el = mapScreen(app, app.level);
      break;
    case 'game':
      el = hudScreen(app, app.level, isTouch);
      break;
    case 'results':
      el = opts;
      break;
    default:
      el = h('div');
  }
  app.screen = el;
  ui().prepend(el);
  app.music();
};

app.refresh = () => {
  const s = S();
  const key = `${s.car}|${JSON.stringify(s.equip)}`;
  if (app.carKey !== key) {
    app.carKey = key;
    app.menu.setCar(findCar(s.car), s.equip, carStats().weapon.model);
    app.previewCar(s.car, s.equip);
  }
  if (['menu', 'rewards', 'tasks'].includes(app.screenName)) {
    // перерисовать экран, сохранив позицию
    const name = app.screenName;
    if (name === 'menu') app.go('menu');
  }
};

let previewKey = '';
app.previewCar = (carId, equip) => {
  const key = `${carId}|${JSON.stringify(equip)}`;
  if (key === previewKey) return;
  previewKey = key;
  app.garage.setCar(findCar(carId), equip, carStats(carId, equip).weapon.model);
};

app.music = () => {
  if (!S().settings.music) {
    stopMusic();
    return;
  }
  if (app.screenName === 'game') playMusic('drive');
  else playMusic('menu');
};

app.applyQuality = () => {
  applyRendererQuality();
  buildMenuScene();
  app.garage = new GarageScene(app.quality());
  previewKey = '';
  app.previewCar(S().car, S().equip);
  resize();
};

// Картинка базы для карточки в меню
app.baseThumb = async () => {
  if (app.baseThumbUrl) return app.baseThumbUrl;
  const r = app.renderer;
  const m = app.menu;
  const w = 320;
  const hh = 200;
  const rt = new THREE.WebGLRenderTarget(w, hh, { samples: 2 });
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  const cam = new THREE.PerspectiveCamera(40, w / hh, 0.5, 1500);
  cam.position.set(30, 22, 40);
  cam.lookAt(0, 0, -18);
  m.sky.position.copy(cam.position);
  r.setRenderTarget(rt);
  r.render(m.scene, cam);
  const buf = new Uint8Array(w * hh * 4);
  r.readRenderTargetPixels(rt, 0, 0, w, hh, buf);
  r.setRenderTarget(null);
  rt.dispose();
  const c = document.createElement('canvas');
  c.width = w;
  c.height = hh;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, hh);
  for (let y = 0; y < hh; y++) img.data.set(buf.subarray((hh - 1 - y) * w * 4, (hh - y) * w * 4), y * w * 4);
  ctx.putImageData(img, 0, 0);
  app.baseThumbUrl = c.toDataURL('image/jpeg', 0.85);
  return app.baseThumbUrl;
};

// ------------------------------ ввод ------------------------------

function bindInput() {
  const KEYMAP = { KeyA: 'left', ArrowLeft: 'tleft', KeyD: 'right', ArrowRight: 'tright', KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', Space: 'fire', KeyJ: 'fire' };
  window.addEventListener('keydown', (e) => {
    unlockAudio();
    const k = KEYMAP[e.code];
    if (k) {
      app.keys.add(k);
      if (app.screenName === 'game') e.preventDefault();
    }
    if (app.screenName !== 'game' || e.repeat) return;
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (app.paused) app.resume();
      else app.pause();
    }
    if (e.code === 'KeyR') app.useItem('repair');
    if (e.code === 'KeyF') app.useItem('fuel');
    if (e.code === 'KeyC') app.useItem('camera');
    if (e.code === 'KeyH') app.useItem('med');
    if (e.code === 'KeyE') app.useItem('enter');
  });
  window.addEventListener('keyup', (e) => {
    const k = KEYMAP[e.code];
    if (k) app.keys.delete(k);
  });
  window.addEventListener('blur', () => app.keys.clear());
  const canvas = document.getElementById('gl');
  canvas.addEventListener('pointerdown', (e) => {
    if (app.screenName !== 'game' || e.pointerType !== 'mouse') return;
    if (e.button === 0) app.mouseFire = true;
  });
  window.addEventListener('pointerup', () => {
    app.mouseFire = false;
  });
  // пешком: курсор остаётся видимым, обзор — движением мыши;
  // у левого/правого края экрана взгляд продолжает поворачиваться
  window.addEventListener('mousemove', (e) => {
    app.mouseX = e.clientX;
    app.mouseY = e.clientY;
    if (app.screenName !== 'game' || app.paused || app.level?.state !== 'foot') return;
    app.touchInput.lookDX += (e.movementX || 0) * 1.3;
    app.touchInput.lookDY += (e.movementY || 0) * 1.0;
  });
  document.addEventListener('mouseleave', () => {
    app.mouseX = null;
  });
  bindGarageOrbit(canvas);
}

// Вращение машины в гараже: один палец/мышь — поворот и наклон, два пальца/колесо — приближение
function bindGarageOrbit(canvas) {
  const pts = new Map();
  let pinch = 0;
  const active = () => app.view === 'garage' && app.garage;
  const start = (e) => {
    if (!active()) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    app.garage.drag = true;
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };
  canvas.addEventListener('pointerdown', start);
  // зона вращения поверх сцены (экран гаража создаёт элемент .orbit-zone)
  document.addEventListener('pointerdown', (e) => {
    if (e.target.closest?.('.orbit-zone')) {
      e.target.setPointerCapture?.(e.pointerId);
      start(e);
    }
  });
  window.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId);
    if (!p || !active()) return;
    if (pts.size >= 2) {
      p.x = e.clientX;
      p.y = e.clientY;
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch > 0) app.garage.onZoom(pinch / d);
      pinch = d;
      return;
    }
    app.garage.onDrag(e.clientX - p.x, e.clientY - p.y);
    p.x = e.clientX;
    p.y = e.clientY;
  });
  const end = (e) => {
    pts.delete(e.pointerId);
    if (!pts.size && app.garage) app.garage.drag = false;
    pinch = 0;
  };
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
  canvas.addEventListener(
    'wheel',
    (e) => {
      if (active()) app.garage.onZoom(e.deltaY > 0 ? 1.08 : 0.93);
    },
    { passive: true },
  );
}

function applyInput() {
  const lv = app.level;
  if (!lv) return;
  const k = app.keys;
  const t = app.touchInput;
  const inp = lv.input;
  inp.steer = (k.has('right') || k.has('tright') || t.right ? 1 : 0) - (k.has('left') || k.has('tleft') || t.left ? 1 : 0);
  inp.gas = k.has('up');
  inp.brake = k.has('down') || t.brake;
  inp.fire = k.has('fire') || app.mouseFire || t.fire;
  inp.moveX = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0) + t.joyX;
  inp.moveY = (k.has('up') ? 1 : 0) - (k.has('down') ? 1 : 0) + t.joyY;
  let edge = 0;
  if (!isTouch && app.mouseX != null && lv.state === 'foot') {
    const e = app.mouseX / app.w;
    if (e < 0.06) edge = -(0.06 - e) / 0.06;
    else if (e > 0.94) edge = (e - 0.94) / 0.06;
  }
  inp.turn = (k.has('tright') ? 1 : 0) - (k.has('tleft') ? 1 : 0) + edge * 1.2;
  inp.lookX = t.lookDX;
  inp.lookY = t.lookDY;
  t.lookDX = 0;
  t.lookDY = 0;
}

app.useItem = (kind) => {
  const lv = app.level;
  if (!lv || app.paused) return;
  if (kind === 'repair') {
    if (!lv.useRepair()) sfx.error();
  } else if (kind === 'fuel') {
    if (!lv.useFuel()) sfx.error();
  } else if (kind === 'camera') {
    S().settings.camera = lv.toggleCamera();
    store.save();
  } else if (kind === 'med') {
    const m = lv.useMed();
    if (!m) sfx.error();
  } else if (kind === 'enter') lv.enterCar();
};

// ------------------------------ поездка ------------------------------

app.play = () => {
  const s = S();
  const frac = s.carHp[s.car] ?? 1;
  if (frac < 0.6) repairModal(app, () => app.openMap());
  else app.openMap();
};

app.openMap = () => {
  const s = S();
  const dest = s.base + 1;
  const load = h('div', { class: 'black on', style: { transition: 'none' } }, h('div', { class: 'type2' }, 'Разведка местности…'));
  ui().append(load);
  setTimeout(() => {
    const st = carStats();
    const ammoBoxes = Math.min(s.inv.ammo || 0, 3);
    app.levelAmmo = ammoBoxes;
    const gun = gunStats();
    app.level = new Level({
      dest,
      stats: st,
      equip: s.equip,
      gun,
      armor: armorTotal(),
      vest: s.vest,
      helmet: s.helmet,
      inv: { repair: s.inv.repair || 0, fuel: s.inv.fuel || 0, med1: s.inv.med1 || 0, med2: s.inv.med2 || 0, med3: s.inv.med3 || 0, med4: s.inv.med4 || 0 },
      ammoBoxes,
      armory: s.baseUp.armory || 0,
      carHpFrac: s.carHp[s.car] ?? 1,
      settings: s.settings,
      quality: app.quality(),
      onEvent: levelEvent,
    });
    app.level.resize(app.w, app.h);
    app.go('map');
    load.remove();
  }, 60);
};

app.leaveLevel = () => {
  app.level?.dispose();
  app.level = null;
  app.go('menu');
};

app.startDrive = async () => {
  await showFullscreenAd();
  const lv = app.level;
  const s = S();
  // ящики патронов расходуются при выезде
  s.inv.ammo = Math.max(0, (s.inv.ammo || 0) - app.levelAmmo);
  store.save();
  app.go('game');
  ui().classList.add('letterbox');
  const from = baseInfo(lv.dest - 1);
  const to = baseInfo(lv.dest);
  const banner = h('div', { class: 'banner' }, h('b', {}, `${from.name} → ${to.name}`), h('span', {}, `${to.sub} · ${fmt(lv.L)} м`));
  ui().append(banner);
  setTimeout(() => banner.remove(), 3500);
  lv.startIntro();
  gameplayStart();
};

function levelEvent(type, data) {
  switch (type) {
    case 'drive':
      ui().classList.remove('letterbox');
      break;
    case 'cutscene':
      ui().classList.toggle('letterbox', !!data);
      break;
    case 'foot':
      ui().classList.remove('letterbox');
      break;
    case 'arrived':
      arrive(data);
      break;
    case 'dead':
      setTimeout(() => failModal(data), 1400);
      break;
    default:
      break;
  }
}

app.pause = () => {
  if (!app.level || app.paused) return;
  app.paused = true;
  app.level.paused = true;
  engineMute(true);
  gameplayStop();
  app.keys.clear();
  const m = modal(
    [
      h('h2', {}, 'Пауза'),
      h(
        'div',
        { class: 'btns' },
        h('button', { class: 'btn yellow big', onclick: () => (m.close(), app.resume()) }, 'Продолжить'),
        h('button', {
          class: 'btn dark',
          onclick: () => {
            S().settings.sound = !S().settings.sound;
            setAudioSettings({ sound: S().settings.sound });
            store.save();
          },
          html: `${icon('sound')} Звук вкл/выкл`,
        }),
        h('button', {
          class: 'btn red',
          onclick: () => {
            m.close();
            app.paused = false;
            quitLevel('quit');
          },
        }, 'Вернуться на базу'),
      ),
    ],
    { onClose: () => app.paused && app.resume() },
  );
  app.pauseModal = m;
};

app.resume = () => {
  if (!app.paused) return;
  app.paused = false;
  const m = app.pauseModal;
  app.pauseModal = null;
  m?.close?.();
  engineMute(false);
  if (app.level) {
    app.level.paused = false;
    if (app.level.state !== 'dead') gameplayStart();
  }
};

function failModal(reason) {
  const lv = app.level;
  if (!lv) return;
  gameplayStop();
  const title = reason === 'player' ? 'Ты погиб!' : reason === 'fuel' ? 'Кончилось топливо!' : 'Машина уничтожена!';
  const text = reason === 'fuel' ? 'Без бензина дальше не уехать.' : 'Зомби оказались сильнее… но можно попробовать снова.';
  const canRevive = lv.revives < 2;
  const m = modal([
    h('h2', {}, title),
    h('p', {}, text),
    h(
      'div',
      { class: 'btns' },
      canRevive
        ? h('button', {
            class: 'btn yellow big',
            html: `${icon('video')} Продолжить`,
            onclick: async () => {
              if (await rewardAd()) {
                m.close();
                lv.revive();
                gameplayStart();
              }
            },
          })
        : null,
      h('button', {
        class: 'btn dark',
        onclick: () => {
          m.close();
          quitLevel('fail');
        },
      }, 'На базу (половина добычи)'),
    ),
  ]);
}

// Прерванная поездка: половина добычи, машина повреждена
function quitLevel(why) {
  const lv = app.level;
  if (!lv) return;
  const r = lv.result();
  const s = S();
  applyStats(r);
  for (const k of ['wood', 'metal', 'cloth', 'ammo']) s.inv[k] = (s.inv[k] || 0) + Math.floor(r.collected[k] / 2);
  s.cash += Math.floor(r.picked / 2);
  s.carHp[s.car] = why === 'fail' ? 0.25 : Math.max(0.25, r.carHpFrac);
  store.save();
  gameplayStop();
  ui().classList.remove('letterbox');
  lv.dispose();
  app.level = null;
  app.go('menu');
}

function applyStats(r) {
  const s = S();
  const lv = app.level;
  s.stats.kills += r.kills;
  s.stats.brutes += r.brutes;
  s.stats.bandits += r.bandits;
  s.stats.footKills += r.footKills;
  s.stats.crates += r.crates;
  s.stats.bosses = (s.stats.bosses || 0) + (r.bosses || 0);
  s.stats.distance += r.distance;
  s.stats.wood += r.collected.wood;
  s.stats.metal += r.collected.metal;
  s.stats.cloth += r.collected.cloth;
  if (r.refueled) s.stats.refuels++;
  // израсходованные предметы
  s.inv.repair = lv.inv.repair;
  s.inv.fuel = lv.inv.fuel;
  for (const k of ['med1', 'med2', 'med3', 'med4']) s.inv[k] = lv.inv[k];
  s.xp += Math.round(r.xp * 0.5);
}

// ------------------------------ прибытие на базу ------------------------------

function typeText(el, text, speed) {
  return new Promise((resolve) => {
    let i = 0;
    el.innerHTML = '<span class="caret"></span>';
    const iv = setInterval(() => {
      i++;
      el.innerHTML = `${text.slice(0, i)}<span class="caret"></span>`;
      if (text[i - 1] !== ' ') sfx.type();
      if (i >= text.length) {
        clearInterval(iv);
        resolve();
      }
    }, speed);
  });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function arrive(r) {
  const lv = app.level;
  const s = S();
  gameplayStop();
  const info = baseInfo(r.dest);
  const black = h('div', { class: 'black' }, h('div', { class: 'type' }), h('div', { class: 'type2' }));
  ui().append(black);
  await wait(30);
  black.classList.add('on');
  await wait(1000);
  ui().classList.remove('letterbox');
  app.screen?.remove();
  app.screen = null;
  app.view = 'black';
  stopMusic();
  await wait(400);
  await typeText(black.children[0], info.name.toUpperCase(), 170);
  sfx.typeBell();
  await wait(350);
  await typeText(black.children[1], info.sub, 70);
  await wait(1300);

  // применяем награды
  applyStats(r);
  s.xp += Math.round(r.xp * 0.5);
  s.base = Math.max(s.base, r.dest);
  s.stats.maxBase = Math.max(s.stats.maxBase, r.dest);
  s.stats.levels++;
  for (const k of ['wood', 'metal', 'cloth', 'ammo']) s.inv[k] = (s.inv[k] || 0) + r.collected[k];
  s.cash += r.cash;
  s.gold += r.bossGold || 0;
  s.carHp[s.car] = Math.max(0.05, r.carHpFrac);
  store.save();
  submitScore('bases', s.base);
  lv.dispose();
  app.level = null;

  // проявляется машина в гараже
  app.previewCar(s.car, s.equip);
  app.garage.lightsOn();
  app.garage.rot = -0.6;
  app.go('results', resultsPanel(r, info));
  black.classList.remove('on');
  setTimeout(() => black.remove(), 1000);
  sfx.lights();
  setTimeout(() => sfx.win(), 900);
}

function resultsPanel(r, info) {
  const el = h('div', { class: 'screen active' }, h('div', { class: 'orbit-zone' }));
  const s = S();
  const line = (ic, name, val, col) => h('div', { class: 'line' }, h('span', { html: `${icon(ic)} ${name}` }), h('b', { style: col ? { color: col } : {} }, val));
  let doubled = false;
  const total = h('b', {}, `+${fmt(r.cash)}`);
  const dbl = h('button', {
    class: 'btn yellow',
    html: `${icon('video')} ×2 награда`,
    onclick: async () => {
      if (doubled) return;
      if (await rewardAd()) {
        doubled = true;
        s.cash += r.cash;
        store.save();
        total.textContent = `+${fmt(r.cash * 2)}`;
        dbl.disabled = true;
        sfx.coin();
      }
    },
  });
  const li = levelInfo(s.xp);
  const panel = h(
    'div',
    { class: 'results panel' },
    h('h2', {}, info.name),
    h('div', { class: 'sub' }, info.sub),
    h('h4', {}, 'Собрано:'),
    ...['wood', 'metal', 'cloth', 'ammo'].map((k) => line(k, RESOURCES[k].name, `+${r.collected[k]}`, '#7ad84a')),
    line('skull', 'Зомби убито', `${r.kills}`, r.kills >= r.killGoal ? '#7ad84a' : null),
    r.bandits ? line('bandit', 'Бандитов', `${r.bandits}`) : null,
    line('cash', 'Подобрано', `+${fmt(r.picked)}`),
    line('home', 'Награда за базу', `+${fmt(r.baseReward)}`),
    r.bonus ? line('trophy', `Задание: ${r.killGoal} зомби`, `+${fmt(r.bonus)}`, '#7ad84a') : null,
    r.bossCash ? line('skull', 'Босс повержен', `+${fmt(r.bossCash)} · +${r.bossGold} зол.`, '#ffb01a') : null,
    h('div', { class: 'line total' }, h('span', { html: `${icon('cash')} Итого` }), total),
    h('div', { class: 'line', style: { color: 'var(--muted)', fontSize: '0.95rem' } }, h('span', {}, `Уровень ${li.lvl}`), h('span', {}, `Машина: ${Math.round(r.carHpFrac * 100)}%`)),
    h(
      'div',
      { class: 'row2', style: { display: 'flex', gap: '0.5rem' } },
      dbl,
      h('button', {
        class: 'btn green',
        style: { flex: 1 },
        onclick: async () => {
          await showFullscreenAd();
          app.go('menu');
        },
      }, 'Продолжить'),
    ),
  );
  el.append(panel);
  return el;
}

boot().catch((e) => {
  console.error(e);
  const l = document.getElementById('loading');
  if (l) l.querySelector('small').textContent = 'Ошибка запуска: ' + e.message;
});

void toast;
void findArmor;

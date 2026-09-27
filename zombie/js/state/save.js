// Сохранение прогресса: деньги, машины, детали, снаряжение, ресурсы, статистика.

import { CARS, PARTS, findCar, findPart, findGun, findArmor, GUNS } from '../data/catalog.js';
import { saveCloud } from '../platform/yandex.js';

const KEY = 'zroad_save_v1';

export function defaultSave() {
  return {
    v: 1,
    name: 'Игрок',
    cash: 2500,
    gold: 50,
    xp: 0,
    base: 1,
    car: 'rusty',
    cars: ['rusty'],
    carHp: { rusty: 1 },
    owned: { bumper: ['none'], grille: ['none'], paint: ['factory'], wheels: ['std'], weapon: ['mg1'] },
    equip: { bumper: 'none', grille: 'none', paint: 'factory', wheels: 'std', weapon: 'mg1' },
    guns: ['g17'],
    gun: 'g17',
    gunUp: {},
    armor: [],
    vest: null,
    helmet: null,
    inv: { wood: 0, metal: 0, cloth: 0, ammo: 2, repair: 1, fuel: 1, med1: 2, med2: 0, med3: 0, med4: 0, crate: 0 },
    baseUp: { workshop: 0, armory: 0, depot: 0 },
    stats: { kills: 0, brutes: 0, bandits: 0, footKills: 0, crates: 0, wood: 0, metal: 0, cloth: 0, distance: 0, purchases: 0, maxBase: 1, baseUps: 0, cars: 1, refuels: 0, levels: 0 },
    tasks: {},
    daily: { n: 0, last: '' },
    wheelLast: 0,
    settings: { sound: true, music: true, quality: 'auto', camera: 'cockpit', shake: true, autofire: false, sens: 1 },
  };
}

function merge(def, s) {
  if (!s || typeof s !== 'object') return def;
  const out = { ...def, ...s };
  for (const k of ['owned', 'equip', 'inv', 'baseUp', 'stats', 'settings', 'daily', 'carHp', 'gunUp', 'tasks']) {
    out[k] = { ...def[k], ...(s[k] || {}) };
  }
  for (const slot of Object.keys(def.owned)) {
    if (!Array.isArray(out.owned[slot])) out.owned[slot] = def.owned[slot];
  }
  if (!Array.isArray(out.cars) || !out.cars.length) out.cars = def.cars;
  if (!Array.isArray(out.guns) || !out.guns.length) out.guns = def.guns;
  if (!Array.isArray(out.armor)) out.armor = [];
  return out;
}

export const store = {
  data: defaultSave(),
  listeners: new Set(),

  load(cloud) {
    let local = null;
    try {
      local = JSON.parse(localStorage.getItem(KEY) || 'null');
    } catch {
      local = null;
    }
    // берём сохранение с большим прогрессом
    let pick = local;
    if (cloud && (!local || (cloud.xp || 0) >= (local.xp || 0))) pick = cloud;
    this.data = merge(defaultSave(), pick);
    return this.data;
  },

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      // приватный режим
    }
    saveCloud(this.data);
    this.listeners.forEach((fn) => fn(this.data));
  },

  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  },

  reset() {
    this.data = defaultSave();
    this.save();
  },
};

export const S = () => store.data;

// ------------------------------ уровень игрока ------------------------------

export function levelInfo(xp) {
  let lvl = 1;
  let need = 100;
  let rest = xp;
  while (rest >= need) {
    rest -= need;
    lvl++;
    need = 100 + (lvl - 1) * 60;
  }
  return { lvl, cur: rest, need };
}

// ------------------------------ деньги и ресурсы ------------------------------

export function canAfford(price, cur = 'cash') {
  return (cur === 'gold' ? S().gold : S().cash) >= price;
}

export function spend(price, cur = 'cash') {
  if (!canAfford(price, cur)) return false;
  if (cur === 'gold') S().gold -= price;
  else S().cash -= price;
  return true;
}

export function give(reward) {
  const s = S();
  if (!reward) return;
  if (reward.cash) s.cash += reward.cash;
  if (reward.gold) s.gold += reward.gold;
  if (reward.xp) s.xp += reward.xp;
  if (reward.res) for (const k in reward.res) s.inv[k] = (s.inv[k] || 0) + reward.res[k];
}

// ------------------------------ характеристики ------------------------------

export function carStats(carId = S().car, equip = S().equip) {
  const s = S();
  const car = findCar(carId);
  const bumper = findPart('bumper', equip.bumper);
  const grille = findPart('grille', equip.grille);
  const wheels = findPart('wheels', equip.wheels);
  const weapon = findPart('weapon', equip.weapon);
  const ws = 1 + (s.baseUp.workshop || 0) * 0.1;
  return {
    car,
    hp: Math.round((car.hp + bumper.hp + grille.hp) * ws),
    speed: car.speed + wheels.speed,
    handling: car.handling + wheels.handling,
    ram: car.ram + bumper.ram,
    fuel: Math.round(car.fuel * (1 + (s.baseUp.depot || 0) * 0.15)),
    trunk: car.trunk,
    armor: Math.min(0.6, (bumper.hp + grille.hp) / 160),
    weapon,
    spikes: wheels.spikes,
    dps: weapon.dmg * weapon.rate * (weapon.pellets || 1),
  };
}

export function gunStats(id = S().gun) {
  const g = findGun(id);
  const up = S().gunUp[id] || { dmg: 0, rate: 0, mag: 0 };
  return {
    ...g,
    dmg: Math.round(g.dmg * (1 + up.dmg * 0.1)),
    rpm: Math.round(g.rpm * (1 + up.rate * 0.1)),
    mag: g.mag ? g.mag + up.mag * 5 : 0,
    up,
  };
}

export function armorTotal() {
  const s = S();
  return (findArmor(s.vest)?.def || 0) + (findArmor(s.helmet)?.def || 0);
}

export function ownsPart(slot, id) {
  return S().owned[slot]?.includes(id);
}

export function allCarsCount() {
  return CARS.length;
}

export function allGunsCount() {
  return GUNS.length;
}

export function partList(slot) {
  return PARTS[slot];
}

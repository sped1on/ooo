// Сохранение прогресса игрока в localStorage: монеты, купленные скины, настройки.

import { DEFAULT_SKINS, SKIN_KINDS, isPlain } from '../data/skins.js';

const KEY = 'koridor.save.v1';
const DAY = 24 * 60 * 60 * 1000;

const DEFAULTS = {
  coins: 520,
  owned: { walls: [], field: [], pawns: [], finish: [], background: [], board8: [], chessPieces: [], checkersPieces: [] },
  equipped: { ...DEFAULT_SKINS },
  lastBonus: 0,
  updated: 0,
  stats: { played: 0, wins: 0 },
  lessons: { koridor: { novice: 1, skilled: 1 }, chess: { novice: 1, skilled: 1 }, checkers: { novice: 1, skilled: 1 } },
  prefs: {
    time: 60,
    mode: 'online',
    size: 9,
    botLevel: 'medium',
  },
  settings: {
    sound: true,
    volume: 0.7,
    hints: true,
    autoWalls: true,
    checkerRows: true,
    animations: true,
    tilt: 55,
    rotateHotseat: false,
    name: '',
  },
};

// Старые или неизвестные id скинов заменяем значениями по умолчанию
function sanitizeSkins(st) {
  for (const kind of Object.keys(SKIN_KINDS)) {
    const k = SKIN_KINDS[kind];
    const known = (id) => k.colors.some((s) => s.id === id) || k.list.some((s) => s.id === id);
    st.owned[kind] = (st.owned[kind] || []).filter((id) => k.list.some((s) => s.id === id));
    if (!known(st.equipped[kind])) st.equipped[kind] = DEFAULT_SKINS[kind];
  }
  return st;
}

function merge(raw) {
  return sanitizeSkins({
    ...structuredClone(DEFAULTS),
    ...raw,
    owned: { ...DEFAULTS.owned, ...raw.owned },
    equipped: { ...DEFAULTS.equipped, ...raw.equipped },
    stats: { ...DEFAULTS.stats, ...raw.stats },
    lessons: { ...structuredClone(DEFAULTS.lessons), ...raw.lessons },
    prefs: { ...DEFAULTS.prefs, ...raw.prefs },
    settings: { ...DEFAULTS.settings, ...raw.settings },
  });
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    return raw ? merge(raw) : structuredClone(DEFAULTS);
  } catch {
    return structuredClone(DEFAULTS);
  }
}

const listeners = new Set();
export const state = load();

export function save() {
  state.updated = Date.now();
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Хранилище недоступно (приватный режим) — играем без сохранения
  }
  listeners.forEach((fn) => fn(state));
}

// Применить сохранение из облака, если оно новее локального
export function applyCloudSave(raw) {
  if (!raw || typeof raw !== 'object') return false;
  if ((raw.updated || 0) <= (state.updated || 0)) return false;
  const merged = merge(raw);
  Object.keys(state).forEach((k) => delete state[k]);
  Object.assign(state, merged);
  save();
  return true;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function addCoins(amount) {
  state.coins = Math.max(0, state.coins + amount);
  save();
}

export function isOwned(kind, id) {
  return isPlain(kind, id) || state.owned[kind].includes(id);
}

export function buy(kind, skin) {
  if (isOwned(kind, skin.id)) return true;
  if (state.coins < skin.price) return false;
  state.coins -= skin.price;
  state.owned[kind].push(skin.id);
  state.equipped[kind] = skin.id;
  save();
  return true;
}

// Купить набор: все недостающие скины со скидкой, сразу надеть
export function buySet(set, price) {
  if (state.coins < price) return false;
  state.coins -= price;
  for (const [kind, id] of Object.entries(set.skins)) {
    if (!isOwned(kind, id)) state.owned[kind].push(id);
    state.equipped[kind] = id;
  }
  save();
  return true;
}

export function equipSet(set) {
  for (const [kind, id] of Object.entries(set.skins)) if (isOwned(kind, id)) state.equipped[kind] = id;
  save();
}

export function equip(kind, id) {
  if (!isOwned(kind, id)) return;
  state.equipped[kind] = id;
  save();
}

// Ежедневный бонус по кнопке «+»
export function claimBonus(now = Date.now()) {
  const left = state.lastBonus + DAY - now;
  if (left > 0) return { ok: false, left };
  state.lastBonus = now;
  state.coins += 100;
  save();
  return { ok: true, amount: 100 };
}

export function resetProgress() {
  const fresh = structuredClone(DEFAULTS);
  fresh.settings = { ...state.settings };
  Object.keys(state).forEach((k) => delete state[k]);
  Object.assign(state, fresh);
  save();
}

export function playerName() {
  return state.settings.name.trim() || 'Игрок';
}

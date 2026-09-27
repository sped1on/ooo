// Каталог скинов. У каждого вида есть бесплатные однотонные цвета (colors)
// и платные текстурные скины (list). Внешний вид задаётся рецептом текстуры
// (render/textures.js) и параметрами материала.

export const PLAYER_COLORS = ['#2f7dff', '#ff2d3d'];

// ---------- Поле (доска) ----------
// surf — текстура на всю доску, frame — текстура рамки, decor — украшения рамки

const fieldColor = (id, name, c, frame) => ({
  id,
  name,
  plain: true,
  surf: { r: 'stone', p: { c, slabs: 1 } },
  frame: { r: 'plain', p: { c: frame } },
  rough: 0.6,
});

const FIELD_COLORS = [
  fieldColor('c-graphite', 'Графит', '#3a404d', '#232836'),
  fieldColor('c-slate', 'Сланец', '#55606f', '#2b323d'),
  fieldColor('c-sandc', 'Беж', '#b89a6e', '#6e5536'),
  fieldColor('c-snow', 'Светлый', '#c9ced8', '#6c7482'),
  fieldColor('c-navy', 'Индиго', '#27305e', '#161b38'),
  fieldColor('c-moss', 'Мох', '#3f5a3a', '#243322'),
  fieldColor('c-wine', 'Бордо', '#5a2330', '#33131b'),
];

const FIELD_SKINS = [
  { id: 'wood', name: 'Дерево', price: 150, surf: { r: 'wood', p: { c: '#a86a34', c2: '#5a3314', planks: 9, bevel: false } }, frame: { r: 'wood', p: { c: '#6d4220', c2: '#2f1a0a', planks: 2, bevel: false } }, decor: 'bolts', rough: 0.7 },
  { id: 'sand', name: 'Песок', price: 150, surf: { r: 'sand', p: { c: '#d9b27a' } }, frame: { r: 'sandstone', p: { c: '#c49a64' } }, decor: 'rocks', decorColor: '#9a7448', rough: 0.95 },
  { id: 'marble', name: 'Мрамор', price: 250, surf: { r: 'marble', p: { c: '#e6e9ee', c2: '#6a7280' } }, frame: { r: 'stone', p: { c: '#6b7280', slabs: 1 } }, decor: 'bolts', rough: 0.28 },
  { id: 'metal', name: 'Металл', price: 200, surf: { r: 'metal', p: { c: '#6f7784', plates: 4 } }, frame: { r: 'metal', p: { c: '#3d434d', plates: 1 } }, decor: 'hazard', rough: 0.4, metal: 0.6 },
  { id: 'grass', name: 'Трава', price: 150, surf: { r: 'grass', p: { c: '#4a9a3c' } }, frame: { r: 'soil', p: { c: '#5b3f25' } }, decor: 'bushes', rough: 0.95 },
  { id: 'lava', name: 'Лава', price: 300, surf: { r: 'lava', p: { c: '#262022', glow: '#ff6a1a' } }, frame: { r: 'stone', p: { c: '#2d2a2c', slabs: 1 } }, decor: 'rocks', decorColor: '#2a2224', glow: 1.8, rough: 0.85 },
  { id: 'crystals', name: 'Кристаллы', price: 350, surf: { r: 'crystal', p: { c: '#5a2fd0', cells: 8 } }, frame: { r: 'stone', p: { c: '#2a2140', slabs: 1 } }, decor: 'crystals', decorColor: '#8a5cff', glow: 0.7, rough: 0.25 },
  { id: 'space', name: 'Космос', price: 300, surf: { r: 'space', p: { c: '#080a22', c2: '#6b2ad8', c3: '#1c6ad8' } }, frame: { r: 'metal', p: { c: '#262b3a', plates: 1, rivets: false } }, decor: 'lights', decorColor: '#4db8ff', glow: 0.9, rough: 0.4 },
  { id: 'dunes', name: 'Пустыня', price: 200, surf: { r: 'dunes', p: { c: '#d99a5a' } }, frame: { r: 'sandstone', p: { c: '#b97c45' } }, decor: 'rocks', decorColor: '#a0673a', rough: 0.95 },
  { id: 'portal', name: 'Портал', price: 400, surf: { r: 'portal', p: { c: '#0a1030', glow: '#3d8bff' } }, frame: { r: 'techno', p: { c: '#0b1426', glow: '#a04dff' } }, decor: 'lights', decorColor: '#a04dff', glow: 1.4, rough: 0.4 },
  { id: 'swamp', name: 'Болото', price: 200, surf: { r: 'swamp', p: { c: '#4d5e33' } }, frame: { r: 'stone', p: { c: '#3d4630', slabs: 1 } }, decor: 'bushes', rough: 0.9 },
  { id: 'sandstone', name: 'Песчаник', price: 200, surf: { r: 'sandstone', p: { c: '#d49a62' } }, frame: { r: 'sandstone', p: { c: '#b47a44' } }, decor: 'pillars', decorColor: '#b47a44', rough: 0.9 },
  { id: 'ice', name: 'Лёд', price: 250, surf: { r: 'ice', p: { c: '#7cc4f2', bevel: false } }, frame: { r: 'ice', p: { c: '#5d9fd0', bevel: false } }, decor: 'icerocks', decorColor: '#b6dcf5', glow: 0.35, rough: 0.15 },
  { id: 'cyber', name: 'Киберпанк', price: 350, surf: { r: 'neongrid', p: { c: '#0c0826', glow: '#8a4dff', lines: 9 } }, frame: { r: 'techno', p: { c: '#081226', glow: '#22e4ff' } }, decor: 'lights', decorColor: '#ff3ccf', glow: 1.3, rough: 0.35 },
  { id: 'mystic', name: 'Дерево мистик', price: 350, surf: { r: 'mystic', p: { c: '#3a2a22', glow: '#2fb8ff' } }, frame: { r: 'wood', p: { c: '#3b2a1e', c2: '#1a120c', planks: 2, bevel: false } }, decor: 'bolts', glow: 1.3, rough: 0.75 },
  { id: 'volcano', name: 'Вулкан', price: 300, surf: { r: 'lava', p: { c: '#2b2427', glow: '#ff3a0a', big: true } }, frame: { r: 'cobble', p: { c: '#3a3436' } }, decor: 'rocks', decorColor: '#2a2224', glow: 1.8, rough: 0.85 },
  { id: 'plants', name: 'Растения', price: 250, surf: { r: 'cobble', p: { c: '#6e7275' } }, frame: { r: 'leaves', p: { c: '#2f7a2c' } }, decor: 'flowers', rough: 0.85 },
  { id: 'dragon', name: 'Кожа дракона', price: 400, surf: { r: 'scales', p: { c: '#6a1a1c', glow: '#ff2a1a' } }, frame: { r: 'stone', p: { c: '#231c1e', slabs: 1 } }, decor: 'spikes', decorColor: '#2a1d1f', glow: 0.6, rough: 0.5 },
  { id: 'techgrid', name: 'Техно', price: 300, surf: { r: 'techgrid', p: { c: '#0a1a26', glow: '#1ec8e8' } }, frame: { r: 'techno', p: { c: '#081420', glow: '#2f7dff' } }, decor: 'lights', decorColor: '#22e4ff', glow: 1.1, rough: 0.4 },
  { id: 'ruins', name: 'Руины', price: 250, surf: { r: 'ruins', p: { c: '#7a7c78' } }, frame: { r: 'cobble', p: { c: '#6a6c68' } }, decor: 'pillars', decorColor: '#6a6c68', rough: 0.9 },
  { id: 'galaxy', name: 'Галактика', price: 400, surf: { r: 'space', p: { c: '#0a0620', c2: '#8a2ae8', c3: '#2a4ae8', galaxy: true } }, frame: { r: 'metal', p: { c: '#2a2d3a', plates: 1, rivets: false } }, decor: 'lights', decorColor: '#b04dff', glow: 1, rough: 0.4 },
  { id: 'snow', name: 'Снег', price: 250, surf: { r: 'snow', p: { c: '#e8eef6' } }, frame: { r: 'stone', p: { c: '#8a96a6', slabs: 1 } }, decor: 'icerocks', decorColor: '#5d6674', rough: 0.8 },
  { id: 'brick', name: 'Кирпич', price: 150, surf: { r: 'brick', p: { c: '#a3472f', rows: 18 } }, frame: { r: 'stone', p: { c: '#4a4a4f', slabs: 1 } }, decor: 'bolts', rough: 0.85 },
  { id: 'tiles', name: 'Плитка', price: 150, surf: { r: 'tile', p: { c: '#d9dde4', grid: 9 } }, frame: { r: 'plain', p: { c: '#555c68' } }, rough: 0.3 },
  { id: 'carpet', name: 'Ковёр', price: 200, surf: { r: 'carpet', p: { c: '#8e1b22', c2: '#d8a94a' } }, frame: { r: 'wood', p: { c: '#5a3417', c2: '#26140a', planks: 2, bevel: false } }, decor: 'bolts', rough: 0.95 },
  { id: 'pixel', name: 'Пиксели', price: 250, surf: { r: 'pixel', p: { grid: 27 } }, frame: { r: 'pixel', p: { grid: 8, palette: ['#1d2b53', '#29366f', '#3b5dc9'] } }, rough: 0.6 },
];

// ---------- Стены ----------

const wallColor = (id, name, c, glow) => ({ id, name, plain: true, r: 'plain', p: { c }, glow: glow ? 1.6 : 0, glowColor: glow ? c : null, rough: 0.35, metal: 0.1 });

const WALL_COLORS = [
  wallColor('c-grey', 'Серая', '#c3cad6'),
  wallColor('c-white', 'Белая', '#f2f4f8'),
  wallColor('c-black', 'Чёрная', '#23252b'),
  wallColor('c-blue', 'Синяя', '#2f8bff', true),
  wallColor('c-red', 'Красная', '#ff2d3d', true),
  wallColor('c-goldc', 'Золотая', '#ffc23d', true),
  wallColor('c-green', 'Зелёная', '#36e27d', true),
  wallColor('c-violet', 'Фиолетовая', '#a64dff', true),
];

const WALL_SKINS = [
  { id: 'stone', name: 'Камень', price: 150, r: 'stone', p: { c: '#8b9099', slabs: 1 }, rough: 0.9 },
  { id: 'metal', name: 'Металл', price: 200, r: 'brushed', p: { c: '#b9c2cf' }, rough: 0.3, metal: 0.85 },
  { id: 'wood', name: 'Дерево', price: 150, r: 'wood', p: { c: '#a8662f', c2: '#4a2a10', planks: 1, bevel: false }, rough: 0.7 },
  { id: 'ice', name: 'Лёд', price: 200, r: 'ice', p: { c: '#6cc7ff', bevel: false }, rough: 0.1, opacity: 0.85, glow: 0.8, glowColor: '#6cc7ff' },
  { id: 'lava', name: 'Лава', price: 250, r: 'lava', p: { c: '#221715', glow: '#ff5a14' }, rough: 0.8, glow: 2, glowColor: '#ff5a14' },
  { id: 'neon', name: 'Неон', price: 250, r: 'neon', p: { c: '#140b26', glow: '#b04dff' }, rough: 0.35, glow: 2.2, glowColor: '#b04dff' },
  { id: 'brick', name: 'Кирпич', price: 150, r: 'brick', p: { c: '#a3472f', rows: 3 }, rough: 0.85 },
  { id: 'sandstone', name: 'Песчаник', price: 150, r: 'sandstone', p: { c: '#d9b98a' }, rough: 0.9 },
  { id: 'ceramic', name: 'Керамика', price: 150, r: 'tile', p: { c: '#e9e4dc', c2: '#9a948a', grid: 1 }, rough: 0.2 },
  { id: 'plastic', name: 'Пластик', price: 100, r: 'plastic', p: { c: '#3a4150' }, rough: 0.4 },
  { id: 'glass', name: 'Стекло', price: 250, r: 'glass', p: { c: '#7cc6ff' }, rough: 0.05, opacity: 0.55, glow: 0.4, glowColor: '#7cc6ff' },
  { id: 'techno', name: 'Техно', price: 300, r: 'techno', p: { c: '#06121f', glow: '#22e4ff' }, rough: 0.35, glow: 1.8, glowColor: '#22e4ff' },
  { id: 'rope', name: 'Верёвка', price: 150, r: 'rope', p: { c: '#a47a4a' }, rough: 0.95 },
  { id: 'grating', name: 'Решётка', price: 200, r: 'grating', p: { c: '#7a818c' }, rough: 0.4, metal: 0.7 },
  { id: 'leaves', name: 'Листья', price: 200, r: 'leaves', p: { c: '#2f7a2c' }, rough: 0.8 },
  { id: 'marble', name: 'Мрамор', price: 250, r: 'marble', p: { c: '#eceef2', c2: '#5d6470' }, rough: 0.25 },
  { id: 'gold', name: 'Золото', price: 350, r: 'gold', p: { c: '#e8b53c' }, rough: 0.22, metal: 0.9 },
  { id: 'crystal', name: 'Кристалл', price: 350, r: 'crystal', p: { c: '#7d4dff' }, rough: 0.1, opacity: 0.85, glow: 1, glowColor: '#9a6bff' },
  { id: 'space', name: 'Космос', price: 300, r: 'space', p: { c: '#0a0a24', c2: '#7a2ad8', c3: '#1b7ad8' }, rough: 0.4, glow: 0.9 },
  { id: 'flame', name: 'Огонь', price: 300, r: 'lava', p: { c: '#3a1208', glow: '#ffae2a' }, rough: 0.8, glow: 2.2, glowColor: '#ff7a1a' },
];

// ---------- Фишки ----------
// style: color | metal | tex | glass | neon

const pawnColor = (id, name, c) => ({ id, name, plain: true, style: 'color', c });

const PAWN_COLORS = [
  { id: 'c-player', name: 'Цвет игрока', plain: true, style: 'color', c: null },
  pawnColor('c-white', 'Белый', '#eef1f6'),
  pawnColor('c-black', 'Чёрный', '#23252c'),
  pawnColor('c-red', 'Красный', '#e8202f'),
  pawnColor('c-blue', 'Синий', '#1f6bff'),
  pawnColor('c-yellow', 'Жёлтый', '#ffc21a'),
  pawnColor('c-green', 'Зелёный', '#19b85a'),
  pawnColor('c-violet', 'Фиолетовый', '#7b3cf0'),
  pawnColor('c-orange', 'Оранжевый', '#ff7a1a'),
  pawnColor('c-pink', 'Розовый', '#ff9cc9'),
  pawnColor('c-cyan', 'Голубой', '#4fd6ff'),
];

const PAWN_SKINS = [
  { id: 'stone', name: 'Камень', price: 150, style: 'tex', r: 'granite', p: { c: '#6d7078' }, rough: 0.85 },
  { id: 'metal', name: 'Металл', price: 200, style: 'metal', c: '#aeb8c6', rough: 0.3 },
  { id: 'wood', name: 'Дерево', price: 150, style: 'tex', r: 'wood', p: { c: '#9a5a28', c2: '#4a2a10', planks: 1, bevel: false }, rough: 0.6 },
  { id: 'ice', name: 'Лёд', price: 250, style: 'glass', c: '#8fdcff', emissive: 0.5, opacity: 0.8 },
  { id: 'lava', name: 'Лава', price: 300, style: 'tex', r: 'lava', p: { c: '#1a1010', glow: '#ff5a14' }, glow: 1.8, rough: 0.8 },
  { id: 'neon', name: 'Неон', price: 250, style: 'neon', c: '#7b3cff' },
  { id: 'gold', name: 'Золото', price: 300, style: 'metal', c: '#f1c24e', rough: 0.2 },
  { id: 'silver', name: 'Серебро', price: 250, style: 'metal', c: '#dfe4ec', rough: 0.15 },
  { id: 'platinum', name: 'Платина', price: 350, style: 'metal', c: '#c9d3e2', rough: 0.08 },
  { id: 'blackgold', name: 'Чёрное золото', price: 400, style: 'tex', r: 'lava', p: { c: '#141214', glow: '#e8b53c' }, glow: 1.2, rough: 0.3, metal: 0.6 },
  { id: 'crystal', name: 'Кристалл', price: 350, style: 'glass', c: '#9a6bff', emissive: 0.7, opacity: 0.85, faceted: true },
  { id: 'ruby', name: 'Рубин', price: 350, style: 'glass', c: '#ff1f45', emissive: 0.5, opacity: 0.88, faceted: true },
  { id: 'emerald', name: 'Изумруд', price: 350, style: 'glass', c: '#1fe07a', emissive: 0.5, opacity: 0.88, faceted: true },
  { id: 'diamond', name: 'Алмаз', price: 450, style: 'glass', c: '#e6f6ff', emissive: 0.35, opacity: 0.7, faceted: true },
  { id: 'glass', name: 'Прозрачный', price: 200, style: 'glass', c: '#bfe3ff', emissive: 0.15, opacity: 0.45 },
  { id: 'matte', name: 'Матовый', price: 100, style: 'color', c: '#2a2d35', rough: 0.95 },
  { id: 'flame', name: 'Пламя', price: 300, style: 'tex', r: 'flame', p: {}, glow: 1.6, rough: 0.7 },
  { id: 'toxic', name: 'Токсин', price: 250, style: 'neon', c: '#3dff3d' },
  { id: 'cosmos', name: 'Космос', price: 350, style: 'tex', r: 'space', p: { c: '#0a0a24', c2: '#b02ad8', c3: '#2a6ad8' }, glow: 0.9, rough: 0.3 },
  { id: 'rainbow', name: 'Радуга', price: 300, style: 'tex', r: 'rainbow', p: {}, glow: 0.25, rough: 0.3 },
  { id: 'ghost', name: 'Призрак', price: 250, style: 'glass', c: '#dfe9ff', emissive: 0.6, opacity: 0.5 },
  { id: 'marble', name: 'Мрамор', price: 250, style: 'tex', r: 'marble', p: { c: '#f0f1f4', c2: '#5d6470' }, rough: 0.25 },
  { id: 'pastel', name: 'Пастель', price: 100, style: 'color', c: '#ffb3d9', rough: 0.5 },
];

// ---------- Финиш ----------

const finishColor = (id, name, c) => ({ id, name, plain: true, glowColor: c });

const FINISH_COLORS = [
  { id: 'c-player', name: 'Цвет игрока', plain: true, glowColor: null },
  finishColor('c-blue', 'Синий', '#2f8bff'),
  finishColor('c-red', 'Красный', '#ff2d3d'),
  finishColor('c-goldc', 'Золотой', '#ffc23d'),
  finishColor('c-green', 'Зелёный', '#36e27d'),
  finishColor('c-violet', 'Фиолетовый', '#a64dff'),
  finishColor('c-white', 'Белый', '#eef3ff'),
];

const FINISH_SKINS = [
  { id: 'neon', name: 'Неон', price: 150, r: 'neon', p: { c: '#140b26', glow: '#b04dff' }, glowColor: '#b04dff' },
  { id: 'gold', name: 'Золото', price: 250, r: 'gold', p: { c: '#e8b53c' }, glowColor: '#ffc23d', metal: 0.8 },
  { id: 'metal', name: 'Металл', price: 150, r: 'brushed', p: { c: '#c3cbd6' }, glowColor: '#9fb4d8', metal: 0.8 },
  { id: 'wood', name: 'Дерево', price: 150, r: 'wood', p: { c: '#a8662f', c2: '#4a2a10', planks: 1, bevel: false }, glowColor: '#ffb070' },
  { id: 'stone', name: 'Камень', price: 150, r: 'stone', p: { c: '#8b9099', slabs: 1 }, glowColor: '#c9d4ec' },
  { id: 'crystal', name: 'Кристалл', price: 300, r: 'crystal', p: { c: '#7d4dff' }, glowColor: '#9a6bff' },
  { id: 'flame', name: 'Пламя', price: 300, r: 'lava', p: { c: '#3a1208', glow: '#ffae2a' }, glowColor: '#ff6a1a' },
  { id: 'techno', name: 'Техно', price: 250, r: 'techno', p: { c: '#06121f', glow: '#22e4ff' }, glowColor: '#22e4ff' },
  { id: 'sand', name: 'Песок', price: 150, r: 'sand', p: { c: '#d9b27a' }, glowColor: '#ffcf8a' },
  { id: 'ice', name: 'Лёд', price: 200, r: 'ice', p: { c: '#6cc7ff', bevel: false }, glowColor: '#6cc7ff' },
  { id: 'tricolor', name: 'Классика', price: 200, r: 'tricolor', p: {}, glowColor: '#dfe6ff' },
];

// ---------- Фон ----------
// particles: stars | embers | snow | bubbles | sparks | digital | leaves | dust

const bgColor = (id, name, c, c2) => ({ id, name, plain: true, r: 'backdrop', p: { c, c2 }, particles: 'dust', accent: c });

const BG_COLORS = [
  bgColor('c-night', 'Ночь', '#16213d', '#060912'),
  bgColor('c-dark', 'Тёмный', '#1a1b20', '#050506'),
  bgColor('c-light', 'Светлый', '#8792a6', '#3a4150'),
  bgColor('c-indigo', 'Индиго', '#2a1d5c', '#0a0620'),
  bgColor('c-wine', 'Бордо', '#4a1420', '#12040a'),
  bgColor('c-emerald', 'Изумруд', '#0f3d33', '#03110e'),
];

const BG_SKINS = [
  { id: 'stars', name: 'Звёздное небо', price: 200, r: 'space', p: { c: '#070a24', c2: '#6b2ad8', c3: '#1c4ad8' }, particles: 'stars', accent: '#6b4dff' },
  { id: 'waves', name: 'Цветные волны', price: 250, r: 'waves', p: {}, particles: 'sparks', accent: '#ff3ccf' },
  { id: 'digital', name: 'Цифровой', price: 250, r: 'digital', p: {}, particles: 'digital', accent: '#22c7ff' },
  { id: 'flame', name: 'Пламя', price: 250, r: 'flame', p: {}, particles: 'embers', accent: '#ff6a1a', dim: 0.55 },
  { id: 'marble', name: 'Мрамор', price: 200, r: 'marble', p: { c: '#2a2d33', c2: '#c9ced8' }, particles: 'dust', accent: '#9aa4b8', dim: 0.7 },
  { id: 'granite', name: 'Гранит', price: 150, r: 'granite', p: { c: '#4a4d55' }, particles: 'dust', accent: '#8a8f99', dim: 0.7 },
  { id: 'fantasy', name: 'Фэнтези', price: 300, r: 'fantasy', p: {}, particles: 'sparks', accent: '#8a5cff' },
  { id: 'pixels', name: 'Пиксели', price: 200, r: 'pixel', p: { grid: 24 }, particles: 'digital', accent: '#41a6f6', dim: 0.7 },
  { id: 'camo', name: 'Камуфляж', price: 150, r: 'camo', p: {}, particles: 'leaves', accent: '#7a8a4a', dim: 0.75 },
  { id: 'rainbow', name: 'Радуга', price: 250, r: 'rainbow', p: {}, particles: 'sparks', accent: '#ff4df0', dim: 0.5 },
  { id: 'ocean', name: 'Океан', price: 250, r: 'ocean', p: {}, particles: 'bubbles', accent: '#3db8ff' },
  { id: 'desert', name: 'Пустыня', price: 200, r: 'desert', p: {}, particles: 'dust', accent: '#ffb070', dim: 0.8 },
  { id: 'forest', name: 'Лес', price: 200, r: 'forest', p: {}, particles: 'leaves', accent: '#6adf6a' },
  { id: 'winter', name: 'Зима', price: 200, r: 'backdrop', p: { c: '#3a5a80', c2: '#0c1626' }, particles: 'snow', accent: '#bfe3ff' },
];

// ---------- Наборы (готовые комбинации) ----------

export const SETS = [
  { id: 'cyberpunk', name: 'Киберпанк', skins: { field: 'cyber', walls: 'neon', pawns: 'neon', finish: 'neon', background: 'digital' } },
  { id: 'western', name: 'Дикий запад', skins: { field: 'wood', walls: 'rope', pawns: 'wood', finish: 'wood', background: 'desert' } },
  { id: 'samurai', name: 'Самурай', skins: { field: 'dragon', walls: 'c-red', pawns: 'ruby', finish: 'c-red', background: 'c-wine' } },
  { id: 'desert', name: 'Пустыня', skins: { field: 'dunes', walls: 'sandstone', pawns: 'gold', finish: 'sand', background: 'desert' } },
  { id: 'cosmos', name: 'Космос', skins: { field: 'galaxy', walls: 'space', pawns: 'cosmos', finish: 'crystal', background: 'stars' } },
  { id: 'jungle', name: 'Джунгли', skins: { field: 'plants', walls: 'leaves', pawns: 'emerald', finish: 'c-green', background: 'forest' } },
  { id: 'volcano', name: 'Вулкан', skins: { field: 'volcano', walls: 'lava', pawns: 'lava', finish: 'flame', background: 'flame' } },
  { id: 'winter', name: 'Зима', skins: { field: 'snow', walls: 'ice', pawns: 'ice', finish: 'ice', background: 'winter' } },
  { id: 'portal', name: 'Портал', skins: { field: 'portal', walls: 'techno', pawns: 'crystal', finish: 'techno', background: 'fantasy' } },
];

// ---------- Шахматы и шашки ----------
// Доска 8×8: light/dark — текстуры светлых и тёмных полей на всю доску

const board8Color = (id, name, light, dark, frame) => ({ id, name, plain: true, light: { r: 'plain', p: { c: light } }, dark: { r: 'plain', p: { c: dark } }, frame: { r: 'plain', p: { c: frame } }, rough: 0.45 });

const BOARD8_COLORS = [
  { id: 'c-wood', name: 'Дерево', plain: true, light: { r: 'wood', p: { c: '#e2c28f', c2: '#b8894f', planks: 8, bevel: false } }, dark: { r: 'wood', p: { c: '#8a5328', c2: '#4e2a10', planks: 8, bevel: false } }, frame: { r: 'wood', p: { c: '#5c3317', c2: '#2a1606', planks: 2, bevel: false } }, rough: 0.5, label: '#f0d7a8' },
  board8Color('c-tournament', 'Турнирная', '#eeeed2', '#769656', '#3d4a2e'),
  board8Color('c-blue', 'Голубая', '#dee3e6', '#8ca2ad', '#3e4a52'),
  board8Color('c-brown', 'Коричневая', '#f0d9b5', '#b58863', '#5a3a22'),
  board8Color('c-grey', 'Серая', '#cfd3da', '#6b7280', '#2b2f38'),
  board8Color('c-night', 'Ночная', '#4a5568', '#1f2533', '#10141d'),
];

const BOARD8_SKINS = [
  { id: 'marble', name: 'Мрамор', price: 250, light: { r: 'marble', p: { c: '#eef0f3', c2: '#8a909b' } }, dark: { r: 'marble', p: { c: '#3a3d45', c2: '#b9bec8' } }, frame: { r: 'marble', p: { c: '#26282e', c2: '#9aa0aa' } }, rough: 0.25 },
  { id: 'stone', name: 'Камень', price: 150, light: { r: 'stone', p: { c: '#b9bdc4', slabs: 1 } }, dark: { r: 'stone', p: { c: '#5d626b', slabs: 1 } }, frame: { r: 'cobble', p: { c: '#6a6c70' } }, rough: 0.85 },
  { id: 'glass', name: 'Стекло', price: 300, light: { r: 'glass', p: { c: '#bfe3ff' } }, dark: { r: 'glass', p: { c: '#2a4a7a' } }, frame: { r: 'metal', p: { c: '#3a4150', plates: 1, rivets: false } }, rough: 0.05 },
  { id: 'neon', name: 'Неон', price: 350, light: { r: 'neongrid', p: { c: '#1b1236', glow: '#b04dff', lines: 8 } }, dark: { r: 'neongrid', p: { c: '#07060f', glow: '#22e4ff', lines: 8 } }, frame: { r: 'techno', p: { c: '#081226', glow: '#ff3ccf' } }, rough: 0.35, glow: 1.2 },
  { id: 'metal', name: 'Металл', price: 200, light: { r: 'brushed', p: { c: '#c9d0da' } }, dark: { r: 'brushed', p: { c: '#555d6a' } }, frame: { r: 'metal', p: { c: '#3a414c', plates: 1 } }, rough: 0.3, metal: 0.6 },
  { id: 'ice', name: 'Лёд', price: 250, light: { r: 'ice', p: { c: '#cfeaff', bevel: false } }, dark: { r: 'ice', p: { c: '#3d8fd0', bevel: false } }, frame: { r: 'ice', p: { c: '#6aa8d8', bevel: false } }, rough: 0.12, glow: 0.3 },
  { id: 'lava', name: 'Лава', price: 300, light: { r: 'stone', p: { c: '#6b5f5a', slabs: 1 } }, dark: { r: 'lava', p: { c: '#241a18', glow: '#ff5a14' } }, frame: { r: 'stone', p: { c: '#2d2a2c', slabs: 1 } }, rough: 0.8, glow: 1.6 },
  { id: 'space', name: 'Космос', price: 350, light: { r: 'space', p: { c: '#2a2f6a', c2: '#8a6bff', c3: '#4db8ff' } }, dark: { r: 'space', p: { c: '#05061a', c2: '#6b2ad8', c3: '#1c4ad8' } }, frame: { r: 'metal', p: { c: '#262b3a', plates: 1, rivets: false } }, rough: 0.35, glow: 0.8 },
  { id: 'sand', name: 'Песок', price: 150, light: { r: 'sand', p: { c: '#ecd3a4' } }, dark: { r: 'sandstone', p: { c: '#b47a44' } }, frame: { r: 'sandstone', p: { c: '#8a5a2c' } }, rough: 0.9 },
  { id: 'grass', name: 'Газон', price: 150, light: { r: 'grass', p: { c: '#7cc05a' } }, dark: { r: 'grass', p: { c: '#3a7a2c' } }, frame: { r: 'soil', p: { c: '#5b3f25' } }, rough: 0.9 },
  { id: 'gold', name: 'Золото', price: 400, light: { r: 'gold', p: { c: '#f3d27a' } }, dark: { r: 'marble', p: { c: '#1d1b1a', c2: '#b8913a' } }, frame: { r: 'gold', p: { c: '#b8862c' } }, rough: 0.25, metal: 0.5 },
  { id: 'dragon', name: 'Дракон', price: 400, light: { r: 'stone', p: { c: '#8a7f7a', slabs: 1 } }, dark: { r: 'scales', p: { c: '#6a1a1c', glow: '#ff2a1a', grid: 16 } }, frame: { r: 'stone', p: { c: '#231c1e', slabs: 1 } }, rough: 0.5, glow: 0.6 },
  { id: 'cyber', name: 'Киберпанк', price: 350, light: { r: 'techgrid', p: { c: '#12324a', glow: '#1ec8e8' } }, dark: { r: 'techgrid', p: { c: '#050d16', glow: '#ff3ccf' } }, frame: { r: 'techno', p: { c: '#081420', glow: '#2f7dff' } }, rough: 0.4, glow: 1 },
  { id: 'wood-dark', name: 'Эбен', price: 200, light: { r: 'wood', p: { c: '#c79a64', c2: '#8a5f30', planks: 8, bevel: false } }, dark: { r: 'wood', p: { c: '#3a2416', c2: '#1a0e06', planks: 8, bevel: false } }, frame: { r: 'wood', p: { c: '#2a1a0e', c2: '#0e0804', planks: 2, bevel: false } }, rough: 0.45 },
];

// Фигуры: w/b — материал белых и чёрных (как у фишек: color | metal | tex | glass | neon)
const pieceColor = (id, name, w, b) => ({ id, name, plain: true, w: { style: 'color', c: w, rough: 0.35 }, b: { style: 'color', c: b, rough: 0.35 } });

const PIECE_COLORS = [
  { id: 'c-classic', name: 'Классика', plain: true, w: { style: 'tex', r: 'wood', p: { c: '#f1dcb4', c2: '#c9a877', planks: 1, bevel: false }, rough: 0.35 }, b: { style: 'tex', r: 'wood', p: { c: '#3a2416', c2: '#1a0e06', planks: 1, bevel: false }, rough: 0.35 } },
  pieceColor('c-bw', 'Белые и чёрные', '#f2f2ee', '#24252a'),
  pieceColor('c-redblue', 'Красные и синие', '#e8202f', '#1f6bff'),
  pieceColor('c-cream', 'Слоновая кость', '#f3e6c8', '#6b3a1e'),
  pieceColor('c-grey', 'Серые', '#d9dde4', '#4a4f5a'),
];

const PIECE_SKINS = [
  { id: 'marble', name: 'Мрамор', price: 250, w: { style: 'tex', r: 'marble', p: { c: '#f0f1f4', c2: '#8a909b' }, rough: 0.2 }, b: { style: 'tex', r: 'marble', p: { c: '#2a2c32', c2: '#b9bec8' }, rough: 0.2 } },
  { id: 'metal', name: 'Золото и серебро', price: 350, w: { style: 'metal', c: '#f1c24e', rough: 0.2 }, b: { style: 'metal', c: '#aeb8c6', rough: 0.25 } },
  { id: 'glass', name: 'Стекло', price: 300, w: { style: 'glass', c: '#e6f6ff', emissive: 0.2, opacity: 0.6 }, b: { style: 'glass', c: '#4a5a7a', emissive: 0.15, opacity: 0.75 } },
  { id: 'neon', name: 'Неон', price: 300, w: { style: 'neon', c: '#22e4ff' }, b: { style: 'neon', c: '#ff3ccf' } },
  { id: 'crystal', name: 'Кристалл', price: 400, w: { style: 'glass', c: '#9fd6ff', emissive: 0.5, opacity: 0.85, faceted: true }, b: { style: 'glass', c: '#b04dff', emissive: 0.5, opacity: 0.85, faceted: true } },
  { id: 'stone', name: 'Камень', price: 150, w: { style: 'tex', r: 'granite', p: { c: '#b9bdc4' }, rough: 0.85 }, b: { style: 'tex', r: 'granite', p: { c: '#3d4048' }, rough: 0.85 } },
  { id: 'lava', name: 'Огонь и лёд', price: 350, w: { style: 'glass', c: '#8fdcff', emissive: 0.5, opacity: 0.85 }, b: { style: 'tex', r: 'lava', p: { c: '#1a1010', glow: '#ff5a14' }, glow: 1.6, rough: 0.8 } },
  { id: 'ruby', name: 'Рубин и изумруд', price: 400, w: { style: 'glass', c: '#1fe07a', emissive: 0.5, opacity: 0.88, faceted: true }, b: { style: 'glass', c: '#ff1f45', emissive: 0.5, opacity: 0.88, faceted: true } },
  { id: 'cosmos', name: 'Космос', price: 350, w: { style: 'tex', r: 'space', p: { c: '#2a2f6a', c2: '#8a6bff', c3: '#4db8ff' }, glow: 0.6, rough: 0.3 }, b: { style: 'tex', r: 'space', p: { c: '#05061a', c2: '#b02ad8', c3: '#2a6ad8' }, glow: 0.9, rough: 0.3 } },
  { id: 'wood-red', name: 'Красное дерево', price: 200, w: { style: 'tex', r: 'wood', p: { c: '#e8c9a0', c2: '#b58a5a', planks: 1, bevel: false }, rough: 0.35 }, b: { style: 'tex', r: 'wood', p: { c: '#7a2a18', c2: '#3a0e06', planks: 1, bevel: false }, rough: 0.35 } },
];

export const SKIN_KINDS = {
  field: { title: 'Поле', colors: FIELD_COLORS, list: FIELD_SKINS },
  walls: { title: 'Стены', colors: WALL_COLORS, list: WALL_SKINS },
  pawns: { title: 'Фишки', colors: PAWN_COLORS, list: PAWN_SKINS },
  finish: { title: 'Финиш', colors: FINISH_COLORS, list: FINISH_SKINS },
  background: { title: 'Фон', colors: BG_COLORS, list: BG_SKINS },
  board8: { title: 'Доска', colors: BOARD8_COLORS, list: BOARD8_SKINS },
  chessPieces: { title: 'Фигуры', colors: PIECE_COLORS, list: PIECE_SKINS },
  checkersPieces: { title: 'Шашки', colors: PIECE_COLORS, list: PIECE_SKINS },
};

// Какие вкладки магазина показывать для каждой игры
export const GAME_SKIN_KINDS = {
  koridor: ['field', 'walls', 'pawns', 'finish', 'background'],
  chess: ['board8', 'chessPieces', 'background'],
  checkers: ['board8', 'checkersPieces', 'background'],
};

export const DEFAULT_SKINS = { field: 'c-graphite', walls: 'c-grey', pawns: 'c-player', finish: 'c-player', background: 'c-night', board8: 'c-wood', chessPieces: 'c-classic', checkersPieces: 'c-classic' };

export function findSkin(kind, id) {
  const k = SKIN_KINDS[kind];
  return k.colors.find((s) => s.id === id) || k.list.find((s) => s.id === id) || k.colors[0];
}

export function isPlain(kind, id) {
  return SKIN_KINDS[kind].colors.some((s) => s.id === id);
}

// Стоимость набора: сумма ещё не купленных скинов со скидкой 30%
export function setPrice(set, isOwnedFn) {
  let sum = 0;
  for (const [kind, id] of Object.entries(set.skins)) {
    if (isPlain(kind, id) || isOwnedFn(kind, id)) continue;
    sum += findSkin(kind, id).price || 0;
  }
  return Math.round((sum * 0.7) / 10) * 10;
}

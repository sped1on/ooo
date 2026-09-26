// Каталог скинов магазина. Внешний вид описывается параметрами, по которым
// render/materials.js строит материалы Three.js.

export const WALL_SKINS = [
  { id: 'classic', name: 'Классические', price: 100, tex: 'plain', color: '#c9d2e3', rough: 0.45, metal: 0.1 },
  { id: 'wood', name: 'Дерево', price: 150, tex: 'wood', color: '#b8793a', dark: '#6b3c16', rough: 0.7 },
  { id: 'stone', name: 'Камень', price: 150, tex: 'stone', color: '#8d949e', rough: 0.9 },
  { id: 'neon', name: 'Неон', price: 200, tex: 'neon', color: '#1a0d33', glow: '#b04dff', rough: 0.35 },
  { id: 'ice', name: 'Лёд', price: 200, tex: 'ice', color: '#6cc7ff', rough: 0.15, opacity: 0.82 },
  { id: 'sand', name: 'Песок', price: 150, tex: 'sand', color: '#cfae78', rough: 0.95 },
  { id: 'metal', name: 'Металл', price: 200, tex: 'metal', color: '#8995a6', rough: 0.35, metal: 0.9 },
  { id: 'lava', name: 'Лава', price: 200, tex: 'lava', color: '#221512', glow: '#ff5a14', rough: 0.8 },
  { id: 'gold', name: 'Золото', price: 300, tex: 'metal', color: '#e8b94a', rough: 0.25, metal: 1 },
  { id: 'marble', name: 'Мрамор', price: 250, tex: 'marble', color: '#eceef2', vein: '#6d7480', rough: 0.3 },
  { id: 'toxic', name: 'Токсин', price: 250, tex: 'neon', color: '#0b1d0e', glow: '#5cff5c', rough: 0.4 },
  { id: 'crystal', name: 'Кристалл', price: 350, tex: 'ice', color: '#ff7ad9', rough: 0.1, opacity: 0.78 },
  { id: 'cyber', name: 'Кибер', price: 300, tex: 'neon', color: '#061626', glow: '#22e4ff', rough: 0.35 },
  { id: 'obsidian', name: 'Обсидиан', price: 250, tex: 'stone', color: '#2a2437', rough: 0.2, metal: 0.3 },
  { id: 'emerald', name: 'Изумруд', price: 350, tex: 'ice', color: '#2fe39a', rough: 0.12, opacity: 0.85 },
  { id: 'bronze', name: 'Бронза', price: 200, tex: 'metal', color: '#b0703f', rough: 0.4, metal: 0.95 },
];

export const FIELD_SKINS = [
  { id: 'classic', name: 'Классика', price: 100, tex: 'tile', color: '#2b3040', frame: '#454c5e', base: '#12151d', rough: 0.6 },
  { id: 'ice', name: 'Лёд', price: 200, tex: 'ice', color: '#3aa7ec', frame: '#9fd8ff', base: '#0b2a44', rough: 0.15, glow: '#0a4a88' },
  { id: 'wood', name: 'Дерево', price: 150, tex: 'wood', color: '#9a6232', dark: '#5a3314', frame: '#5a3314', base: '#24140a', rough: 0.7 },
  { id: 'stone', name: 'Камень', price: 150, tex: 'stone', color: '#6f7580', frame: '#4c525c', base: '#1a1c21', rough: 0.9 },
  { id: 'neon', name: 'Неон', price: 250, tex: 'grid', color: '#120a24', frame: '#1c1236', base: '#07040f', glow: '#a04dff', rough: 0.4 },
  { id: 'sand', name: 'Пустыня', price: 150, tex: 'sand', color: '#c6a26a', frame: '#8a6a3c', base: '#3a2a14', rough: 0.95 },
  { id: 'marble', name: 'Мрамор', price: 250, tex: 'marble', color: '#e5e7ec', vein: '#7a818c', frame: '#262a33', base: '#121419', rough: 0.3 },
  { id: 'lava', name: 'Вулкан', price: 300, tex: 'lava', color: '#1d1210', frame: '#2b1a15', base: '#0d0706', glow: '#ff5a14', rough: 0.85 },
  { id: 'space', name: 'Космос', price: 300, tex: 'space', color: '#0a0c1e', frame: '#1a1d3a', base: '#05060f', rough: 0.4 },
  { id: 'grass', name: 'Газон', price: 150, tex: 'grass', color: '#3f8a3a', frame: '#6b4a2a', base: '#1d140b', rough: 0.95 },
  { id: 'chess', name: 'Шахматы', price: 200, tex: 'chess', color: '#d9c7a3', dark: '#5b3b25', frame: '#3a2415', base: '#170d07', rough: 0.45 },
  { id: 'cyber', name: 'Кибер', price: 300, tex: 'grid', color: '#04121e', frame: '#0b2233', base: '#02080e', glow: '#22e4ff', rough: 0.35 },
];

// Для фишек: style определяет материал, цвет игрока подмешивается автоматически
export const PAWN_SKINS = [
  { id: 'classic', name: 'Классика', price: 100, style: 'plastic' },
  { id: 'gold', name: 'Золото', price: 300, style: 'gold' },
  { id: 'glass', name: 'Стекло', price: 200, style: 'glass' },
  { id: 'neon', name: 'Неон', price: 250, style: 'neon' },
  { id: 'metal', name: 'Металл', price: 200, style: 'metal' },
  { id: 'crystal', name: 'Кристалл', price: 350, style: 'crystal' },
  { id: 'marble', name: 'Мрамор', price: 250, style: 'marble' },
  { id: 'lava', name: 'Магма', price: 300, style: 'lava' },
];

export const SKIN_KINDS = {
  walls: { title: 'Стены', list: WALL_SKINS },
  field: { title: 'Поле', list: FIELD_SKINS },
  pawns: { title: 'Фишки', list: PAWN_SKINS },
};

export function findSkin(kind, id) {
  const list = SKIN_KINDS[kind].list;
  return list.find((s) => s.id === id) || list[0];
}

export const PLAYER_COLORS = ['#2f7dff', '#ff2d3d'];

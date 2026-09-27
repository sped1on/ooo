// Каталог игры: машины, детали, оружие, снаряжение, базы, задания, награды.

// Машины. speed — макс. скорость (м/с), hp — прочность, trunk — багажник (сколько ресурсов
// увозится за поездку), unlock — с какой базы машина доступна в автосалоне.
export const CARS = [
  { id: 'rusty', name: 'Седан «Ржавчик»', type: 'sedan', price: 0, speed: 22, hp: 100, trunk: 30, handling: 1.0, fuel: 100, ram: 20, unlock: 1, color: '#c8662a', rust: 1 },
  { id: 'seven', name: 'Семёрка «Классик»', type: 'boxy', price: 5000, speed: 24, hp: 115, trunk: 45, handling: 1.0, fuel: 100, ram: 22, unlock: 1, color: '#c9502e', rust: 0.8 },
  { id: 'hunter', name: 'Вездеход «Барсук»', type: 'uaz', price: 8000, speed: 23, hp: 150, trunk: 55, handling: 0.95, fuel: 120, ram: 30, unlock: 2, color: '#4f5f2f', rust: 0.4 },
  { id: 'ranger', name: 'Пикап «Бизон»', type: 'pickup', price: 12000, speed: 25, hp: 165, trunk: 80, handling: 0.95, fuel: 130, ram: 34, unlock: 2, color: '#2f5f9e', rust: 0.25 },
  { id: 'bumble', name: 'Шмель «Турбо»', type: 'muscle', price: 18000, speed: 31, hp: 120, trunk: 35, handling: 1.15, fuel: 110, ram: 24, unlock: 3, color: '#e8b81c', stripes: '#151515', rust: 0.1 },
  { id: 'safari', name: 'Сафари 70', type: 'suv', price: 20000, speed: 25, hp: 195, trunk: 75, handling: 0.95, fuel: 140, ram: 36, unlock: 3, color: '#dcd8cc', rust: 0.3 },
  { id: 'vendetta', name: 'Вендетта V8', type: 'charger', price: 22000, speed: 30, hp: 145, trunk: 45, handling: 1.1, fuel: 120, ram: 30, unlock: 4, color: '#18191c', rust: 0.15 },
  { id: 'scout', name: 'Скаут «Рысь»', type: 'jeep', price: 25000, speed: 27, hp: 175, trunk: 55, handling: 1.1, fuel: 120, ram: 32, unlock: 4, color: '#c42a22', rust: 0.15 },
  { id: 'hatch', name: 'Хэтч «Стриж»', type: 'hatch', price: 28000, speed: 32, hp: 135, trunk: 40, handling: 1.25, fuel: 110, ram: 24, unlock: 5, color: '#a9adb3', stripes: '#c81e1e', rust: 0.05 },
  { id: 'ram', name: 'Грузовик «Таран»', type: 'bigpickup', price: 32000, speed: 26, hp: 250, trunk: 100, handling: 0.9, fuel: 160, ram: 48, unlock: 6, color: '#3b3e44', rust: 0.1 },
  { id: 'bolt', name: 'Гиперкар «Молния»', type: 'hyper', price: 50000, speed: 40, hp: 170, trunk: 25, handling: 1.35, fuel: 120, ram: 30, unlock: 8, color: '#1f6fd8', rust: 0 },
];

export const CAR_MAX = { speed: 40, hp: 250, trunk: 100 };

// Детали машины
export const PARTS = {
  bumper: [
    { id: 'none', name: 'Без бампера', price: 0, hp: 0, ram: 0 },
    { id: 'std', name: 'Бампер «Стандарт»', price: 300, hp: 10, ram: 8 },
    { id: 'heavy', name: 'Бампер «Усиленный»', price: 500, hp: 20, ram: 14 },
    { id: 'bull', name: 'Кенгурятник', price: 800, hp: 30, ram: 22 },
    { id: 'spikes', name: 'Бампер «Шипы»', price: 1200, hp: 35, ram: 36 },
    { id: 'plow', name: 'Отвал «Бульдозер»', price: 1500, hp: 55, ram: 48 },
  ],
  grille: [
    { id: 'none', name: 'Без решётки', price: 0, hp: 0 },
    { id: 'classic', name: 'Решётка «Классик»', price: 700, hp: 15 },
    { id: 'mesh', name: 'Решётка «Сетка»', price: 900, hp: 25 },
    { id: 'steel', name: 'Решётка «Сталь»', price: 1400, hp: 40 },
    { id: 'cage', name: 'Каркас «Клетка»', price: 2200, hp: 65 },
  ],
  paint: [
    { id: 'factory', name: 'Заводская', price: 0 },
    { id: 'blue', name: 'Краска «Синий»', price: 800, color: '#2d5fb8' },
    { id: 'red', name: 'Краска «Красный»', price: 800, color: '#b3221c' },
    { id: 'khaki', name: 'Краска «Хаки»', price: 1000, color: '#6b6a3a' },
    { id: 'black', name: 'Краска «Чёрный»', price: 1200, color: '#1d1f22' },
    { id: 'white', name: 'Краска «Белый»', price: 1200, color: '#e6e3dc' },
    { id: 'toxic', name: 'Краска «Токсик»', price: 1800, color: '#7ad12a' },
    { id: 'camo', name: 'Краска «Камуфляж»', price: 2500, color: '#6f7446', camo: true },
    { id: 'gold', name: 'Краска «Золото»', price: 60, cur: 'gold', color: '#d8a521', metal: true },
  ],
  wheels: [
    { id: 'std', name: 'Диски «Стандарт»', price: 0, speed: 0, handling: 0, rim: '#8b8f96', spokes: 5 },
    { id: 'steel', name: 'Диски «Сталь»', price: 600, speed: 1, handling: 0.1, rim: '#c4c9d0', spokes: 8 },
    { id: 'sport', name: 'Диски «Спорт»', price: 1500, speed: 3, handling: 0.15, rim: '#1f2226', spokes: 6, accent: '#e0b21c' },
    { id: 'offroad', name: 'Диски «Вездеход»', price: 2000, speed: 2, handling: 0.3, rim: '#c77a1c', spokes: 4 },
    { id: 'spiked', name: 'Диски «Шипы»', price: 3000, speed: 2, handling: 0.2, rim: '#40444a', spokes: 6, spikes: true },
  ],
  // Бронелисты, наваренные на кузов
  armor: [
    { id: 'none', name: 'Без брони', price: 0, hp: 0, ram: 0 },
    { id: 'doors', name: 'Бронедвери', price: 900, hp: 25, ram: 0 },
    { id: 'hood', name: 'Капот и двери', price: 1600, hp: 45, ram: 4 },
    { id: 'full', name: 'Полная обшивка', price: 2800, hp: 75, ram: 8 },
    { id: 'spiked', name: 'Обшивка с шипами', price: 4000, hp: 85, ram: 18 },
  ],
  // Салон: руль, подвеска на зеркало, фигурка на панель (для красоты)
  steer: [
    { id: 'std', name: 'Руль «Стандарт»', price: 0 },
    { id: 'sport', name: 'Руль «Спорт»', price: 500, color: '#b8261e' },
    { id: 'wood', name: 'Руль «Дерево»', price: 700, color: '#8a5a2a' },
    { id: 'chain', name: 'Руль «Цепь»', price: 900, color: '#9aa0a8' },
    { id: 'race', name: 'Руль «Гоночный»', price: 1200, color: '#1a1a1a' },
  ],
  hang: [
    { id: 'none', name: 'Ничего на зеркале', price: 0 },
    { id: 'tree', name: 'Ёлочка-вонючка', price: 150, color: '#3aa04a' },
    { id: 'tree2', name: 'Ёлочка «Ваниль»', price: 150, color: '#e8d060' },
    { id: 'dice', name: 'Пушистые кубики', price: 250, color: '#e8e4dc' },
    { id: 'beads', name: 'Чётки', price: 200, color: '#8a4a2a' },
  ],
  dash: [
    { id: 'none', name: 'Пустая панель', price: 0 },
    { id: 'duck', name: 'Резиновая уточка', price: 200, color: '#f2c21b' },
    { id: 'dog', name: 'Собачка-кивалка', price: 350, color: '#a07040' },
    { id: 'cactus', name: 'Кактус в горшке', price: 150, color: '#4a8a3a' },
    { id: 'skull', name: 'Черепок', price: 300, color: '#e8e4d8' },
  ],
  // Оружие на машину. kind — как стреляет. rate — выстрелов в секунду.
  weapon: [
    { id: 'mg1', name: 'Пулемёт (базовый)', kind: 'bullet', model: 'mg', price: 500, dmg: 12, rate: 8, range: 55, mag: 40, spread: 0.035 },
    { id: 'mg2', name: 'Пулемёт (улучшенный)', kind: 'bullet', model: 'mg2', price: 1200, dmg: 16, rate: 10, range: 60, mag: 60, spread: 0.03 },
    { id: 'flamer', name: 'Огнемёт', kind: 'flame', model: 'flamer', price: 1800, dmg: 7, rate: 14, range: 15, mag: 140, spread: 0.2 },
    { id: 'autocannon', name: 'Автопушка', kind: 'bullet', model: 'gatling', price: 2500, dmg: 18, rate: 16, range: 60, mag: 150, spread: 0.05 },
    { id: 'grenade', name: 'Гранатомёт', kind: 'grenade', model: 'grenade', price: 2500, dmg: 90, rate: 1.6, range: 50, mag: 8, splash: 5 },
    { id: 'mines', name: 'Минный разбрасыватель', kind: 'mine', model: 'mines', price: 2800, dmg: 130, rate: 1.2, range: 25, mag: 8, splash: 4.5 },
    { id: 'rockets', name: 'Ракетница', kind: 'rocket', model: 'pod', price: 3000, dmg: 70, rate: 3, range: 70, mag: 9, splash: 4 },
    { id: 'shocker', name: 'Электрошокер', kind: 'shock', model: 'shock', price: 3200, dmg: 48, rate: 2, range: 26, mag: 20, chain: 4 },
    { id: 'bomber', name: 'Бомбомёт', kind: 'mortar', model: 'mortar', price: 3600, dmg: 140, rate: 0.9, range: 60, mag: 6, splash: 6.5 },
    { id: 'cannon', name: 'Пушка (средняя)', kind: 'cannon', model: 'cannon', price: 4200, dmg: 110, rate: 1.2, range: 75, mag: 10, splash: 2.5 },
    { id: 'mgap', name: 'Пулемёт с бронебойными', kind: 'bullet', model: 'mg3', price: 5800, dmg: 30, rate: 9, range: 70, mag: 60, spread: 0.025, pierce: 3 },
    { id: 'launcher', name: 'Ракетная установка', kind: 'rocket', model: 'launcher', price: 6000, dmg: 170, rate: 1.1, range: 80, mag: 4, splash: 7 },
    { id: 'turret', name: 'Турель (автоматическая)', kind: 'bullet', model: 'turret', price: 7200, dmg: 20, rate: 8, range: 50, mag: 90, spread: 0.03, auto: true },
    { id: 'hcannon', name: 'Пушка (тяжёлая)', kind: 'cannon', model: 'hcannon', price: 8000, dmg: 230, rate: 0.7, range: 90, mag: 6, splash: 4 },
    { id: 'laser', name: 'Лазерная пушка', kind: 'laser', model: 'laser', price: 9500, dmg: 85, rate: 3, range: 90, mag: 24, pierce: 99 },
  ],
};

export const CAR_WEAPON_MAX = { dps: 480, rate: 16, range: 90 };

export const SLOT_NAMES = {
  body: 'Авто',
  weapon: 'Оружие',
  armor: 'Броня',
  steer: 'Руль',
  hang: 'На зеркало',
  dash: 'На панель',
  bumper: 'Бампера',
  grille: 'Решётки',
  paint: 'Краска',
  wheels: 'Диски',
  items: 'Предметы',
};

export const RARITY = {
  common: { name: 'Обычное', color: '#4caf3f' },
  rare: { name: 'Редкое', color: '#2f8fe0' },
  epic: { name: 'Эпическое', color: '#9b45e0' },
  legendary: { name: 'Легендарное', color: '#e8962a' },
};

// Ручное оружие (для вылазок из машины: заправка и т.п.)
// rpm — выстрелов в минуту, acc — точность 0..100
export const GUNS = [
  { id: 'g17', name: 'Пистолет «Страж»', cat: 'pistol', rarity: 'common', price: 500, dmg: 22, rpm: 360, range: 30, acc: 70, mag: 17, model: 'pistol', desc: 'Лёгкий и надёжный пистолет.' },
  { id: 'magnum', name: 'Револьвер «Шериф» .44', cat: 'pistol', rarity: 'common', price: 1000, dmg: 60, rpm: 120, range: 35, acc: 80, mag: 6, model: 'revolver', desc: 'Мощный, но медленный.' },
  { id: 'm870', name: 'Дробовик «Помпа»', cat: 'shotgun', rarity: 'common', price: 800, dmg: 14, pellets: 7, rpm: 70, range: 16, acc: 40, mag: 6, model: 'pump', desc: 'Останавливает любого зомби вблизи.' },
  { id: 'spas', name: 'Дробовик «Штурм»', cat: 'shotgun', rarity: 'rare', price: 1800, dmg: 16, pellets: 8, rpm: 140, range: 18, acc: 45, mag: 8, model: 'spas', desc: 'Полуавтоматический дробовик.' },
  { id: 'mp5', name: 'Пистолет-пулемёт «Оса»', cat: 'rifle', rarity: 'common', price: 1200, dmg: 18, rpm: 800, range: 35, acc: 65, mag: 30, model: 'smg', desc: 'Высокий темп стрельбы.' },
  { id: 'ak47', name: 'Автомат «Ветеран»', cat: 'rifle', rarity: 'rare', price: 1500, dmg: 32, rpm: 600, range: 50, acc: 65, mag: 30, model: 'ak', desc: 'Легенда: работает в любую погоду.' },
  { id: 'scar', name: 'Автомат «Скат»', cat: 'rifle', rarity: 'common', price: 1600, dmg: 30, rpm: 620, range: 55, acc: 75, mag: 30, model: 'scar', desc: 'Точный и удобный автомат.' },
  { id: 'p90', name: 'Пистолет-пулемёт «Шершень»', cat: 'rifle', rarity: 'rare', price: 2200, dmg: 20, rpm: 900, range: 35, acc: 65, mag: 50, model: 'p90', desc: 'Огромный магазин.' },
  { id: 'm4', name: 'Автомат «Карабин»', cat: 'rifle', rarity: 'epic', price: 2800, dmg: 35, rpm: 750, range: 60, acc: 85, mag: 30, model: 'm4', desc: 'Надёжное оружие для любых ситуаций.' },
  { id: 'l115', name: 'Снайперская винтовка «Сокол»', cat: 'sniper', rarity: 'epic', price: 3000, dmg: 150, rpm: 45, range: 90, acc: 98, mag: 5, pierce: 3, model: 'sniper', desc: 'Пробивает нескольких зомби.' },
  { id: 'm82', name: 'Крупнокалиберная винтовка «Молот»', cat: 'sniper', rarity: 'epic', price: 5000, dmg: 190, rpm: 90, range: 100, acc: 95, mag: 10, pierce: 4, model: 'barrett', desc: 'Крупный калибр, полуавтомат.' },
  { id: 'm249', name: 'Пулемёт «Ливень»', cat: 'mg', rarity: 'rare', price: 3500, dmg: 28, rpm: 800, range: 55, acc: 60, mag: 100, model: 'm249', desc: 'Сдерживает целую толпу.' },
  { id: 'm60', name: 'Пулемёт «Гром»', cat: 'mg', rarity: 'rare', price: 3800, dmg: 36, rpm: 600, range: 60, acc: 62, mag: 100, model: 'm60', desc: 'Тяжёлый пулемёт.' },
  { id: 'm203', name: 'Гранатомёт «Хлопушка»', cat: 'rocket', rarity: 'legendary', price: 3200, dmg: 110, rpm: 60, range: 40, acc: 70, mag: 6, splash: 4.5, model: 'm203', desc: 'Разрывные гранаты по площади.' },
  { id: 'rpg', name: 'Ракетница «Труба»', cat: 'rocket', rarity: 'epic', price: 4200, dmg: 220, rpm: 30, range: 60, acc: 85, mag: 1, splash: 6, model: 'rpg', desc: 'Одна ракета — одна толпа.' },
  { id: 'laser', name: 'Лазерная винтовка', cat: 'rifle', rarity: 'epic', price: 4600, dmg: 40, rpm: 500, range: 70, acc: 100, mag: 40, pierce: 5, model: 'laser', desc: 'Луч прожигает насквозь.' },
  { id: 'bat', name: 'Бита', cat: 'melee', rarity: 'common', price: 200, dmg: 45, rpm: 100, range: 2.2, acc: 100, mag: 0, model: 'bat', desc: 'Не нужны патроны.' },
  { id: 'machete', name: 'Мачете', cat: 'melee', rarity: 'rare', price: 600, dmg: 70, rpm: 110, range: 2.4, acc: 100, mag: 0, model: 'machete', desc: 'Быстрый и острый.' },
  { id: 'axe', name: 'Пожарный топор', cat: 'melee', rarity: 'rare', price: 900, dmg: 110, rpm: 75, range: 2.6, acc: 100, mag: 0, model: 'axe', desc: 'Разрубает громил.' },
];

export const GUN_CATS = [
  { id: 'all', name: 'Все', icon: 'grid' },
  { id: 'pistol', name: 'Пистолеты', icon: 'pistol' },
  { id: 'shotgun', name: 'Дробовики', icon: 'shotgun' },
  { id: 'rifle', name: 'Автоматы', icon: 'rifle' },
  { id: 'sniper', name: 'Снайперские', icon: 'rifle' },
  { id: 'mg', name: 'Пулемёты', icon: 'weapon' },
  { id: 'rocket', name: 'Ракетницы', icon: 'rocket' },
  { id: 'melee', name: 'Ближний бой', icon: 'knife' },
];

export const GUN_MAX = { dmg: 230, rpm: 900, range: 100, acc: 100, mag: 100 };

// Улучшения ручного оружия (до 3 уровней каждое)
export const GUN_UPGRADES = [
  { id: 'dmg', name: 'Урон +10%', price: 1500, icon: 'target' },
  { id: 'rate', name: 'Скорострельность +10%', price: 1500, icon: 'target' },
  { id: 'mag', name: 'Магазин +5', price: 1000, icon: 'ammo' },
];

export const ARMOR = [
  { id: 'vest1', slot: 'vest', name: 'Лёгкий бронежилет', def: 10, price: 500, color: '#55603a', desc: 'Лёгкая защита, не мешает двигаться.' },
  { id: 'vest2', slot: 'vest', name: 'Стандартный жилет', def: 20, price: 1000, color: '#8a6a44', desc: 'Надёжный жилет для защиты от укусов и осколков.' },
  { id: 'vest3', slot: 'vest', name: 'Усиленный жилет', def: 35, price: 2000, color: '#3a3c40', accent: '#b8261e', desc: 'Дополнительные пластины.' },
  { id: 'vest4', slot: 'vest', name: 'Тактический бронежилет', def: 50, price: 3500, color: '#2a2c30', desc: 'Максимальная защита корпуса.' },
  { id: 'helm1', slot: 'helmet', name: 'Лёгкий шлем', def: 10, price: 400, color: '#56603c', desc: 'Защищает голову от ударов.' },
  { id: 'helm2', slot: 'helmet', name: 'Шлем с визором', def: 20, price: 800, color: '#34373c', visor: true, desc: 'Прозрачный визор от брызг.' },
  { id: 'helm3', slot: 'helmet', name: 'Тактический шлем', def: 35, price: 1500, color: '#8a7050', desc: 'Лёгкий и прочный.' },
  { id: 'helm4', slot: 'helmet', name: 'Шлем спецназа', def: 50, price: 2500, color: '#2a2c30', visor: true, desc: 'Лучшая защита головы.' },
];

export const MEDKITS = [
  { id: 'med1', name: 'Аптечка (мал.)', heal: 0.25, price: 300, color: '#55603a', desc: 'Восстанавливает 25% HP' },
  { id: 'med2', name: 'Аптечка (стандарт.)', heal: 0.5, price: 600, color: '#c62a24', desc: 'Восстанавливает 50% HP' },
  { id: 'med3', name: 'Аптечка (больш.)', heal: 1, price: 1200, color: '#e07a1c', desc: 'Восстанавливает 100% HP' },
  { id: 'med4', name: 'Набор выжившего', heal: 1, cure: true, price: 2000, color: '#6f7446', desc: 'Восстанавливает 100% HP + снимает отравление' },
];

// Расходники и ресурсы
export const ITEMS = [
  { id: 'repair', name: 'Ремкомплект', price: 300, give: { repair: 1 }, desc: 'Чинит 40% прочности машины в пути' },
  { id: 'fuel', name: 'Канистра', price: 200, give: { fuel: 1 }, desc: '+50 топлива в пути' },
  { id: 'ammo', name: 'Ящик патронов', price: 150, give: { ammo: 1 }, desc: '+1 магазин оружию машины' },
  { id: 'metal10', name: 'Металлолом ×10', price: 400, give: { metal: 10 }, desc: 'Для ремонта и базы' },
  { id: 'wood10', name: 'Доски ×10', price: 250, give: { wood: 10 }, desc: 'Для улучшения базы' },
  { id: 'cloth10', name: 'Ткань ×10', price: 300, give: { cloth: 10 }, desc: 'Для ремонта и базы' },
  { id: 'crate', name: 'Ящик припасов', price: 15, cur: 'gold', give: { crate: 1 }, desc: 'Случайные ресурсы и деньги' },
  { id: 'spray', name: 'Баллончик краски', price: 250, give: { spray: 100 }, desc: 'Рисуй на машине в гараже' },
];

// Цвета баллончиков
export const SPRAY_COLORS = ['#f2f2f2', '#1a1a1a', '#e2261e', '#f28a1a', '#f2d21b', '#6ad84a', '#2a9a4a', '#2aa8e8', '#2a4ab8', '#8a3ad8', '#e84aa8', '#8a5a2a'];

export const RESOURCES = {
  wood: { name: 'Дерево', color: '#b07a3c' },
  metal: { name: 'Металл', color: '#9fb2c8' },
  cloth: { name: 'Ткань', color: '#d8c7a0' },
  ammo: { name: 'Патроны', color: '#e0b22a' },
  repair: { name: 'Ремкомплект', color: '#e2443a' },
  fuel: { name: 'Канистра', color: '#d8362a' },
};

export const BASE_UPGRADES = [
  { id: 'workshop', name: 'Мастерская', desc: 'Ремонт дешевле, +10% прочности машины', max: 5, cost: (l) => ({ wood: 8 + l * 8, metal: 6 + l * 6 }) },
  { id: 'armory', name: 'Оружейная', desc: '+1 магазин оружию машины в каждой поездке', max: 5, cost: (l) => ({ metal: 8 + l * 8, cloth: 4 + l * 4 }) },
  { id: 'depot', name: 'Топливный склад', desc: '+15% к объёму бака', max: 5, cost: (l) => ({ wood: 6 + l * 6, metal: 4 + l * 5, cloth: 3 + l * 3 }) },
];

export const BIOMES = {
  desert: {
    name: 'Пустоши', ground: '#c49a62', ground2: '#a0764a', grass: '#a89252', far: '#9a7a58',
    skyTop: '#3d6fa8', skyBottom: '#f0c890', fog: '#e2c49a', sun: '#ffe2b0', hemi: ['#ffe8c8', '#8a6a44'],
    trees: ['dead', 'pine', 'bush'], treeDensity: 0.35, rocks: 1.2, water: '#3f7fa0',
  },
  forest: {
    name: 'Лес', ground: '#7f8a48', ground2: '#5f6f36', grass: '#6f8a38', far: '#51613a',
    skyTop: '#4a7cb8', skyBottom: '#e8dcb8', fog: '#c9cfb4', sun: '#fff0cc', hemi: ['#fff4dc', '#4f5a30'],
    trees: ['spruce', 'pine', 'birch', 'bush'], treeDensity: 1.0, rocks: 0.6, water: '#2f6f96',
  },
  steppe: {
    name: 'Степь', ground: '#b4a05a', ground2: '#978544', grass: '#b09a4c', far: '#8a7a4a',
    skyTop: '#5a86c0', skyBottom: '#f3dcae', fog: '#e0d2a8', sun: '#ffe6b8', hemi: ['#fff0d0', '#80703c'],
    trees: ['birch', 'bush', 'pine'], treeDensity: 0.4, rocks: 0.7, water: '#3a7898',
  },
  field: {
    name: 'Поля', ground: '#7f9a48', ground2: '#637e36', grass: '#86a64a', far: '#5a7040',
    skyTop: '#4f86c8', skyBottom: '#dfe6d0', fog: '#c8d4c0', sun: '#fff4d8', hemi: ['#f4fff0', '#4f6a30'],
    trees: ['birch', 'bush', 'spruce'], treeDensity: 0.55, rocks: 0.4, water: '#2f6a94',
  },
  swamp: {
    name: 'Болота', ground: '#5c6a3c', ground2: '#46522e', grass: '#667038', far: '#3f4a30',
    skyTop: '#5f7488', skyBottom: '#b8c0a8', fog: '#9aa48c', sun: '#e8e4c8', hemi: ['#d8e0c8', '#3a4428'],
    trees: ['dead', 'spruce', 'bush'], treeDensity: 0.8, rocks: 0.5, water: '#3a5a50',
  },
  snow: {
    name: 'Снега', ground: '#e6ebf0', ground2: '#c6d0da', grass: '#dfe6ee', far: '#b8c4d0',
    skyTop: '#6f8fb8', skyBottom: '#e4ecf4', fog: '#d8e2ec', sun: '#ffffff', hemi: ['#ffffff', '#9aa8b8'],
    trees: ['snowspruce', 'snowspruce', 'spruce', 'dead'], treeDensity: 0.9, rocks: 0.6, water: '#5a86a8',
  },
  canyon: {
    name: 'Каньон', ground: '#b8704a', ground2: '#9a5a3a', grass: '#a8804a', far: '#8a5038',
    skyTop: '#4a78b0', skyBottom: '#f4c898', fog: '#e0b890', sun: '#ffe0b0', hemi: ['#ffe4c8', '#7a4a30'],
    trees: ['dead', 'bush', 'pine'], treeDensity: 0.25, rocks: 1.8, water: '#3a7088', rock: '#a0583a',
  },
  autumn: {
    name: 'Осень', ground: '#9a7a44', ground2: '#7f6034', grass: '#a8743a', far: '#6a5030',
    skyTop: '#5a78a8', skyBottom: '#f0d0a0', fog: '#dcc4a0', sun: '#ffd8a0', hemi: ['#ffe8c8', '#6a4a2a'],
    trees: ['autumn', 'birch', 'spruce', 'bush'], treeDensity: 0.9, rocks: 0.5, water: '#3a6f90',
  },
};

const BASE_LIST = [
  ['Пустоши', 'desert'],
  ['Новая территория', 'forest'],
  ['Лесной лагерь', 'forest'],
  ['Старая заправка', 'steppe'],
  ['Ферма «Рассвет»', 'field'],
  ['Речной мост', 'swamp'],
  ['Осенний привал', 'autumn'],
  ['Снежный пост', 'snow'],
  ['Военная часть', 'canyon'],
  ['Последний оплот', 'desert'],
  ['Горный перевал', 'snow'],
];

// Десять уникальных поездок (к базам 2–11): время суток, погода, рельеф, трамплины, развилки.
// time: day | sunset | dawn | overcast | night; weather: rain | snow | fog;
// terrain: valley | hills | plain | mountain | canyon.
export const LEVELS = {
  2: { title: 'Лесная дорога', time: 'day', terrain: 'valley', curvy: 1, hillAmp: 20, jumps: 0, forks: 0, base: 0, brand: 0 },
  3: { title: 'Закат над холмами', time: 'sunset', terrain: 'hills', curvy: 1.25, hillAmp: 30, jumps: 1, forks: 1, base: 1, brand: 1 },
  4: { title: 'Степная трасса', time: 'day', terrain: 'plain', curvy: 0.55, hillAmp: 12, jumps: 3, forks: 1, base: 2, brand: 2 },
  5: { title: 'Дождливый рассвет', time: 'dawn', weather: 'rain', terrain: 'hills', curvy: 1.15, hillAmp: 26, jumps: 1, forks: 2, slippery: 0.85, base: 0, brand: 3 },
  6: { title: 'Туман над болотом', time: 'overcast', weather: 'fog', terrain: 'valley', curvy: 1.5, hillAmp: 10, jumps: 1, forks: 1, base: 1, brand: 0 },
  7: { title: 'Ночная дорога', time: 'night', lamps: true, terrain: 'hills', curvy: 1.2, hillAmp: 24, jumps: 1, forks: 1, base: 2, brand: 1 },
  8: { title: 'Снежный серпантин', time: 'day', weather: 'snow', terrain: 'mountain', curvy: 2.2, hillAmp: 55, jumps: 2, forks: 0, slippery: 0.72, base: 3, brand: 2 },
  9: { title: 'Красный каньон', time: 'sunset', terrain: 'canyon', curvy: 1.4, hillAmp: 26, jumps: 3, forks: 2, base: 3, brand: 3 },
  10: { title: 'Гроза в пустошах', time: 'night', weather: 'rain', storm: true, lamps: true, terrain: 'hills', curvy: 1.3, hillAmp: 30, jumps: 2, forks: 2, slippery: 0.85, base: 2, brand: 0 },
  11: { title: 'Метель на перевале', time: 'night', weather: 'snow', lamps: true, terrain: 'mountain', curvy: 1.9, hillAmp: 50, jumps: 2, forks: 1, slippery: 0.7, base: 1, brand: 1 },
};

// Аркада: бесконечное кольцо, считаются пройденные километры
export const ARCADE_MAPS = [
  { id: 'forest', name: 'Лесная трасса', biome: 'forest', time: 'day', terrain: 'valley', hillAmp: 16, jumps: 3, color: '#3f7a3a' },
  { id: 'sunset', name: 'Закатные холмы', biome: 'autumn', time: 'sunset', terrain: 'hills', hillAmp: 26, jumps: 4, color: '#d8703a' },
  { id: 'night', name: 'Ночной трек', biome: 'field', time: 'night', lamps: true, terrain: 'valley', hillAmp: 16, jumps: 3, color: '#2a3a6a' },
  { id: 'snow', name: 'Снежное кольцо', biome: 'snow', time: 'day', weather: 'snow', terrain: 'mountain', hillAmp: 24, jumps: 3, slippery: 0.75, color: '#8aa8c8' },
  { id: 'canyon', name: 'Красный каньон', biome: 'canyon', time: 'day', terrain: 'canyon', hillAmp: 18, jumps: 4, color: '#b8583a' },
];

// Уровни дальше 11-го — сочетания готовых вариантов
function levelPreset(n) {
  if (LEVELS[n]) return LEVELS[n];
  const keys = Object.keys(LEVELS).map(Number).filter((k) => k > 2);
  const a = LEVELS[keys[(n * 7) % keys.length]];
  const b = LEVELS[keys[(n * 3 + 1) % keys.length]];
  return { ...a, terrain: b.terrain, curvy: b.curvy, hillAmp: b.hillAmp, jumps: 2 + (n % 3), forks: 1 + (n % 2), title: `Дикие земли ${n}`, base: n % 4, brand: n % 4 };
}

export function baseInfo(n) {
  const i = n - 1;
  if (i < BASE_LIST.length) return { n, name: `База ${n}`, sub: BASE_LIST[i][0], biome: BASE_LIST[i][1] };
  const keys = Object.keys(BIOMES);
  const biome = keys[(n * 7) % keys.length];
  return { n, name: `База ${n}`, sub: `Дикие земли · ${BIOMES[biome].name}`, biome };
}

// Параметры поездки к базе n (из базы n-1). С каждой базой зомби сильнее, быстрее и разнообразнее.
export function levelParams(n) {
  const k = Math.max(0, n - 2);
  // доли видов (остальное — обычные ходоки)
  const mix = {
    runner: k < 1 ? 0.08 : Math.min(0.12 + k * 0.03, 0.3),
    crawler: 0.1,
    brute: k < 1 ? 0 : Math.min(0.04 + k * 0.012, 0.12),
    armored: k < 1 ? 0 : Math.min(0.05 + k * 0.02, 0.18),
    spitter: k < 2 ? 0 : Math.min(0.04 + k * 0.012, 0.12),
    exploder: k < 2 ? 0 : Math.min(0.04 + k * 0.01, 0.1),
  };
  const bosses = ['tank', 'queen', 'butcher'];
  return {
    length: Math.min(1300 + k * 160, 3000),
    zombieDensity: Math.min(0.05 + k * 0.01, 0.14),
    mix,
    hpMul: 1 + k * 0.15,
    speedMul: Math.min(1 + k * 0.035, 1.35),
    dmgMul: 1 + k * 0.12,
    boss: bosses[k % 3],
    bossMul: 1 + k * 0.35,
    stationBoss: k >= 3,
    bandits: k === 0 ? 3 : Math.min(3 + k, 9),
    mines: k === 0 ? 3 : Math.min(4 + k * 2, 16),
    stationWave: Math.min(8 + k * 3, 30),
    killGoal: Math.min(12 + k * 5, 60),
    reward: 450 + k * 150,
    bossReward: { cash: 400 + k * 200, gold: 5 + k * 2 },
    ...levelPreset(Math.max(2, n)),
  };
}

export const TASKS = [
  { id: 'kill25', text: 'Убей 25 зомби', stat: 'kills', goal: 25, reward: { cash: 500 } },
  { id: 'base2', text: 'Доберись до Базы 2', stat: 'maxBase', goal: 2, reward: { cash: 400 } },
  { id: 'buy1', text: 'Купи первое улучшение', stat: 'purchases', goal: 1, reward: { cash: 300 } },
  { id: 'fuel1', text: 'Заправь машину на заправке', stat: 'refuels', goal: 1, reward: { cash: 400 } },
  { id: 'metal30', text: 'Собери 30 металла', stat: 'metal', goal: 30, reward: { cash: 600 } },
  { id: 'crates15', text: 'Разбей 15 ящиков', stat: 'crates', goal: 15, reward: { cash: 500 } },
  { id: 'bandits10', text: 'Победи 10 бандитов', stat: 'bandits', goal: 10, reward: { cash: 900 } },
  { id: 'kill100', text: 'Убей 100 зомби', stat: 'kills', goal: 100, reward: { cash: 1500 } },
  { id: 'base3', text: 'Доберись до Базы 3', stat: 'maxBase', goal: 3, reward: { cash: 800 } },
  { id: 'wood40', text: 'Собери 40 дерева', stat: 'wood', goal: 40, reward: { cash: 700 } },
  { id: 'foot50', text: 'Убей 50 зомби пешком', stat: 'footKills', goal: 50, reward: { gold: 10 } },
  { id: 'dist10', text: 'Проедь 10 км', stat: 'distance', goal: 10000, reward: { gold: 10 } },
  { id: 'brute10', text: 'Убей 10 громил', stat: 'brutes', goal: 10, reward: { gold: 15 } },
  { id: 'boss1', text: 'Победи босса', stat: 'bosses', goal: 1, reward: { gold: 10 } },
  { id: 'boss5', text: 'Победи 5 боссов', stat: 'bosses', goal: 5, reward: { gold: 40 } },
  { id: 'base5', text: 'Доберись до Базы 5', stat: 'maxBase', goal: 5, reward: { gold: 25 } },
  { id: 'upgrade3', text: 'Улучши базу 3 раза', stat: 'baseUps', goal: 3, reward: { cash: 2000 } },
  { id: 'car2', text: 'Купи вторую машину', stat: 'cars', goal: 2, reward: { gold: 20 } },
  { id: 'kill500', text: 'Убей 500 зомби', stat: 'kills', goal: 500, reward: { gold: 40 } },
  { id: 'base10', text: 'Доберись до Базы 10', stat: 'maxBase', goal: 10, reward: { gold: 60 } },
  { id: 'dist50', text: 'Проедь 50 км', stat: 'distance', goal: 50000, reward: { gold: 50 } },
  { id: 'jump10', text: 'Соверши 10 прыжков с трамплина', stat: 'jumps', goal: 10, reward: { cash: 900 } },
  { id: 'arcade3', text: 'Проедь 3 км в аркаде за заезд', stat: 'arcade', goal: 3000, reward: { gold: 15 } },
  { id: 'arcade10', text: 'Проедь 10 км в аркаде за заезд', stat: 'arcade', goal: 10000, reward: { gold: 50 } },
];

// Ежедневные награды (7 дней по кругу)
export const DAILY = [
  { kind: 'cash', amount: 500, icon: 'cash' },
  { kind: 'cash', amount: 1000, icon: 'chest' },
  { kind: 'gold', amount: 15, icon: 'gold' },
  { kind: 'gun', id: 'ak47', fallback: { kind: 'cash', amount: 1500 }, icon: 'rifle' },
  { kind: 'cash', amount: 2000, icon: 'cash' },
  { kind: 'res', res: { metal: 15, wood: 15, cloth: 10, repair: 2 }, icon: 'chest' },
  { kind: 'car', id: 'hunter', fallback: { kind: 'gold', amount: 40 }, icon: 'car' },
];

// Сектора рулетки
export const WHEEL = [
  { label: '300', kind: 'cash', amount: 300, color: '#3f8f3a', w: 18 },
  { label: '5', kind: 'gold', amount: 5, color: '#c9861a', w: 10 },
  { label: '×8', kind: 'res', res: { metal: 8 }, icon: 'metal', color: '#4a6fa8', w: 14 },
  { label: '800', kind: 'cash', amount: 800, color: '#7a3fa0', w: 10 },
  { label: '×2', kind: 'res', res: { repair: 2 }, icon: 'repair', color: '#b8342a', w: 12 },
  { label: '×10', kind: 'res', res: { wood: 10 }, icon: 'wood', color: '#3f8f3a', w: 14 },
  { label: '20', kind: 'gold', amount: 20, color: '#c9861a', w: 4 },
  { label: '×3', kind: 'res', res: { ammo: 3, fuel: 1 }, icon: 'ammo', color: '#4a6fa8', w: 12 },
  { label: '2000', kind: 'cash', amount: 2000, color: '#7a3fa0', w: 5 },
  { label: '×8', kind: 'res', res: { cloth: 8 }, icon: 'cloth', color: '#b8342a', w: 12 },
];

export const EXCHANGE = [
  { gold: 10, cash: 1200 },
  { gold: 30, cash: 4000 },
  { gold: 80, cash: 12000 },
];
// Товары внутриигровых покупок Яндекса (id нужно завести в консоли разработчика)
export const PURCHASES = [
  { id: 'gold100', gold: 100, label: '100 золота' },
  { id: 'gold300', gold: 300, label: '300 золота' },
  { id: 'gold1000', gold: 1000, label: '1000 золота' },
];

export function findPart(slot, id) {
  return PARTS[slot].find((p) => p.id === id) || PARTS[slot][0];
}
export function findCar(id) {
  return CARS.find((c) => c.id === id) || CARS[0];
}
export function findGun(id) {
  return GUNS.find((g) => g.id === id) || GUNS[0];
}
export function findArmor(id) {
  return ARMOR.find((a) => a.id === id) || null;
}

// Случайный вид зомби по долям из levelParams().mix
export function pickZombieType(mix, r) {
  let acc = 0;
  for (const k in mix) {
    acc += mix[k];
    if (r < acc) return k;
  }
  return 'walker';
}

export const ZBOSS_NAMES = { tank: 'Танк', queen: 'Королева заразы', butcher: 'Мясник' };

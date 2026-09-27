// Точка входа: загрузка, меню, магазин, правила, настройки и запуск партий.

import { Game, BOARD_SIZES, WALLS_BY_SIZE } from './core/quoridor.js';
import { BOT_LEVELS } from './core/ai.js';
import { BoardView } from './render/board3d.js';
import { skinThumb } from './render/thumbs.js';
import { SKIN_KINDS, findSkin } from './data/skins.js';
import { state, save, subscribe, isOwned, buy, equip, claimBonus, resetProgress, applyCloudSave, addCoins, playerName } from './state/store.js';
import { $, $$, h, icon, coinIcon, modal, toast } from './ui/dom.js';
import { icons } from './ui/icons.js';
import { sfx, setPaused } from './audio.js';
import { Match } from './ui/game.js';
import { OnlineClient, inviteLink } from './net/online.js';
import * as platform from './platform/yandex.js';

const TIMES = [
  { sec: 60, label: '1 мин', sub: 'Быстро' },
  { sec: 180, label: '3 мин', sub: 'Классика' },
  { sec: 300, label: '5 мин', sub: 'Длинная' },
  { sec: 600, label: '10 мин', sub: 'Для опытных' },
];

const MODES = [
  { id: 'bot', icon: 'robot', label: 'Против бота', sub: 'Тренируйся и улучшайся' },
  { id: 'online', icon: 'globe', label: 'Онлайн', sub: 'Случайный игрок или друг' },
  { id: 'friend', icon: 'users', label: 'С другом', sub: 'На одном экране или по ссылке' },
];

const SHOP_PAGE = 8;

let view = null; // единственный 3D-вид, переезжает между экранами
let match = null;
let currentView = 'play';
let shopKind = 'walls';
let shopPage = 0;

// ---------- Утилиты ----------

function fillIcons(root = document) {
  $$('[data-icon]', root).forEach((el) => {
    el.innerHTML = icons[el.dataset.icon] || '';
  });
}

function showScreen(id) {
  $$('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
}

function applySkinsToView() {
  view.setSkins({ ...state.equipped });
}

// Декоративная позиция для превью в меню и правилах
function demoGame(n) {
  const g = new Game(n);
  const c = (n - 1) / 2;
  const walls = [
    [c - 3, 1, 'h'],
    [c + 1, 1, 'v'],
    [c - 1, 2, 'h'],
    [c + 2, 3, 'h'],
    [c - 3, 3, 'v'],
    [c, 4, 'v'],
    [c - 2, 5, 'h'],
    [c + 1, 5, 'h'],
    [c + 3, 2, 'v'],
    [c - 4, 6, 'h'],
    [c + 2, 6, 'v'],
  ];
  g.wallsLeft = [99, 99];
  for (const [x, y, o] of walls) {
    g.turn = 0;
    if (g.canPlaceWall(x, y, o, 0)) g.play({ type: 'wall', x, y, o });
  }
  g.turn = 0;
  return g;
}

// ---------- Меню: навигация ----------

function setView(name) {
  currentView = name;
  $$('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  $$('.view').forEach((v) => v.classList.toggle('active', v.dataset.view === name));
  if (name === 'play') mountMenuPreview();
  else if (name === 'rules') mountRulesPreview();
  else view.stop();
  if (name === 'shop') renderShop();
  if (name === 'settings') renderSettings();
  $('.menu-main').scrollTop = 0;
}

function mountMenuPreview() {
  const n = state.prefs.size;
  view.setSize(n);
  view.syncState(demoGame(n));
  view.setFlipped(false);
  view.setTilt(Math.min(60, state.settings.tilt + 2));
  view.pulseStrip(0, false);
  view.mount($('#menu-stage'), { interactive: false, sway: state.settings.animations });
  view.start();
}

function mountRulesPreview() {
  const n = state.prefs.size;
  view.setSize(n);
  view.syncState(demoGame(n));
  view.setFlipped(false);
  view.setTilt(58);
  view.mount($('#rules-stage'), { interactive: false, sway: false });
  view.start();
}

// ---------- Играть ----------

function renderPlayPanel() {
  const times = $('#time-choices');
  times.innerHTML = '';
  for (const t of TIMES) {
    times.append(
      h(
        'button',
        {
          class: `choice${state.prefs.time === t.sec ? ' selected' : ''}`,
          onclick: () => {
            state.prefs.time = t.sec;
            save();
            sfx.click();
            renderPlayPanel();
          },
        },
        icon('clock'),
        h('b', {}, t.label),
        h('small', {}, t.sub),
      ),
    );
  }
  const modes = $('#mode-choices');
  modes.innerHTML = '';
  for (const m of MODES) {
    modes.append(
      h(
        'button',
        {
          class: `choice${state.prefs.mode === m.id ? ' selected' : ''}`,
          onclick: () => {
            state.prefs.mode = m.id;
            save();
            sfx.click();
            renderPlayPanel();
          },
        },
        icon(m.icon),
        h('b', {}, m.label),
        h('small', {}, m.sub),
      ),
    );
  }
  const levels = $('#level-choices');
  levels.innerHTML = '';
  levels.classList.toggle('hidden', state.prefs.mode !== 'bot');
  for (const [id, lv] of Object.entries(BOT_LEVELS)) {
    levels.append(
      h(
        'button',
        {
          class: `choice${state.prefs.botLevel === id ? ' selected' : ''}`,
          onclick: () => {
            state.prefs.botLevel = id;
            save();
            sfx.click();
            renderPlayPanel();
          },
        },
        lv.name,
      ),
    );
  }
  $('#size-label').textContent = `${state.prefs.size} × ${state.prefs.size}`;
}

function onStart() {
  sfx.click();
  const mode = state.prefs.mode;
  if (mode === 'bot') startMatch({ mode: 'bot', botLevel: state.prefs.botLevel });
  else if (mode === 'online') startQuickMatch();
  else openFriendModal();
}

function startMatch(cfg) {
  const full = { size: state.prefs.size, time: state.prefs.time, ...cfg };
  document.activeElement?.blur?.();
  view.stop();
  showScreen('screen-game');
  match = new Match(full, {
    view,
    onExit: backToMenu,
    onRestart: (next) => startMatch(next),
  });
  match.start();
}

function backToMenu() {
  match = null;
  showScreen('screen-menu');
  $('#modal-root').innerHTML = '';
  setView('play');
}

function openSizeModal() {
  sfx.click();
  const body = h(
    'div',
    { class: 'size-grid' },
    BOARD_SIZES.map((n) =>
      h(
        'button',
        {
          class: `option${state.prefs.size === n ? ' selected' : ''}`,
          onclick: () => {
            state.prefs.size = n;
            save();
            sfx.click();
            renderPlayPanel();
            if (currentView === 'play') mountMenuPreview();
            m.close();
          },
        },
        icon('grid'),
        h('div', {}, h('b', {}, `${n} × ${n}`), h('small', {}, `${WALLS_BY_SIZE[n]} стен у игрока${n === 9 ? ' · классика' : ''}`)),
      ),
    ),
  );
  const m = modal({ title: 'Размер поля', body });
}

// ---------- Режим «С другом» ----------

function openFriendModal() {
  const body = h(
    'div',
    { class: 'option-list' },
    h(
      'button',
      { class: 'option', onclick: () => { m.close(); startMatch({ mode: 'hotseat' }); } },
      icon('device'),
      h('div', {}, h('b', {}, 'На одном устройстве'), h('small', {}, 'Ходите по очереди за одним экраном')),
    ),
    h(
      'button',
      { class: 'option', onclick: () => { m.close(); createRoom(); } },
      icon('link'),
      h('div', {}, h('b', {}, 'Пригласить по ссылке'), h('small', {}, 'Создайте комнату и отправьте ссылку другу')),
    ),
    h(
      'button',
      { class: 'option', onclick: () => { m.close(); openJoinModal(); } },
      icon('users'),
      h('div', {}, h('b', {}, 'Войти по коду'), h('small', {}, 'Введите код комнаты от друга')),
    ),
  );
  const m = modal({ title: 'Игра с другом', body });
}

function openJoinModal(prefill = '') {
  const input = h('input', { class: 'text-input', placeholder: 'Код комнаты', maxlength: 8, value: prefill });
  const m = modal({
    title: 'Войти по коду',
    body: h('div', {}, h('p', {}, 'Введите код, который прислал друг.'), input),
    buttons: [
      { label: 'Отмена', kind: 'ghost' },
      { label: 'Войти', kind: 'primary', onClick: () => joinRoom(input.value) },
    ],
  });
  setTimeout(() => input.focus(), 50);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      m.close();
      joinRoom(input.value);
    }
  });
}

// ---------- Онлайн ----------

async function connectOnline() {
  const net = new OnlineClient(playerName());
  // Если сервер вернул нас в идущую партию — сразу открываем её
  net.on('start', (msg) => {
    $('#modal-root').innerHTML = '';
    startOnline(net, msg);
  });
  try {
    const resumed = await net.connect();
    return { net, resumed };
  } catch {
    net.close();
    modal({
      title: 'Онлайн недоступен',
      body: h('div', {}, h('p', {}, 'Не удалось подключиться к игровому серверу. Проверьте интернет и попробуйте ещё раз.'), h('p', {}, 'А пока можно сыграть с ботом или с другом на одном устройстве.')),
      buttons: [
        { label: 'Закрыть', kind: 'ghost' },
        { label: 'Играть с ботом', kind: 'primary', onClick: () => startMatch({ mode: 'bot', botLevel: state.prefs.botLevel }) },
      ],
    });
    return null;
  }
}

function waitForStart(net, dialog) {
  net.on('start', (msg) => {
    dialog?.close();
    startOnline(net, msg);
  });
  net.on('error', (msg) => toast(msg.msg, 'error'));
  net.on('disconnect', () => {
    dialog?.close();
    toast('Соединение с сервером потеряно', 'error');
  });
}

function startOnline(net, msg) {
  startMatch({
    mode: 'online',
    size: msg.size,
    time: msg.time,
    net,
    you: msg.you,
    names: msg.names,
    moves: msg.moves,
    remaining: msg.remaining,
  });
}

async function startQuickMatch() {
  const dialog = modal({
    title: 'Поиск соперника',
    closable: false,
    body: h('div', { style: { textAlign: 'center' } }, h('div', { class: 'spinner' }), h('p', { class: 'search-text' }, 'Подключаемся к серверу…'), h('p', {}, h('small', {}, `Поле ${state.prefs.size}×${state.prefs.size} · ${state.prefs.time / 60} мин на ход`))),
    buttons: [
      { label: 'Отмена', kind: 'ghost', onClick: () => conn?.net.close() },
      {
        label: 'Играть с другом',
        kind: 'ghost',
        icon: 'link',
        onClick: () => {
          conn?.net.close();
          createRoom();
        },
      },
    ],
  });
  const conn = await connectOnline();
  if (!conn) {
    dialog.close();
    return;
  }
  if (conn.resumed) return; // старт придёт через обработчик ниже
  const text = dialog.el.querySelector('.search-text');
  if (text) text.textContent = 'Ищем случайного соперника…';
  waitForStart(conn.net, dialog);
  conn.net.send({ t: 'quick', size: state.prefs.size, time: state.prefs.time });
}

async function createRoom() {
  const conn = await connectOnline();
  if (!conn) return;
  const { net } = conn;
  let dialog = null;
  net.on('room', (msg) => {
    const link = platform.inviteUrl(msg.code) || inviteLink(msg.code);
    const input = h('input', { class: 'text-input', value: link, readonly: true });
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(link);
        toast('Ссылка скопирована', 'success');
      } catch {
        input.select();
        document.execCommand?.('copy');
        toast('Ссылка скопирована', 'success');
      }
    };
    dialog = modal({
      title: 'Пригласите друга',
      closable: false,
      body: h(
        'div',
        {},
        h('p', {}, 'Отправьте другу ссылку или код комнаты. Игра начнётся, как только он зайдёт.'),
        h('div', { class: 'big-code' }, msg.code),
        h('div', { class: 'code-box' }, input, h('button', { class: 'btn primary', onclick: copy }, icon('copy'))),
        h('div', { class: 'spinner' }),
      ),
      buttons: [
        { label: 'Отмена', kind: 'ghost', onClick: () => net.close() },
        navigator.share
          ? { label: 'Поделиться', kind: 'primary', close: false, onClick: () => navigator.share({ title: 'Коридор', text: `Сыграем в Коридор? Код: ${msg.code}`, url: link }).catch(() => {}) }
          : null,
      ].filter(Boolean),
    });
    waitForStart(net, dialog);
  });
  net.on('start', (msg) => {
    dialog?.close();
    startOnline(net, msg);
  });
  net.send({ t: 'create', size: state.prefs.size, time: state.prefs.time });
}

async function joinRoom(code) {
  code = String(code || '').trim().toUpperCase();
  if (!code) return;
  const conn = await connectOnline();
  if (!conn) return;
  const dialog = modal({
    title: 'Подключение',
    closable: false,
    body: h('div', { style: { textAlign: 'center' } }, h('div', { class: 'spinner' }), h('p', {}, `Входим в комнату ${code}…`)),
    buttons: [{ label: 'Отмена', kind: 'ghost', onClick: () => conn.net.close() }],
  });
  waitForStart(conn.net, dialog);
  conn.net.on('error', (msg) => {
    dialog.close();
    conn.net.close();
    toast(msg.msg, 'error');
  });
  conn.net.send({ t: 'join', code });
}

// ---------- Монеты ----------

function renderCoins() {
  $('#coins').textContent = String(state.coins);
}

async function onPlus() {
  sfx.click();
  if (platform.isYandex()) {
    modal({
      title: 'Получить монеты',
      body: h('div', {}, h('p', {}, 'Посмотрите короткую рекламу и получите 50 монет.')),
      buttons: [
        { label: 'Отмена', kind: 'ghost' },
        {
          label: '+50',
          icon: 'video',
          kind: 'gold',
          onClick: async () => {
            const ok = await platform.showRewardedAd();
            if (ok) {
              addCoins(50);
              sfx.coin();
              toast('+50 монет!', 'success');
            } else {
              toast('Реклама недоступна, попробуйте позже');
            }
          },
        },
      ],
    });
    return;
  }
  const r = claimBonus();
  if (r.ok) {
    sfx.coin();
    toast(`Ежедневный бонус: +${r.amount} монет!`, 'success');
  } else {
    const hrs = Math.ceil(r.left / 3_600_000);
    toast(`Следующий бонус через ${hrs} ч. Побеждайте, чтобы заработать монеты!`);
  }
}

// ---------- Магазин ----------

function renderShop() {
  const tabs = $('#shop-tabs');
  tabs.innerHTML = '';
  for (const [kind, def] of Object.entries(SKIN_KINDS)) {
    tabs.append(
      h(
        'button',
        {
          class: `tab${kind === shopKind ? ' active' : ''}`,
          onclick: () => {
            shopKind = kind;
            shopPage = 0;
            sfx.click();
            renderShop();
          },
        },
        def.title,
      ),
    );
  }
  const list = SKIN_KINDS[shopKind].list;
  const pages = Math.ceil(list.length / SHOP_PAGE);
  shopPage = Math.min(shopPage, pages - 1);
  const grid = $('#shop-grid');
  grid.innerHTML = '';
  for (const skin of list.slice(shopPage * SHOP_PAGE, (shopPage + 1) * SHOP_PAGE)) {
    const owned = isOwned(shopKind, skin.id);
    const equipped = state.equipped[shopKind] === skin.id;
    const cls = ['skin-card', equipped && 'equipped', !owned && 'locked', !owned && state.coins < skin.price && 'cant'].filter(Boolean).join(' ');
    const price = owned
      ? h('div', { class: 'price owned' }, equipped ? 'Выбрано' : 'Надеть')
      : h('div', { class: 'price' }, coinIcon(), String(skin.price));
    grid.append(
      h(
        'button',
        { class: cls, onclick: () => onSkinClick(shopKind, skin) },
        h('img', { src: skinThumb(shopKind, skin), alt: skin.name, draggable: 'false' }),
        h('div', { class: 'meta' }, h('div', { class: 'name' }, skin.name), price),
      ),
    );
  }
  const dots = $('#shop-dots');
  dots.innerHTML = '';
  if (pages > 1) {
    for (let i = 0; i < pages; i++) {
      dots.append(
        h('button', {
          class: `dot${i === shopPage ? ' active' : ''}`,
          'aria-label': `Страница ${i + 1}`,
          onclick: () => {
            shopPage = i;
            renderShop();
          },
        }),
      );
    }
  }
  renderEquipped();
}

function renderEquipped() {
  const box = $('#equipped-list');
  box.innerHTML = '';
  for (const [kind, def] of Object.entries(SKIN_KINDS)) {
    const skin = findSkin(kind, state.equipped[kind]);
    box.append(
      h(
        'div',
        { class: 'eq-row' },
        h('img', { src: skinThumb(kind, skin), alt: '' }),
        h('div', {}, h('b', {}, def.title), h('span', {}, `(${skin.name})`)),
      ),
    );
  }
}

function onSkinClick(kind, skin) {
  if (isOwned(kind, skin.id)) {
    equip(kind, skin.id);
    applySkinsToView();
    sfx.click();
    renderShop();
    return;
  }
  if (state.coins < skin.price) {
    sfx.error();
    const buttons = [{ label: 'Понятно', kind: 'ghost' }];
    if (platform.isYandex()) buttons.push({ label: 'Монеты за рекламу', icon: 'video', kind: 'gold', onClick: onPlus });
    modal({
      title: 'Не хватает монет',
      body: h('p', {}, `Нужно ещё ${skin.price - state.coins} монет. Побеждайте в партиях, чтобы заработать!`),
      buttons,
    });
    return;
  }
  modal({
    title: `Купить «${skin.name}»?`,
    body: h(
      'div',
      { style: { textAlign: 'center' } },
      h('img', { src: skinThumb(kind, skin), alt: '', style: { width: '220px', borderRadius: '12px' } }),
      h('p', {}, `${SKIN_KINDS[kind].title} · `, h('b', {}, String(skin.price)), ' монет'),
    ),
    buttons: [
      { label: 'Отмена', kind: 'ghost' },
      {
        label: 'Купить',
        kind: 'primary',
        onClick: () => {
          if (buy(kind, skin)) {
            sfx.coin();
            toast(`«${skin.name}» куплено и надето!`, 'success');
            applySkinsToView();
            renderShop();
          }
        },
      },
    ],
  });
}

// ---------- Правила ----------

function renderRules() {
  const items = [
    'У каждого игрока фишка на поле 9 × 9 (можно выбрать 5 × 5, 7 × 7 или 11 × 11).',
    'Фишки начинают на своих концах поля (красная — сверху, синяя — снизу). Синие ходят первыми.',
    'За ход можно либо передвинуть фишку на соседнюю свободную клетку, либо поставить стену.',
    'Стена закрывает проход сразу между двумя парами клеток. На поле 9 × 9 у каждого 10 стен. Полностью перекрыть сопернику путь к финишу нельзя.',
    'Если фишки стоят рядом, можно перепрыгнуть соперника. Если за ним стена или край поля — прыжок по диагонали.',
    'Ваша цель — первым дойти до финиша на стороне противника.',
  ];
  const ol = $('#rules-list');
  ol.innerHTML = '';
  items.forEach((t) => ol.append(h('li', {}, t)));
  $('#controls-help').innerHTML = `
    <div><b>Компьютер</b><br>Клик — ход или стена<br><kbd>Пробел</kbd> — фишка/стена<br><kbd>R</kbd>, колесо, ПКМ — повернуть стену</div>
    <div><b>Телефон</b><br>Касание клетки — ход<br>Режим «Стена»: коснитесь борозды, затем ещё раз — поставить</div>`;
}

// ---------- Настройки ----------

function renderSettings() {
  const s = state.settings;
  const list = $('#settings-list');
  list.innerHTML = '';
  const row = (title, sub, control) => h('div', { class: 'setting' }, h('div', {}, h('b', {}, title), sub ? h('small', {}, sub) : null), control);
  const sw = (key, onChange) =>
    h('button', {
      class: `switch${s[key] ? ' on' : ''}`,
      role: 'switch',
      'aria-checked': String(!!s[key]),
      onclick: (e) => {
        s[key] = !s[key];
        save();
        e.currentTarget.classList.toggle('on', s[key]);
        e.currentTarget.setAttribute('aria-checked', String(s[key]));
        sfx.click();
        onChange?.(s[key]);
      },
    });
  const range = (key, min, max, step, onInput) => {
    const r = h('input', { type: 'range', min, max, step, value: s[key] });
    r.addEventListener('input', () => {
      s[key] = Number(r.value);
      onInput?.(s[key]);
    });
    r.addEventListener('change', () => save());
    return r;
  };
  const name = h('input', { class: 'text-input', maxlength: 20, placeholder: platform.playerName() || 'Игрок', value: s.name });
  name.addEventListener('change', () => {
    s.name = name.value.trim();
    save();
  });
  list.append(
    row('Звуки', 'Эффекты ходов, стен и таймера', sw('sound')),
    row('Громкость', null, range('volume', 0, 1, 0.05, () => sfx.tick())),
    row('Подсказки ходов', 'Подсвечивать клетки, куда можно пойти', sw('hints')),
    row('Анимации', 'Прыжки фишек, падение стен, покачивание', sw('animations', (v) => {
      view.animations = v;
    })),
    row('Наклон камеры', 'От «сверху» до низкого 2.5D', range('tilt', 40, 88, 1)),
    row('Поворачивать поле', 'В игре на одном устройстве — к тому, чей ход', sw('rotateHotseat')),
    row('Имя в онлайне', null, name),
    row(
      'Сбросить прогресс',
      'Монеты, скины и статистика',
      h('button', {
        class: 'btn danger',
        onclick: () =>
          modal({
            title: 'Сбросить прогресс?',
            body: h('p', {}, 'Все монеты и купленные скины будут удалены.'),
            buttons: [
              { label: 'Отмена', kind: 'ghost' },
              {
                label: 'Сбросить',
                kind: 'danger',
                onClick: () => {
                  resetProgress();
                  applySkinsToView();
                  renderAll();
                  toast('Прогресс сброшен');
                },
              },
            ],
          }),
      }, 'Сбросить'),
    ),
  );
  renderStats();
}

function renderStats() {
  const st = state.stats;
  const owned = Object.values(state.owned).reduce((a, l) => a + l.length, 0);
  const total = Object.values(SKIN_KINDS).reduce((a, k) => a + k.list.length, 0);
  $('#stats').innerHTML = '';
  $('#stats').append(
    h('div', { class: 'stat' }, 'Сыграно партий', h('b', {}, String(st.played))),
    h('div', { class: 'stat' }, 'Побед', h('b', {}, String(st.wins))),
    h('div', { class: 'stat' }, 'Процент побед', h('b', {}, st.played ? `${Math.round((st.wins / st.played) * 100)}%` : '—')),
    h('div', { class: 'stat' }, 'Скинов собрано', h('b', {}, `${owned} / ${total}`)),
  );
}

function renderAll() {
  renderCoins();
  renderPlayPanel();
  renderRules();
  if (currentView === 'shop') renderShop();
  if (currentView === 'settings') renderSettings();
}

// ---------- Выход ----------

function onExit() {
  sfx.click();
  modal({
    title: 'Выйти из игры?',
    body: h('p', {}, 'Прогресс сохранён — возвращайтесь за новыми победами!'),
    buttons: [
      { label: 'Остаться', kind: 'ghost' },
      {
        label: 'Выйти',
        kind: 'danger',
        onClick: () => {
          if (!platform.requestExit()) {
            if (history.length > 1) history.back();
            else toast('Закройте вкладку, чтобы выйти');
          }
        },
      },
    ],
  });
}

// ---------- Запуск ----------

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

async function boot() {
  fillIcons();
  if (!webglAvailable()) {
    const f = $('#fatal');
    f.innerHTML = '<div><h2>Нужен WebGL</h2><p>Ваш браузер не поддерживает 3D-графику. Обновите браузер или включите аппаратное ускорение.</p></div>';
    f.classList.add('show');
    $('#loader').classList.add('hidden');
    platform.loadingReady();
    return;
  }

  const onYandex = await platform.initPlatform();
  if (onYandex) {
    const cloud = await platform.loadCloud();
    applyCloudSave(cloud);
    subscribe((s) => platform.saveCloud(s));
    if (!state.settings.name) state.settings.name = platform.playerName();
  }
  platform.onPause((p) => setPaused(p));

  const canvas = document.createElement('canvas');
  $('#menu-stage').prepend(canvas);
  view = new BoardView(canvas, { tilt: state.settings.tilt });
  view.animations = state.settings.animations;
  applySkinsToView();

  subscribe(() => {
    renderCoins();
    if (currentView === 'settings') renderStats();
  });

  $$('.nav-btn').forEach((b) =>
    b.addEventListener('click', () => {
      sfx.click();
      setView(b.dataset.view);
    }),
  );
  $('#btn-start').addEventListener('click', onStart);
  $('#btn-size').addEventListener('click', openSizeModal);
  $('#btn-skins').addEventListener('click', () => {
    sfx.click();
    setView('shop');
  });
  $('#btn-plus').addEventListener('click', onPlus);
  $('#btn-exit').addEventListener('click', onExit);

  renderAll();
  setView('play');

  // Прогреваем превью магазина в фоне, чтобы вкладка открывалась мгновенно
  const warm = [];
  for (const [kind, def] of Object.entries(SKIN_KINDS)) def.list.forEach((s) => warm.push([kind, s]));
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 60));
  const step = () => {
    const item = warm.shift();
    if (!item) return;
    skinThumb(item[0], item[1]);
    idle(step);
  };
  setTimeout(() => idle(step), 800);

  $('#loader').classList.add('hidden');
  platform.loadingReady();

  // Приглашение: ?room=КОД или payload из ссылки Яндекс Игр
  const room = new URLSearchParams(location.search).get('room') || platform.launchPayload();
  if (room) joinRoom(room);
  else {
    // Переподключение к онлайн-партии после перезагрузки страницы
    try {
      if (sessionStorage.getItem('koridor.resume')) {
        await connectOnlineSilently();
      }
    } catch {
      // нет хранилища
    }
  }
}

async function connectOnlineSilently() {
  const net = new OnlineClient(playerName());
  net.on('start', (msg) => startOnline(net, msg));
  try {
    const resumed = await net.connect();
    if (!resumed) {
      net.close();
      return null;
    }
    return net;
  } catch {
    net.close();
    return null;
  }
}

// Для автотестов и отладки
window.__koridor = { get match() { return match; }, get view() { return view; } };

// Кнопки не держат фокус: иначе пробел/Enter в игре «нажимали» бы их повторно
document.addEventListener('pointerup', (e) => {
  if (e.target.closest?.('button')) setTimeout(() => document.activeElement?.blur?.(), 0);
});

window.addEventListener('error', (e) => console.error(e.error || e.message));
boot().catch((e) => {
  console.error(e);
  $('#loader').classList.add('hidden');
  toast('Ошибка запуска игры', 'error');
});

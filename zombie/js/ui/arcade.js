// Аркада: выбор трассы, личный рекорд и таблица лидеров.

import { h, currencyBar } from './dom.js';
import { icon } from './icons.js';
import { S } from '../state/save.js';
import { ARCADE_MAPS } from '../data/catalog.js';
import { currencyModal } from './common.js';
import { sfx } from '../engine/audio.js';
import { getLeaderboard, isYandex } from '../platform/yandex.js';

export const km = (m) => `${((m || 0) / 1000).toFixed(2)} км`;

const TIME_ICON = { day: 'star', sunset: 'star', night: 'clock' };

export function arcadeScreen(app) {
  const s = S();
  let sel = ARCADE_MAPS.find((m) => m.id === s.arcadeMap) || ARCADE_MAPS[0];
  const el = h('div', { class: 'screen active arcade' });
  el.append(
    h('div', { class: 'screen-head' }, h('button', { class: 'icon-btn', html: icon('back'), onclick: () => (sfx.click(), app.go('menu')) }), h('h1', {}, 'Аркада')),
    currencyBar(() => currencyModal()),
  );
  const maps = h('div', { class: 'arc-maps' });
  const board = h('div', { class: 'arc-board panel' });
  const info = h(
    'div',
    { class: 'arc-info panel' },
    h('h3', {}, 'Бесконечная дорога'),
    h('p', {}, 'Едь без остановки, пока цела машина и есть бензин. Подбирай канистры и ремкомплекты, прыгай с трамплинов. Каждые 700 м зомби становятся сильнее, каждые 2 км — босс.'),
    h('div', { class: 'arc-best', html: `${icon('trophy')}<span>Твой рекорд</span><b>${km(s.arcadeBest)}</b>` }),
    h('p', { class: 'arc-note' }, 'Добыча за заезд остаётся полностью, машина в гараже не ломается. +150 монет за каждый километр.'),
  );
  const start = h('button', { class: 'btn yellow big', html: `${icon('play')} Старт`, onclick: () => (sfx.click(), app.startArcade(sel.id)) });
  el.append(h('div', { class: 'arc-wrap' }, h('div', { class: 'arc-left' }, maps, info, start), board));

  const renderMaps = () => {
    maps.innerHTML = '';
    for (const m of ARCADE_MAPS) {
      maps.append(
        h(
          'button',
          {
            class: `arc-map${m === sel ? ' sel' : ''}`,
            style: { '--mc': m.color },
            onclick: () => {
              sel = m;
              s.arcadeMap = m.id;
              sfx.click();
              renderMaps();
            },
          },
          h('span', { class: 'mi', html: icon(m.weather === 'snow' ? 'star' : TIME_ICON[m.time] || 'map') }),
          h('b', {}, m.name),
          h('small', {}, [m.time === 'night' ? 'ночь' : m.time === 'sunset' ? 'закат' : 'день', m.weather === 'snow' ? 'снег' : null, `трамплины: ${m.jumps}`].filter(Boolean).join(' · ')),
        ),
      );
    }
  };
  renderMaps();

  // таблица лидеров: из Яндекса, иначе — свои лучшие заезды
  const renderBoard = (data) => {
    board.innerHTML = '';
    board.append(h('h3', { html: `${icon('trophy')} Таблица лидеров` }));
    const list = h('div', { class: 'lb-list' });
    if (data && data.entries.length) {
      for (const e of data.entries) list.append(h('div', { class: `lb-row${e.me ? ' me' : ''}` }, h('span', { class: 'rk' }, `${e.rank}`), h('span', { class: 'nm' }, e.name), h('b', {}, km(e.score))));
    } else {
      const top = (s.arcadeTop || []).slice(0, 10);
      if (!top.length) list.append(h('div', { class: 'lb-empty' }, 'Здесь появятся лучшие заезды. Поставь первый рекорд!'));
      top.forEach((e, i) => list.append(h('div', { class: `lb-row${i === 0 ? ' me' : ''}` }, h('span', { class: 'rk' }, `${i + 1}`), h('span', { class: 'nm' }, `${s.name || 'Игрок'} · ${new Date(e.t).toLocaleDateString('ru-RU')}`), h('b', {}, km(e.d)))));
    }
    board.append(list);
    if (!isYandex()) board.append(h('small', { class: 'lb-note' }, 'Общая таблица доступна в Яндекс Играх'));
  };
  renderBoard(null);
  getLeaderboard('arcade').then((d) => {
    if (d && el.isConnected) renderBoard(d);
  });
  return el;
}

// Итоги заезда
export function arcadeResults(r, onAgain, onBoard, onMenu) {
  const line = (ic, name, val, col) => h('div', { class: 'line' }, h('span', { html: `${icon(ic)} ${name}` }), h('b', { style: col ? { color: col } : {} }, val));
  return [
    h('h2', {}, r.record ? 'Новый рекорд!' : 'Заезд окончен'),
    h('div', { class: `arc-big${r.record ? ' rec' : ''}` }, km(r.dist)),
    h(
      'div',
      { class: 'res-lines' },
      line('trophy', 'Рекорд', km(r.best), r.record ? 'var(--yellow)' : null),
      line('skull', 'Убито зомби', `${r.kills}`),
      line('cash', 'Монеты', `+${r.cash}`, 'var(--green)'),
      r.res ? line('box', 'Ресурсы', `+${r.res}`) : null,
    ),
    h(
      'div',
      { class: 'btns' },
      h('button', { class: 'btn yellow big', html: `${icon('play')} Ещё раз`, onclick: onAgain }),
      h('button', { class: 'btn dark', html: `${icon('trophy')} Лидеры`, onclick: onBoard }),
      h('button', { class: 'btn dark', html: `${icon('home')} В меню`, onclick: onMenu }),
    ),
  ];
}

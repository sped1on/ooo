// Главное меню, окно базы (улучшения), ремонт машины.

import { h, modal, toast, rewardAd, statBar, currencyBar, confirmModal } from './dom.js';
import { icon } from './icons.js';
import { S, store, levelInfo, carStats, give } from '../state/save.js';
import { baseInfo, BASE_UPGRADES, findCar } from '../data/catalog.js';
import { claimableTasks, dailyAvailable, currencyModal, tryBuy, resName } from './common.js';
import { sfx } from '../engine/audio.js';
import { fmt } from '../engine/util.js';
import { playerAvatar } from '../platform/yandex.js';

export function menuScreen(app) {
  const s = S();
  const li = levelInfo(s.xp);
  const el = h('div', { class: 'screen active menu' });
  const photo = playerAvatar();
  el.append(
    h(
      'div',
      { class: 'profile panel' },
      h('div', { class: 'avatar', html: photo ? `<img src="${photo}" alt="">` : icon('bandit') }),
      h(
        'div',
        { class: 'pinfo' },
        h('div', { class: 'pname' }, s.name || 'Игрок'),
        h('div', { class: 'plvl' }, h('span', {}, `Ур. ${li.lvl}`), h('span', {}, `${li.cur}/${li.need}`)),
        h('div', { class: 'xpbar' }, h('i', { style: { width: `${(li.cur / li.need) * 100}%` } })),
      ),
    ),
  );
  el.append(currencyBar(() => currencyModal()));

  const nav = h('nav', { class: 'menu-nav' });
  const btn = (ic, text, fn, cls = '', dot = false) => h('button', { class: `nav-btn ${cls}`, onclick: () => (sfx.click(), fn()) }, h('span', { html: icon(ic) }), text, dot ? h('i', { class: 'dot' }) : null);
  nav.append(
    btn('play', 'Играть', () => app.play(), 'play'),
    btn('trophy', 'Аркада', () => app.go('arcade'), 'arcade'),
    btn('car', 'Гараж', () => app.go('garage')),
    btn('cart', 'Магазин', () => app.go('shop')),
    btn('vest', 'Снаряжение', () => app.go('gear')),
    btn('tasks', 'Задания', () => app.go('tasks'), '', claimableTasks() > 0),
    btn('gift', 'Награды', () => app.go('rewards'), '', dailyAvailable() || Date.now() - s.wheelLast > 86400000),
    btn('gear', 'Настройки', () => app.go('settings')),
  );
  el.append(nav);

  el.append(
    h('div', { class: 'menu-banner' }, h('span', { html: icon('skull') }), h('div', {}, h('b', {}, 'Уничтожь зомби!'), h('span', {}, 'Выживай и развивай базу'))),
  );

  // карточка базы
  const info = baseInfo(s.base);
  const thumb = h('img', { class: 'bthumb', alt: '' });
  app.baseThumb().then((url) => {
    if (url) thumb.src = url;
  });
  const res = h(
    'div',
    { class: 'res-row' },
    ...['wood', 'metal', 'cloth'].map((k) => h('span', { title: resName(k), html: `${icon(k)}${s.inv[k] || 0}` })),
  );
  el.append(
    h(
      'div',
      { class: 'base-card panel', onclick: () => baseModal(app) },
      h('h3', {}, info.name),
      h('p', {}, info.sub),
      thumb,
      res,
    ),
  );

  // состояние машины
  const st = carStats();
  const frac = s.carHp[s.car] ?? 1;
  const hpBox = h(
    'div',
    { class: 'car-hp panel' },
    h('div', { class: 'row' }, h('span', {}, findCar(s.car).name), h('span', {}, `${Math.round(frac * 100)}%`)),
    statBar(frac, 1, 0, `hp ${frac > 0.5 ? 'good' : ''}`),
  );
  if (frac < 0.999) hpBox.append(h('button', { class: 'btn green', style: { width: '100%' }, onclick: () => repairModal(app) }, h('span', { html: icon('wrench') }), 'Ремонт'));
  else hpBox.append(h('div', { class: 'row', style: { color: 'var(--muted)' } }, h('span', {}, `Прочность ${st.hp} · Скорость ${Math.round(st.speed * 3.6)} км/ч`)));
  el.append(hpBox);
  return el;
}

// Стоимость ремонта
export function repairCost() {
  const s = S();
  const st = carStats();
  const miss = 1 - (s.carHp[s.car] ?? 1);
  const k = 1 - (s.baseUp.workshop || 0) * 0.08;
  return {
    miss,
    cash: Math.ceil(miss * st.hp * 6 * k),
    metal: Math.ceil(miss * 18 * k),
    cloth: Math.ceil(miss * 6 * k),
  };
}

export function repairModal(app, then) {
  const s = S();
  const c = repairCost();
  if (c.miss <= 0.001) {
    then?.();
    return;
  }
  const done = (how) => {
    s.carHp[s.car] = 1;
    store.save();
    sfx.buy();
    toast(`Машина отремонтирована ${how}`, false, 'wrench');
    m.close();
    app.refresh();
    then?.();
  };
  const hasRes = (s.inv.metal || 0) >= c.metal && (s.inv.cloth || 0) >= c.cloth;
  const m = modal([
    h('h2', {}, 'Ремонт машины'),
    h('p', {}, `Прочность: ${Math.round((1 - c.miss) * 100)}%`),
    statBar(1 - c.miss, 1, 0, 'hp'),
    h(
      'div',
      { class: 'btns' },
      h('button', {
        class: 'btn green',
        disabled: !hasRes,
        html: `${icon('metal')} ${c.metal} + ${icon('cloth')} ${c.cloth} — починить`,
        onclick: () => {
          s.inv.metal -= c.metal;
          s.inv.cloth -= c.cloth;
          done('из ресурсов');
        },
      }),
      h('button', {
        class: 'btn yellow',
        html: `${icon('cash')} ${fmt(c.cash)} — починить`,
        onclick: () => {
          if (tryBuy(c.cash)) done('');
        },
      }),
      h('button', {
        class: 'btn dark',
        html: `${icon('video')} Бесплатно за рекламу`,
        onclick: async () => {
          if (await rewardAd()) done('');
        },
      }),
      then ? h('button', { class: 'btn dark', onclick: () => (m.close(), then()) }, 'Ехать так') : h('button', { class: 'btn dark', onclick: () => m.close() }, 'Закрыть'),
    ),
  ]);
}

// Улучшения базы за ресурсы
export function baseModal(app) {
  const s = S();
  const info = baseInfo(s.base);
  const list = h('div', { class: 'btns' });
  const render = () => {
    list.innerHTML = '';
    list.append(
      h('div', { class: 'res-grid' }, ...['wood', 'metal', 'cloth', 'ammo', 'repair', 'fuel'].map((k) => h('div', { class: 'res-item', html: `${icon(k)} ${resName(k)}<b style="color:#fff">${s.inv[k] || 0}</b>` }))),
    );
    for (const u of BASE_UPGRADES) {
      const lvl = s.baseUp[u.id] || 0;
      const max = lvl >= u.max;
      const cost = u.cost(lvl);
      const ok = Object.keys(cost).every((k) => (s.inv[k] || 0) >= cost[k]);
      const costHtml = Object.keys(cost)
        .map((k) => `${icon(k)}${cost[k]}`)
        .join(' ');
      list.append(
        h(
          'div',
          { class: 'ex-row', style: { flexWrap: 'wrap' } },
          h('span', { style: { flexDirection: 'column', alignItems: 'flex-start', gap: '0' } }, h('b', {}, `${u.name} · ${lvl}/${u.max}`), h('small', { style: { color: 'var(--muted)' } }, u.desc)),
          max
            ? h('b', { style: { color: 'var(--green)' } }, 'Макс.')
            : h('button', {
                class: 'btn green',
                disabled: !ok,
                html: costHtml,
                onclick: () => {
                  for (const k in cost) s.inv[k] -= cost[k];
                  s.baseUp[u.id] = lvl + 1;
                  s.stats.baseUps++;
                  sfx.buy();
                  store.save();
                  render();
                  app.refresh();
                },
              }),
        ),
      );
    }
    list.append(
      h('button', {
        class: 'btn dark',
        html: `${icon('video')} Реклама: +5 ${resName('metal')} и +5 ${resName('wood')}`,
        onclick: async () => {
          if (await rewardAd()) {
            give({ res: { metal: 5, wood: 5 } });
            store.save();
            render();
          }
        },
      }),
    );
    list.append(h('button', { class: 'btn dark', onclick: () => m.close() }, 'Закрыть'));
  };
  const m = modal([h('h2', {}, `${info.name} · ${info.sub}`), h('p', {}, 'Собирай ресурсы в поездках и улучшай базу'), list]);
  render();
}

export async function resetConfirm() {
  return confirmModal('Сбросить прогресс?', 'Все деньги, машины и базы будут потеряны.', 'Сбросить');
}

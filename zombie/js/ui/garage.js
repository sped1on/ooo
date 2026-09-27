// Гараж: выбор машины и деталей, предпросмотр на поворотном круге, покупка и установка.

import { h, currencyBar, statBar, toast } from './dom.js';
import { icon } from './icons.js';
import { thumbImg } from './thumbs.js';
import { S, store, carStats } from '../state/save.js';
import { CARS, PARTS, findCar, CAR_WEAPON_MAX } from '../data/catalog.js';
import { tryBuy, currencyModal } from './common.js';
import { repairModal } from './menu.js';
import { sfx } from '../engine/audio.js';
import { fmt } from '../engine/util.js';

const CATS = [
  { id: 'body', name: 'Авто', icon: 'car' },
  { id: 'bumper', name: 'Бампер', icon: 'bumper' },
  { id: 'grille', name: 'Решётка', icon: 'grille' },
  { id: 'paint', name: 'Окраска', icon: 'paint' },
  { id: 'wheels', name: 'Диски', icon: 'wheel' },
  { id: 'weapon', name: 'Оружие', icon: 'weapon' },
];

export function itemsFor(cat) {
  return cat === 'body' ? CARS : PARTS[cat];
}

export function ownedItem(cat, id) {
  const s = S();
  return cat === 'body' ? s.cars.includes(id) : s.owned[cat].includes(id);
}

export function equippedItem(cat, id) {
  const s = S();
  return cat === 'body' ? s.car === id : s.equip[cat] === id;
}

export function thumbKey(cat, it) {
  const s = S();
  switch (cat) {
    case 'body':
      return `car:${it.id}`;
    case 'paint':
      return `paint:${it.id}:${s.car}`;
    case 'weapon':
      return `weapon:${it.model}`;
    default:
      return `${cat}:${it.id}`;
  }
}

export function garageScreen(app, startCat = 'body') {
  const s = S();
  let cat = startCat;
  let sel = cat === 'body' ? s.car : s.equip[cat];
  const el = h('div', { class: 'screen active garage' });
  el.append(
    h(
      'div',
      { class: 'screen-head' },
      h('button', { class: 'icon-btn', html: icon('back'), onclick: () => (sfx.click(), app.go('menu')) }),
      h('h1', {}, 'Гараж'),
    ),
  );
  el.append(currencyBar(() => currencyModal()));
  const cats = h('div', { class: 'side-cats panel' });
  el.append(cats);
  const stats = h('div', { class: 'stats-panel panel' });
  el.append(stats);
  const title = h('div', { class: 'car-title' });
  el.append(title);
  const strip = h('div', { class: 'item-strip panel' });
  const action = h('div', { class: 'garage-action' });
  el.append(h('div', { class: 'garage-bottom' }, strip, action));

  const preview = () => {
    const carId = cat === 'body' ? sel : s.car;
    const equip = { ...s.equip };
    if (cat !== 'body') equip[cat] = sel;
    app.previewCar(carId, equip);
    return { carId, equip };
  };

  const renderStats = () => {
    const { carId, equip } = preview();
    const cur = carStats(s.car, s.equip);
    const nw = carStats(carId, equip);
    const row = (name, a, b, max, fmtv = (v) => Math.round(v)) => {
      const d = b - a;
      return h(
        'div',
        { class: 'stat' },
        h('div', { class: 'lbl' }, h('span', {}, name), h('span', {}, fmtv(b), d ? h('em', { class: d < 0 ? 'neg' : '' }, ` ${d > 0 ? '+' : ''}${fmtv(d)}`) : null)),
        statBar(a, max, d),
      );
    };
    stats.innerHTML = '';
    stats.append(
      h('h4', {}, 'Характеристики'),
      row('Прочность', cur.hp, nw.hp, 360),
      row('Скорость', cur.speed * 3.6, nw.speed * 3.6, 150),
      row('Урон оружия', cur.dps, nw.dps, CAR_WEAPON_MAX.dps),
      row('Таран', cur.ram, nw.ram, 110),
      row('Багажник', cur.trunk, nw.trunk, 100),
    );
    const frac = s.carHp[s.car] ?? 1;
    if (frac < 0.999 && cat !== 'body') {
      stats.append(h('div', { class: 'stat' }, h('div', { class: 'lbl' }, h('span', {}, 'Состояние'), h('span', {}, `${Math.round(frac * 100)}%`)), statBar(frac, 1, 0, 'hp')));
      stats.append(h('button', { class: 'btn green', style: { width: '100%', fontSize: '1.05rem' }, onclick: () => repairModal(app, null) }, h('span', { html: icon('wrench') }), 'Ремонт'));
    }
    const car = findCar(carId);
    title.innerHTML = '';
    title.append(h('b', {}, car.name));
    if (cat !== 'body') {
      const it = itemsFor(cat).find((x) => x.id === sel);
      title.append(h('span', {}, it?.name || ''));
    } else if (!ownedItem('body', carId)) title.append(h('span', {}, car.unlock > s.base ? `Откроется на базе ${car.unlock}` : 'Можно купить'));
  };

  const renderAction = () => {
    action.innerHTML = '';
    const it = itemsFor(cat).find((x) => x.id === sel);
    if (!it) return;
    const owned = ownedItem(cat, sel);
    const eq = equippedItem(cat, sel);
    const locked = cat === 'body' && it.unlock > s.base && !owned;
    if (eq) action.append(h('button', { class: 'btn dark', disabled: true }, h('span', { html: icon('check') }), 'Установлено'));
    else if (owned)
      action.append(
        h('button', {
          class: 'btn green',
          onclick: () => {
            if (cat === 'body') s.car = sel;
            else s.equip[cat] = sel;
            sfx.buy();
            store.save();
            renderAll();
            app.refresh();
          },
        }, 'Установить'),
      );
    else if (locked) action.append(h('button', { class: 'btn dark', disabled: true, html: `${icon('lock')} База ${it.unlock}` }));
    else
      action.append(
        h('button', {
          class: 'btn yellow',
          html: `${icon(it.cur === 'gold' ? 'gold' : 'cash')} ${fmt(it.price)}`,
          onclick: () => {
            if (!tryBuy(it.price, it.cur)) return;
            if (cat === 'body') {
              s.cars.push(sel);
              s.carHp[sel] = 1;
              s.car = sel;
              s.stats.cars = s.cars.length;
            } else {
              s.owned[cat].push(sel);
              s.equip[cat] = sel;
            }
            store.save();
            toast(`Куплено: ${it.name}`, false, 'check');
            renderAll();
            app.refresh();
          },
        }),
      );
    action.append(h('div', { class: 'sub' }, owned ? 'Куплено' : it.cur === 'gold' ? 'За золото' : 'Цена'));
  };

  const renderStrip = () => {
    strip.innerHTML = '';
    for (const it of itemsFor(cat)) {
      const owned = ownedItem(cat, it.id);
      const eq = equippedItem(cat, it.id);
      const locked = cat === 'body' && it.unlock > s.base && !owned;
      const card = h(
        'div',
        {
          class: `item-card${it.id === sel ? ' sel' : ''}`,
          onclick: () => {
            sel = it.id;
            sfx.click();
            renderAll();
          },
        },
        thumbImg(thumbKey(cat, it)),
        h('div', { class: 'nm' }, it.name),
        owned ? h('div', { class: 'pr' }, eq ? 'Установлено' : 'Куплено') : h('div', { class: 'pr', html: `${icon(it.cur === 'gold' ? 'gold' : 'cash')}${fmt(it.price)}` }),
      );
      if (eq) card.append(h('span', { class: 'tag eq' }, '✓'));
      else if (locked) card.append(h('span', { class: 'tag lock', html: icon('lock') }));
      strip.append(card);
      if (it.id === sel) requestAnimationFrame(() => card.scrollIntoView({ block: 'nearest', inline: 'center' }));
    }
  };

  const renderCats = () => {
    cats.innerHTML = '';
    for (const c of CATS) {
      cats.append(
        h('button', {
          class: `cat-btn${c.id === cat ? ' active' : ''}`,
          html: `${icon(c.icon)}<span>${c.name}</span>`,
          onclick: () => {
            cat = c.id;
            sel = cat === 'body' ? s.car : s.equip[cat];
            sfx.click();
            renderAll();
          },
        }),
      );
    }
  };

  const renderAll = () => {
    renderCats();
    renderStrip();
    renderStats();
    renderAction();
  };
  renderAll();
  el.onLeave = () => app.previewCar(s.car, s.equip);
  return el;
}

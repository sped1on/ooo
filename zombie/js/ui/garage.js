// Гараж: выбор машины и деталей, предпросмотр на поворотном круге, покупка и установка,
// рисование баллончиком по кузову.

import { h, currencyBar, statBar, toast, confirmModal } from './dom.js';
import { icon } from './icons.js';
import { thumbImg } from './thumbs.js';
import { S, store, carStats } from '../state/save.js';
import { CARS, PARTS, ITEMS, SPRAY_COLORS, findCar, CAR_WEAPON_MAX } from '../data/catalog.js';
import { tryBuy, currencyModal } from './common.js';
import { repairModal } from './menu.js';
import { sfx } from '../engine/audio.js';
import { fmt } from '../engine/util.js';
import { sprayDab, sprayLayer, saveSpray, clearSpray } from '../state/spray.js';

const CATS = [
  { id: 'body', name: 'Авто', icon: 'car' },
  { id: 'weapon', name: 'Оружие', icon: 'weapon' },
  { id: 'armor', name: 'Броня', icon: 'shield' },
  { id: 'bumper', name: 'Бампер', icon: 'bumper' },
  { id: 'grille', name: 'Решётка', icon: 'grille' },
  { id: 'wheels', name: 'Диски', icon: 'wheel' },
  { id: 'paint', name: 'Окраска', icon: 'roller' },
  { id: 'spray', name: 'Баллончик', icon: 'paint' },
  { id: 'salon', name: 'Салон', icon: 'steer' },
];

// Салон: руль, подвеска на зеркало и фигурка на панель в одном списке (id вида «слот:предмет»)
const SALON = ['steer', 'hang', 'dash'].flatMap((slot) => PARTS[slot].map((it) => ({ ...it, id: `${slot}:${it.id}`, pid: it.id, slot })));

const SIZES = [
  { id: 's', name: 'S', px: 6 },
  { id: 'm', name: 'M', px: 11 },
  { id: 'l', name: 'L', px: 19 },
];
const SPRAY_ITEM = ITEMS.find((x) => x.id === 'spray');

export function itemsFor(cat) {
  if (cat === 'body') return CARS;
  if (cat === 'salon') return SALON;
  return PARTS[cat] || [];
}

function slotOf(cat, id) {
  if (cat === 'salon') {
    const [slot, pid] = String(id).split(':');
    return [slot, pid];
  }
  return [cat, id];
}

export function ownedItem(cat, id) {
  const s = S();
  if (cat === 'body') return s.cars.includes(id);
  const [slot, pid] = slotOf(cat, id);
  return !!s.owned[slot]?.includes(pid);
}

export function equippedItem(cat, id) {
  const s = S();
  if (cat === 'body') return s.car === id;
  const [slot, pid] = slotOf(cat, id);
  return s.equip[slot] === pid;
}

export function equipItem(cat, id) {
  const s = S();
  if (cat === 'body') s.car = id;
  else {
    const [slot, pid] = slotOf(cat, id);
    s.equip[slot] = pid;
  }
}

export function buyItem(cat, id) {
  const s = S();
  if (cat === 'body') {
    s.cars.push(id);
    s.carHp[id] = 1;
    s.car = id;
    s.stats.cars = s.cars.length;
    return;
  }
  const [slot, pid] = slotOf(cat, id);
  if (!s.owned[slot].includes(pid)) s.owned[slot].push(pid);
  s.equip[slot] = pid;
}

function currentSel(cat) {
  const s = S();
  if (cat === 'body') return s.car;
  if (cat === 'salon') return `steer:${s.equip.steer}`;
  return s.equip[cat];
}

export function thumbKey(cat, it) {
  const s = S();
  switch (cat) {
    case 'body':
      return `car:${it.id}`;
    case 'paint':
      return `paint:${it.id}:${s.car}`;
    case 'armor':
      return `armor:${it.id}:${s.car}`;
    case 'weapon':
      return `weapon:${it.model}`;
    case 'salon':
      return `${it.slot}:${it.pid}`;
    default:
      return `${cat}:${it.id}`;
  }
}

export function garageScreen(app, startCat = 'body') {
  const s = S();
  let cat = CATS.some((c) => c.id === startCat) ? startCat : 'body';
  let sel = currentSel(cat);
  let sprayColor = SPRAY_COLORS[2];
  let spraySize = SIZES[1];
  let emptyWarned = false;
  const el = h('div', { class: 'screen active garage' });
  const hint = h('span', { class: 'orbit-hint', html: `${icon('left')} Вращай машину ${icon('right')}` });
  el.append(h('div', { class: 'orbit-zone', title: 'Потяни, чтобы повернуть машину' }, hint));
  el.append(
    h(
      'div',
      { class: 'screen-head' },
      h('button', { class: 'icon-btn', html: icon('back'), onclick: () => (sfx.click(), app.go('menu')) }),
      h('h1', {}, 'Гараж'),
    ),
  );
  el.append(currencyBar(() => currencyModal()));
  const cats = h('div', { class: 'side-cats panel garage-cats' });
  el.append(cats);
  const stats = h('div', { class: 'stats-panel panel' });
  el.append(stats);
  const title = h('div', { class: 'car-title' });
  el.append(title);
  // кнопки поворота в режиме баллончика (одним пальцем там рисуют)
  const rot = (dir) => {
    const g = app.garage;
    g.lastTouch = g.t;
    g.rotV += dir * 2.6;
    sfx.click();
  };
  const rotBtns = h(
    'div',
    { class: 'spray-rot' },
    h('button', { class: 'icon-btn', html: icon('left'), onclick: () => rot(-1) }),
    h('button', { class: 'icon-btn', html: icon('right'), onclick: () => rot(1) }),
  );
  el.append(rotBtns);
  const strip = h('div', { class: 'item-strip panel' });
  const action = h('div', { class: 'garage-action' });
  el.append(h('div', { class: 'garage-bottom' }, strip, action));

  const preview = () => {
    const carId = cat === 'body' ? sel : s.car;
    const equip = { ...s.equip };
    if (cat !== 'body' && cat !== 'spray') {
      const [slot, pid] = slotOf(cat, sel);
      equip[slot] = pid;
    }
    app.previewCar(carId, equip);
    return { carId, equip };
  };

  // ---------- баллончик ----------
  const paintLeft = () => Math.max(0, Math.ceil(s.inv.spray || 0));
  const setPaintMode = (on) => {
    app.garage.paintMode = on;
    el.classList.toggle('spraying', on);
    if (on) {
      app.sprayHandler = (nx, ny, first) => {
        const uv = app.garage.paintHit(nx, ny);
        if (!uv) return;
        if ((s.inv.spray || 0) <= 0) {
          if (!emptyWarned) {
            emptyWarned = true;
            toast('Краска закончилась — купи баллончик', true);
          }
          return;
        }
        const car = app.garage.car;
        sprayDab(s.car, uv.x, uv.y, sprayColor, spraySize.px);
        const tex = sprayLayer(s.car).tex;
        if (car?.sprayU) car.sprayU.value = tex;
        s.inv.spray = Math.max(0, (s.inv.spray || 0) - 0.06 * (spraySize.px / 11));
        if (first) sfx.spray();
        else if (Math.random() < 0.12) sfx.spray();
      };
      app.sprayEnd = () => {
        emptyWarned = false;
        saveSpray(s.car);
        const m = app.menu?.car;
        if (m?.def.id === s.car && m.sprayU) m.sprayU.value = sprayLayer(s.car).tex;
        store.save();
        renderSprayInfo();
      };
    } else {
      app.sprayHandler = null;
      app.sprayEnd = null;
    }
  };

  let amountEl = null;
  const renderSprayInfo = () => {
    if (!amountEl) return;
    amountEl.innerHTML = '';
    amountEl.append(h('div', { class: 'lbl' }, h('span', {}, 'Краска'), h('span', {}, `${paintLeft()}%`)), statBar(paintLeft(), 100, 0, 'fuel'));
  };

  const renderSprayPanel = () => {
    stats.innerHTML = '';
    amountEl = h('div', { class: 'stat' });
    renderSprayInfo();
    const sizes = h('div', { class: 'size-row' });
    for (const sz of SIZES) {
      sizes.append(
        h('button', {
          class: `size-btn${sz === spraySize ? ' active' : ''}`,
          onclick: () => {
            spraySize = sz;
            sfx.click();
            renderSprayPanel();
          },
        }, h('i', { style: { width: `${0.5 + sz.px / 28}rem`, height: `${0.5 + sz.px / 28}rem`, background: sprayColor } }), sz.name),
      );
    }
    stats.append(
      h('h4', {}, 'Баллончик'),
      amountEl,
      h('div', { class: 'spray-lbl' }, 'Размер пятна'),
      sizes,
      h('button', {
        class: 'btn dark',
        style: { width: '100%', fontSize: '1rem', marginTop: '0.5rem' },
        onclick: async () => {
          if (!(await confirmModal('Стереть рисунок?', 'Весь рисунок с этой машины будет удалён. Краска не вернётся.', 'Стереть'))) return;
          clearSpray(s.car);
          toast('Рисунок стёрт', false, 'check');
        },
      }, 'Стереть рисунок'),
      h('p', { class: 'spray-help' }, window.matchMedia?.('(pointer: coarse)').matches ? 'Води пальцем по машине. Повернуть — двумя пальцами или стрелками.' : 'Левая кнопка — рисовать, правая — вращать. Колесо — приближение.'),
    );
  };

  const renderSprayStrip = () => {
    strip.innerHTML = '';
    for (const c of SPRAY_COLORS) {
      strip.append(
        h('div', {
          class: `item-card swatch${c === sprayColor ? ' sel' : ''}`,
          onclick: () => {
            sprayColor = c;
            sfx.click();
            renderSprayStrip();
            renderSprayPanel();
          },
        }, h('span', { class: 'sw', style: { background: c } })),
      );
    }
  };

  const renderSprayAction = () => {
    action.innerHTML = '';
    action.append(
      h('button', {
        class: 'btn yellow',
        html: `${icon('cash')} ${fmt(SPRAY_ITEM.price)}`,
        onclick: () => {
          if (!tryBuy(SPRAY_ITEM.price, SPRAY_ITEM.cur)) return;
          s.inv.spray = Math.min(999, (s.inv.spray || 0) + SPRAY_ITEM.give.spray);
          store.save();
          toast('Баллончик куплен', false, 'check');
          renderSprayInfo();
        },
      }),
      h('div', { class: 'sub' }, 'Баллончик +100%'),
    );
  };

  // ---------- детали ----------
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
      row('Прочность', cur.hp, nw.hp, 440),
      row('Скорость', cur.speed * 3.6, nw.speed * 3.6, 150),
      row('Урон оружия', cur.dps, nw.dps, CAR_WEAPON_MAX.dps),
      row('Таран', cur.ram, nw.ram, 130),
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
            equipItem(cat, sel);
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
            buyItem(cat, sel);
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
    let lastSlot = null;
    for (const it of itemsFor(cat)) {
      if (cat === 'salon' && it.slot !== lastSlot) {
        lastSlot = it.slot;
        strip.append(h('div', { class: 'strip-sep' }, { steer: 'Руль', hang: 'На зеркало', dash: 'На панель' }[it.slot]));
      }
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
            if (cat === c.id) return;
            cat = c.id;
            sel = currentSel(cat);
            sfx.click();
            renderAll();
          },
        }),
      );
    }
  };

  const renderAll = () => {
    renderCats();
    const spray = cat === 'spray';
    setPaintMode(spray);
    app.garage.setCabin(cat === 'salon');
    hint.innerHTML = spray ? `${icon('paint')} Рисуй прямо по машине` : cat === 'salon' ? `${icon('left')} Осмотри салон ${icon('right')}` : `${icon('left')} Вращай машину ${icon('right')}`;
    if (spray) {
      preview();
      title.innerHTML = '';
      title.append(h('b', {}, findCar(s.car).name), h('span', {}, 'Рисунок баллончиком'));
      renderSprayStrip();
      renderSprayPanel();
      renderSprayAction();
      return;
    }
    renderStrip();
    renderStats();
    renderAction();
  };
  renderAll();
  el.onLeave = () => {
    if (app.garage.paintMode) saveSpray(s.car);
    setPaintMode(false);
    app.garage.setCabin(false);
    app.previewCar(s.car, s.equip);
  };
  return el;
}

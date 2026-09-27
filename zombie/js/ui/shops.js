// Магазины: «Магазин» (машины и детали) и «Снаряжение» (ручное оружие, броня, аптечки, разное).

import { h, currencyBar, statBar, toast, rewardAd } from './dom.js';
import { icon } from './icons.js';
import { thumbImg } from './thumbs.js';
import { S, store, give, gunStats, canAfford } from '../state/save.js';
import { CARS, PARTS, ITEMS, GUNS, GUN_CATS, GUN_UPGRADES, GUN_MAX, ARMOR, MEDKITS, RARITY, CAR_MAX, CAR_WEAPON_MAX } from '../data/catalog.js';
import { tryBuy, currencyModal } from './common.js';
import { itemsFor, ownedItem, equippedItem, thumbKey } from './garage.js';
import { sfx } from '../engine/audio.js';
import { fmt } from '../engine/util.js';

const CAR_CATS = [
  { id: 'body', name: 'Авто', icon: 'car', note: 'Новые автомобили открываются на следующих базах.' },
  { id: 'weapon', name: 'Оружие', icon: 'weapon', note: 'Оружие устанавливается на машину и не может быть использовано вручную.' },
  { id: 'bumper', name: 'Бампера', icon: 'bumper', note: 'Бампер усиливает таран и защищает машину.' },
  { id: 'grille', name: 'Решётки', icon: 'grille', note: 'Решётка защищает стёкла и радиатор.' },
  { id: 'paint', name: 'Краска', icon: 'paint', note: 'Краска меняет цвет текущей машины.' },
  { id: 'wheels', name: 'Диски', icon: 'wheel', note: 'Диски добавляют скорость и управляемость.' },
  { id: 'items', name: 'Предметы', icon: 'box', note: 'Предметы можно использовать в поездке.' },
];

function itemThumbKey(it) {
  const map = { repair: 'pickup:repair', fuel: 'pickup:fuel', ammo: 'pickup:ammo', metal10: 'pickup:metal', wood10: 'pickup:wood', cloth10: 'pickup:cloth', crate: 'crate:0' };
  return map[it.id] || 'crate:0';
}

function miniStats(rows) {
  const g = h('div', { class: 'mini-stats' });
  for (const [name, v, max] of rows) g.append(h('span', {}, name), statBar(v, max));
  return g;
}

function sideAd(text, amount, rewardFn) {
  return h(
    'div',
    { class: 'ad-box panel' },
    h('span', { html: icon('video', 'vid') }),
    h('div', { class: 'txt', html: `${text}<br>${icon('cash')} +${amount}` }),
    h('button', {
      class: 'btn yellow',
      onclick: async () => {
        if (await rewardAd()) {
          rewardFn();
          store.save();
          toast(`+${amount}`, false, 'cash');
        }
      },
    }, 'Смотреть'),
  );
}

function buyCurrencyBox() {
  return h(
    'button',
    { class: 'ad-box panel', onclick: () => currencyModal() },
    h('span', { html: icon('gold', 'vid') }),
    h('div', { class: 'txt' }, 'Купить валюту'),
    h('span', { class: 'btn green', html: icon('plus') }),
  );
}

// ------------------------------ магазин машин и деталей ------------------------------

export function carShopScreen(app, startCat = 'body') {
  const s = S();
  let cat = startCat;
  const el = h('div', { class: 'screen active shop' });
  el.append(
    h('div', { class: 'screen-head' }, h('button', { class: 'icon-btn', html: icon('back'), onclick: () => (sfx.click(), app.go('menu')) }), h('h1', {}, 'Магазин')),
    currencyBar(() => currencyModal()),
  );
  const cats = h('div', { class: 'side-cats panel' });
  const grid = h('div', { class: 'shop-grid' });
  const side = h('div', { class: 'shop-side' }, sideAd('Смотри рекламу', 200, () => give({ cash: 200 })), buyCurrencyBox());
  const note = h('div', { class: 'info-note panel' });
  el.append(cats, h('div', { class: 'shop-wrap' }, grid, side), note);

  const card = (it) => {
    const isItem = cat === 'items';
    const owned = !isItem && ownedItem(cat, it.id);
    const eq = !isItem && equippedItem(cat, it.id);
    const locked = cat === 'body' && it.unlock > s.base && !owned;
    const c = h('div', { class: 'shop-card' }, h('h5', {}, it.name), thumbImg(isItem ? itemThumbKey(it) : thumbKey(cat, it)));
    if (cat === 'body') c.append(miniStats([['Скорость', it.speed, CAR_MAX.speed], ['Прочность', it.hp, CAR_MAX.hp], ['Багажник', it.trunk, CAR_MAX.trunk]]));
    else if (cat === 'weapon') c.append(miniStats([['Урон', it.dmg * it.rate, CAR_WEAPON_MAX.dps], ['Скорострельность', it.rate, CAR_WEAPON_MAX.rate], ['Дальность', it.range, CAR_WEAPON_MAX.range]]));
    else if (cat === 'bumper') c.append(miniStats([['Прочность', it.hp, 60], ['Таран', it.ram, 50]]));
    else if (cat === 'grille') c.append(miniStats([['Прочность', it.hp, 70]]));
    else if (cat === 'wheels') c.append(miniStats([['Скорость', it.speed, 3], ['Управление', it.handling, 0.3]]));
    else if (isItem) c.append(h('div', { class: 'mini-stats' }, h('span', { style: { gridColumn: '1 / -1' } }, it.desc), h('span', { style: { gridColumn: '1 / -1' } }, `У тебя: ${countItem(it)}`)));
    else c.append(h('div', { class: 'mini-stats' }, h('span', { style: { gridColumn: '1 / -1' } }, 'Внешний вид машины')));
    if (owned) {
      c.append(h('div', { class: 'price' }, eq ? 'Установлено' : 'Куплено'));
      c.append(
        h('button', {
          class: `btn ${eq ? 'dark' : 'green'}`,
          disabled: eq,
          onclick: () => {
            if (cat === 'body') s.car = it.id;
            else s.equip[cat] = it.id;
            sfx.buy();
            store.save();
            app.refresh();
            render();
          },
        }, eq ? 'Выбрано' : 'Установить'),
      );
    } else {
      c.append(h('div', { class: 'price', html: `${icon(it.cur === 'gold' ? 'gold' : 'cash')}<span>${fmt(it.price)}</span>` }));
      c.append(
        h('button', {
          class: 'btn green',
          disabled: locked,
          onclick: () => {
            if (!tryBuy(it.price, it.cur)) return;
            if (isItem) {
              if (it.give.crate) openCrate();
              else give({ res: it.give });
            } else if (cat === 'body') {
              s.cars.push(it.id);
              s.carHp[it.id] = 1;
              s.car = it.id;
              s.stats.cars = s.cars.length;
            } else {
              s.owned[cat].push(it.id);
              s.equip[cat] = it.id;
            }
            store.save();
            toast(`Куплено: ${it.name}`, false, 'check');
            app.refresh();
            render();
          },
        }, 'Купить'),
      );
    }
    if (locked) c.append(h('div', { class: 'lock-over', html: `${icon('lock')}<span>Откроется на базе ${it.unlock}</span>` }));
    if (eq) c.classList.add('sel');
    return c;
  };

  const render = () => {
    cats.innerHTML = '';
    for (const c of CAR_CATS) {
      cats.append(
        h('button', {
          class: `cat-btn${c.id === cat ? ' active' : ''}`,
          html: `${icon(c.icon)}<span>${c.name}</span>`,
          onclick: () => {
            cat = c.id;
            sfx.click();
            render();
          },
        }),
      );
    }
    grid.innerHTML = '';
    const list = cat === 'items' ? ITEMS : itemsFor(cat);
    for (const it of list) grid.append(card(it));
    note.innerHTML = `${icon('info')}<span>${CAR_CATS.find((c) => c.id === cat).note}</span>`;
    grid.scrollTop = 0;
  };
  render();
  return el;
}

function countItem(it) {
  const k = Object.keys(it.give)[0];
  return S().inv[k] || 0;
}

export function openCrate() {
  const s = S();
  const r = Math.random();
  const res = { wood: 5 + Math.floor(Math.random() * 10), metal: 5 + Math.floor(Math.random() * 10), cloth: 3 + Math.floor(Math.random() * 6) };
  if (r < 0.3) res.repair = 1;
  else if (r < 0.5) res.med2 = 1;
  give({ res, cash: 300 + Math.floor(Math.random() * 700) });
  s.stats.crates = (s.stats.crates || 0) + 0;
  toast('Ящик открыт: ресурсы и деньги!', false, 'chest');
}

// ------------------------------ снаряжение ------------------------------

const GEAR_TABS = [
  { id: 'guns', name: 'Оружие', icon: 'pistol' },
  { id: 'armor', name: 'Броня', icon: 'shield' },
  { id: 'meds', name: 'Аптечки', icon: 'medkit' },
  { id: 'misc', name: 'Разное', icon: 'box' },
];

export function gearScreen(app) {
  const s = S();
  let tab = 'guns';
  let sub = 'all';
  let sel = s.gun;
  let onlyAffordable = false;
  const el = h('div', { class: 'screen active gear with-tabs' });
  el.append(
    h(
      'div',
      { class: 'screen-head' },
      h('button', { class: 'icon-btn', html: icon('back'), onclick: () => (sfx.click(), app.go('menu')) }),
      h('div', {}, h('h1', {}, 'Снаряжение'), h('p', {}, 'Оружие для вылазок, броня и аптечки')),
    ),
    currencyBar(() => currencyModal()),
  );
  const tabs = h('div', { class: 'top-tabs' });
  const cats = h('div', { class: 'side-cats panel' });
  const grid = h('div', { class: 'shop-grid' });
  const detail = h('div', { class: 'detail panel' });
  const side = h('div', { class: 'shop-side' }, detail, sideAd('Смотри рекламу', 300, () => give({ cash: 300 })));
  const note = h('div', { class: 'info-note panel' });
  const filter = h('button', {
    class: 'btn dark gear-filter',
    onclick: () => {
      onlyAffordable = !onlyAffordable;
      render();
    },
  });
  el.append(tabs, cats, h('div', { class: 'shop-wrap' }, grid, side), note);

  const gunCard = (g) => {
    const owned = s.guns.includes(g.id);
    const c = h(
      'div',
      { class: `shop-card r-${g.rarity}${sel === g.id ? ' sel' : ''}`, onclick: () => ((sel = g.id), sfx.click(), render()) },
      h('span', { class: 'rarity', style: { background: RARITY[g.rarity].color } }, RARITY[g.rarity].name),
      h('h5', {}, g.name),
      thumbImg(`gun:${g.model}`),
      h('div', { class: 'price', html: owned ? (s.gun === g.id ? `${icon('check')}<span>Выбрано</span>` : '<span>Куплено</span>') : `${icon('cash')}<span>${fmt(g.price)}</span> ${icon('cart')}` }),
    );
    return c;
  };

  const armorCard = (a) => {
    const owned = s.armor.includes(a.id);
    const on = s[a.slot] === a.id;
    return h(
      'div',
      { class: `shop-card${sel === a.id ? ' sel' : ''}`, onclick: () => ((sel = a.id), sfx.click(), render()) },
      h('h5', {}, a.name),
      thumbImg(`${a.slot}:${a.id}`),
      h('div', { class: 'mini-stats', html: `<span style="grid-column:1/-1">${icon('shield')} Защита +${a.def}</span>` }),
      h('div', { class: 'price', html: owned ? `<span>${on ? 'Надето' : 'Куплено'}</span>` : `${icon('cash')}<span>${fmt(a.price)}</span>` }),
      owned
        ? h('button', {
            class: `btn ${on ? 'dark' : 'green'}`,
            onclick: (e) => {
              e.stopPropagation();
              s[a.slot] = on ? null : a.id;
              sfx.buy();
              store.save();
              render();
            },
          }, on ? 'Снять' : 'Надеть')
        : h('button', {
            class: 'btn green',
            onclick: (e) => {
              e.stopPropagation();
              if (!tryBuy(a.price)) return;
              s.armor.push(a.id);
              s[a.slot] = a.id;
              store.save();
              toast(`Куплено: ${a.name}`, false, 'check');
              render();
            },
          }, 'Купить'),
    );
  };

  const consumableCard = (it, key, thumbK, desc) =>
    h(
      'div',
      { class: 'shop-card' },
      h('h5', {}, it.name),
      thumbImg(thumbK),
      h('div', { class: 'mini-stats' }, h('span', { style: { gridColumn: '1 / -1' } }, desc), h('span', { style: { gridColumn: '1 / -1' } }, `У тебя: ${s.inv[key] || 0}`)),
      h('div', { class: 'price', html: `${icon(it.cur === 'gold' ? 'gold' : 'cash')}<span>${fmt(it.price)}</span>` }),
      h('button', {
        class: 'btn green',
        onclick: () => {
          if (!tryBuy(it.price, it.cur)) return;
          if (it.give?.crate) openCrate();
          else give({ res: it.give || { [key]: 1 } });
          store.save();
          toast(`Куплено: ${it.name}`, false, 'check');
          render();
        },
      }, 'Купить'),
    );

  const renderGunDetail = () => {
    const g = GUNS.find((x) => x.id === sel) || GUNS[0];
    const owned = s.guns.includes(g.id);
    const st = gunStats(g.id);
    detail.innerHTML = '';
    detail.append(
      h('span', { class: 'rarity', style: { background: RARITY[g.rarity].color, alignSelf: 'flex-start', padding: '0.05rem 0.5rem', borderRadius: '0.2rem', fontSize: '0.85rem' } }, RARITY[g.rarity].name),
      h('h3', {}, g.name),
      h('p', {}, g.desc),
      thumbImg(`gun:${g.model}`),
    );
    const rows = [
      ['Урон', st.dmg * (g.pellets || 1), GUN_MAX.dmg],
      ['Скорострельность', st.rpm, GUN_MAX.rpm],
      ['Дальность', g.range, GUN_MAX.range],
      ['Точность', g.acc, GUN_MAX.acc],
      ['Ёмкость магазина', st.mag || '—', GUN_MAX.mag],
    ];
    for (const [n, v, m] of rows) detail.append(h('div', { class: 'srow' }, h('span', {}, n), statBar(typeof v === 'number' ? v : 0, m), h('b', {}, String(v))));
    if (owned) {
      detail.append(h('h4', { style: { margin: '0.3rem 0 0' } }, 'Улучшения'));
      const up = (s.gunUp[g.id] ||= { dmg: 0, rate: 0, mag: 0 });
      for (const u of GUN_UPGRADES) {
        if (u.id === 'mag' && !g.mag) continue;
        const lv = up[u.id];
        const price = u.price * (lv + 1);
        detail.append(
          h(
            'div',
            { class: 'up-row' },
            h('span', {}, u.name, h('div', { class: 'lv' }, `Уровень ${lv}/3`)),
            lv >= 3
              ? h('b', { style: { color: 'var(--green)' } }, 'Макс.')
              : h('button', {
                  class: 'btn green',
                  html: `${icon('cash')}${fmt(price)} ${icon('plus')}`,
                  onclick: () => {
                    if (!tryBuy(price)) return;
                    up[u.id]++;
                    store.save();
                    render();
                  },
                }),
          ),
        );
      }
      detail.append(
        s.gun === g.id
          ? h('button', { class: 'btn dark big', disabled: true }, 'Выбрано')
          : h('button', {
              class: 'btn green big',
              onclick: () => {
                s.gun = g.id;
                sfx.buy();
                store.save();
                render();
              },
            }, 'Взять с собой'),
      );
    } else {
      detail.append(
        h('button', {
          class: 'btn green big',
          html: `${icon('cash')} ${fmt(g.price)}<br>Купить`,
          style: { flexDirection: 'column', gap: '0', lineHeight: '1.1' },
          onclick: () => {
            if (!tryBuy(g.price)) return;
            s.guns.push(g.id);
            s.gun = g.id;
            store.save();
            toast(`Куплено: ${g.name}`, false, 'check');
            render();
          },
        }),
      );
    }
  };

  const renderArmorDetail = () => {
    const a = ARMOR.find((x) => x.id === sel) || ARMOR[0];
    detail.innerHTML = '';
    detail.append(h('h3', {}, a.name), thumbImg(`${a.slot}:${a.id}`), h('div', { class: 'srow', html: `<span>${icon('shield')} Защита</span><span></span><b>+${a.def}</b>` }), h('p', {}, a.desc));
    const vest = ARMOR.find((x) => x.id === s.vest);
    const helm = ARMOR.find((x) => x.id === s.helmet);
    detail.append(h('p', {}, `Надето: ${vest ? vest.name : 'нет жилета'}, ${helm ? helm.name : 'нет шлема'}`));
    detail.append(h('p', {}, `Общая защита: ${(vest?.def || 0) + (helm?.def || 0)} (урон −${Math.round(Math.min(0.7, ((vest?.def || 0) + (helm?.def || 0)) / 140) * 100)}%)`));
  };

  const render = () => {
    tabs.innerHTML = '';
    for (const t of GEAR_TABS) {
      tabs.append(
        h('button', {
          class: `cat-btn${t.id === tab ? ' active' : ''}`,
          html: `${icon(t.icon)}<span>${t.name}</span>`,
          onclick: () => {
            tab = t.id;
            sub = 'all';
            sel = tab === 'guns' ? s.gun : tab === 'armor' ? s.vest || ARMOR[0].id : null;
            sfx.click();
            render();
          },
        }),
      );
    }
    cats.innerHTML = '';
    const subList = tab === 'guns' ? GUN_CATS : tab === 'armor' ? [{ id: 'all', name: 'Все', icon: 'grid' }, { id: 'vest', name: 'Жилеты', icon: 'vest' }, { id: 'helmet', name: 'Шлемы', icon: 'shield' }] : [{ id: 'all', name: 'Все', icon: 'grid' }];
    for (const c of subList) {
      cats.append(
        h('button', {
          class: `cat-btn${c.id === sub ? ' active' : ''}`,
          html: `${icon(c.icon)}<span>${c.name}</span>`,
          onclick: () => {
            sub = c.id;
            sfx.click();
            render();
          },
        }),
      );
    }
    grid.innerHTML = '';
    detail.parentElement.style.display = tab === 'guns' || tab === 'armor' ? '' : 'none';
    if (tab === 'guns') {
      let list = GUNS.filter((g) => sub === 'all' || g.cat === sub);
      if (onlyAffordable) list = list.filter((g) => s.guns.includes(g.id) || canAfford(g.price));
      for (const g of list) grid.append(gunCard(g));
      renderGunDetail();
      note.innerHTML = `${icon('info')}<span>Ручное оружие нужно на заправке и в вылазках. Его можно улучшать.</span>`;
    } else if (tab === 'armor') {
      for (const a of ARMOR.filter((x) => sub === 'all' || x.slot === sub)) grid.append(armorCard(a));
      renderArmorDetail();
      note.innerHTML = `${icon('shield')}<span>Броня снижает урон от зомби и взрывов.</span>`;
    } else if (tab === 'meds') {
      for (const m of MEDKITS) grid.append(consumableCard(m, m.id, `med:${m.id}`, m.desc));
      note.innerHTML = `${icon('medkit')}<span>Аптечки лечат тебя, когда ты выходишь из машины.</span>`;
    } else {
      for (const it of ITEMS) grid.append(consumableCard(it, Object.keys(it.give)[0], itemThumbKey(it), it.desc));
      note.innerHTML = `${icon('info')}<span>Ремкомплекты и канистры используются в пути.</span>`;
    }
    filter.style.display = tab === 'guns' ? '' : 'none';
    filter.innerHTML = `${icon(onlyAffordable ? 'check' : 'grid')} Только доступное`;
  };
  el.append(filter);
  render();
  return el;
}

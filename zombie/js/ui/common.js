// Общие действия: покупки, окно валюты, награды, задания.

import { h, modal, toast, rewardAd, priceHtml } from './dom.js';
import { icon } from './icons.js';
import { S, store, spend, canAfford, give } from '../state/save.js';
import { EXCHANGE, PURCHASES, TASKS, DAILY, findCar, findGun, RESOURCES } from '../data/catalog.js';
import { hasPayments, purchase as ydPurchase, catalogPrices } from '../platform/yandex.js';
import { sfx } from '../engine/audio.js';
import { fmt, todayKey } from '../engine/util.js';

// Покупка: списываем валюту или предлагаем пополнить
export function tryBuy(price, cur = 'cash') {
  if (!canAfford(price, cur)) {
    toast(cur === 'gold' ? 'Не хватает золота' : 'Не хватает денег', true);
    currencyModal(cur);
    return false;
  }
  spend(price, cur);
  S().stats.purchases++;
  sfx.buy();
  store.save();
  return true;
}

export function currencyModal(focus = 'cash') {
  const rows = [];
  rows.push(h('h2', {}, 'Купить валюту'));
  rows.push(h('p', {}, 'Меняй золото на деньги или смотри рекламу'));
  const adRow = h(
    'div',
    { class: 'ex-row' },
    h('span', { html: `${icon('video')} Реклама → ${icon('cash')} +200` }),
    h('button', {
      class: 'btn yellow',
      onclick: async () => {
        if (await rewardAd()) {
          give({ cash: 200 });
          store.save();
          toast('+200', false, 'cash');
        }
      },
    }, 'Смотреть'),
  );
  rows.push(adRow);
  for (const ex of EXCHANGE) {
    rows.push(
      h(
        'div',
        { class: 'ex-row' },
        h('span', { html: `${icon('gold')} ${ex.gold} → ${icon('cash')} ${fmt(ex.cash)}` }),
        h('button', {
          class: 'btn green',
          onclick: () => {
            if (!canAfford(ex.gold, 'gold')) {
              toast('Не хватает золота', true);
              return;
            }
            spend(ex.gold, 'gold');
            give({ cash: ex.cash });
            sfx.coin();
            store.save();
          },
        }, 'Обменять'),
      ),
    );
  }
  if (hasPayments()) {
    rows.push(h('h4', { style: { margin: '0.4rem 0 0' } }, 'Золото'));
    const priceEls = {};
    for (const p of PURCHASES) {
      const pr = h('b', {}, '…');
      priceEls[p.id] = pr;
      rows.push(
        h(
          'div',
          { class: 'ex-row' },
          h('span', { html: `${icon('gold')} ${p.label}` }),
          pr,
          h('button', {
            class: 'btn yellow',
            onclick: async () => {
              if (await ydPurchase(p.id)) {
                give({ gold: p.gold });
                store.save();
                toast(`+${p.gold} золота`, false, 'gold');
              }
            },
          }, 'Купить'),
        ),
      );
    }
    catalogPrices().then((prices) => {
      for (const id in priceEls) priceEls[id].textContent = prices[id] || '';
    });
  }
  const m = modal([...rows, h('button', { class: 'btn dark', onclick: () => m.close() }, 'Закрыть')]);
  void focus;
}

// ------------------------------ задания ------------------------------

export function taskState(t) {
  const s = S();
  const v = s.stats[t.stat] || 0;
  return { value: Math.min(v, t.goal), done: v >= t.goal, claimed: !!s.tasks[t.id] };
}

export function claimableTasks() {
  return TASKS.filter((t) => {
    const st = taskState(t);
    return st.done && !st.claimed;
  }).length;
}

export function claimTask(t) {
  const st = taskState(t);
  if (!st.done || st.claimed) return;
  S().tasks[t.id] = true;
  give(t.reward);
  sfx.coin();
  store.save();
}

// ------------------------------ ежедневные награды ------------------------------

export function dailyAvailable() {
  return S().daily.last !== todayKey();
}

export function dailyIndex() {
  return S().daily.n % 7;
}

export function giveDaily(i) {
  const s = S();
  let r = DAILY[i];
  if (r.kind === 'car' && s.cars.includes(r.id)) r = r.fallback;
  if (r.kind === 'gun' && s.guns.includes(r.id)) r = r.fallback;
  let text = '';
  if (r.kind === 'cash') {
    give({ cash: r.amount });
    text = `+${fmt(r.amount)} денег`;
  } else if (r.kind === 'gold') {
    give({ gold: r.amount });
    text = `+${r.amount} золота`;
  } else if (r.kind === 'res') {
    give({ res: r.res });
    text = 'Ресурсы получены';
  } else if (r.kind === 'car') {
    s.cars.push(r.id);
    s.carHp[r.id] = 1;
    s.stats.cars = s.cars.length;
    text = `Новая машина: ${findCar(r.id).name}`;
  } else if (r.kind === 'gun') {
    s.guns.push(r.id);
    text = `Новое оружие: ${findGun(r.id).name}`;
  }
  s.daily.n++;
  s.daily.last = todayKey();
  store.save();
  sfx.win();
  return text;
}

export function resName(k) {
  return RESOURCES[k]?.name || k;
}

export { priceHtml };

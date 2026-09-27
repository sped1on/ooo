// DOM-помощники: элементы, валюта, всплывающие сообщения, модальные окна, реклама.

import { icon } from './icons.js';
import { S, store } from '../state/save.js';
import { fmt } from '../engine/util.js';
import { showRewardedAd, isYandex } from '../platform/yandex.js';
import { sfx, setPaused } from '../engine/audio.js';

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const ui = () => document.getElementById('ui');

export function priceHtml(price, cur = 'cash') {
  return `${icon(cur === 'gold' ? 'gold' : 'cash')}<span>${fmt(price)}</span>`;
}

// Плашка с деньгами и золотом
const curEls = new Set();
export function currencyBar(onPlus) {
  const cash = h('b', {}, fmt(S().cash));
  const gold = h('b', {}, fmt(S().gold));
  const el = h(
    'div',
    { class: 'currency' },
    h('div', { class: 'cur cash-cur', html: icon('cash') }, cash, h('button', { class: 'plus', html: icon('plus'), onclick: () => onPlus?.('cash') })),
    h('div', { class: 'cur gold-cur', html: icon('gold') }, gold, h('button', { class: 'plus', html: icon('plus'), onclick: () => onPlus?.('gold') })),
  );
  el._cash = cash;
  el._gold = gold;
  curEls.add(el);
  return el;
}

let lastCash = null;
let lastGold = null;
store.on((d) => {
  for (const el of curEls) {
    if (!el.isConnected) {
      curEls.delete(el);
      continue;
    }
    el._cash.textContent = fmt(d.cash);
    el._gold.textContent = fmt(d.gold);
    if (lastCash !== null && d.cash !== lastCash) bump(el.querySelector('.cash-cur'));
    if (lastGold !== null && d.gold !== lastGold) bump(el.querySelector('.gold-cur'));
  }
  lastCash = d.cash;
  lastGold = d.gold;
});

function bump(el) {
  if (!el) return;
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

let toastWrap = null;
export function toast(text, err = false, ic = null) {
  if (!toastWrap || !toastWrap.isConnected) {
    toastWrap = h('div', { class: 'toast-wrap' });
    ui().append(toastWrap);
  }
  const t = h('div', { class: `toast${err ? ' err' : ''}`, html: (ic ? icon(ic) : '') + `<span>${text}</span>` });
  toastWrap.append(t);
  if (err) sfx.error();
  setTimeout(() => t.remove(), 2200);
}

export function modal(content, { onClose, cls = '' } = {}) {
  const back = h('div', { class: 'modal-back' });
  const box = h('div', { class: `modal panel ${cls}` }, content);
  back.append(box);
  const close = () => {
    back.remove();
    onClose?.();
  };
  back.addEventListener('pointerdown', (e) => {
    if (e.target === back) close();
  });
  ui().append(back);
  return { el: box, close };
}

export function confirmModal(title, text, yes, no = 'Отмена') {
  return new Promise((resolve) => {
    const m = modal([
      h('h2', {}, title),
      h('p', {}, text),
      h(
        'div',
        { class: 'row2' },
        h('button', { class: 'btn dark', onclick: () => (m.close(), resolve(false)) }, no),
        h('button', { class: 'btn yellow', onclick: () => (m.close(), resolve(true)) }, yes),
      ),
    ]);
  });
}

// Реклама за награду. Вне Яндекса показываем короткую заглушку, чтобы можно было проверить игру.
export async function rewardAd() {
  const r = await showRewardedAd();
  if (r !== null) return r;
  if (isYandex()) return false;
  return new Promise((resolve) => {
    setPaused(true);
    let n = 2;
    const txt = h('div', {}, `Реклама (демо) · ${n}`);
    const el = h('div', { class: 'fake-ad' }, h('div', { html: icon('video') }), txt);
    ui().append(el);
    const iv = setInterval(() => {
      n--;
      txt.textContent = `Реклама (демо) · ${n}`;
      if (n <= 0) {
        clearInterval(iv);
        el.remove();
        setPaused(false);
        resolve(true);
      }
    }, 700);
  });
}

export function statBar(value, max, delta = 0, cls = '') {
  const w = Math.max(0, Math.min(1, value / max)) * 100;
  const d = Math.max(0, Math.min(1, (value + delta) / max)) * 100;
  const bar = h('div', { class: `bar ${cls}` }, h('i', { style: { width: `${Math.min(w, d)}%` } }));
  if (delta > 0) bar.append(h('i', { class: 'delta', style: { left: `${w}%`, width: `${d - w}%` } }));
  if (delta < 0) bar.firstChild.style.width = `${d}%`;
  return bar;
}

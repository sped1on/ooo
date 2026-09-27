// Небольшие помощники для DOM: создание элементов, всплывающие сообщения, модальные окна.

import { icons } from './icons.js';
import { sfx } from '../audio.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function icon(name, cls = 'ic') {
  return h('span', { class: cls, html: icons[name] || '' });
}

export function coinIcon() {
  return h('span', { class: 'coin' });
}

let toastTimer = null;
export function toast(text, kind = 'info') {
  const el = $('#toast');
  el.textContent = text;
  el.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.className = 'toast';
  }, 2600);
}

// Модальное окно. buttons: [{ label, kind, onClick, close = true }]
export function modal({ title, body, buttons = [], closable = true, cls = '' }) {
  const root = $('#modal-root');
  const close = () => {
    wrap.classList.add('closing');
    setTimeout(() => wrap.remove(), 180);
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => {
    if (e.key === 'Escape' && closable) close();
  };
  const btns = buttons.map((b) =>
    h(
      'button',
      {
        class: `btn ${b.kind || 'ghost'}`,
        onclick: () => {
          sfx.click();
          if (b.close !== false) close();
          b.onClick?.();
        },
      },
      b.icon ? icon(b.icon) : null,
      b.label,
    ),
  );
  const box = h(
    'div',
    { class: `modal panel ${cls}` },
    closable ? h('button', { class: 'modal-x', 'aria-label': 'Закрыть', onclick: () => close() }, icon('close')) : null,
    title ? h('h2', { class: 'modal-title' }, title) : null,
    h('div', { class: 'modal-body' }, body),
    btns.length ? h('div', { class: 'modal-actions' }, btns) : null,
  );
  const wrap = h('div', {
    class: 'modal-wrap',
    onclick: (e) => {
      if (e.target === wrap && closable) close();
    },
  }, box);
  root.append(wrap);
  document.addEventListener('keydown', onKey);
  return { close, el: box };
}

export function formatTime(sec) {
  sec = Math.max(0, Math.ceil(sec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Награды (ежедневные, рулетка, реклама), задания, настройки.

import { h, currencyBar, statBar, toast, rewardAd, modal } from './dom.js';
import { icon } from './icons.js';
import { thumbImg } from './thumbs.js';
import { S, store, give } from '../state/save.js';
import { DAILY, WHEEL, TASKS, findCar, findGun, RESOURCES } from '../data/catalog.js';
import { currencyModal, dailyAvailable, dailyIndex, giveDaily, taskState, claimTask } from './common.js';
import { sfx, setAudioSettings } from '../engine/audio.js';
import { fmt } from '../engine/util.js';
import { resetConfirm } from './menu.js';

function head(app, title, sub) {
  return h(
    'div',
    { class: 'screen-head' },
    h('button', { class: 'icon-btn', html: icon('back'), onclick: () => (sfx.click(), app.go('menu')) }),
    h('div', {}, h('h1', {}, title), sub ? h('p', {}, sub) : null),
  );
}

// ------------------------------ награды ------------------------------

export function rewardsScreen(app) {
  const s = S();
  const el = h('div', { class: 'screen active rewards-screen' });
  el.append(head(app, 'Ежедневные награды'), currencyBar(() => currencyModal()));
  const wrap = h('div', { class: 'rewards' });
  el.append(wrap);
  const days = h('div', { class: 'days' });
  const renderDays = () => {
    days.innerHTML = '';
    const idx = dailyIndex();
    const avail = dailyAvailable();
    DAILY.forEach((d, i) => {
      let r = d;
      if (d.kind === 'car' && s.cars.includes(d.id)) r = d.fallback;
      if (d.kind === 'gun' && s.guns.includes(d.id)) r = d.fallback;
      const done = i < idx || (i === idx && !avail && false);
      const today = i === idx && avail;
      const card = h('div', { class: `day${today ? ' today' : ''}${i < idx ? ' done' : ''}${i === 6 ? ' last' : ''}` }, h('h5', {}, `День ${i + 1}`));
      if (r.kind === 'car') card.append(thumbImg(`car:${r.id}`), h('div', { class: 'amt' }, findCar(r.id).name));
      else if (r.kind === 'gun') card.append(thumbImg(`gun:${findGun(r.id).model}`), h('div', { class: 'amt' }, findGun(r.id).name));
      else if (r.kind === 'res') card.append(h('span', { html: icon('chest', 'big') }), h('div', { class: 'amt' }, 'Припасы'));
      else card.append(h('span', { html: icon(d.icon === 'chest' ? 'chest' : r.kind === 'gold' ? 'gold' : 'cash', 'big') }), h('div', { class: 'amt', html: `${icon(r.kind === 'gold' ? 'gold' : 'cash')}${fmt(r.amount)}` }));
      if (i < idx) card.append(h('span', { html: icon('check', 'check') }));
      if (today)
        card.append(
          h('button', {
            class: 'btn green',
            onclick: () => {
              const t = giveDaily(i);
              toast(t, false, 'gift');
              renderDays();
              app.refresh();
            },
          }, 'Забрать'),
        );
      else if (i === idx) card.append(h('span', { style: { color: 'var(--muted)' } }, 'Завтра'));
      void done;
      days.append(card);
    });
  };
  renderDays();
  wrap.append(days);

  // рулетка
  const N = WHEEL.length;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 360;
  drawWheel(cv);
  let rot = 0;
  const timer = h('div', { class: 'timer' });
  const spinBtn = h('button', { class: 'btn yellow' });
  const updTimer = () => {
    const left = s.wheelLast + 86400000 - Date.now();
    if (left <= 0) {
      timer.textContent = 'Бесплатное вращение доступно!';
      spinBtn.textContent = 'Вращать';
      spinBtn.dataset.free = '1';
    } else {
      const hh = String(Math.floor(left / 3600000)).padStart(2, '0');
      const mm = String(Math.floor((left % 3600000) / 60000)).padStart(2, '0');
      const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, '0');
      timer.innerHTML = `Бесплатное вращение через:<br><b>${hh}:${mm}:${ss}</b>`;
      spinBtn.innerHTML = `${icon('video')} Вращать за рекламу`;
      spinBtn.dataset.free = '';
    }
  };
  updTimer();
  const iv = setInterval(() => {
    if (!el.isConnected) clearInterval(iv);
    else updTimer();
  }, 1000);
  let spinning = false;
  spinBtn.onclick = async () => {
    if (spinning) return;
    if (!spinBtn.dataset.free) {
      if (!(await rewardAd())) return;
    } else {
      s.wheelLast = Date.now();
      store.save();
    }
    spinning = true;
    const total = WHEEL.reduce((a, w) => a + w.w, 0);
    let r = Math.random() * total;
    let idx = 0;
    for (let i = 0; i < N; i++) {
      r -= WHEEL[i].w;
      if (r <= 0) {
        idx = i;
        break;
      }
    }
    const A = 360 / N;
    const target = 360 - (idx + 0.5) * A + (Math.random() - 0.5) * A * 0.6;
    rot = rot - (rot % 360) + 360 * 6 + target;
    cv.style.transform = `rotate(${rot}deg)`;
    let ticks = 0;
    const tk = setInterval(() => {
      if (++ticks > 30) clearInterval(tk);
      else sfx.wheelTick();
    }, 110);
    setTimeout(() => {
      spinning = false;
      const w = WHEEL[idx];
      if (w.kind === 'cash') give({ cash: w.amount });
      else if (w.kind === 'gold') give({ gold: w.amount });
      else give({ res: w.res });
      store.save();
      sfx.win();
      const txt = w.kind === 'res' ? Object.entries(w.res).map(([k, v]) => `${RESOURCES[k]?.name || k} +${v}`).join(', ') : `+${w.amount} ${w.kind === 'gold' ? 'золота' : 'денег'}`;
      toast(`Выигрыш: ${txt}`, false, 'gift');
      updTimer();
      app.refresh();
    }, 4300);
  };
  const wheelBox = h(
    'div',
    { class: 'wheel-box panel' },
    h('div', { style: { height: '100%', display: 'flex', flexDirection: 'column' } }, h('h4', {}, 'Рулетка'), h('div', { class: 'wheel-wrap' }, cv, h('div', { class: 'pointer' }))),
    h('div', { class: 'wheel-info' }, timer, spinBtn),
  );
  const adBox = h(
    'div',
    { class: 'ad-reward panel' },
    h('h4', {}, 'Смотри рекламу и получай:'),
    h(
      'div',
      { class: 'row' },
      h('span', { html: icon('video', 'vid') }),
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '0.6rem', flex: 1, alignItems: 'center' } },
        h('div', { class: 'amt', html: `${icon('cash')} +100` }),
        h('button', {
          class: 'btn yellow',
          onclick: async () => {
            if (await rewardAd()) {
              give({ cash: 100 });
              store.save();
              toast('+100', false, 'cash');
            }
          },
        }, 'Смотреть'),
      ),
    ),
  );
  wrap.append(h('div', { class: 'rewards-row' }, wheelBox, adBox));
  return el;
}

function drawWheel(cv) {
  const ctx = cv.getContext('2d');
  const N = WHEEL.length;
  const r = cv.width / 2;
  ctx.translate(r, r);
  ctx.fillStyle = '#c9a24a';
  ctx.beginPath();
  ctx.arc(0, 0, r - 2, 0, Math.PI * 2);
  ctx.fill();
  const A = (Math.PI * 2) / N;
  for (let i = 0; i < N; i++) {
    const a0 = -Math.PI / 2 + i * A;
    ctx.fillStyle = WHEEL[i].color;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r - 12, a0, a0 + A);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.save();
    ctx.rotate(a0 + A / 2 + Math.PI / 2);
    ctx.fillStyle = '#fff';
    ctx.font = '700 30px Oswald, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 4;
    ctx.fillText(WHEEL[i].label, 0, -r * 0.62);
    // значок сектора
    const w = WHEEL[i];
    const kind = w.kind === 'res' ? w.icon : w.kind;
    ctx.fillStyle = kind === 'gold' ? '#ffd23a' : kind === 'cash' ? '#6ad84a' : '#e8e0d0';
    ctx.beginPath();
    ctx.arc(0, -r * 0.38, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // гвоздики по краю
  for (let i = 0; i < N * 2; i++) {
    const a = (i / (N * 2)) * Math.PI * 2;
    ctx.fillStyle = '#fff3c0';
    ctx.beginPath();
    ctx.arc(Math.cos(a) * (r - 7), Math.sin(a) * (r - 7), 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#b8261e';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f5c21b';
  ctx.lineWidth = 5;
  ctx.stroke();
}

// ------------------------------ задания ------------------------------

export function tasksScreen(app) {
  const el = h('div', { class: 'screen active' });
  el.append(head(app, 'Задания', 'Выполняй задания и получай награды'), currencyBar(() => currencyModal()));
  const list = h('div', { class: 'tasks' });
  el.append(list);
  const render = () => {
    list.innerHTML = '';
    const sorted = [...TASKS].sort((a, b) => {
      const sa = taskState(a);
      const sb = taskState(b);
      const rank = (x) => (x.claimed ? 2 : x.done ? 0 : 1);
      return rank(sa) - rank(sb);
    });
    for (const t of sorted) {
      const st = taskState(t);
      const rw = t.reward.gold ? `${icon('gold')}${t.reward.gold}` : `${icon('cash')}${fmt(t.reward.cash)}`;
      list.append(
        h(
          'div',
          { class: `task panel${st.claimed ? ' claimed' : ''}` },
          h('span', { html: icon(t.stat === 'maxBase' ? 'home' : t.stat.includes('kill') || t.stat === 'brutes' ? 'skull' : t.stat === 'distance' ? 'speed' : 'target', 't') }),
          h('div', { class: 'body' }, h('b', {}, t.text), h('div', { style: { fontSize: '0.9rem', color: 'var(--muted)' } }, `${fmt(st.value)} / ${fmt(t.goal)}`), statBar(st.value, t.goal)),
          h('div', { class: 'rw', html: rw }),
          st.claimed
            ? h('span', { html: icon('check'), style: { color: 'var(--green)' } })
            : h('button', {
                class: 'btn green',
                disabled: !st.done,
                onclick: () => {
                  claimTask(t);
                  toast('Награда получена!', false, 'check');
                  render();
                },
              }, 'Забрать'),
        ),
      );
    }
  };
  render();
  return el;
}

// ------------------------------ настройки ------------------------------

export function settingsScreen(app) {
  const s = S();
  const set = s.settings;
  const el = h('div', { class: 'screen active' });
  el.append(head(app, 'Настройки'));
  const box = h('div', { class: 'settings panel' });
  el.append(box);
  const toggle = (key, label, after) =>
    h(
      'div',
      { class: 'set-row' },
      h('span', {}, label),
      h('button', {
        class: `toggle${set[key] ? ' on' : ''}`,
        onclick: (e) => {
          set[key] = !set[key];
          e.currentTarget.classList.toggle('on', set[key]);
          store.save();
          after?.();
          sfx.click();
        },
      }),
    );
  const seg = (key, label, opts, after) => {
    const wrap = h('div', { class: 'seg' });
    const render = () => {
      wrap.innerHTML = '';
      for (const [v, t] of opts)
        wrap.append(
          h('button', {
            class: set[key] === v ? 'on' : '',
            onclick: () => {
              set[key] = v;
              store.save();
              render();
              after?.();
              sfx.click();
            },
          }, t),
        );
    };
    render();
    return h('div', { class: 'set-row' }, h('span', {}, label), wrap);
  };
  const audio = () => setAudioSettings({ sound: set.sound, music: set.music });
  box.append(
    toggle('sound', 'Звуки', audio),
    toggle('music', 'Музыка', () => {
      audio();
      app.music();
    }),
    seg('quality', 'Графика', [['auto', 'Авто'], ['low', 'Низкая'], ['mid', 'Средняя'], ['high', 'Высокая']], () => app.applyQuality()),
    seg('camera', 'Камера в поездке', [['cockpit', 'Из кабины'], ['chase', 'Сзади']]),
    toggle('autofire', 'Автострельба из машины'),
    toggle('shake', 'Тряска камеры'),
    h(
      'div',
      { class: 'set-row' },
      h('span', {}, 'Управление'),
      h('span', { style: { color: 'var(--muted)', fontSize: '0.95rem', textAlign: 'right' } }, 'A/D — руль, W — газ, S — тормоз, Пробел — огонь, C — камера'),
    ),
    h(
      'div',
      { class: 'set-row' },
      h('span', {}, 'Прогресс'),
      h('button', {
        class: 'btn red',
        onclick: async () => {
          if (await resetConfirm()) {
            store.reset();
            app.applyQuality();
            app.refresh();
            app.go('menu');
          }
        },
      }, 'Сбросить'),
    ),
  );
  void modal;
  return el;
}

// Экран карты уровня и игровой интерфейс (HUD) с сенсорным управлением.

import { h, currencyBar, statBar } from './dom.js';
import { icon } from './icons.js';
import { baseInfo } from '../data/catalog.js';
import { currencyModal } from './common.js';
import { sfx } from '../engine/audio.js';
import { fmt } from '../engine/util.js';

const POI = {
  zombies: { icon: 'skull', name: 'Зомби' },
  res: { icon: 'box', name: 'Ресурсы' },
  station: { icon: 'pump', name: 'Заправка' },
  camp: { icon: 'bandit', name: 'Лагерь бандитов' },
  base: { icon: 'home', name: 'База' },
  bridge: { icon: 'bridge', name: 'Мост' },
  boss: { icon: 'skull', name: 'Босс' },
};

// ------------------------------ карта уровня ------------------------------

export function mapScreen(app, level) {
  const from = baseInfo(level.dest - 1);
  const to = baseInfo(level.dest);
  const el = h('div', { class: 'screen active mapscreen' });
  const layer = h('div', { style: { position: 'absolute', inset: 0, pointerEvents: 'none' } });
  el.append(layer);
  el.append(
    h(
      'div',
      { class: 'map-base panel' },
      h('button', { class: 'icon-btn', html: icon('back'), onclick: () => (sfx.click(), app.leaveLevel()) }),
      h('span', { html: icon('car'), style: { color: 'var(--yellow)' } }),
      h('div', {}, h('b', {}, from.name), h('span', {}, `Уровень ${level.dest - 1}`)),
    ),
    currencyBar(() => currencyModal()),
    h(
      'div',
      { class: 'map-goal panel' },
      h('span', { html: icon('info', 'warn') }),
      h('div', {}, h('b', {}, 'Текущая цель'), h('span', {}, `Добраться до базы ${level.dest}`)),
    ),
  );
  // мини-схема
  const cv = document.createElement('canvas');
  el.append(h('div', { class: 'map-mini panel' }, h('h4', {}, 'Карта уровня'), cv));
  requestAnimationFrame(() => drawSketch(cv, level));
  // легенда
  el.append(
    h(
      'div',
      { class: 'map-legend panel' },
      ...[
        ['res', 'Собирай ресурсы'],
        ['station', 'Заправляйся пешком'],
        ['zombies', 'Уничтожай зомби'],
        ['camp', 'Берегись бандитов и мин'],
        ['base', 'Достигай новых баз'],
      ].map(([k, t]) => h('div', {}, h('span', { class: `pin ${k}`, html: icon(POI[k].icon) }), t)),
    ),
  );
  el.append(
    h(
      'div',
      { class: 'map-go' },
      h('button', { class: 'btn yellow big', html: `${icon('play')} В путь`, onclick: () => (sfx.click(), app.startDrive()) }),
      h('div', { class: 'hint' }, `${fmt(level.L)} м · ${to.name}: ${to.sub} · перетащи карту, чтобы осмотреться`),
    ),
  );
  // вращение и приближение
  let drag = null;
  const canvas = document.getElementById('gl');
  const down = (e) => {
    drag = { x: e.clientX, rot: level.mapView.rot };
  };
  const move = (e) => {
    if (!drag) return;
    level.mapView.rot = drag.rot + (e.clientX - drag.x) * 0.005;
  };
  const up = () => {
    drag = null;
  };
  const wheel = (e) => {
    level.mapView.zoom = Math.min(1.6, Math.max(0.45, level.mapView.zoom * (e.deltaY > 0 ? 1.08 : 0.92)));
  };
  canvas.addEventListener('pointerdown', down);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  canvas.addEventListener('wheel', wheel, { passive: true });
  el.onLeave = () => {
    canvas.removeEventListener('pointerdown', down);
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    canvas.removeEventListener('wheel', wheel);
  };
  // маркеры
  const marks = new Map();
  el.onFrame = () => {
    const list = level.mapMarkers();
    for (const m of list) {
      const key = `${m.type}${m.s}`;
      let d = marks.get(key);
      if (!d) {
        let title = POI[m.type].name;
        let sub = '';
        if (m.type === 'boss') {
          title = `Босс: ${m.name}`;
          sub = 'Охраняет ворота базы';
        }
        if (m.type === 'base') {
          title = m.start ? from.name : to.name;
          sub = m.start ? `Уровень ${level.dest - 1} · вы здесь` : `Уровень ${level.dest}`;
        }
        d = h(
          'div',
          { class: 'map-marker' },
          h('div', { class: 'lbl' }, h('span', { class: `pin ${m.type}`, html: icon(m.start ? 'car' : POI[m.type].icon) }), h('div', {}, title, sub ? h('small', {}, sub) : null)),
          h('div', { class: 'stem' }),
        );
        layer.append(d);
        marks.set(key, d);
      }
      d.style.left = `${m.sx}px`;
      d.style.top = `${m.sy}px`;
    }
  };
  return el;
}

function drawSketch(cv, level) {
  const w = (cv.width = cv.clientWidth * devicePixelRatio);
  const hh = (cv.height = cv.clientHeight * devicePixelRatio);
  const ctx = cv.getContext('2d');
  const { pts } = level.routeSketch(60);
  // поворачиваем так, чтобы старт был слева
  const a = pts[0];
  const b = pts[pts.length - 1];
  const ang = Math.atan2(b.z - a.z, b.x - a.x);
  const rot = pts.map((p) => {
    const x = p.x - a.x;
    const z = p.z - a.z;
    return { x: x * Math.cos(-ang) - z * Math.sin(-ang), y: x * Math.sin(-ang) + z * Math.cos(-ang), s: p.s };
  });
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of rot) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const pad = 22 * devicePixelRatio;
  const sx = (w - pad * 2) / Math.max(1, maxX - minX);
  const sy = (hh - pad * 2) / Math.max(1, maxY - minY);
  const sc = Math.min(sx, sy * 3);
  const cy = (minY + maxY) / 2;
  const P = (p) => [pad + (p.x - minX) * sc, hh / 2 + (p.y - cy) * Math.min(sc, sy)];
  ctx.fillStyle = 'rgba(30,50,40,0.5)';
  ctx.fillRect(0, 0, w, hh);
  ctx.strokeStyle = '#8a9aa8';
  ctx.lineWidth = 3 * devicePixelRatio;
  ctx.beginPath();
  rot.forEach((p, i) => {
    const [x, y] = P(p);
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  });
  ctx.stroke();
  const at = (s) => {
    const i = Math.round((s / level.L) * (rot.length - 1));
    return P(rot[Math.max(0, Math.min(rot.length - 1, i))]);
  };
  const colors = { zombies: '#c62a24', res: '#3fae2a', station: '#2f7ae0', camp: '#e8962a', bridge: '#6a7a8a' };
  for (const poi of level.world.pois) {
    if (poi.type === 'base') continue;
    const [x, y] = at(poi.s);
    ctx.fillStyle = colors[poi.type] || '#fff';
    ctx.beginPath();
    ctx.arc(x, y, 5 * devicePixelRatio, 0, Math.PI * 2);
    ctx.fill();
  }
  const home = (x, y, col) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x, y, 10 * devicePixelRatio, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.font = `700 ${11 * devicePixelRatio}px Oswald`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⌂', x, y);
  };
  home(...at(0), '#3fae2a');
  home(...at(level.L), '#f5c21b');
}

// ------------------------------ HUD ------------------------------

export function hudScreen(app, level, touch) {
  const el = h('div', { class: 'screen active hud' });
  const input = app.touchInput;
  const vign = h('div', { class: 'hurt-vignette' });
  el.append(vign);
  el.append(h('button', { class: 'icon-btn pause', html: icon('pause'), onclick: () => app.pause() }));
  const quest = h('div', { class: 'quest panel' });
  el.append(quest);
  // полоса маршрута
  const fill = h('i');
  const routeBar = h('div', { class: 'route-bar' }, fill);
  for (const p of level.world.pois) {
    if (p.type === 'station' || p.type === 'camp') {
      routeBar.append(h('span', { class: `mk ${p.type}`, style: { left: `${(p.s / level.L) * 100}%` }, html: icon(p.type === 'station' ? 'pump' : 'bandit') }));
    }
  }
  routeBar.append(h('span', { class: 'mk end', style: { left: '100%' }, html: icon('home') }));
  const distTxt = h('span');
  const objTxt = h('span');
  const hpBar = statBar(1, 1, 0, 'hp good');
  const fuelBar = statBar(1, 1, 0, 'fuel');
  el.append(
    h(
      'div',
      { class: 'topbar panel' },
      h('div', { class: 'row' }, objTxt, distTxt),
      routeBar,
      h('div', { class: 'bars2' }, h('span', { html: icon('wrench') }), hpBar, h('span', { html: icon('fuel') }), fuelBar),
    ),
  );
  // мини-карта
  const mm = document.createElement('canvas');
  mm.className = 'minimap';
  mm.width = mm.height = 220;
  el.append(mm);
  const cashTxt = h('b');
  const cargoTxt = h('b');
  el.append(h('div', { class: 'hcash' }, h('div', { class: 'cur', html: icon('cash') }, cashTxt), h('div', { class: 'cur', html: icon('trunk') }, cargoTxt)));
  const notices = h('div', { class: 'notices' });
  el.append(notices);
  const bossBar = h('div', { class: 'boss-bar', style: { display: 'none' } }, h('b'), h('div', { class: 'bar hp' }, h('i')));
  el.append(bossBar);
  const pump = h('div', { class: 'pump-bar panel', style: { display: 'none' } });
  el.append(pump);
  const php = h('div', { class: 'php panel', style: { display: 'none' } });
  el.append(php);
  const speedo = h('div', { class: 'speedo' });
  if (!touch) el.append(speedo);

  // сенсорные кнопки
  const hold = (btn, on, off) => {
    const press = (e) => {
      e.preventDefault();
      btn.setPointerCapture?.(e.pointerId);
      btn.classList.add('pressed');
      on();
    };
    const rel = () => {
      btn.classList.remove('pressed');
      off();
    };
    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', rel);
    btn.addEventListener('pointercancel', rel);
    btn.addEventListener('lostpointercapture', rel);
    return btn;
  };
  const tap = (btn, fn) => {
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      fn();
    });
    return btn;
  };
  const driveCtl = h('div', { class: 'drive-ctl' });
  const footCtl = h('div', { class: 'foot-ctl' });
  const fireBtn = h('div', { class: 'ctl fire', html: `${icon('fire')}<span class="ammo"></span>` });
  hold(fireBtn, () => (input.fire = true), () => (input.fire = false));
  const repairBtn = tap(h('div', { class: 'ctl small repair', html: `${icon('wrench')}<span class="n"></span>` }), () => app.useItem('repair'));
  const canBtn = tap(h('div', { class: 'ctl small canister', html: `${icon('fuel')}<span class="n"></span>` }), () => app.useItem('fuel'));
  const camBtn = tap(h('div', { class: 'ctl small cam', html: icon('camera') }), () => app.useItem('camera'));
  if (touch) {
    const l = hold(h('div', { class: 'ctl steer l', html: icon('left') }), () => (input.left = true), () => (input.left = false));
    const r = hold(h('div', { class: 'ctl steer r', html: icon('right') }), () => (input.right = true), () => (input.right = false));
    const br = hold(h('div', { class: 'ctl small brake', html: icon('brake') }), () => (input.brake = true), () => (input.brake = false));
    driveCtl.append(l, r, br);
  } else {
    driveCtl.append(h('div', { class: 'keys-hint', html: '<kbd>A</kbd>/<kbd>D</kbd> руль · <kbd>W</kbd> газ · <kbd>S</kbd> тормоз · <kbd>Пробел</kbd>/ЛКМ огонь<br><kbd>R</kbd> ремонт · <kbd>F</kbd> канистра · <kbd>C</kbd> камера · <kbd>Esc</kbd> пауза' }));
  }
  driveCtl.append(fireBtn, repairBtn, canBtn, camBtn);
  // пешком
  const joy = h('div', { class: 'joy' }, h('i'));
  const knob = joy.firstChild;
  let joyId = null;
  const joyMove = (e) => {
    const r = joy.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let dx = (e.clientX - cx) / (r.width / 2);
    let dy = (e.clientY - cy) / (r.height / 2);
    const l = Math.hypot(dx, dy);
    if (l > 1) {
      dx /= l;
      dy /= l;
    }
    input.joyX = dx;
    input.joyY = -dy;
    knob.style.transform = `translate(${dx * r.width * 0.32}px, ${dy * r.height * 0.32}px)`;
  };
  joy.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    joyId = e.pointerId;
    joy.setPointerCapture(e.pointerId);
    joyMove(e);
  });
  joy.addEventListener('pointermove', (e) => {
    if (e.pointerId === joyId) joyMove(e);
  });
  const joyEnd = () => {
    joyId = null;
    input.joyX = 0;
    input.joyY = 0;
    knob.style.transform = '';
  };
  joy.addEventListener('pointerup', joyEnd);
  joy.addEventListener('pointercancel', joyEnd);
  const fireBtn2 = h('div', { class: 'ctl fire', html: `${icon('fire')}<span class="ammo"></span>` });
  hold(fireBtn2, () => (input.fire = true), () => (input.fire = false));
  const medBtn = tap(h('div', { class: 'ctl small med', html: `${icon('medkit')}<span class="n"></span>` }), () => app.useItem('med'));
  const enterBtn = tap(h('div', { class: 'ctl enter', html: `${icon('door')}<span>Сесть в машину</span>` }), () => app.useItem('enter'));
  // прицел и зона обзора (палец по правой половине экрана)
  const cross = h('div', { class: 'crosshair' }, h('i'), h('i'), h('i'), h('i'));
  const look = h('div', { class: 'look-zone' });
  let lookId = null;
  let lx = 0;
  let ly = 0;
  look.addEventListener('pointerdown', (e) => {
    lookId = e.pointerId;
    lx = e.clientX;
    ly = e.clientY;
    look.setPointerCapture(e.pointerId);
  });
  look.addEventListener('pointermove', (e) => {
    if (e.pointerId !== lookId) return;
    input.lookDX += (e.clientX - lx) * 2.2;
    input.lookDY += (e.clientY - ly) * 2.2;
    lx = e.clientX;
    ly = e.clientY;
  });
  const lookEnd = () => {
    lookId = null;
  };
  look.addEventListener('pointerup', lookEnd);
  look.addEventListener('pointercancel', lookEnd);
  footCtl.append(cross);
  if (touch) footCtl.append(look, joy);
  else footCtl.append(h('div', { class: 'keys-hint', html: '<kbd>WASD</kbd> идти · мышь — осмотреться (клик захватывает мышь) · <kbd>←</kbd><kbd>→</kbd> поворот<br>стрельба сама, когда зомби в прицеле · <kbd>H</kbd> аптечка · <kbd>E</kbd> сесть в машину' }));
  footCtl.append(fireBtn2, medBtn, enterBtn);
  el.append(driveCtl, footCtl);

  let lastMode = '';
  let mmT = 0;
  let noticeKey = '';
  el.onFrame = (dt) => {
    const d = level.hud();
    const foot = d.state === 'foot';
    const drive = d.state === 'drive' || d.state === 'stationOut';
    const mode = foot ? 'foot' : drive ? 'drive' : 'none';
    if (mode !== lastMode) {
      lastMode = mode;
      driveCtl.style.display = mode === 'drive' ? '' : 'none';
      footCtl.style.display = mode === 'foot' ? '' : 'none';
      php.style.display = foot ? '' : 'none';
      pump.style.display = foot ? '' : 'none';
      speedo.style.display = mode === 'drive' ? '' : 'none';
      el.querySelector('.topbar').style.display = mode === 'none' ? 'none' : '';
      mm.style.display = mode === 'none' ? 'none' : '';
      quest.style.display = mode === 'none' ? 'none' : '';
      el.querySelector('.hcash').style.display = mode === 'none' ? 'none' : '';
    }
    // задание
    const done = d.kills >= d.killGoal;
    quest.className = `quest panel${done ? ' done' : ''}`;
    quest.innerHTML = `${icon(done ? 'check' : 'skull')}<div>Убить зомби<br><b>${Math.min(d.kills, d.killGoal)}/${d.killGoal}</b></div>`;
    objTxt.textContent = d.objective;
    distTxt.textContent = `${fmt(d.distLeft)} м`;
    fill.style.width = `${d.progress * 100}%`;
    const hpK = d.hp / d.maxHp;
    hpBar.firstChild.style.width = `${hpK * 100}%`;
    hpBar.classList.toggle('good', hpK > 0.4);
    fuelBar.firstChild.style.width = `${(d.fuel / d.maxFuel) * 100}%`;
    cashTxt.textContent = fmt(d.cash);
    cargoTxt.textContent = `${d.cargo}/${d.trunk}`;
    speedo.innerHTML = `${Math.round(d.speed * 3.6)}<small>км/ч</small>`;
    // боеприпасы
    const ammoTxt = d.melee && foot ? '' : d.reloading ? 'перезарядка' : `${d.mag}/${d.reserve}`;
    for (const b of [fireBtn, fireBtn2]) {
      b.querySelector('.ammo').textContent = ammoTxt;
      b.classList.toggle('reload', d.reloading);
    }
    repairBtn.querySelector('.n').textContent = d.repair;
    repairBtn.classList.toggle('empty', d.repair <= 0);
    canBtn.querySelector('.n').textContent = d.canisters;
    canBtn.classList.toggle('empty', d.canisters <= 0);
    medBtn.querySelector('.n').textContent = d.meds;
    medBtn.classList.toggle('empty', d.meds <= 0);
    enterBtn.style.display = d.canEnter ? '' : 'none';
    cross.classList.toggle('on', !!d.aimed);
    if (foot) {
      php.innerHTML = `<div class="row"><span>${icon('heart')} Здоровье</span><span class="${d.poison ? 'poison' : ''}">${d.poison ? 'Отравление! ' : ''}${Math.ceil(d.php)}/${d.pmax}</span></div>`;
      php.append(statBar(d.php, d.pmax, 0, `hp ${d.php / d.pmax > 0.4 ? 'good' : ''}`));
      if (d.pump < 1) {
        pump.style.display = '';
        pump.innerHTML = `${icon('pump')} ${d.objective}`;
        pump.append(statBar(d.pump, 1, 0, 'fuel'));
      } else pump.style.display = 'none';
    }
    if (d.boss && mode !== 'none') {
      bossBar.style.display = '';
      bossBar.firstChild.textContent = `БОСС: ${d.boss.name.toUpperCase()}`;
      bossBar.lastChild.firstChild.style.width = `${Math.max(0, d.boss.hp / d.boss.max) * 100}%`;
    } else bossBar.style.display = 'none';
    vign.style.opacity = foot ? Math.min(1, d.hurt * 3 + (d.php / d.pmax < 0.3 ? 0.5 : 0)) : hpK < 0.25 ? 0.5 : 0;
    // сообщения
    const nk = d.notices.map((n) => n.text).join('|');
    if (nk !== noticeKey) {
      noticeKey = nk;
      notices.innerHTML = '';
      for (const n of d.notices) notices.append(h('div', { class: `notice ${n.kind}` }, n.text));
    }
    mmT -= dt;
    if (mmT <= 0 && mode !== 'none') {
      mmT = 1 / 20;
      level.drawMinimap(mm.getContext('2d'), mm.width);
    }
  };
  return el;
}

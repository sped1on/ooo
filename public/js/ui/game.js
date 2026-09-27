// Экран партии: связывает правила, 3D-вид, бота, онлайн и HUD.

import { Game } from '../core/quoridor.js';
import { chooseBotMove, BOT_LEVELS } from '../core/ai.js';
import { $, h, icon, coinIcon, modal, toast, formatTime } from './dom.js';
import { sfx } from '../audio.js';
import { state, save, addCoins, playerName } from '../state/store.js';
import * as platform from '../platform/yandex.js';

const REWARDS = {
  bot: { easy: 20, medium: 40, hard: 80 },
  online: 60,
  hotseat: 10,
  lose: 5,
};

const EMOTES = ['👍', '😮', '😎', '🤝', '😅'];

export class Match {
  /**
   * @param {object} cfg { mode: 'bot'|'hotseat'|'online', size, time, botLevel, net, you, names, moves, remaining }
   * @param {object} deps { view, onExit, onRestart }
   */
  constructor(cfg, deps) {
    this.cfg = cfg;
    this.view = deps.view;
    this.onExit = deps.onExit;
    this.onRestart = deps.onRestart;
    this.game = new Game(cfg.size);
    for (const mv of cfg.moves || []) this.game.play(mv);
    this.mode = 'move';
    this.pendingWall = null;
    this.busy = false;
    this.over = false;
    this.botTimer = null;
    this.deadline = 0;
    this.pausedLeft = 0;
    this.usedUndo = false;
    this.bottomSeat = cfg.mode === 'online' ? cfg.you : 0;
    this.names = this._names();
    this._keys = this._onKey.bind(this);
    this._unsubPause = platform.onPause((p) => this._pause(p));
  }

  _names() {
    const c = this.cfg;
    if (c.mode === 'bot') return [playerName(), `Бот · ${BOT_LEVELS[c.botLevel].name}`];
    if (c.mode === 'hotseat') return ['Синий', 'Красный'];
    return c.names || ['Игрок', 'Игрок'];
  }

  isLocal(seat) {
    if (this.cfg.mode === 'hotseat') return true;
    if (this.cfg.mode === 'bot') return seat === 0;
    return seat === this.cfg.you;
  }

  get myTurn() {
    return !this.over && !this.busy && this.isLocal(this.game.turn);
  }

  start() {
    const v = this.view;
    v.mount($('#game-stage'), { interactive: true, sway: false });
    v.setTilt(state.settings.tilt);
    v.setPadding(() => {
      const stage = $('#game-stage').getBoundingClientRect();
      const top = $('.hud-top').getBoundingClientRect().bottom - stage.top;
      const bottom = stage.bottom - $('#action-bar').getBoundingClientRect().top;
      return { top: Math.max(0, top + 4), bottom: Math.max(0, bottom + 4) };
    });
    v.animations = state.settings.animations;
    v.syncState(this.game);
    v.setFlipped(this.bottomSeat === 1);
    v.clearMoves();
    v.showGhost(null);
    v.on('hover', (t) => this._hover(t));
    v.on('click', (t, e) => this._click(t, e));
    v.on('rotate', () => this.rotateWall());
    v.on('wallLanded', null);
    v.start();
    document.addEventListener('keydown', this._keys);
    this._buildHud();
    v._resize();
    if (this.cfg.mode === 'online') this._bindNet();
    platform.gameplayStart();
    sfx.start();
    const rem = this.cfg.remaining;
    this._beginTurn(rem);
    this.timerInt = setInterval(() => this._tick(), 200);
  }

  destroy() {
    clearTimeout(this.botTimer);
    clearInterval(this.timerInt);
    document.removeEventListener('keydown', this._keys);
    this._unsubPause();
    this.view.on('hover', null);
    this.view.on('click', null);
    this.view.on('rotate', null);
    this.view.clearMoves();
    this.view.showGhost(null);
    this.view.pulseStrip(0, false);
    this.view.setPadding(null);
    platform.gameplayStop();
  }

  // ---------- HUD ----------

  _buildHud() {
    const seats = [this.bottomSeat, 1 - this.bottomSeat];
    seats.forEach((seat, i) => {
      const card = $(`#card-${i}`);
      card.className = `player-card p${seat}${i ? ' right' : ''}`;
      card.innerHTML = '';
      const ring = `<svg class="ring" viewBox="0 0 56 56"><circle cx="28" cy="28" r="25" stroke="rgba(255,255,255,.12)"/><circle class="prog" cx="28" cy="28" r="25" stroke="${seat ? '#ff5a66' : '#6aa7ff'}" stroke-dasharray="157" stroke-dashoffset="0"/></svg>`;
      const who = this.cfg.mode === 'bot' && seat === 1 ? 'robot' : 'user';
      card.append(
        h('div', { class: 'avatar', html: ring }, icon(who)),
        h(
          'div',
          { class: 'pc-info' },
          h('div', { class: 'pc-name' }, this.names[seat]),
          h('div', { class: 'pc-sub' }, seat ? 'Красные · сверху' : 'Синие · снизу'),
          h('div', { class: 'pc-walls' }),
        ),
        h('div', { class: 'pc-time' }, formatTime(this.cfg.time)),
      );
      card.dataset.seat = seat;
    });
    this._buildActions();
    this._buildEmotes();
    this._updateHud();
  }

  _buildActions() {
    const bar = $('#action-bar');
    bar.innerHTML = '';
    const btn = (id, ic, label, onClick, cls = 'ghost') =>
      h('button', { class: `btn ${cls}`, id, title: label, onclick: () => { sfx.click(); onClick(); } }, icon(ic), h('span', { class: 'lbl' }, label));
    this.btnMove = btn('act-move', 'pawn', 'Фишка', () => this.setMode('move'), 'ghost mode');
    this.btnWall = btn('act-wall', 'wall', 'Стена', () => this.setMode('wall'), 'ghost mode');
    this.btnRotate = btn('act-rotate', 'rotate', 'Повернуть', () => this.rotateWall());
    this.btnConfirm = btn('act-confirm', 'check', 'Поставить', () => this._confirmWall(), 'confirm');
    this.btnUndo = btn('act-undo', 'undo', 'Отменить', () => this.undo());
    const btnResign = btn('act-resign', 'flag', 'Сдаться', () => this.confirmResign());
    const btnMenu = btn('act-menu', 'menu', 'Меню', () => this.confirmExit());
    bar.append(this.btnMove, this.btnWall, this.btnRotate, this.btnConfirm, h('div', { class: 'sep' }));
    if (this.cfg.mode !== 'online') bar.append(this.btnUndo);
    bar.append(btnResign, btnMenu);
  }

  _buildEmotes() {
    const box = $('#emotes');
    box.innerHTML = '';
    if (this.cfg.mode !== 'online') return;
    for (const e of EMOTES) {
      box.append(
        h('button', {
          onclick: () => {
            this.cfg.net.send({ t: 'emote', id: e });
            this._showEmote(e, true);
          },
        }, e),
      );
    }
  }

  _showEmote(e, mine) {
    const el = $('#float-emote');
    el.textContent = e;
    el.className = `float-emote${mine ? ' mine' : ''}`;
    void el.offsetWidth;
    el.classList.add('show');
  }

  _updateHud() {
    const g = this.game;
    for (let i = 0; i < 2; i++) {
      const card = $(`#card-${i}`);
      const seat = Number(card.dataset.seat);
      card.classList.toggle('active', g.turn === seat && !this.over);
      const walls = card.querySelector('.pc-walls');
      walls.innerHTML = '';
      for (let k = 0; k < g.wallsPerPlayer; k++) {
        walls.append(h('i', { class: k < g.wallsLeft[seat] ? '' : 'used' }));
      }
      const sub = card.querySelector('.pc-sub');
      sub.textContent = `Стен: ${g.wallsLeft[seat]} · ${seat ? 'красные' : 'синие'}`;
    }
    const banner = $('#turn-banner');
    if (this.over) {
      banner.textContent = 'Партия окончена';
      banner.className = 'turn-banner';
    } else {
      const t = g.turn;
      let text;
      if (this.cfg.mode === 'hotseat') text = `Ход: ${this.names[t]}`;
      else text = this.isLocal(t) ? 'Ваш ход' : this.cfg.mode === 'bot' ? 'Бот думает…' : 'Ход соперника';
      banner.textContent = text;
      banner.className = `turn-banner p${t}`;
    }
    const mine = this.myTurn;
    const canWall = mine && g.wallsLeft[g.turn] > 0;
    this.btnMove.classList.toggle('selected', this.mode === 'move');
    this.btnWall.classList.toggle('selected', this.mode === 'wall');
    this.btnMove.disabled = !mine;
    this.btnWall.disabled = !canWall;
    this.btnRotate.disabled = !mine || this.mode !== 'wall';
    this.btnConfirm.style.display = this.pendingWall ? '' : 'none';
    this.btnUndo.disabled = this.over || this.busy || !this._canUndo();
  }

  _tick() {
    if (this.over || this.paused) return;
    const left = (this.deadline - Date.now()) / 1000;
    const i = this.game.turn === this.bottomSeat ? 0 : 1;
    const card = $(`#card-${i}`);
    const other = $(`#card-${1 - i}`);
    const el = card.querySelector('.pc-time');
    el.textContent = formatTime(left);
    el.classList.toggle('low', left <= 10);
    other.querySelector('.pc-time').textContent = formatTime(this.cfg.time);
    other.querySelector('.pc-time').classList.remove('low');
    const frac = Math.max(0, Math.min(1, left / this.cfg.time));
    card.querySelector('.prog').setAttribute('stroke-dashoffset', String(157 * (1 - frac)));
    other.querySelector('.prog').setAttribute('stroke-dashoffset', '0');
    const whole = Math.ceil(left);
    if (whole <= 5 && whole > 0 && whole !== this._lastTick && this.isLocal(this.game.turn)) sfx.tick();
    this._lastTick = whole;
    if (left <= 0 && this.cfg.mode !== 'online' && !this.busy) {
      // Время вышло — автоматический шаг по кратчайшему пути
      clearTimeout(this.botTimer);
      const mv = this.game.autoMove();
      if (mv) {
        toast('Время вышло — сделан автоматический ход');
        this._apply(mv);
      }
    }
  }

  _pause(p) {
    // Пауза на время рекламы / сворачивания: замораживаем таймер (кроме онлайна)
    if (this.cfg.mode === 'online' || this.over) return;
    if (p && !this.paused) {
      this.paused = true;
      this.pausedLeft = this.deadline - Date.now();
    } else if (!p && this.paused) {
      this.paused = false;
      this.deadline = Date.now() + this.pausedLeft;
    }
  }

  // ---------- Ход партии ----------

  _beginTurn(remainingMs) {
    this.pendingWall = null;
    this.view.showGhost(null);
    this.deadline = Date.now() + (remainingMs ?? this.cfg.time * 1000);
    const g = this.game;
    if (this.cfg.mode === 'hotseat' && state.settings.rotateHotseat) this._rotateBoard(g.turn === 1);
    if (this.mode === 'wall' && (g.wallsLeft[g.turn] <= 0 || !this.isLocal(g.turn))) this.mode = 'move';
    this.view.pulseStrip(g.turn, true);
    this._refreshMarkers();
    this._updateHud();
    if (this.cfg.mode === 'bot' && g.turn === 1 && !this.over) {
      this.busy = true;
      this._updateHud();
      this.botTimer = setTimeout(() => {
        const mv = chooseBotMove(this.game, this.cfg.botLevel);
        this.busy = false;
        this._apply(mv);
      }, 550 + Math.random() * 450);
    }
  }

  _rotateBoard(flip) {
    const v = this.view;
    if (v.flipped === flip) return;
    const from = v.root.rotation.y;
    const to = flip ? Math.PI : 0;
    v.flipped = flip;
    v.tween(700, (k) => {
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      v.root.rotation.y = from + (to - from) * e;
    });
  }

  _refreshMarkers() {
    const g = this.game;
    if (this.myTurn && this.mode === 'move' && state.settings.hints) {
      this.view.showMoves(g.pawnMoves(g.turn), g.turn);
    } else {
      this.view.clearMoves();
    }
  }

  setMode(mode) {
    if (!this.myTurn) return;
    if (mode === 'wall' && this.game.wallsLeft[this.game.turn] <= 0) {
      toast('Стены закончились');
      sfx.error();
      return;
    }
    this.mode = mode;
    this.pendingWall = null;
    this.view.showGhost(null);
    this._refreshMarkers();
    this._updateHud();
    if (mode === 'wall' && this.view.hover) this._hover(this.view.hover);
  }

  rotateWall() {
    if (this.mode !== 'wall') return;
    this.view.orientation = this.view.orientation === 'h' ? 'v' : 'h';
    if (this.pendingWall) {
      this.pendingWall = { ...this.pendingWall, o: this.pendingWall.o === 'h' ? 'v' : 'h' };
      this.view.showGhost(this.pendingWall, this.game.canPlaceWall(this.pendingWall.x, this.pendingWall.y, this.pendingWall.o));
    } else if (this.view.hover?.wall) {
      const w = { ...this.view.hover.wall, o: this.view.orientation };
      this.view.showGhost(w, this.game.canPlaceWall(w.x, w.y, w.o));
    }
    sfx.click();
  }

  _hover(t) {
    const canvas = this.view.canvas;
    if (!this.myTurn || !t) {
      canvas.style.cursor = 'default';
      if (!this.pendingWall) this.view.showGhost(null);
      return;
    }
    if (this.mode === 'wall') {
      if (this.pendingWall) return; // на сенсорных экранах ждём подтверждения
      if (t.wall) this.view.showGhost(t.wall, this.game.canPlaceWall(t.wall.x, t.wall.y, t.wall.o));
      else this.view.showGhost(null);
      canvas.style.cursor = t.wall ? 'pointer' : 'default';
    } else {
      const ok = t.cell && this.game.canMovePawn(t.cell.x, t.cell.y);
      canvas.style.cursor = ok ? 'pointer' : 'default';
    }
  }

  _click(t, e) {
    if (!this.myTurn || !t) return;
    const g = this.game;
    if (this.mode === 'move') {
      if (t.cell && g.canMovePawn(t.cell.x, t.cell.y)) {
        this._submit({ type: 'move', x: t.cell.x, y: t.cell.y });
      } else if (t.onGroove && g.wallsLeft[g.turn] > 0 && t.wall && g.canPlaceWall(t.wall.x, t.wall.y, t.wall.o)) {
        // Клик по борозде в режиме фишки — подсказываем про стены
        this.setMode('wall');
        this._click(t, e);
      } else if (t.cell) {
        sfx.error();
      }
      return;
    }
    if (!t.wall) return;
    const touch = e?.pointerType === 'touch' || e?.pointerType === 'pen';
    const w = this.pendingWall && touch ? this._touchWall(t) : t.wall;
    const valid = g.canPlaceWall(w.x, w.y, w.o);
    if (touch) {
      // Касание: первое — предпросмотр, второе в то же место — установка
      const same = this.pendingWall && this.pendingWall.x === w.x && this.pendingWall.y === w.y && this.pendingWall.o === w.o;
      if (same && valid) {
        this._confirmWall();
        return;
      }
      this.pendingWall = w;
      this.view.showGhost(w, valid);
      this._updateHud();
      if (!valid) sfx.error();
      return;
    }
    if (valid) this._submit({ type: 'wall', ...w });
    else {
      sfx.error();
      toast(this._wallError(w), 'error');
    }
  }

  // При втором касании рядом с призраком — считаем, что это то же место
  _touchWall(t) {
    const p = this.pendingWall;
    if (Math.abs(t.wall.x - p.x) <= 0 && Math.abs(t.wall.y - p.y) <= 0) return p;
    return t.wall;
  }

  _wallError(w) {
    const g = this.game;
    if (!g.wallFits(w.x, w.y, w.o)) return 'Здесь стена не помещается';
    return 'Нельзя полностью перекрыть путь к финишу';
  }

  _confirmWall() {
    const w = this.pendingWall;
    if (!w) return;
    if (!this.game.canPlaceWall(w.x, w.y, w.o)) {
      sfx.error();
      toast(this._wallError(w), 'error');
      return;
    }
    this.pendingWall = null;
    this._submit({ type: 'wall', ...w });
  }

  _submit(move) {
    if (this.cfg.mode === 'online') {
      // Ждём подтверждения сервера
      this.busy = true;
      this.view.clearMoves();
      this.view.showGhost(null);
      this._updateHud();
      this.cfg.net.send({ t: 'action', move });
      clearTimeout(this._pendingTimer);
      this._pendingTimer = setTimeout(() => {
        if (this.busy) {
          this.busy = false;
          this._refreshMarkers();
          this._updateHud();
        }
      }, 4000);
      return;
    }
    this._apply(move);
  }

  async _apply(move, remaining) {
    const g = this.game;
    const player = g.turn;
    const jump = move.type === 'move' && Math.abs(move.x - g.pawns[player].x) + Math.abs(move.y - g.pawns[player].y) > 1;
    if (!g.play(move)) {
      sfx.error();
      return;
    }
    this.busy = true;
    this.view.clearMoves();
    this.view.showGhost(null);
    this.pendingWall = null;
    this._updateHud();
    if (move.type === 'move') {
      sfx.move();
      await this.view.movePawn(player, move.x, move.y, jump);
    } else {
      sfx.wall();
      this.view.addWall(move);
      await new Promise((r) => setTimeout(r, state.settings.animations ? 380 : 0));
    }
    this.busy = false;
    if (this.destroyed) return;
    if (g.winner !== -1) {
      if (this.cfg.mode !== 'online') this._finish(g.winner, 'goal');
      else this._updateHud();
      return;
    }
    this._beginTurn(remaining);
  }

  _canUndo() {
    const hist = this.game.history;
    if (this.cfg.mode === 'hotseat') return hist.length > 0;
    if (this.cfg.mode === 'bot') return hist.some((m) => m.player === 0);
    return false;
  }

  undo() {
    if (this.over || this.busy || !this._canUndo()) return;
    clearTimeout(this.botTimer);
    const g = this.game;
    if (this.cfg.mode === 'bot') {
      // Откатываем до хода человека включительно
      let last;
      do {
        last = g.undo();
      } while (last && last.player !== 0);
      this.usedUndo = true;
    } else {
      g.undo();
    }
    this.view.syncState(g);
    sfx.click();
    this._beginTurn();
  }

  confirmResign() {
    if (this.over) return;
    modal({
      title: 'Сдаться?',
      body: h('p', {}, 'Партия будет засчитана как поражение.'),
      buttons: [
        { label: 'Отмена', kind: 'ghost' },
        {
          label: 'Сдаться',
          kind: 'danger',
          onClick: () => {
            if (this.over) return;
            if (this.cfg.mode === 'online') this.cfg.net.send({ t: 'resign' });
            else {
              const loser = this.cfg.mode === 'hotseat' ? this.game.turn : 0;
              this._finish(1 - loser, 'resign');
            }
          },
        },
      ],
    });
  }

  confirmExit() {
    if (this.over) {
      this.exit();
      return;
    }
    modal({
      title: 'Выйти в меню?',
      body: h('p', {}, this.cfg.mode === 'hotseat' ? 'Текущая партия будет потеряна.' : 'Партия будет засчитана как поражение.'),
      buttons: [
        { label: 'Остаться', kind: 'ghost' },
        {
          label: 'Выйти',
          kind: 'danger',
          onClick: () => {
            if (this.cfg.mode === 'online') this.cfg.net.send({ t: 'resign' });
            else if (this.cfg.mode === 'bot') this._record(false);
            this.exit();
          },
        },
      ],
    });
  }

  exit() {
    this.destroyed = true;
    if (this.cfg.mode === 'online') this.cfg.net.close();
    this.destroy();
    this.onExit();
  }

  _onKey(e) {
    if (document.querySelector('.modal-wrap')) return;
    if (e.code === 'Space') {
      e.preventDefault();
      this.setMode(this.mode === 'move' ? 'wall' : 'move');
    } else if (e.code === 'KeyR') this.rotateWall();
    else if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) this.undo();
    else if (e.code === 'KeyU') this.undo();
    else if (e.code === 'Escape') this.confirmExit();
    else if (e.code === 'Enter') this._confirmWall();
  }

  // ---------- Онлайн ----------

  _bindNet() {
    const net = this.cfg.net;
    net.on('action', (msg) => {
      clearTimeout(this._pendingTimer);
      this.busy = false;
      if (msg.auto) toast(msg.by === this.cfg.you ? 'Время вышло — сделан автоматический ход' : 'У соперника вышло время');
      this._apply(msg.move, msg.remaining);
    });
    net.on('reject', (msg) => {
      clearTimeout(this._pendingTimer);
      this.busy = false;
      toast(msg.msg, 'error');
      this._refreshMarkers();
      this._updateHud();
    });
    net.on('error', (msg) => toast(msg.msg, 'error'));
    net.on('over', (msg) => {
      // Дождаться окончания анимации последнего хода
      const wait = () => (this.busy ? setTimeout(wait, 100) : this._finish(msg.winner, msg.reason));
      wait();
    });
    net.on('opponent_dropped', () => toast('Соперник потерял связь. Ждём переподключения…'));
    net.on('opponent_back', () => toast('Соперник вернулся', 'success'));
    net.on('opponent_left', () => {
      if (this.over) toast('Соперник покинул комнату');
    });
    net.on('emote', (msg) => this._showEmote(msg.id, false));
    net.on('rematch_offer', () => toast('Соперник предлагает реванш!', 'success'));
    net.on('start', (msg) => {
      // Реванш: новая партия в той же комнате
      this.destroyed = true;
      this.destroy();
      this.resultModal?.close();
      this.onRestart({ ...this.cfg, you: msg.you, names: msg.names, moves: msg.moves, remaining: msg.remaining });
    });
    net.on('disconnect', () => {
      if (!this.over) {
        toast('Соединение с сервером потеряно', 'error');
        this._finish(-1, 'disconnect');
      }
    });
  }

  // ---------- Конец партии ----------

  _record(win) {
    state.stats.played++;
    if (win) state.stats.wins++;
    save();
    if (win) platform.submitWins(state.stats.wins);
  }

  _finish(winner, reason) {
    if (this.over) return;
    this.over = true;
    clearTimeout(this.botTimer);
    this.game.winner = winner;
    this.view.clearMoves();
    this.view.showGhost(null);
    this.view.pulseStrip(0, false);
    this._updateHud();
    platform.gameplayStop();

    const mode = this.cfg.mode;
    let title;
    let sub;
    let win = false;
    let reward = 0;
    if (winner === -1) {
      title = 'Партия прервана';
      sub = 'Соединение потеряно';
    } else if (mode === 'hotseat') {
      win = true;
      title = `Победил ${this.names[winner]}!`;
      sub = reason === 'resign' ? 'Соперник сдался' : 'Фишка дошла до финиша';
      reward = REWARDS.hotseat;
    } else {
      const me = mode === 'online' ? this.cfg.you : 0;
      win = winner === me;
      title = win ? 'Победа!' : 'Поражение';
      const reasons = {
        goal: win ? 'Ваша фишка первой дошла до финиша' : 'Соперник первым дошёл до финиша',
        resign: win ? 'Соперник сдался' : 'Вы сдались',
        left: 'Соперник покинул игру',
        disconnect: 'Соперник отключился',
      };
      sub = reasons[reason] || '';
      reward = win ? (mode === 'bot' ? REWARDS.bot[this.cfg.botLevel] : REWARDS.online) : REWARDS.lose;
      if (win && this.usedUndo) reward = Math.round(reward / 2);
      this._record(win);
    }
    if (winner !== -1) {
      this.view.celebrate(winner);
      if (win) sfx.win();
      else sfx.lose();
    }
    if (reward) addCoins(reward);

    const rewardEl = reward
      ? h('div', { class: 'reward' }, '+', h('span', { class: 'amount' }, String(reward)), coinIcon())
      : null;
    const buttons = [];
    if (reward && platform.isYandex()) {
      buttons.push({
        label: 'x2 за рекламу',
        icon: 'video',
        kind: 'gold',
        close: false,
        onClick: async () => {
          const ok = await platform.showRewardedAd();
          if (ok) {
            addCoins(reward);
            sfx.coin();
            rewardEl.querySelector('.amount').textContent = String(reward * 2);
            toast(`+${reward} монет!`, 'success');
            this.resultModal.el.querySelector('.btn.gold')?.remove();
          }
        },
      });
    }
    buttons.push({ label: 'В меню', kind: 'ghost', onClick: () => this.exit() });
    if (winner !== -1 || mode !== 'online') {
      buttons.push({
        label: mode === 'online' ? 'Реванш' : 'Ещё раз',
        kind: 'primary',
        close: mode !== 'online',
        onClick: async () => {
          if (mode === 'online') {
            this.cfg.net.send({ t: 'rematch' });
            toast('Ждём ответа соперника…');
            return;
          }
          this.destroyed = true;
          this.destroy();
          await platform.showFullscreenAd();
          this.onRestart({ ...this.cfg, moves: [], remaining: undefined });
        },
      });
    }

    setTimeout(() => {
      this.resultModal = modal({
        cls: `result ${win || mode === 'hotseat' ? 'win' : 'lose'}`,
        closable: false,
        body: h(
          'div',
          {},
          h('span', { class: 'big-ic', html: icon(win ? 'trophy' : 'flag').innerHTML }),
          h('h2', {}, title),
          h('p', {}, sub),
          rewardEl,
        ),
        buttons,
      });
      if (reward) sfx.coin();
    }, winner === -1 ? 0 : 1100);
  }
}

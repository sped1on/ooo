// Партия в шахматы или шашки: связывает движок, 3D-доску, бота, онлайн и HUD.

import { Chess, sqName } from '../core/chess.js';
import { Checkers } from '../core/checkers.js';
import { chooseMove8, LEVELS8 } from '../core/ai8.js';
import { $, h, icon, coinIcon, modal, toast, formatTime } from './dom.js';
import { sfx } from '../audio.js';
import { state, save, addCoins, playerName } from '../state/store.js';
import * as platform from '../platform/yandex.js';
import { watchRewarded } from './ads.js';

const REWARDS = { bot: { easy: 20, medium: 40, hard: 80 }, online: 60, hotseat: 10, lose: 5 };
const EMOTES = ['👍', '😮', '😎', '🤝', '😅'];
export const GAME_TITLES = { chess: 'Шахматы', checkers: 'Шашки' };

export function createEngine(kind) {
  return kind === 'chess' ? new Chess() : new Checkers();
}

// Ход для передачи по сети / сохранения
export function packMove(kind, m) {
  if (kind === 'chess') return { from: m.from, to: m.to, promo: m.promo || undefined };
  return { from: m.from, to: m.to, path: m.path };
}

export class Match8 {
  constructor(cfg, deps) {
    this.cfg = cfg;
    this.kind = cfg.game;
    this.view = deps.view;
    this.onExit = deps.onExit;
    this.onRestart = deps.onRestart;
    this.game = createEngine(this.kind);
    for (const mv of cfg.moves || []) this.game.play(mv);
    this.selected = null;
    this.busy = false;
    this.over = false;
    this.clocks = cfg.clocks ? cfg.clocks.slice() : [cfg.time * 1000, cfg.time * 1000];
    this.turnStart = Date.now();
    this.bottomSeat = cfg.mode === 'online' ? cfg.you : 0;
    this.names = this._names();
    this.last = null;
    this._keys = (e) => {
      if (document.querySelector('.modal-wrap')) return;
      if (e.code === 'Escape') this.confirmExit();
      else if ((e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) || e.code === 'KeyU') this.undo();
    };
    this._unsubPause = platform.onPause((p) => this._pause(p));
  }

  _names() {
    const c = this.cfg;
    const white = this.kind === 'chess' ? 'Белые' : 'Белые';
    if (c.mode === 'bot') return [playerName(), `Бот · ${LEVELS8[c.botLevel].name}`];
    if (c.mode === 'hotseat') return [white, 'Чёрные'];
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
    v.setKind(this.kind);
    v.mount($('#game-stage'), { interactive: true, sway: false });
    v.setTilt(state.settings.tilt);
    v.animations = state.settings.animations;
    v.setPadding(() => {
      const stage = $('#game-stage').getBoundingClientRect();
      const top = $('.hud-top').getBoundingClientRect().bottom - stage.top;
      const bottom = stage.bottom - $('#action-bar').getBoundingClientRect().top;
      return { top: Math.max(0, top + 4), bottom: Math.max(0, bottom + 4) };
    });
    v.clearPieces();
    v.syncPieces(this.game);
    v.setFlipped(this.bottomSeat === 1);
    v.on('click', (t) => this._click(t));
    v.on('hover', (t) => {
      const ok = t && this.myTurn && this._clickable(t.sq);
      v.canvas.style.cursor = ok ? 'pointer' : 'default';
    });
    v.on('rotate', null);
    v.start();
    document.addEventListener('keydown', this._keys);
    this._buildHud();
    v._resize();
    if (this.cfg.mode === 'online') this._bindNet();
    platform.gameplayStart();
    sfx.start();
    this._beginTurn();
    this.timerInt = setInterval(() => this._tick(), 200);
  }

  destroy() {
    clearTimeout(this.botTimer);
    clearInterval(this.timerInt);
    document.removeEventListener('keydown', this._keys);
    this._unsubPause();
    ['click', 'hover', 'rotate'].forEach((e) => this.view.on(e, null));
    this.view.clearOverlays();
    this.view.setPadding(null);
    platform.gameplayStop();
  }

  // ---------- HUD ----------

  _buildHud() {
    const seats = [this.bottomSeat, 1 - this.bottomSeat];
    seats.forEach((seat, i) => {
      const card = $(`#card-${i}`);
      card.className = `player-card side${seat}${i ? ' right' : ''}`;
      card.innerHTML = '';
      const ring = `<svg class="ring" viewBox="0 0 56 56"><circle cx="28" cy="28" r="25" stroke="rgba(255,255,255,.12)"/><circle class="prog" cx="28" cy="28" r="25" stroke="${seat ? '#9aa4b8' : '#ffe2a8'}" stroke-dasharray="157" stroke-dashoffset="0"/></svg>`;
      const who = this.cfg.mode === 'bot' && seat === 1 ? 'robot' : 'user';
      card.append(
        h('div', { class: 'avatar', html: ring }, icon(who)),
        h('div', { class: 'pc-info' }, h('div', { class: 'pc-name' }, this.names[seat]), h('div', { class: 'pc-sub' })),
        h('div', { class: 'pc-time' }, formatTime(this.clocks[seat] / 1000)),
      );
      card.dataset.seat = seat;
    });
    const bar = $('#action-bar');
    bar.innerHTML = '';
    const btn = (id, ic, label, onClick, cls = 'ghost') =>
      h('button', { class: `btn ${cls}`, id, title: label, onclick: () => { sfx.click(); onClick(); } }, icon(ic), h('span', { class: 'lbl' }, label));
    this.btnUndo = btn('act-undo', 'undo', 'Отменить', () => this.undo());
    this.btnHint = btn('act-hint', 'eye', 'Подсказка', () => this.hint());
    if (this.cfg.mode !== 'online') bar.append(this.btnUndo, this.btnHint);
    bar.append(btn('act-resign', 'flag', 'Сдаться', () => this.confirmResign()), btn('act-menu', 'menu', 'Меню', () => this.confirmExit()));
    const em = $('#emotes');
    em.innerHTML = '';
    if (this.cfg.mode === 'online') {
      for (const e of EMOTES) em.append(h('button', { onclick: () => { this.cfg.net.send({ t: 'emote', id: e }); this._showEmote(e, true); } }, e));
    }
    this._updateHud();
  }

  _showEmote(e, mine) {
    const el = $('#float-emote');
    el.textContent = e;
    el.className = `float-emote${mine ? ' mine' : ''}`;
    void el.offsetWidth;
    el.classList.add('show');
  }

  _material(seat) {
    // Счёт снятых фигур: для шашек — сколько осталось
    if (this.kind === 'checkers') {
      const mine = this.game.pieces().filter((p) => p.color === seat);
      const kings = mine.filter((p) => p.type === 'king').length;
      return `Шашек: ${mine.length}${kings ? ` · дамок: ${kings}` : ''}`;
    }
    const vals = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    let a = 0;
    let b = 0;
    for (const p of this.game.pieces()) (p.color === seat ? (a += vals[p.type]) : (b += vals[p.type]));
    const d = a - b;
    return `${seat ? 'Чёрные' : 'Белые'}${d > 0 ? ` · +${d}` : ''}`;
  }

  _updateHud() {
    const g = this.game;
    for (let i = 0; i < 2; i++) {
      const card = $(`#card-${i}`);
      const seat = Number(card.dataset.seat);
      card.classList.toggle('active', g.turn === seat && !this.over);
      card.querySelector('.pc-sub').textContent = this._material(seat);
    }
    const banner = $('#turn-banner');
    if (this.over) {
      banner.textContent = 'Партия окончена';
      banner.className = 'turn-banner';
    } else {
      const t = g.turn;
      let text = this.cfg.mode === 'hotseat' ? `Ход: ${this.names[t]}` : this.isLocal(t) ? 'Ваш ход' : this.cfg.mode === 'bot' ? 'Бот думает…' : 'Ход соперника';
      if (this.kind === 'chess' && g.inCheck()) text += ' · Шах!';
      banner.textContent = text;
      banner.className = `turn-banner side${t}`;
    }
    if (this.btnUndo) {
      this.btnUndo.disabled = this.over || this.busy || !this._canUndo();
      this.btnHint.disabled = !this.myTurn;
    }
  }

  // ---------- Часы ----------

  _left(seat) {
    if (seat !== this.game.turn || this.over || this.paused) return this.clocks[seat];
    return Math.max(0, this.clocks[seat] - (Date.now() - this.turnStart));
  }

  _tick() {
    if (this.over) return;
    const total = this.cfg.time * 1000;
    for (let i = 0; i < 2; i++) {
      const card = $(`#card-${i}`);
      const seat = Number(card.dataset.seat);
      const left = this._left(seat);
      const el = card.querySelector('.pc-time');
      el.textContent = formatTime(left / 1000);
      el.classList.toggle('low', left <= 10_000 && seat === this.game.turn);
      card.querySelector('.prog').setAttribute('stroke-dashoffset', String(157 * (1 - Math.max(0, Math.min(1, left / total)))));
    }
    if (this.paused) return;
    const turn = this.game.turn;
    const left = this._left(turn) / 1000;
    const whole = Math.ceil(left);
    if (whole <= 5 && whole > 0 && whole !== this._lastTick && this.isLocal(turn)) sfx.tick();
    this._lastTick = whole;
    if (left <= 0 && this.cfg.mode !== 'online') {
      clearTimeout(this.botTimer);
      this.clocks[turn] = 0;
      this._finish(1 - turn, 'timeout');
    }
  }

  _pause(p) {
    if (this.cfg.mode === 'online' || this.over) return;
    if (p && !this.paused) {
      this.clocks[this.game.turn] = this._left(this.game.turn);
      this.paused = true;
    } else if (!p && this.paused) {
      this.paused = false;
      this.turnStart = Date.now();
    }
  }

  // ---------- Ходы ----------

  _beginTurn() {
    if (this.cfg.mode !== 'online') this.turnStart = Date.now();
    const g = this.game;
    if (this.cfg.mode === 'hotseat' && state.settings.rotateHotseat) this.view.setFlipped(g.turn === 1);
    this.selected = null;
    this._refresh();
    this._updateHud();
    const res = g.result();
    if (res) {
      if (this.cfg.mode !== 'online') this._finish(res.winner, res.reason);
      return;
    }
    if (this.cfg.mode === 'bot' && g.turn === 1 && !this.over) {
      this.busy = true;
      this._updateHud();
      this.botTimer = setTimeout(() => {
        const mv = chooseMove8(this.game, this.kind, this.cfg.botLevel);
        this.busy = false;
        if (mv) this._apply(packMove(this.kind, mv));
      }, 300 + Math.random() * 300);
    }
  }

  _movesFrom(sq) {
    return this.game.legalMoves().filter((m) => m.from === sq);
  }

  _clickable(sq) {
    const p = this.game.pieceAt(sq);
    if (p && p.color === this.game.turn && this._movesFrom(sq).length) return true;
    return this.selected !== null && this._movesFrom(this.selected).some((m) => m.to === sq);
  }

  _refresh(hintSq = null) {
    const g = this.game;
    const targets = this.selected !== null && state.settings.hints !== false
      ? this._movesFrom(this.selected).map((m) => ({ sq: m.to, capture: this.kind === 'chess' ? !!m.capture : m.captures.length > 0 }))
      : [];
    const check = this.kind === 'chess' && g.inCheck() ? g.kingSq(g.side) : null;
    this.view.highlight({ last: this.last, selected: this.selected, targets, check, hint: hintSq });
  }

  _click(t) {
    if (!this.myTurn || !t) return;
    const sq = t.sq;
    const p = this.game.pieceAt(sq);
    if (this.selected !== null) {
      const cands = this._movesFrom(this.selected).filter((m) => m.to === sq);
      if (cands.length) {
        if (this.kind === 'chess' && cands.some((m) => m.promo)) {
          this._askPromotion(this.selected, sq);
          return;
        }
        const m = this.kind === 'checkers' ? cands.sort((a, b) => b.captures.length - a.captures.length)[0] : cands[0];
        this._submit(packMove(this.kind, m));
        return;
      }
    }
    if (p && p.color === this.game.turn) {
      const moves = this._movesFrom(sq);
      if (!moves.length) {
        sfx.error();
        if (this.kind === 'checkers' && this.game.legalMoves().some((m) => m.captures.length)) toast('Бить обязательно — выберите шашку, которая может бить');
        this.selected = null;
      } else {
        sfx.click();
        this.selected = sq;
      }
      this._refresh();
      return;
    }
    this.selected = null;
    this._refresh();
  }

  _askPromotion(from, to) {
    const names = { q: 'Ферзь', r: 'Ладья', b: 'Слон', n: 'Конь' };
    const m = modal({
      title: 'Превращение пешки',
      body: h('div', { class: 'option-list' }, ...Object.entries(names).map(([k, name]) => h('button', { class: 'option', onclick: () => { m.close(); this._submit({ from, to, promo: k }); } }, h('b', {}, name)))),
    });
  }

  _submit(move) {
    this.selected = null;
    if (this.cfg.mode === 'online') {
      this.busy = true;
      this.view.clearOverlays();
      this._updateHud();
      this.cfg.net.send({ t: 'action', move });
      clearTimeout(this._pendingTimer);
      this._pendingTimer = setTimeout(() => {
        if (this.busy) {
          this.busy = false;
          this._refresh();
          this._updateHud();
        }
      }, 4000);
      return;
    }
    this._apply(move);
  }

  async _apply(move, clocks) {
    const g = this.game;
    const player = g.turn;
    const full = g.findMove(move);
    if (!full) {
      sfx.error();
      return;
    }
    if (clocks) {
      this.clocks = clocks.slice();
      this.turnStart = Date.now();
    } else if (!this.paused) {
      this.clocks[player] = this._left(player);
      this.turnStart = Date.now();
    }
    g.play(move);
    this.busy = true;
    this.last = [full.from, full.to];
    this.view.clearOverlays();
    this._updateHud();
    const opts = { after: g };
    if (this.kind === 'chess') {
      const captures = full.capture ? [full.ep ? full.to + (player === 0 ? 8 : -8) : full.to] : [];
      opts.captures = captures;
      opts.hop = g.board[full.to].toLowerCase() === 'n' || !!full.capture;
      if (full.castle === 'k') opts.extra = [[full.from + 3, full.from + 1]];
      if (full.castle === 'q') opts.extra = [[full.from - 4, full.from - 1]];
      // Взятие: сначала убираем жертву, чтобы фигура встала на её место
    } else {
      opts.path = full.path;
      opts.captures = full.captures;
    }
    if (full.capture || full.captures?.length) sfx.wall();
    else sfx.move();
    await this.view.animateMove(full.from, full.to, opts);
    this.busy = false;
    if (this.destroyed) return;
    if (this.kind === 'chess' && g.inCheck() && !g.result()) toast('Шах!');
    this._beginTurn();
  }

  _canUndo() {
    const hist = this.game.history;
    if (this.cfg.mode === 'hotseat') return hist.length > 0;
    if (this.cfg.mode === 'bot') return hist.length >= (this.game.turn === 0 ? 2 : 1);
    return false;
  }

  undo() {
    if (this.over || this.busy || !this._canUndo()) return;
    clearTimeout(this.botTimer);
    const g = this.game;
    g.undo();
    if (this.cfg.mode === 'bot' && g.turn === 1) g.undo();
    this.usedUndo = this.cfg.mode === 'bot';
    this.last = null;
    this.view.syncPieces(g);
    sfx.click();
    this._beginTurn();
  }

  hint() {
    if (!this.myTurn) return;
    const mv = chooseMove8(this.game, this.kind, 'hard');
    if (!mv) return;
    this.usedUndo = true;
    this.selected = mv.from;
    this._refresh(mv.to);
    toast(`Подсказка: ${sqName(mv.from)} → ${sqName(mv.to)}`);
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
            else this._finish(1 - (this.cfg.mode === 'hotseat' ? this.game.turn : 0), 'resign');
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

  // ---------- Онлайн ----------

  _bindNet() {
    const net = this.cfg.net;
    net.on('action', (msg) => {
      clearTimeout(this._pendingTimer);
      this.busy = false;
      this._apply(msg.move, msg.clocks);
    });
    net.on('reject', (msg) => {
      clearTimeout(this._pendingTimer);
      this.busy = false;
      toast(msg.msg, 'error');
      this._refresh();
      this._updateHud();
    });
    net.on('error', (msg) => toast(msg.msg, 'error'));
    net.on('over', (msg) => {
      if (msg.clocks) this.clocks = msg.clocks.slice();
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
      this.destroyed = true;
      this.destroy();
      this.resultModal?.close();
      this.onRestart({ ...this.cfg, you: msg.you, names: msg.names, moves: msg.moves, clocks: msg.clocks });
    });
    net.on('disconnect', () => {
      if (!this.over) {
        toast('Соединение с сервером потеряно', 'error');
        this._finish(-2, 'disconnect');
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
    this.view.clearOverlays();
    this._updateHud();
    platform.gameplayStop();
    const mode = this.cfg.mode;
    const reasons = {
      mate: 'Мат!',
      stalemate: 'Пат — ничья',
      fifty: 'Ничья: 50 ходов без взятий',
      material: 'Ничья: недостаточно материала',
      repetition: 'Ничья: троекратное повторение',
      nopieces: 'Шашки соперника закончились',
      blocked: 'У соперника не осталось ходов',
      draw: 'Ничья: долго не было взятий',
      resign: 'Соперник сдался',
      timeout: 'Время вышло',
      left: 'Соперник покинул игру',
      disconnect: 'Соединение потеряно',
    };
    let title;
    let win = false;
    let reward = 0;
    const sub = reasons[reason] || '';
    if (winner === -2) title = 'Партия прервана';
    else if (winner === -1) {
      title = 'Ничья';
      reward = mode === 'hotseat' ? 0 : 10;
      if (mode !== 'hotseat') this._record(false);
    } else if (mode === 'hotseat') {
      win = true;
      title = `Победили ${winner === 0 ? 'белые' : 'чёрные'}!`;
      reward = REWARDS.hotseat;
    } else {
      const me = mode === 'online' ? this.cfg.you : 0;
      win = winner === me;
      title = win ? 'Победа!' : 'Поражение';
      reward = win ? (mode === 'bot' ? REWARDS.bot[this.cfg.botLevel] : REWARDS.online) : REWARDS.lose;
      if (win && this.usedUndo) reward = Math.round(reward / 2);
      this._record(win);
    }
    if (winner >= 0) {
      const king = this.game.pieces().find((p) => p.color === winner && (p.type === 'k' || p.type === 'king'));
      if (king) this.view.celebrateAt(king.sq, winner);
      if (win) sfx.win();
      else sfx.lose();
    }
    if (reward) addCoins(reward);
    const rewardEl = reward ? h('div', { class: 'reward' }, '+', h('span', { class: 'amount' }, String(reward)), coinIcon()) : null;
    const buttons = [];
    if (reward) {
      buttons.push({
        label: 'x2 за рекламу',
        icon: 'video',
        kind: 'gold',
        close: false,
        onClick: async () => {
          if (await watchRewarded()) {
            addCoins(reward);
            sfx.coin();
            rewardEl.querySelector('.amount').textContent = String(reward * 2);
            this.resultModal.el.querySelector('.btn.gold')?.remove();
          }
        },
      });
    }
    buttons.push({ label: 'В меню', kind: 'ghost', onClick: () => this.exit() });
    if (winner !== -2 || mode !== 'online') {
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
          this.onRestart({ ...this.cfg, moves: [], clocks: undefined });
        },
      });
    }
    setTimeout(() => {
      this.resultModal = modal({
        cls: `result ${win || winner === -1 ? 'win' : 'lose'}`,
        closable: false,
        body: h('div', {}, h('span', { class: 'big-ic', html: icon(win ? 'trophy' : 'flag').innerHTML }), h('h2', {}, title), h('p', {}, sub), rewardEl),
        buttons,
      });
      if (reward) sfx.coin();
    }, winner < 0 ? 300 : 1100);
  }
}

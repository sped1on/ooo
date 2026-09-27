// Прохождение одного упражнения: задача, доска, проверка решения, награда.

import { makeLesson, koridorBoard, lessonReward, TRACKS, MAX_LEVEL, bestWallGain } from '../core/lessons.js';
import { Chess, sqName } from '../core/chess.js';
import { Checkers } from '../core/checkers.js';
import { chooseMove8, mateIn } from '../core/ai8.js';
import { $, h, icon, coinIcon, modal, toast } from './dom.js';
import { sfx } from '../audio.js';
import { state, save, addCoins } from '../state/store.js';
import * as platform from '../platform/yandex.js';

export function lessonProgress(game, track) {
  state.lessons ||= {};
  state.lessons[game] ||= { novice: 1, skilled: 1 };
  return state.lessons[game][track] || 1;
}

export class LessonRun {
  constructor({ game, track, level }, deps) {
    this.gameKind = game;
    this.track = track;
    this.level = level;
    this.deps = deps;
    this.lesson = makeLesson(game, track, level);
    this.done = false;
    this.moves = 0;
    this._keys = (e) => {
      if (document.querySelector('.modal-wrap')) return;
      if (e.code === 'Escape') this.exit();
      if (e.code === 'KeyR' && this.gameKind === 'koridor') this.rotate();
    };
  }

  get view() {
    return this.gameKind === 'koridor' ? this.deps.view : this.deps.view8;
  }

  start() {
    const L = this.lesson;
    const v = this.view;
    const other = v === this.deps.view ? this.deps.view8 : this.deps.view;
    other.stop();
    other.canvas.remove();
    if (this.gameKind === 'koridor') {
      this.g = koridorBoard(L.n, L.me, L.opp, L.walls);
      if (L.type === 'wall') this.g.wallsLeft = [L.place, 0];
      v.setSkins({ mySeat: 0, pawnsOpp: 'c-player', wallsOpp: null });
      v.setSize(0);
      v.syncState(this.g);
    } else if (this.gameKind === 'chess') {
      this.g = new Chess(L.fen);
      v.setKind('chess');
      v.setSkins8({ pieces: state.equipped.chessPieces });
      v.clearPieces();
      v.syncPieces(this.g);
      this.stars = L.stars ? L.stars.slice() : [];
      this.hero = L.hero;
    } else {
      this.g = new Checkers(L.setup);
      v.setKind('checkers');
      v.setSkins8({ pieces: state.equipped.checkersPieces });
      v.clearPieces();
      v.syncPieces(this.g);
    }
    v.mount($('#game-stage'), { interactive: true, sway: false });
    v.setTilt(state.settings.tilt);
    v.setFlipped(false);
    v.animations = state.settings.animations;
    v.setPadding(() => {
      const stage = $('#game-stage').getBoundingClientRect();
      const top = $('#lesson-task').getBoundingClientRect().bottom - stage.top;
      const bottom = stage.bottom - $('#action-bar').getBoundingClientRect().top;
      return { top: Math.max(0, top + 6), bottom: Math.max(0, bottom + 4) };
    });
    v.on('click', (t, e) => this._click(t, e));
    v.on('hover', (t) => this._hover(t));
    v.on('rotate', () => this.rotate());
    v.start();
    document.addEventListener('keydown', this._keys);
    $('#screen-game').classList.add('lesson-mode');
    this._buildHud();
    v._resize();
    this._refresh();
    if (L.explain) {
      modal({ title: L.title, body: h('p', {}, L.explain), buttons: [{ label: 'Понятно', kind: 'primary' }] });
    }
  }

  destroy() {
    document.removeEventListener('keydown', this._keys);
    ['click', 'hover', 'rotate'].forEach((e) => this.view.on(e, null));
    $('#screen-game').classList.remove('lesson-mode');
    this.view.setPadding(null);
    if (this.gameKind === 'koridor') {
      this.view.clearMoves();
      this.view.showGhost(null);
    } else this.view.clearOverlays();
  }

  exit() {
    this.destroy();
    this.deps.onExit();
  }

  restart() {
    this.destroy();
    this.deps.onPlay({ game: this.gameKind, track: this.track, level: this.level });
  }

  _buildHud() {
    const L = this.lesson;
    $('#lesson-task').innerHTML = '';
    $('#lesson-task').append(
      h('div', { class: 'lt-head' }, h('b', {}, `Уровень ${this.level}`), h('span', {}, ` · ${TRACKS[this.track]} · ${L.title || ''}`)),
      h('div', { class: 'lt-text' }, L.text),
      h('div', { class: 'lt-status', id: 'lesson-status' }),
    );
    const bar = $('#action-bar');
    bar.innerHTML = '';
    const btn = (ic, label, fn, cls = 'ghost') => h('button', { class: `btn ${cls}`, onclick: () => { sfx.click(); fn(); } }, icon(ic), h('span', { class: 'lbl' }, label));
    if (this.gameKind === 'koridor' && L.type === 'wall') bar.append(btn('rotate', 'Повернуть', () => this.rotate()));
    bar.append(btn('undo', 'Заново', () => this.restart()), btn('eye', 'Подсказка', () => this.hint()), btn('menu', 'Меню', () => this.exit()));
    $('#emotes').innerHTML = '';
    this._status();
  }

  _status() {
    const L = this.lesson;
    let text = '';
    if (L.maxMoves) text = `Ходов: ${this.moves} / ${L.maxMoves}`;
    if (this.gameKind === 'koridor' && L.type === 'wall') text = `Путь красной фишки: ${this.g.distance(1)} · цель ${L.target} · стен осталось ${this.g.wallsLeft[0]}`;
    if (this.gameKind === 'chess' && L.type === 'stars') text = `Звёзд осталось: ${this.stars.length} · ходов ${this.moves} / ${L.maxMoves}`;
    if (this.gameKind === 'chess' && L.type === 'mate') text = `Мат в ${L.depth} · ваш ход ${Math.min(L.depth, this.moves + 1)} из ${L.depth}`;
    $('#lesson-status').textContent = text;
  }

  // ---------- Отрисовка подсказок ----------

  _refresh(hint = null) {
    const L = this.lesson;
    if (this.gameKind === 'koridor') {
      if (L.type === 'reach' && !this.done) this.view.showMoves(this.g.pawnMoves(0), 0);
      else this.view.clearMoves();
      return;
    }
    const targets = this.selected != null ? this._targets(this.selected) : [];
    const goals = L.target != null ? [L.target] : [];
    const check = this.gameKind === 'chess' && L.type === 'mate' && this.g.inCheck() ? this.g.kingSq(this.g.side) : null;
    this.view.highlight({ last: this.last, selected: this.selected, targets, stars: this.stars || [], goals, check, hint });
  }

  _targets(sq) {
    return this._movesFrom(sq).map((m) => ({ sq: m.to, capture: this.gameKind === 'chess' ? !!m.capture : m.captures.length > 0 }));
  }

  _movesFrom(sq) {
    const L = this.lesson;
    if (this.gameKind === 'chess' && L.type === 'stars') {
      if (sq !== this.hero) return [];
      this.g.side = 'w';
      return this.g._pseudo().filter((m) => m.from === sq);
    }
    return this.g.legalMoves().filter((m) => m.from === sq);
  }

  // ---------- Ввод ----------

  _hover(t) {
    if (this.done || this.busy || !t) return;
    const L = this.lesson;
    if (this.gameKind === 'koridor') {
      if (L.type === 'wall' && t.wall && this.g.wallsLeft[0] > 0) this.view.showGhost(t.wall, this.g.canPlaceWall(t.wall.x, t.wall.y, t.wall.o, 0));
      else this.view.showGhost(null);
    }
  }

  rotate() {
    if (this.gameKind !== 'koridor') return;
    this.view.orientation = this.view.orientation === 'h' ? 'v' : 'h';
    if (this.view.hover) this._hover(this.view.hover);
  }

  _click(t, e) {
    if (this.done || this.busy || !t) return;
    if (this.gameKind === 'koridor') this._clickKoridor(t, e);
    else this._click8(t.sq);
  }

  async _clickKoridor(t) {
    const L = this.lesson;
    const g = this.g;
    if (L.type === 'reach') {
      if (!t.cell) return;
      const mv = g.pawnMoves(0).find((m) => m.x === t.cell.x && m.y === t.cell.y);
      if (!mv) {
        sfx.error();
        return;
      }
      this.busy = true;
      this.view.clearMoves();
      sfx.move();
      g.pawns[0] = { x: mv.x, y: mv.y };
      await this.view.movePawn(0, mv.x, mv.y, mv.jump);
      this.busy = false;
      this.moves++;
      this._status();
      if (mv.y === g.goalRow(0)) this._success();
      else if (this.moves >= L.maxMoves) this._fail('Ходы закончились, а финиш ещё не достигнут.');
      else this._refresh();
      return;
    }
    if (!t.wall || g.wallsLeft[0] <= 0) return;
    const w = t.wall;
    if (!g.canPlaceWall(w.x, w.y, w.o, 0)) {
      sfx.error();
      toast(g.wallFits(w.x, w.y, w.o) ? 'Нельзя полностью перекрыть путь' : 'Здесь стена не помещается', 'error');
      return;
    }
    g.turn = 0;
    g.play({ type: 'wall', ...w });
    g.turn = 0;
    sfx.wall();
    this.view.showGhost(null);
    this.view.addWall({ ...w, player: 0 });
    this._status();
    if (g.wallsLeft[0] === 0) {
      const d = g.distance(1);
      setTimeout(() => (d >= L.target ? this._success() : this._fail(`Путь вырос до ${d}, а нужно ${L.target}. Попробуйте другое место.`)), 600);
    }
  }

  async _click8(sq) {
    const L = this.lesson;
    const g = this.g;
    if (this.selected != null) {
      const cands = this._movesFrom(this.selected).filter((m) => m.to === sq);
      if (cands.length) {
        const m = this.gameKind === 'checkers' ? cands.sort((a, b) => b.captures.length - a.captures.length)[0] : cands.find((c) => !c.promo || c.promo === 'q');
        this.selected = null;
        await this._play8(m);
        return;
      }
    }
    const p = g.pieceAt(sq);
    const mine = p && p.color === 0 && this._movesFrom(sq).length;
    if (mine) {
      this.selected = sq;
      sfx.click();
    } else {
      if (p && p.color === 0) {
        sfx.error();
        if (this.gameKind === 'checkers' && g.legalMoves().some((m) => m.captures.length)) toast('Бить обязательно — выберите шашку, которая может бить');
      }
      this.selected = null;
    }
    this._refresh();
  }

  async _play8(m) {
    const L = this.lesson;
    const g = this.g;
    this.busy = true;
    this.last = [m.from, m.to];
    if (this.gameKind === 'chess' && L.type === 'stars') {
      g.side = 'w';
      g._make(m);
      g.side = 'w';
      this.hero = m.to;
      sfx.move();
      await this.view.animateMove(m.from, m.to, { hop: g.board[m.to] === 'N', after: g });
      this.moves++;
      if (this.stars.includes(m.to)) {
        this.stars = this.stars.filter((s) => s !== m.to);
        sfx.coin();
      }
      this.busy = false;
      this._status();
      if (!this.stars.length) this._success();
      else if (this.moves >= L.maxMoves) this._fail('Ходы закончились. Постарайтесь найти путь короче.');
      else this._refresh();
      return;
    }
    if (this.gameKind === 'chess') {
      g.play({ from: m.from, to: m.to, promo: m.promo });
      sfx.move();
      await this.view.animateMove(m.from, m.to, { captures: m.capture ? [m.to] : [], after: g });
      this.moves++;
      this._status();
      const res = g.result();
      if (res?.reason === 'mate') {
        this.busy = false;
        this._refresh();
        this._success();
        return;
      }
      if (this.moves >= L.depth) {
        this.busy = false;
        this._refresh();
        this._fail(res?.reason === 'stalemate' ? 'Это пат — ничья, а нужен мат.' : 'Мата нет. Попробуйте другой ход.');
        return;
      }
      // Чёрные защищаются: выбираем ответ, после которого нет мата в 1
      await new Promise((r) => setTimeout(r, 350));
      const replies = g._legal();
      let reply = replies.find((r) => {
        g.push(r);
        const ok = !mateIn(g, 1);
        g.pop();
        return ok;
      });
      if (!reply) reply = chooseMove8(g, 'chess', 'hard');
      g.play({ from: reply.from, to: reply.to, promo: reply.promo });
      this.last = [reply.from, reply.to];
      await this.view.animateMove(reply.from, reply.to, { captures: reply.capture ? [reply.to] : [], after: g });
      this.busy = false;
      this._refresh();
      this._status();
      return;
    }
    // Шашки
    g.play({ from: m.from, to: m.to, path: m.path });
    g.turn = 0;
    if (m.captures.length) sfx.wall();
    else sfx.move();
    await this.view.animateMove(m.from, m.to, { path: m.path, captures: m.captures, after: g });
    this.busy = false;
    this.moves++;
    this._status();
    if (L.type === 'capture') {
      if (m.captures.length >= L.need) this._success();
      else this._fail(`Забрано ${m.captures.length}, а можно ${L.need}. Поищите удар длиннее.`);
      return;
    }
    if (m.to === L.target || (L.target >> 3 === 0 && g.pieceAt(m.to)?.type === 'king')) this._success();
    else if (this.moves >= L.maxMoves) this._fail('Ходы закончились.');
    else this._refresh();
  }

  // ---------- Подсказка ----------

  hint() {
    if (this.done || this.busy) return;
    const L = this.lesson;
    const g = this.g;
    if (this.gameKind === 'koridor') {
      if (L.type === 'reach') {
        const path = g.shortestPath(0);
        if (path?.length) toast(`Следующий шаг: подсвеченная клетка`);
        if (path?.length) this.view.showMoves([path[0]], 0);
      } else {
        // Лучшая стена первой
        let best = null;
        let bestD = -1;
        for (const w of g.legalWalls(0)) {
          g.play(w);
          g.turn = 0;
          const d = L.place > 1 ? bestWallGain(g, 1).best : g.distance(1);
          g.undo();
          g.turn = 0;
          if (d > bestD) {
            bestD = d;
            best = w;
          }
        }
        if (best) this.view.showGhost(best, true);
        toast('Подсказка: зелёная стена');
      }
      return;
    }
    if (this.gameKind === 'chess' && L.type === 'mate') {
      const m = mateIn(g.clone(), L.depth - this.moves);
      if (m) {
        this.selected = m.from;
        this._refresh(m.to);
        toast(`Подсказка: ${sqName(m.from)} → ${sqName(m.to)}`);
      }
      return;
    }
    if (this.gameKind === 'checkers') {
      const moves = g.legalMoves().sort((a, b) => b.captures.length - a.captures.length);
      if (moves[0]) {
        this.selected = moves[0].from;
        this._refresh(moves[0].to);
      }
      return;
    }
    // Звёзды: подсвечиваем фигуру
    this.selected = this.hero;
    this._refresh();
  }

  // ---------- Итог ----------

  _success() {
    if (this.done) return;
    this.done = true;
    sfx.win();
    const prog = state.lessons[this.gameKind];
    const first = prog[this.track] <= this.level;
    const reward = first ? lessonReward(this.level) : 0;
    if (first) prog[this.track] = Math.min(MAX_LEVEL, this.level + 1);
    save();
    if (reward) addCoins(reward);
    const next = Math.min(MAX_LEVEL, this.level + 1);
    setTimeout(() => {
      modal({
        cls: 'result win',
        closable: false,
        body: h('div', {}, h('span', { class: 'big-ic', html: icon('star').innerHTML }), h('h2', {}, 'Уровень пройден!'), h('p', {}, `Уровень ${this.level} · ${TRACKS[this.track]}`), reward ? h('div', { class: 'reward' }, '+', String(reward), coinIcon()) : null),
        buttons: [
          { label: 'К упражнениям', kind: 'ghost', onClick: () => this.exit() },
          {
            label: 'Дальше',
            kind: 'primary',
            onClick: async () => {
              this.destroy();
              if (this.level % 5 === 0) await platform.showFullscreenAd();
              this.deps.onPlay({ game: this.gameKind, track: this.track, level: next });
            },
          },
        ],
      });
      if (reward) sfx.coin();
    }, 500);
  }

  _fail(text) {
    if (this.done) return;
    this.done = true;
    sfx.lose();
    setTimeout(() => {
      modal({
        cls: 'result lose',
        closable: false,
        body: h('div', {}, h('span', { class: 'big-ic', html: icon('flag').innerHTML }), h('h2', {}, 'Почти!'), h('p', {}, text)),
        buttons: [
          { label: 'К упражнениям', kind: 'ghost', onClick: () => this.exit() },
          { label: 'Ещё раз', kind: 'primary', onClick: () => this.restart() },
        ],
      });
    }, 400);
  }
}

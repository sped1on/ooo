// Русские шашки: доска 8×8, играют на тёмных полях. Простые шашки ходят
// вперёд по диагонали, бьют во все стороны; бить обязательно, взятие
// продолжается до конца; дамка ходит и бьёт на любое расстояние.
// Шашка, дошедшая до последнего ряда во время взятия, продолжает бить как дамка.
// Сбитые шашки снимаются после хода («турецкий удар» запрещён).
// Игрок 0 — белые (снизу, ходят первыми), игрок 1 — чёрные.

const DIRS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

export const DRAW_LIMIT = 60; // ходов подряд без взятий и ходов простыми — ничья

const inside = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
export const sqOf = (r, c) => r * 8 + c;
export const isDark = (sq) => ((sq >> 3) + (sq & 7)) % 2 === 1;

export class Checkers {
  constructor(setup = null) {
    // board[sq]: null или { color: 0|1, king: bool }
    this.board = new Array(64).fill(null);
    if (setup) {
      for (const p of setup.pieces) this.board[p.sq] = { color: p.color, king: !!p.king };
      this.turn = setup.turn ?? 0;
    } else {
      for (let sq = 0; sq < 64; sq++) {
        if (!isDark(sq)) continue;
        const r = sq >> 3;
        if (r < 3) this.board[sq] = { color: 1, king: false };
        else if (r > 4) this.board[sq] = { color: 0, king: false };
      }
      this.turn = 0;
    }
    this.quiet = 0;
    this.history = [];
    this._start = this.board.map((p) => (p ? { ...p } : null));
    this._startTurn = this.turn;
    this.forcedResult = null;
  }

  clone() {
    const c = Object.create(Checkers.prototype);
    c.board = this.board.map((p) => (p ? { ...p } : null));
    c.turn = this.turn;
    c.quiet = this.quiet;
    c.history = this.history.slice();
    c._start = this._start;
    c._startTurn = this._startTurn;
    c.forcedResult = this.forcedResult;
    return c;
  }

  forward(color) {
    return color === 0 ? -1 : 1;
  }

  // Все цепочки взятий для шашки на sq
  _captures(sq) {
    const piece = this.board[sq];
    const out = [];
    const walk = (cur, king, captured, path) => {
      let extended = false;
      const r0 = cur >> 3;
      const c0 = cur & 7;
      for (const [dr, dc] of DIRS) {
        if (king) {
          // Дамка: скользит до первой фигуры, за ней — пустые поля для приземления
          let r = r0 + dr;
          let c = c0 + dc;
          while (inside(r, c) && !this._occupied(sqOf(r, c), sq)) {
            r += dr;
            c += dc;
          }
          if (!inside(r, c)) continue;
          const victim = sqOf(r, c);
          const vp = this.board[victim];
          if (!vp || vp.color === piece.color || captured.includes(victim)) continue;
          r += dr;
          c += dc;
          const landings = [];
          while (inside(r, c) && !this._occupied(sqOf(r, c), sq)) {
            landings.push(sqOf(r, c));
            r += dr;
            c += dc;
          }
          // Если с какого-то поля приземления можно бить дальше — бить обязательно оттуда
          const cont = landings.filter((l) => this._canCaptureFrom(l, true, piece.color, [...captured, victim], sq));
          for (const l of cont.length ? cont : landings) {
            extended = true;
            walk(l, true, [...captured, victim], [...path, l]);
          }
        } else {
          const mid = sqOf(r0 + dr, c0 + dc);
          const r2 = r0 + 2 * dr;
          const c2 = c0 + 2 * dc;
          if (!inside(r2, c2)) continue;
          const vp = this.board[mid];
          const land = sqOf(r2, c2);
          if (!vp || vp.color === piece.color || captured.includes(mid) || this._occupied(land, sq)) continue;
          extended = true;
          const promote = r2 === (piece.color === 0 ? 0 : 7);
          walk(land, promote, [...captured, mid], [...path, land]);
        }
      }
      if (!extended && captured.length) out.push({ from: sq, to: cur, path, captures: captured, king: king && !piece.king });
    };
    walk(sq, piece.king, [], []);
    return out;
  }

  // Занято ли поле (исходное поле ходящей шашки считается свободным)
  _occupied(sq, origin) {
    return sq !== origin && this.board[sq] !== null;
  }

  _canCaptureFrom(sq, king, color, captured, origin) {
    const r0 = sq >> 3;
    const c0 = sq & 7;
    for (const [dr, dc] of DIRS) {
      let r = r0 + dr;
      let c = c0 + dc;
      if (king) {
        while (inside(r, c) && !this._occupied(sqOf(r, c), origin)) {
          r += dr;
          c += dc;
        }
      }
      if (!inside(r, c)) continue;
      const v = sqOf(r, c);
      const vp = this.board[v];
      if (!vp || vp.color === color || captured.includes(v)) continue;
      const lr = r + dr;
      const lc = c + dc;
      if (inside(lr, lc) && !this._occupied(sqOf(lr, lc), origin)) return true;
    }
    return false;
  }

  _quietMoves(sq) {
    const piece = this.board[sq];
    const out = [];
    const r0 = sq >> 3;
    const c0 = sq & 7;
    for (const [dr, dc] of DIRS) {
      if (!piece.king && dr !== this.forward(piece.color)) continue;
      let r = r0 + dr;
      let c = c0 + dc;
      while (inside(r, c) && !this.board[sqOf(r, c)]) {
        const to = sqOf(r, c);
        out.push({ from: sq, to, path: [to], captures: [], king: !piece.king && r === (piece.color === 0 ? 0 : 7) });
        if (!piece.king) break;
        r += dr;
        c += dc;
      }
    }
    return out;
  }

  legalMoves() {
    if (this.forcedResult) return [];
    const caps = [];
    const quiet = [];
    for (let sq = 0; sq < 64; sq++) {
      const p = this.board[sq];
      if (!p || p.color !== this.turn) continue;
      caps.push(...this._captures(sq));
      if (!caps.length) quiet.push(...this._quietMoves(sq));
    }
    return caps.length ? caps : quiet;
  }

  // Ход задаётся from/to (и при неоднозначности — path)
  findMove(mv) {
    const list = this.legalMoves().filter((m) => m.from === mv.from && m.to === mv.to);
    if (!list.length) return null;
    if (mv.path) {
      const exact = list.find((m) => m.path.join() === mv.path.join());
      if (exact) return exact;
    }
    // Из нескольких путей в одну клетку выбираем тот, что бьёт больше
    return list.sort((a, b) => b.captures.length - a.captures.length)[0];
  }

  _apply(m) {
    const piece = this.board[m.from];
    const undo = { m, piece: { ...piece }, captured: m.captures.map((sq) => ({ sq, p: this.board[sq] })), quiet: this.quiet };
    this.board[m.from] = null;
    for (const sq of m.captures) this.board[sq] = null;
    this.board[m.to] = { color: piece.color, king: piece.king || m.king };
    this.quiet = m.captures.length || !piece.king ? 0 : this.quiet + 1;
    this.turn = 1 - this.turn;
    return undo;
  }

  _revert(u) {
    this.turn = 1 - this.turn;
    this.board[u.m.to] = null;
    this.board[u.m.from] = u.piece;
    for (const { sq, p } of u.captured) this.board[sq] = p;
    this.quiet = u.quiet;
  }

  play(mv) {
    if (this.result()) return false;
    const m = this.findMove(mv);
    if (!m) return false;
    this._apply(m);
    this.history.push({ ...m, player: 1 - this.turn });
    return true;
  }

  push(m) {
    const u = this._apply(m);
    (this._stack ||= []).push(u);
  }

  pop() {
    this._revert(this._stack.pop());
  }

  undo() {
    if (!this.history.length) return false;
    const moves = this.history.slice(0, -1);
    this.board = this._start.map((p) => (p ? { ...p } : null));
    this.turn = this._startTurn;
    this.quiet = 0;
    this.history = [];
    for (const m of moves) this.play(m);
    return true;
  }

  count(color) {
    let n = 0;
    for (const p of this.board) if (p && p.color === color) n++;
    return n;
  }

  result() {
    if (this.forcedResult) return this.forcedResult;
    if (!this.count(this.turn)) return { winner: 1 - this.turn, reason: 'nopieces' };
    if (!this.legalMoves().length) return { winner: 1 - this.turn, reason: 'blocked' };
    if (this.quiet >= DRAW_LIMIT) return { winner: -1, reason: 'draw' };
    return null;
  }

  pieces() {
    const out = [];
    this.board.forEach((p, sq) => {
      if (p) out.push({ sq, type: p.king ? 'king' : 'man', color: p.color });
    });
    return out;
  }

  pieceAt(sq) {
    const p = this.board[sq];
    return p ? { type: p.king ? 'king' : 'man', color: p.color } : null;
  }
}

// Оценка позиции для бота (с точки зрения seat)
export function evaluateCheckers(g, seat) {
  let s = 0;
  for (let sq = 0; sq < 64; sq++) {
    const p = g.board[sq];
    if (!p) continue;
    const r = sq >> 3;
    const c = sq & 7;
    let v = p.king ? 300 : 100;
    if (!p.king) v += (p.color === 0 ? 7 - r : r) * 4; // продвижение
    if (c >= 2 && c <= 5 && r >= 2 && r <= 5) v += 6; // центр
    if (!p.king && (p.color === 0 ? r === 7 : r === 0)) v += 8; // тыл
    s += p.color === seat ? v : -v;
  }
  return s;
}

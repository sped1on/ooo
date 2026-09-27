// Шахматы: полные правила (рокировка, взятие на проходе, превращение пешки,
// мат, пат, ничья по 50 ходам, троекратному повторению и недостатку материала).
// Доска — массив из 64 клеток, индекс = ряд * 8 + столбец, ряд 0 — восьмая
// горизонталь (чёрные), ряд 7 — первая (белые). Белые = игрок 0, ходят первыми.

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const N = -8;
const S = 8;
const E = 1;
const W = -1;
const KNIGHT = [-17, -15, -10, -6, 6, 10, 15, 17];
const KING = [N, S, E, W, N + E, N + W, S + E, S + W];
const BISHOP = [N + E, N + W, S + E, S + W];
const ROOK = [N, S, E, W];

export const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

const colOf = (sq) => sq & 7;
const rowOf = (sq) => sq >> 3;
const isWhite = (p) => p !== '.' && p === p.toUpperCase();
const colorOf = (p) => (p === '.' ? null : isWhite(p) ? 'w' : 'b');

// Проверка, что шаг dir из клетки sq не «перескакивает» через край доски
function stepOk(sq, dir) {
  const to = sq + dir;
  if (to < 0 || to > 63) return false;
  return Math.abs(colOf(to) - colOf(sq)) <= 2;
}

export function sqName(sq) {
  return 'abcdefgh'[colOf(sq)] + (8 - rowOf(sq));
}

export function parseSq(name) {
  return (8 - Number(name[1])) * 8 + 'abcdefgh'.indexOf(name[0]);
}

export class Chess {
  constructor(fen = START_FEN) {
    this._startFen = fen;
    this.load(fen);
  }

  load(fen) {
    const [placement, turn, castle, ep, half, full] = fen.trim().split(/\s+/);
    this.board = [];
    for (const ch of placement.replace(/\//g, '')) {
      if (/\d/.test(ch)) for (let i = 0; i < Number(ch); i++) this.board.push('.');
      else this.board.push(ch);
    }
    this.side = turn || 'w';
    this.castle = castle && castle !== '-' ? castle : '';
    this.ep = ep && ep !== '-' ? parseSq(ep) : -1;
    this.half = Number(half) || 0;
    this.full = Number(full) || 1;
    this.stack = [];
    this.history = [];
    this.reps = new Map();
    this._countRep(1);
    this.forcedResult = null;
  }

  get turn() {
    return this.side === 'w' ? 0 : 1;
  }

  clone() {
    const c = Object.create(Chess.prototype);
    c.board = this.board.slice();
    c.side = this.side;
    c.castle = this.castle;
    c.ep = this.ep;
    c.half = this.half;
    c.full = this.full;
    c.stack = [];
    c.history = this.history.slice();
    c.reps = new Map(this.reps);
    c.forcedResult = this.forcedResult;
    c._startFen = this._startFen;
    return c;
  }

  fen() {
    let s = '';
    for (let r = 0; r < 8; r++) {
      let empty = 0;
      for (let c = 0; c < 8; c++) {
        const p = this.board[r * 8 + c];
        if (p === '.') empty++;
        else {
          if (empty) s += empty;
          empty = 0;
          s += p;
        }
      }
      if (empty) s += empty;
      if (r < 7) s += '/';
    }
    return `${s} ${this.side} ${this.castle || '-'} ${this.ep >= 0 ? sqName(this.ep) : '-'} ${this.half} ${this.full}`;
  }

  _posKey() {
    return `${this.board.join('')}${this.side}${this.castle}${this.ep}`;
  }

  _countRep(d) {
    const k = this._posKey();
    this.reps.set(k, (this.reps.get(k) || 0) + d);
  }

  kingSq(color) {
    return this.board.indexOf(color === 'w' ? 'K' : 'k');
  }

  // Атакована ли клетка sq фигурами цвета by
  attacked(sq, by) {
    const b = this.board;
    const own = (p, t) => p !== '.' && colorOf(p) === by && p.toLowerCase() === t;
    // Пешки
    const pd = by === 'w' ? S : N; // откуда бьёт пешка: белая бьёт вверх, значит стоит ниже
    for (const d of [pd + E, pd + W]) {
      if (stepOk(sq, d) && own(b[sq + d], 'p')) return true;
    }
    for (const d of KNIGHT) if (stepOk(sq, d) && own(b[sq + d], 'n')) return true;
    for (const d of KING) if (stepOk(sq, d) && own(b[sq + d], 'k')) return true;
    for (const d of BISHOP) {
      let s = sq;
      while (stepOk(s, d)) {
        s += d;
        if (b[s] !== '.') {
          if (own(b[s], 'b') || own(b[s], 'q')) return true;
          break;
        }
      }
    }
    for (const d of ROOK) {
      let s = sq;
      while (stepOk(s, d)) {
        s += d;
        if (b[s] !== '.') {
          if (own(b[s], 'r') || own(b[s], 'q')) return true;
          break;
        }
      }
    }
    return false;
  }

  inCheck(color = this.side) {
    const k = this.kingSq(color);
    return k >= 0 && this.attacked(k, color === 'w' ? 'b' : 'w');
  }

  _pseudo() {
    const b = this.board;
    const me = this.side;
    const op = me === 'w' ? 'b' : 'w';
    const out = [];
    const add = (from, to, extra = {}) => out.push({ from, to, ...extra });
    for (let sq = 0; sq < 64; sq++) {
      const p = b[sq];
      if (p === '.' || colorOf(p) !== me) continue;
      const t = p.toLowerCase();
      if (t === 'p') {
        const dir = me === 'w' ? N : S;
        const startRow = me === 'w' ? 6 : 1;
        const lastRow = me === 'w' ? 0 : 7;
        const push = (to, extra) => {
          if (rowOf(to) === lastRow) for (const promo of ['q', 'r', 'b', 'n']) add(sq, to, { ...extra, promo });
          else add(sq, to, extra);
        };
        const one = sq + dir;
        if (one >= 0 && one < 64 && b[one] === '.') {
          push(one);
          const two = one + dir;
          if (rowOf(sq) === startRow && b[two] === '.') add(sq, two, { double: true });
        }
        for (const d of [dir + E, dir + W]) {
          if (!stepOk(sq, d)) continue;
          const to = sq + d;
          if (b[to] !== '.' && colorOf(b[to]) === op) push(to, { capture: b[to] });
          else if (to === this.ep) add(sq, to, { ep: true, capture: me === 'w' ? 'p' : 'P' });
        }
      } else if (t === 'n' || t === 'k') {
        for (const d of t === 'n' ? KNIGHT : KING) {
          if (!stepOk(sq, d)) continue;
          const to = sq + d;
          if (b[to] === '.') add(sq, to);
          else if (colorOf(b[to]) === op) add(sq, to, { capture: b[to] });
        }
        if (t === 'k') this._castles(sq, add);
      } else {
        const dirs = t === 'b' ? BISHOP : t === 'r' ? ROOK : KING;
        for (const d of dirs) {
          let s = sq;
          while (stepOk(s, d)) {
            s += d;
            if (b[s] === '.') add(sq, s);
            else {
              if (colorOf(b[s]) === op) add(sq, s, { capture: b[s] });
              break;
            }
          }
        }
      }
    }
    return out;
  }

  _castles(sq, add) {
    const me = this.side;
    const op = me === 'w' ? 'b' : 'w';
    const b = this.board;
    const home = me === 'w' ? 60 : 4;
    if (sq !== home || this.inCheck(me)) return;
    const [kFlag, qFlag] = me === 'w' ? ['K', 'Q'] : ['k', 'q'];
    if (this.castle.includes(kFlag) && b[home + 1] === '.' && b[home + 2] === '.' && !this.attacked(home + 1, op) && !this.attacked(home + 2, op)) {
      add(home, home + 2, { castle: 'k' });
    }
    if (this.castle.includes(qFlag) && b[home - 1] === '.' && b[home - 2] === '.' && b[home - 3] === '.' && !this.attacked(home - 1, op) && !this.attacked(home - 2, op)) {
      add(home, home - 2, { castle: 'q' });
    }
  }

  legalMoves() {
    if (this.result()) return [];
    return this._legal();
  }

  _legal() {
    const me = this.side;
    return this._pseudo().filter((m) => {
      this._make(m);
      const ok = !this.inCheck(me);
      this._unmake();
      return ok;
    });
  }

  _make(m) {
    const b = this.board;
    const piece = b[m.from];
    this.stack.push({ m, piece, castle: this.castle, ep: this.ep, half: this.half, full: this.full, captured: b[m.to] });
    b[m.to] = m.promo ? (this.side === 'w' ? m.promo.toUpperCase() : m.promo) : piece;
    b[m.from] = '.';
    if (m.ep) b[m.to + (this.side === 'w' ? S : N)] = '.';
    if (m.castle === 'k') {
      b[m.from + 1] = b[m.from + 3];
      b[m.from + 3] = '.';
    } else if (m.castle === 'q') {
      b[m.from - 1] = b[m.from - 4];
      b[m.from - 4] = '.';
    }
    // Права на рокировку
    const lose = (sq) => {
      const map = { 60: 'KQ', 56: 'Q', 63: 'K', 4: 'kq', 0: 'q', 7: 'k' };
      if (map[sq]) for (const f of map[sq]) this.castle = this.castle.replace(f, '');
    };
    lose(m.from);
    lose(m.to);
    this.ep = m.double ? (m.from + m.to) / 2 : -1;
    this.half = piece.toLowerCase() === 'p' || m.capture ? 0 : this.half + 1;
    if (this.side === 'b') this.full++;
    this.side = this.side === 'w' ? 'b' : 'w';
  }

  _unmake() {
    const st = this.stack.pop();
    const { m, piece } = st;
    const b = this.board;
    this.side = this.side === 'w' ? 'b' : 'w';
    b[m.from] = piece;
    b[m.to] = st.captured;
    if (m.ep) b[m.to + (this.side === 'w' ? S : N)] = this.side === 'w' ? 'p' : 'P';
    if (m.castle === 'k') {
      b[m.from + 3] = b[m.from + 1];
      b[m.from + 1] = '.';
    } else if (m.castle === 'q') {
      b[m.from - 4] = b[m.from - 1];
      b[m.from - 1] = '.';
    }
    this.castle = st.castle;
    this.ep = st.ep;
    this.half = st.half;
    this.full = st.full;
  }

  // Найти легальный ход по from/to/promo
  findMove(mv) {
    return this._legal().find((m) => m.from === mv.from && m.to === mv.to && (m.promo || null) === (mv.promo || (m.promo ? 'q' : null)));
  }

  play(mv) {
    if (this.result()) return false;
    const m = this.findMove(mv);
    if (!m) return false;
    const piece = this.board[m.from];
    this._make(m);
    this.stack.length = 0;
    this.history.push({ ...m, piece, san: '' });
    this._countRep(1);
    return true;
  }

  // Быстрые make/unmake для поиска (ход уже легальный, история не ведётся)
  push(m) {
    this._make(m);
  }

  pop() {
    this._unmake();
  }

  undo() {
    // Для отмены хода пересчитываем позицию с начала: истории хватает
    if (!this.history.length) return false;
    const moves = this.history.slice(0, -1);
    this.load(this._startFen);
    for (const m of moves) this.play(m);
    return true;
  }

  insufficient() {
    const pieces = this.board.filter((p) => p !== '.' && p.toLowerCase() !== 'k');
    if (pieces.length === 0) return true;
    if (pieces.length === 1 && /[nbNB]/.test(pieces[0])) return true;
    return false;
  }

  // null — партия идёт; иначе { winner: 0|1|-1, reason }
  result() {
    if (this.forcedResult) return this.forcedResult;
    const moves = this._legal();
    if (moves.length === 0) {
      if (this.inCheck()) return { winner: this.side === 'w' ? 1 : 0, reason: 'mate' };
      return { winner: -1, reason: 'stalemate' };
    }
    if (this.half >= 100) return { winner: -1, reason: 'fifty' };
    if (this.insufficient()) return { winner: -1, reason: 'material' };
    if ((this.reps.get(this._posKey()) || 0) >= 3) return { winner: -1, reason: 'repetition' };
    return null;
  }

  // Фигуры для отрисовки
  pieces() {
    const out = [];
    this.board.forEach((p, sq) => {
      if (p !== '.') out.push({ sq, type: p.toLowerCase(), color: isWhite(p) ? 0 : 1 });
    });
    return out;
  }

  pieceAt(sq) {
    const p = this.board[sq];
    return p === '.' ? null : { type: p.toLowerCase(), color: isWhite(p) ? 0 : 1 };
  }
}

// Подсчёт числа позиций (для проверки генератора ходов)
export function perft(ch, depth) {
  if (depth === 0) return 1;
  let n = 0;
  for (const m of ch._legal()) {
    ch._make(m);
    n += perft(ch, depth - 1);
    ch._unmake();
  }
  return n;
}

// ---------- Оценка позиции для бота ----------

// Таблицы «хороших полей» (с точки зрения белых, ряд 0 — восьмая горизонталь)
const PST = {
  p: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  n: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  b: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  r: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
  q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  k: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
};

// Оценка в сантипешках с точки зрения стороны seat
export function evaluateChess(ch, seat) {
  let score = 0;
  const b = ch.board;
  for (let sq = 0; sq < 64; sq++) {
    const p = b[sq];
    if (p === '.') continue;
    const t = p.toLowerCase();
    if (isWhite(p)) score += VALUE[t] + PST[t][sq];
    else score -= VALUE[t] + PST[t][(7 - rowOf(sq)) * 8 + colOf(sq)];
  }
  return seat === 0 ? score : -score;
}

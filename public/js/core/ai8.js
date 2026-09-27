// Бот для шахмат и шашек: негамакс с альфа-бета отсечением.

import { evaluateChess, VALUE } from './chess.js';
import { evaluateCheckers } from './checkers.js';

export const LEVELS8 = {
  easy: { name: 'Лёгкий' },
  medium: { name: 'Средний' },
  hard: { name: 'Сложный' },
};

const MATE = 100000;

const ADAPTERS = {
  chess: {
    depth: { easy: 1, medium: 2, hard: 3 },
    noise: { easy: 140, medium: 25, hard: 0 },
    moves: (g) => g._legal(),
    // Для «тихого» поиска — только взятия, с проверкой, что король не под шахом
    noisy: (g) => {
      const me = g.side;
      return g._pseudo().filter((m) => {
        if (!m.capture && m.promo !== 'q') return false;
        g._make(m);
        const ok = !g.inCheck(me);
        g._unmake();
        return ok;
      });
    },
    terminal: (g) => (g.inCheck() ? -MATE : 0),
    evaluate: (g) => evaluateChess(g, g.turn),
    // Сначала взятия ценных фигур дешёвыми (MVV-LVA), затем превращения
    order: (g, moves) =>
      moves
        .map((m) => ({ m, s: (m.capture ? VALUE[m.capture.toLowerCase()] * 10 - VALUE[g.board[m.from].toLowerCase()] : 0) + (m.promo === 'q' ? 800 : 0) }))
        .sort((a, b) => b.s - a.s)
        .map((x) => x.m),
    isNoisy: (m) => !!m.capture || m.promo === 'q',
    quiescence: 4,
  },
  checkers: {
    depth: { easy: 2, medium: 4, hard: 6 },
    noise: { easy: 60, medium: 12, hard: 0 },
    moves: (g) => g.legalMoves(),
    terminal: () => -MATE,
    evaluate: (g) => evaluateCheckers(g, g.turn),
    order: (g, moves) => moves.slice().sort((a, b) => b.captures.length - a.captures.length),
    isNoisy: (m) => m.captures.length > 0,
    quiescence: 0,
  },
};

function quiesce(g, A, alpha, beta, qd) {
  const stand = A.evaluate(g);
  if (qd === 0) return stand;
  if (stand >= beta) return stand;
  if (stand > alpha) alpha = stand;
  const moves = A.order(g, A.noisy ? A.noisy(g) : A.moves(g).filter(A.isNoisy));
  for (const m of moves) {
    g.push(m);
    const v = -quiesce(g, A, -beta, -alpha, qd - 1);
    g.pop();
    if (v >= beta) return v;
    if (v > alpha) alpha = v;
  }
  return alpha;
}

function negamax(g, A, depth, alpha, beta, ply) {
  // В листьях не генерируем все ходы — это самое дорогое место поиска
  if (depth <= 0) return A.quiescence ? quiesce(g, A, alpha, beta, A.quiescence) : A.evaluate(g);
  const moves = A.moves(g);
  if (!moves.length) {
    const t = A.terminal(g);
    return t < 0 ? t + ply : t;
  }
  let best = -Infinity;
  for (const m of A.order(g, moves)) {
    g.push(m);
    const v = -negamax(g, A, depth - 1, -beta, -alpha, ply + 1);
    g.pop();
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

// Выбор хода: game — Chess или Checkers, kind — 'chess' | 'checkers'
export function chooseMove8(game, kind, level = 'medium', rng = Math.random) {
  const A = ADAPTERS[kind];
  const g = game.clone();
  const moves = A.order(g, A.moves(g));
  if (moves.length <= 1) return moves[0] || null;
  const depth = A.depth[level] ?? 2;
  const noise = A.noise[level] ?? 0;
  let best = null;
  let bestV = -Infinity;
  for (const m of moves) {
    g.push(m);
    let v = -negamax(g, A, depth - 1, -Infinity, Infinity, 1);
    g.pop();
    v += (rng() - 0.5) * noise;
    if (v > bestV) {
      bestV = v;
      best = m;
    }
  }
  return best;
}

// Решатель для задач «мат в N» (шахматы): есть ли форсированный мат за n ходов
export function mateIn(g, n) {
  const moves = g._legal();
  for (const m of moves) {
    g.push(m);
    const ok = forcedMate(g, n - 1);
    g.pop();
    if (ok) return m;
  }
  return null;
}

function forcedMate(g, n) {
  const replies = g._legal();
  if (!replies.length) return g.inCheck();
  if (n <= 0) return false;
  for (const r of replies) {
    g.push(r);
    const ok = !!mateIn(g, n);
    g.pop();
    if (!ok) return false;
  }
  return true;
}

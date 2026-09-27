// Упражнения: 5000 уровней для каждой игры и каждой ступени (новичок / умею играть).
// Задача строится детерминированно по номеру уровня — у всех игроков одинаковая.

import { Game } from './quoridor.js';
import { Chess, sqName } from './chess.js';
import { Checkers, sqOf, isDark } from './checkers.js';
import { mateIn } from './ai8.js';

export const MAX_LEVEL = 5000;
export const TRACKS = { novice: 'Новичок', skilled: 'Умею играть' };

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rngFrom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];
const randInt = (rnd, a, b) => a + Math.floor(rnd() * (b - a + 1));

export function lessonReward(level) {
  return level % 10 === 0 ? 30 : 5;
}

export function makeLesson(game, track, level) {
  const rnd = rngFrom(hashStr(`${game}:${track}:${level}`));
  if (game === 'chess') return track === 'novice' ? chessNovice(level, rnd) : chessSkilled(level, rnd);
  if (game === 'checkers') return track === 'novice' ? checkersNovice(level, rnd) : checkersSkilled(level, rnd);
  return track === 'novice' ? koridorNovice(level, rnd) : koridorSkilled(level, rnd);
}

// ======================= Коридор =======================

// Минимум ходов фишки 0 до цели (с учётом стоящей фишки соперника и прыжков)
export function minPawnMoves(g) {
  const start = { ...g.pawns[0] };
  const key = (p) => p.x * 100 + p.y;
  const seen = new Set([key(start)]);
  let frontier = [start];
  const goal = g.goalRow(0);
  for (let d = 0; d < 200 && frontier.length; d++) {
    if (frontier.some((p) => p.y === goal)) return d;
    const next = [];
    for (const p of frontier) {
      g.pawns[0] = p;
      for (const m of g.pawnMoves(0)) {
        const k = key(m);
        if (!seen.has(k)) {
          seen.add(k);
          next.push({ x: m.x, y: m.y });
        }
      }
    }
    frontier = next;
  }
  g.pawns[0] = start;
  return -1;
}

export function koridorBoard(n, me, opp, walls) {
  const g = new Game(n);
  g.pawns = [{ ...me }, { ...opp }];
  g.wallsLeft = [99, 99];
  for (const w of walls) {
    g.turn = 0;
    g.play({ type: 'wall', ...w });
  }
  g.turn = 0;
  g.wallsLeft = [0, 0];
  g.walls = g.walls.map((w) => ({ ...w, player: 1 }));
  return g;
}

// Случайные стены, которые удлиняют путь (лабиринт)
function mazeWalls(n, me, opp, count, rnd, greedy) {
  const g = new Game(n);
  g.pawns = [{ ...me }, { ...opp }];
  g.wallsLeft = [999, 999];
  const walls = [];
  for (let i = 0; i < count; i++) {
    let best = null;
    let bestD = -1;
    const tries = greedy ? 24 : 1;
    for (let t = 0; t < tries * 6 && (greedy || !best); t++) {
      const w = { x: randInt(rnd, 0, n - 2), y: randInt(rnd, 0, n - 2), o: rnd() < 0.5 ? 'h' : 'v' };
      g.turn = 0;
      if (!g.canPlaceWall(w.x, w.y, w.o, 0)) continue;
      g.play({ type: 'wall', ...w });
      const d = g.distance(0);
      g.undo();
      if (d > bestD) {
        bestD = d;
        best = w;
      }
    }
    if (!best) continue;
    g.turn = 0;
    g.play({ type: 'wall', ...best });
    walls.push(best);
  }
  return walls;
}

function koridorReach(level, rnd, n, wallCount, greedy, title, text) {
  const me = { x: randInt(rnd, 0, n - 1), y: n - 1 };
  const opp = { x: randInt(rnd, 0, n - 1), y: 0 };
  const walls = mazeWalls(n, me, opp, wallCount, rnd, greedy);
  const g = koridorBoard(n, me, opp, walls);
  const k = minPawnMoves(g);
  return { game: 'koridor', type: 'reach', n, me, opp, walls, maxMoves: k, title, text: text || `Доведите синюю фишку до клетчатого ряда за ${k} ${plural(k, 'ход', 'хода', 'ходов')}.` };
}

// Лучшая стена (или две) для максимального удлинения пути соперника
export function bestWallGain(g, count) {
  const base = g.distance(1);
  let best = base;
  const walls = g.legalWalls(0);
  for (const w of walls) {
    g.play(w);
    g.turn = 0;
    let d = g.distance(1);
    if (count > 1) {
      for (const w2 of g.legalWalls(0)) {
        g.play(w2);
        d = Math.max(d, g.distance(1));
        g.undo();
        g.turn = 0;
      }
    }
    g.undo();
    g.turn = 0;
    if (d > best) best = d;
  }
  return { base, best };
}

function koridorWall(level, rnd, n, wallCount, placeCount, needMax, title) {
  const me = { x: randInt(rnd, 0, n - 1), y: n - 1 };
  const opp = { x: randInt(rnd, 1, n - 2), y: randInt(rnd, 0, Math.floor(n / 2)) };
  const walls = mazeWalls(n, me, opp, wallCount, rnd, false);
  const g = koridorBoard(n, me, opp, walls);
  g.wallsLeft = [placeCount, 0];
  const { base, best } = placeCount > 1 ? bestWallGain(g, 2) : bestWallGain(g, 1);
  const target = needMax ? best : Math.min(best, base + 1);
  const text = needMax
    ? `Поставьте ${placeCount === 1 ? 'одну стену' : 'две стены'} так, чтобы путь красной фишки вырос с ${base} до ${target} ${plural(target, 'хода', 'ходов', 'ходов')}.`
    : `Поставьте стену, чтобы путь красной фишки к финишу стал длиннее (сейчас ${base}).`;
  return { game: 'koridor', type: 'wall', n, me, opp, walls, place: placeCount, base, target, title, text };
}

const KORIDOR_INTRO = [
  () => ({ game: 'koridor', type: 'reach', n: 5, me: { x: 2, y: 4 }, opp: { x: 0, y: 0 }, walls: [], maxMoves: 4, title: 'Первые шаги', explain: 'Фишка ходит на одну клетку вперёд, назад или вбок. Цель — клетчатый ряд на стороне соперника.', text: 'Доведите синюю фишку до клетчатого ряда наверху за 4 хода.' }),
  () => ({ game: 'koridor', type: 'reach', n: 5, me: { x: 2, y: 4 }, opp: { x: 0, y: 0 }, walls: [{ x: 1, y: 2, o: 'h' }, { x: 2, y: 0, o: 'v' }], maxMoves: 5, title: 'Обход стены', explain: 'Сквозь стены ходить нельзя — их нужно обходить.', text: 'Обойдите стену и дойдите до финиша за 5 ходов.' }),
  () => ({ game: 'koridor', type: 'reach', n: 5, me: { x: 2, y: 4 }, opp: { x: 2, y: 3 }, walls: [], maxMoves: 3, title: 'Прыжок', explain: 'Если соперник стоит вплотную, через него можно перепрыгнуть — это экономит ход.', text: 'Перепрыгните красную фишку и дойдите до финиша за 3 хода.' }),
  () => ({ game: 'koridor', type: 'reach', n: 5, me: { x: 2, y: 4 }, opp: { x: 2, y: 3 }, walls: [{ x: 1, y: 2, o: 'h' }], maxMoves: 4, title: 'Прыжок вбок', explain: 'Если за соперником стена, прыгайте по диагонали — влево или вправо от него.', text: 'Прыгните по диагонали и дойдите до финиша за 4 хода.' }),
  () => ({ game: 'koridor', type: 'wall', n: 5, me: { x: 2, y: 4 }, opp: { x: 2, y: 1 }, walls: [], place: 1, base: 3, target: 4, title: 'Первая стена', explain: 'Вместо хода можно поставить стену. Она закрывает проход между двумя парами клеток.', text: 'Поставьте стену перед красной фишкой, чтобы её путь стал длиннее.' }),
  () => ({ game: 'koridor', type: 'wall', n: 5, me: { x: 2, y: 4 }, opp: { x: 1, y: 1 }, walls: [{ x: 1, y: 1, o: 'h' }], place: 1, base: 5, target: 6, title: 'Нельзя запирать', explain: 'Стену нельзя ставить так, чтобы у соперника совсем не осталось пути. Игра подсветит такую стену красным.', text: 'Удлините путь красной фишки ещё на 1 ход, не запирая её.' }),
];

// Для вводных уроков цели считаем по позиции, а не задаём вручную
function finalizeKoridor(l) {
  const g = koridorBoard(l.n, l.me, l.opp, l.walls);
  if (l.type === 'reach') l.maxMoves = minPawnMoves(g);
  else {
    g.wallsLeft = [l.place, 0];
    const { base, best } = bestWallGain(g, l.place);
    l.base = base;
    l.target = Math.min(best, base + 1);
  }
  return l;
}

function koridorNovice(level, rnd) {
  if (level <= KORIDOR_INTRO.length) return finalizeKoridor(KORIDOR_INTRO[level - 1]());
  const n = level < 60 ? 5 : level < 600 ? 7 : 9;
  const walls = Math.min(3 + Math.floor(level / 40), n === 5 ? 5 : 12);
  if (level % 3 === 0) return koridorWall(level, rnd, n, Math.floor(walls / 2), 1, false, 'Замедли соперника');
  return koridorReach(level, rnd, n, walls, level > 30, 'Лабиринт');
}

function koridorSkilled(level, rnd) {
  const n = level < 300 ? 7 : 9;
  const walls = Math.min(6 + Math.floor(level / 60), 22);
  if (level % 2 === 0) {
    const two = level > 800 && level % 4 === 0;
    return koridorWall(level, rnd, n, Math.floor(walls / 2), two ? 2 : 1, true, two ? 'Две стены' : 'Лучшая стена');
  }
  return koridorReach(level, rnd, n, walls, true, 'Сложный лабиринт');
}

// ======================= Шахматы =======================

const PIECE_NAMES = { r: 'ладья', b: 'слон', q: 'ферзь', n: 'конь', k: 'король', p: 'пешка' };

// Минимум ходов фигуры, чтобы собрать все звёзды (поиск в ширину)
export function starsMinMoves(fen, heroSq, stars) {
  const full = (1 << stars.length) - 1;
  const g = new Chess(fen);
  const idx = new Map(stars.map((s, i) => [s, i]));
  const start = { sq: heroSq, mask: 0 };
  const seen = new Set([`${heroSq}:0`]);
  let frontier = [start];
  for (let d = 0; d < 40 && frontier.length; d++) {
    const next = [];
    for (const st of frontier) {
      if (st.mask === full) return d;
      const piece = g.board[heroSq];
      g.board[heroSq] = '.';
      g.board[st.sq] = piece;
      g.side = 'w';
      const moves = g._pseudo().filter((m) => m.from === st.sq);
      g.board[st.sq] = '.';
      g.board[heroSq] = piece;
      for (const m of moves) {
        const mask = idx.has(m.to) ? st.mask | (1 << idx.get(m.to)) : st.mask;
        const k = `${m.to}:${mask}`;
        if (!seen.has(k)) {
          seen.add(k);
          next.push({ sq: m.to, mask });
        }
      }
    }
    frontier = next;
  }
  return -1;
}

function chessStars(level, rnd, type, title, explain) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const board = new Array(64).fill('.');
    const hero = randInt(rnd, 0, 63);
    board[hero] = type.toUpperCase();
    const nObst = type === 'k' ? 0 : Math.min(10, Math.floor(level / 30) + (level > 10 ? 1 : 0));
    for (let i = 0; i < nObst; i++) {
      const sq = randInt(rnd, 8, 55);
      if (board[sq] === '.') board[sq] = 'P';
    }
    const nStars = Math.min(6, 1 + Math.floor(level / 25));
    const stars = [];
    while (stars.length < nStars) {
      const sq = randInt(rnd, 0, 63);
      if (board[sq] === '.' && !stars.includes(sq)) stars.push(sq);
    }
    const fen = boardFen(board);
    const k = starsMinMoves(fen, hero, stars);
    if (k > 0) {
      return { game: 'chess', type: 'stars', fen, hero, stars, maxMoves: k, title, explain, text: `${cap(PIECE_NAMES[type])}: соберите ${stars.length === 1 ? 'звезду' : `все звёзды (${stars.length})`} за ${k} ${plural(k, 'ход', 'хода', 'ходов')}. Свои пешки — препятствия.` };
    }
  }
  return chessStars(Math.max(1, level - 20), rnd, 'r', title, explain);
}

function boardFen(board, side = 'w') {
  let s = '';
  for (let r = 0; r < 8; r++) {
    let e = 0;
    for (let c = 0; c < 8; c++) {
      const p = board[r * 8 + c];
      if (p === '.') e++;
      else {
        if (e) s += e;
        e = 0;
        s += p;
      }
    }
    if (e) s += e;
    if (r < 7) s += '/';
  }
  return `${s} ${side} - - 0 1`;
}

const CHESS_INTRO = [
  ['r', 'Ладья', 'Ладья ходит по вертикали и горизонтали на любое число полей.'],
  ['b', 'Слон', 'Слон ходит по диагонали на любое число полей и всегда остаётся на полях своего цвета.'],
  ['q', 'Ферзь', 'Ферзь — самая сильная фигура: ходит как ладья и как слон вместе.'],
  ['n', 'Конь', 'Конь ходит буквой «Г»: два поля прямо и одно вбок. Он умеет перепрыгивать через фигуры.'],
  ['k', 'Король', 'Король ходит на одно поле в любую сторону. Его нужно беречь: мат королю — конец партии.'],
];

function chessNovice(level, rnd) {
  if (level <= CHESS_INTRO.length) {
    const [t, title, explain] = CHESS_INTRO[level - 1];
    return chessStars(level, rnd, t, title, explain);
  }
  if (level === 6) {
    return { game: 'chess', type: 'mate', fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', depth: 1, title: 'Первый мат', explain: 'Мат — это шах, от которого королю не уйти. Здесь король соперника заперт своими пешками.', text: 'Поставьте мат в 1 ход.' };
  }
  if (level % 4 === 0) return chessMate(level, rnd, 1, 1);
  const type = pick(rnd, ['r', 'b', 'q', 'n', 'n', 'k']);
  return chessStars(level, rnd, type, 'Сбор звёзд');
}

function chessSkilled(level, rnd) {
  const depth = level > 1500 && (level > 3000 || level % 2 === 0) ? 2 : 1;
  const complexity = 1 + Math.min(4, Math.floor(level / 400));
  return chessMate(level, rnd, depth, complexity);
}

function kingDist(a, b) {
  return Math.max(Math.abs((a >> 3) - (b >> 3)), Math.abs((a & 7) - (b & 7)));
}

export function chessMate(level, rnd, depth, complexity) {
  const budget = depth === 1 ? 800 : 60;
  for (let attempt = 0; attempt < budget; attempt++) {
    const board = new Array(64).fill('.');
    // Чёрный король ближе к краю — так маты встречаются чаще
    const edgeRow = rnd() < 0.7 ? pick(rnd, [0, 1]) : randInt(rnd, 0, 7);
    const bk = edgeRow * 8 + randInt(rnd, 0, 7);
    board[bk] = 'k';
    let wk;
    do wk = randInt(rnd, 16, 63);
    while (kingDist(wk, bk) < 2);
    board[wk] = 'K';
    const attackers = randInt(rnd, 1, 1 + complexity);
    const pool = ['Q', 'R', 'R', 'B', 'N', 'Q', 'R', 'B', 'N', 'P'];
    for (let i = 0; i < attackers; i++) {
      const sq = randInt(rnd, 0, 63);
      const p = pick(rnd, pool);
      if (board[sq] !== '.' || (p === 'P' && (sq < 16 || sq > 55)) || kingDist(sq, bk) > 5) continue;
      board[sq] = p;
    }
    const defenders = randInt(rnd, 0, complexity + 1);
    for (let i = 0; i < defenders; i++) {
      const sq = bk + pick(rnd, [7, 8, 9, -1, 1, -7, -8, -9, 16, 15, 17]);
      if (sq < 8 || sq > 55 || board[sq] !== '.') continue;
      board[sq] = pick(rnd, ['p', 'p', 'p', 'n', 'b', 'r']);
    }
    const fen = boardFen(board);
    const g = new Chess(fen);
    if (g.inCheck('b') || g.inCheck('w')) continue;
    const moves = g._legal();
    if (moves.length < 3) continue;
    const m1 = mateIn(g.clone(), 1);
    if (depth === 1) {
      if (!m1) continue;
      return { game: 'chess', type: 'mate', fen, depth: 1, title: 'Мат в 1 ход', text: 'Белые начинают и ставят мат в 1 ход.', solution: sqName(m1.from) + sqName(m1.to) };
    }
    if (m1) continue;
    const m2 = mateIn(g.clone(), 2);
    if (!m2) continue;
    return { game: 'chess', type: 'mate', fen, depth: 2, title: 'Мат в 2 хода', text: 'Белые начинают и ставят мат в 2 хода. Чёрные защищаются лучшим образом.', solution: sqName(m2.from) + sqName(m2.to) };
  }
  if (depth === 2) return chessMate(level, rnd, 1, complexity);
  return chessMate(level, rnd, 1, 1);
}

// ======================= Шашки =======================

const DIAG = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

// Строит цепочку взятий: белая шашка (или дамка) бьёт k чёрных подряд
function captureChain(rnd, k, king) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const pieces = new Map();
    let r = randInt(rnd, 2, 7);
    let c = randInt(rnd, 0, 7);
    if (!isDark(sqOf(r, c))) c = (c + 1) % 8;
    const start = sqOf(r, c);
    pieces.set(start, { color: 0, king });
    const used = new Set([start]);
    let ok = true;
    for (let i = 0; i < k; i++) {
      const dirs = DIAG.slice().sort(() => rnd() - 0.5);
      let moved = false;
      for (const [dr, dc] of dirs) {
        const gap = king ? randInt(rnd, 0, 2) : 0;
        const vr = r + dr * (1 + gap);
        const vc = c + dc * (1 + gap);
        const lr = vr + dr;
        const lc = vc + dc;
        if (lr < 0 || lr > 7 || lc < 0 || lc > 7 || vr < 1 || vr > 6 || vc < 1 || vc > 6) continue;
        const v = sqOf(vr, vc);
        const l = sqOf(lr, lc);
        if (used.has(v) || used.has(l) || pieces.has(v)) continue;
        // Путь до жертвы должен быть свободен
        let clear = true;
        for (let s = 1; s <= gap; s++) if (pieces.has(sqOf(r + dr * s, c + dc * s))) clear = false;
        if (!clear) continue;
        pieces.set(v, { color: 1, king: false });
        used.add(v);
        used.add(l);
        r = lr;
        c = lc;
        moved = true;
        break;
      }
      if (!moved) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    const setup = { turn: 0, pieces: [...pieces].map(([sq, p]) => ({ sq, ...p })) };
    const g = new Checkers(setup);
    const best = Math.max(0, ...g.legalMoves().map((m) => m.captures.length));
    if (best === k) return setup;
  }
  return null;
}

function checkersCapture(level, rnd, k, king, extra, title, explain) {
  const setup = captureChain(rnd, k, king) || captureChain(rnd, Math.max(1, k - 1), king) || captureChain(rnd, 1, false);
  // Дополнительные шашки: свои и чужие, которые не мешают решению
  for (let i = 0; i < extra; i++) {
    const sq = randInt(rnd, 0, 63);
    if (!isDark(sq) || setup.pieces.some((p) => p.sq === sq)) continue;
    const color = rnd() < 0.5 ? 0 : 1;
    const r = sq >> 3;
    if ((color === 0 && r === 0) || (color === 1 && r === 7)) continue;
    const trial = { turn: 0, pieces: [...setup.pieces, { sq, color, king: false }] };
    const before = Math.max(0, ...new Checkers(setup).legalMoves().map((m) => m.captures.length));
    const after = Math.max(0, ...new Checkers(trial).legalMoves().map((m) => m.captures.length));
    if (after === before) setup.pieces.push({ sq, color, king: false });
  }
  const g = new Checkers(setup);
  const need = Math.max(...g.legalMoves().map((m) => m.captures.length));
  return { game: 'checkers', type: 'capture', setup, need, title, explain, text: need === 1 ? 'Побейте шашку соперника.' : `Найдите удар, который забирает ${need} ${plural(need, 'шашку', 'шашки', 'шашек')} за один ход.` };
}

const CHECKERS_INTRO = [
  { title: 'Первый ход', explain: 'Шашки ходят только по тёмным полям: на одно поле вперёд по диагонали.', setup: { turn: 0, pieces: [{ sq: sqOf(6, 3), color: 0 }] }, target: sqOf(4, 3), text: 'Проведите шашку на отмеченное поле за 2 хода.', type: 'reach', maxMoves: 2 },
  { title: 'Взятие', explain: 'Шашка бьёт, перепрыгивая через шашку соперника на свободное поле за ней. Бить обязательно!', setup: { turn: 0, pieces: [{ sq: sqOf(5, 2), color: 0 }, { sq: sqOf(4, 3), color: 1 }] }, text: 'Побейте чёрную шашку.', type: 'capture', need: 1 },
  { title: 'Двойной удар', explain: 'Если после взятия можно бить снова — бейте дальше тем же ходом. Бить можно и назад.', setup: { turn: 0, pieces: [{ sq: sqOf(5, 2), color: 0 }, { sq: sqOf(4, 3), color: 1 }, { sq: sqOf(2, 3), color: 1 }] }, text: 'Заберите обе шашки одним ходом.', type: 'capture', need: 2 },
  { title: 'Дамка', explain: 'Шашка, дошедшая до последнего ряда, становится дамкой.', setup: { turn: 0, pieces: [{ sq: sqOf(2, 1), color: 0 }] }, target: sqOf(0, 1), text: 'Проведите шашку в дамки за 2 хода.', type: 'reach', maxMoves: 2 },
  { title: 'Сила дамки', explain: 'Дамка ходит и бьёт на любое расстояние по диагонали.', setup: { turn: 0, pieces: [{ sq: sqOf(7, 0), color: 0, king: true }, { sq: sqOf(3, 4), color: 1 }] }, text: 'Побейте шашку дамкой издалека.', type: 'capture', need: 1 },
];

function checkersNovice(level, rnd) {
  if (level <= CHECKERS_INTRO.length) return { game: 'checkers', ...structuredClone(CHECKERS_INTRO[level - 1]) };
  const k = Math.min(5, 1 + Math.floor(level / 150));
  return checkersCapture(level, rnd, k, level > 400 && level % 5 === 0, Math.min(6, Math.floor(level / 80)), 'Удар');
}

function checkersSkilled(level, rnd) {
  const k = Math.min(7, 2 + Math.floor(level / 400));
  const king = level > 200 && level % 3 === 0;
  return checkersCapture(level, rnd, k, king, Math.min(10, 2 + Math.floor(level / 150)), king ? 'Удар дамкой' : 'Лучший удар');
}

// ======================= Утилиты =======================

function plural(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

const cap = (s) => s[0].toUpperCase() + s.slice(1);

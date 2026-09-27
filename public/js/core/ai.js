// Бот для «Коридора»: минимакс с альфа-бета отсечением.
// Оценка позиции — разница длин кратчайших путей и запас стен.

import { Game } from './quoridor.js';

export const BOT_LEVELS = {
  easy: { name: 'Лёгкий', depth: 1, noise: 1.1, wallChance: 0.25 },
  medium: { name: 'Средний', depth: 2, noise: 0.4, wallChance: 1 },
  hard: { name: 'Сложный', depth: 3, noise: 0, wallChance: 1 },
};

const WIN = 1000;

function evaluate(g, me) {
  if (g.winner === me) return WIN;
  if (g.winner === 1 - me) return -WIN;
  const dMe = g.distance(me);
  const dOp = g.distance(1 - me);
  // Кто ходит — тот фактически на полшага ближе
  const tempo = g.turn === me ? 0.5 : -0.5;
  return (dOp - dMe) + tempo + 0.12 * (g.wallsLeft[me] - g.wallsLeft[1 - me]);
}

// Стены-кандидаты: те, что перекрывают кратчайший путь соперника, и те,
// что стоят рядом с его фишкой. Так перебор остаётся быстрым.
function candidateWalls(g, player) {
  if (g.wallsLeft[player] <= 0) return [];
  const op = 1 - player;
  const path = g.shortestPath(op) || [];
  const m = g.n - 1;
  const seen = new Set();
  const out = [];
  const add = (x, y, o) => {
    if (x < 0 || y < 0 || x >= m || y >= m) return;
    const key = `${x},${y},${o}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (g.canPlaceWall(x, y, o, player)) out.push({ type: 'wall', x, y, o });
  };
  let prev = g.pawns[op];
  for (const step of path.slice(0, 6)) {
    if (step.x === prev.x) {
      const y = Math.min(step.y, prev.y);
      add(step.x - 1, y, 'h');
      add(step.x, y, 'h');
    } else {
      const x = Math.min(step.x, prev.x);
      add(x, step.y - 1, 'v');
      add(x, step.y, 'v');
    }
    prev = step;
  }
  // Боковые «заборы» вокруг соперника
  const p = g.pawns[op];
  for (let dx = -2; dx <= 1; dx++) {
    for (let dy = -2; dy <= 1; dy++) {
      if (Math.abs(dx) + Math.abs(dy) > 2) continue;
      add(p.x + dx, p.y + dy, 'v');
    }
  }
  return out;
}

function orderedMoves(g, withWalls) {
  const me = g.turn;
  const moves = g.pawnMoves(me).map((m) => ({ type: 'move', x: m.x, y: m.y }));
  // Сначала — ходы, приближающие к цели
  const goal = g.goalRow(me);
  moves.sort((a, b) => Math.abs(a.y - goal) - Math.abs(b.y - goal));
  return withWalls ? moves.concat(candidateWalls(g, me)) : moves;
}

function search(g, depth, alpha, beta, me, withWalls) {
  // Победа раньше ценнее победы позже
  if (g.winner !== -1) return evaluate(g, me) + (g.winner === me ? depth : -depth);
  if (depth === 0) return evaluate(g, me);
  const maximizing = g.turn === me;
  let best = maximizing ? -Infinity : Infinity;
  for (const mv of orderedMoves(g, withWalls)) {
    g.play(mv);
    const v = search(g, depth - 1, alpha, beta, me, withWalls);
    g.undo();
    if (maximizing) {
      if (v > best) best = v;
      if (best > alpha) alpha = best;
    } else {
      if (v < best) best = v;
      if (best < beta) beta = best;
    }
    if (beta <= alpha) break;
  }
  return best;
}

export function chooseBotMove(game, level = 'medium', rng = Math.random) {
  const cfg = BOT_LEVELS[level] || BOT_LEVELS.medium;
  const g = game.clone();
  const me = g.turn;

  // Если можно выиграть одним ходом — выигрываем
  for (const m of g.pawnMoves(me)) {
    if (m.y === g.goalRow(me)) return { type: 'move', x: m.x, y: m.y };
  }

  const withWalls = rng() < cfg.wallChance;
  const moves = orderedMoves(g, withWalls);
  const distNow = g.distance(me);
  // Клетки, где фишка бота была за последние ходы: возвращаться туда —
  // значит топтаться на месте
  const recent = g.history
    .filter((h) => h.type === 'move' && h.player === me)
    .slice(-4)
    .map((h) => `${h.from.x},${h.from.y}`);
  const scored = [];
  for (const mv of moves) {
    g.play(mv);
    let v = search(g, cfg.depth - 1, -Infinity, Infinity, me, withWalls && cfg.depth > 1);
    const distAfter = mv.type === 'move' ? g.distance(me) : distNow;
    g.undo();
    // Не тратим стены впустую: небольшой штраф за стену
    if (mv.type === 'wall') v -= 0.35;
    if (mv.type === 'move') {
      // Продвижение к финишу — бонус, отступление — штраф
      v += (distNow - distAfter) * 0.45;
      if (recent.includes(`${mv.x},${mv.y}`)) v -= 1.2;
    }
    v += (rng() - 0.5) * cfg.noise;
    scored.push({ mv, v });
  }
  scored.sort((a, b) => b.v - a.v);
  return scored.length ? scored[0].mv : game.autoMove(me);
}

export { Game };

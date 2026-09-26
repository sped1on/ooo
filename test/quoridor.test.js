import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../public/js/core/quoridor.js';
import { chooseBotMove } from '../public/js/core/ai.js';

test('начальная позиция', () => {
  const g = new Game(9);
  assert.deepEqual(g.pawns, [{ x: 4, y: 8 }, { x: 4, y: 0 }]);
  assert.equal(g.distance(0), 8);
  assert.equal(g.distance(1), 8);
  assert.equal(g.pawnMoves(0).length, 3);
});

test('стена блокирует ход', () => {
  const g = new Game(9);
  assert.ok(g.play({ type: 'wall', x: 3, y: 7, o: 'h' }));
  assert.ok(!g.pawnMoves(0).some((m) => m.x === 4 && m.y === 7));
  assert.equal(g.wallsLeft[0], 9);
});

test('пересекающиеся и накладывающиеся стены запрещены', () => {
  const g = new Game(9);
  g.play({ type: 'wall', x: 3, y: 3, o: 'h' });
  assert.ok(!g.canPlaceWall(3, 3, 'v'));
  assert.ok(!g.canPlaceWall(4, 3, 'h'));
  assert.ok(!g.canPlaceWall(2, 3, 'h'));
  assert.ok(g.canPlaceWall(5, 3, 'h'));
  assert.ok(g.canPlaceWall(4, 3, 'v'));
});

test('нельзя полностью перекрыть путь', () => {
  const g = new Game(5);
  // Перекрываем ряд между y=1 и y=2 почти полностью
  assert.ok(g.play({ type: 'wall', x: 0, y: 1, o: 'h' }));
  assert.ok(g.play({ type: 'wall', x: 2, y: 1, o: 'h' }));
  // Остался проход только в столбце 4; вертикаль отрезала бы красного от него
  assert.ok(!g.canPlaceWall(3, 0, 'v'));
  assert.ok(g.canPlaceWall(3, 2, 'v'));
});

test('прыжок через соперника и диагональ', () => {
  const g = new Game(9);
  g.pawns = [{ x: 4, y: 5 }, { x: 4, y: 4 }];
  assert.ok(g.pawnMoves(0).some((m) => m.x === 4 && m.y === 3 && m.jump));
  g._applyWall(3, 3, 'h', true); // стена за соперником
  const moves = g.pawnMoves(0);
  assert.ok(!moves.some((m) => m.x === 4 && m.y === 3));
  assert.ok(moves.some((m) => m.x === 3 && m.y === 4));
  assert.ok(moves.some((m) => m.x === 5 && m.y === 4));
});

test('победа и отмена', () => {
  const g = new Game(5);
  g.pawns[0] = { x: 1, y: 1 };
  assert.ok(g.play({ type: 'move', x: 1, y: 0 }));
  assert.equal(g.winner, 0);
  assert.ok(!g.isLegal({ type: 'move', x: 2, y: 1 }));
  g.undo();
  assert.equal(g.winner, -1);
  assert.equal(g.turn, 0);
});

test('бот делает допустимые ходы и доигрывает партию', () => {
  for (const level of ['easy', 'medium', 'hard']) {
    const g = new Game(7);
    let guard = 0;
    while (g.winner === -1 && guard++ < 300) {
      const mv = chooseBotMove(g, level);
      assert.ok(g.play(mv), `недопустимый ход бота ${JSON.stringify(mv)}`);
    }
    assert.notEqual(g.winner, -1, `партия ${level} не закончилась`);
  }
});

test('автоход ведёт к цели', () => {
  const g = new Game(9);
  const mv = g.autoMove(0);
  assert.deepEqual(mv, { type: 'move', x: 4, y: 7 });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess, perft, parseSq } from '../public/js/core/chess.js';
import { Checkers, sqOf } from '../public/js/core/checkers.js';
import { chooseMove8, mateIn } from '../public/js/core/ai8.js';

test('шахматы: perft из начальной позиции и kiwipete', () => {
  assert.deepEqual([1, 2, 3].map((d) => perft(new Chess(), d)), [20, 400, 8902]);
  const k = new Chess('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
  assert.deepEqual([1, 2].map((d) => perft(k, d)), [48, 2039]);
});

test('шахматы: детский мат, пат, отмена', () => {
  const c = new Chess();
  for (const [f, t] of [['e2', 'e4'], ['e7', 'e5'], ['f1', 'c4'], ['b8', 'c6'], ['d1', 'h5'], ['g8', 'f6'], ['h5', 'f7']]) {
    assert.ok(c.play({ from: parseSq(f), to: parseSq(t) }), `${f}-${t}`);
  }
  assert.deepEqual(c.result(), { winner: 0, reason: 'mate' });
  c.undo();
  assert.equal(c.result(), null);
  const st = new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
  assert.deepEqual(st.result(), { winner: -1, reason: 'stalemate' });
});

test('шахматы: бот находит мат в 1 и доигрывает партию', () => {
  const c = new Chess('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
  const m = chooseMove8(c, 'chess', 'medium');
  assert.equal(m.to, parseSq('a8'));
  assert.ok(mateIn(c.clone(), 1));
  const g = new Chess();
  let n = 0;
  while (!g.result() && n++ < 60) assert.ok(g.play(chooseMove8(g, 'chess', 'easy')));
});

test('шашки: начальная позиция, обязательное взятие, множественное взятие', () => {
  const g = new Checkers();
  assert.equal(g.legalMoves().length, 7);
  // Белая шашка c3 должна бить d4 и дальше f6
  const w = new Checkers({ turn: 0, pieces: [
    { sq: sqOf(5, 2), color: 0 },
    { sq: sqOf(4, 3), color: 1 },
    { sq: sqOf(2, 5), color: 1 },
    { sq: sqOf(0, 1), color: 1 },
  ] });
  const moves = w.legalMoves();
  assert.equal(moves.length, 1);
  assert.equal(moves[0].captures.length, 2);
  assert.ok(w.play({ from: moves[0].from, to: moves[0].to }));
  assert.equal(w.count(1), 1);
});

test('шашки: дамка бьёт издалека, шашка превращается в дамку', () => {
  const g = new Checkers({ turn: 0, pieces: [{ sq: sqOf(7, 0), color: 0, king: true }, { sq: sqOf(3, 4), color: 1 }] });
  const m = g.legalMoves();
  assert.ok(m.length >= 1 && m.every((x) => x.captures.length === 1));
  const p = new Checkers({ turn: 0, pieces: [{ sq: sqOf(1, 2), color: 0 }, { sq: sqOf(6, 7), color: 1 }] });
  assert.ok(p.play({ from: sqOf(1, 2), to: sqOf(0, 1) }));
  assert.equal(p.pieceAt(sqOf(0, 1)).type, 'king');
});

test('шашки: бот доигрывает партию до конца', () => {
  const g = new Checkers();
  let n = 0;
  while (!g.result() && n++ < 300) assert.ok(g.play(chooseMove8(g, 'checkers', n % 2 ? 'medium' : 'easy')));
  assert.ok(g.result());
});

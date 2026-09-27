import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import WebSocket from 'ws';

const PORT = 18081;

function client() {
  const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
  const queue = [];
  const waiters = [];
  ws.on('message', (d) => {
    const msg = JSON.parse(d.toString());
    const i = waiters.findIndex((w) => w.t === msg.t);
    if (i !== -1) waiters.splice(i, 1)[0].resolve(msg);
    else queue.push(msg);
  });
  return {
    ws,
    open: () => new Promise((r) => ws.on('open', r)),
    send: (m) => ws.send(JSON.stringify(m)),
    next: (t) => {
      const i = queue.findIndex((m) => m.t === t);
      if (i !== -1) return Promise.resolve(queue.splice(i, 1)[0]);
      return new Promise((resolve) => waiters.push({ t, resolve }));
    },
  };
}

test('быстрый поиск, ходы, проверка очереди хода, сдача', async (t) => {
  const srv = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, PORT: String(PORT) } });
  t.after(() => srv.kill());
  await new Promise((r) => srv.stdout.once('data', r));
  const a = client();
  const b = client();
  await Promise.all([a.open(), b.open()]);
  a.send({ t: 'hello', name: 'A' });
  b.send({ t: 'hello', name: 'B' });
  await Promise.all([a.next('hello'), b.next('hello')]);
  a.send({ t: 'quick', size: 9, time: 60 });
  await a.next('searching');
  b.send({ t: 'quick', size: 9, time: 60 });
  const [sa, sb] = await Promise.all([a.next('start'), b.next('start')]);
  assert.equal(sa.you + sb.you, 1);
  const [blue, red] = sa.you === 0 ? [a, b] : [b, a];
  // Красный не может ходить первым
  red.send({ t: 'action', move: { type: 'move', x: 4, y: 1 } });
  assert.equal((await red.next('error')).t, 'error');
  blue.send({ t: 'action', move: { type: 'move', x: 4, y: 7 } });
  const [ea] = await Promise.all([blue.next('action'), red.next('action')]);
  assert.deepEqual(ea.move, { type: 'move', x: 4, y: 7 });
  // Недопустимая стена отклоняется
  red.send({ t: 'action', move: { type: 'wall', x: 99, y: 0, o: 'h' } });
  await red.next('reject');
  red.send({ t: 'resign' });
  const [oa, ob] = await Promise.all([blue.next('over'), red.next('over')]);
  assert.equal(oa.winner, 0);
  assert.equal(ob.reason, 'resign');
  a.ws.close();
  b.ws.close();
});

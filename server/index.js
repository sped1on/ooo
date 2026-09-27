// Сервер «Коридора»: раздаёт статику из public/ и ведёт онлайн-партии по WebSocket.
// Режимы: быстрый поиск случайного соперника и комнаты по пригласительной ссылке.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Game, BOARD_SIZES, sanitizeMove } from '../public/js/core/quoridor.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const VENDOR = path.resolve(ROOT, '..', 'node_modules', 'three', 'build');
const PORT = Number(process.env.PORT) || 8080;
const TIMES = [60, 180, 300, 600];
const RECONNECT_GRACE_MS = 30_000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  // В режиме разработки three.js берётся прямо из node_modules
  const base = url.pathname.startsWith('/vendor/') ? VENDOR : ROOT;
  const rel = base === VENDOR ? url.pathname.slice('/vendor'.length) : url.pathname;
  let file = path.normalize(path.join(base, decodeURIComponent(rel)));
  if (!file.startsWith(base)) {
    res.writeHead(403).end();
    return;
  }
  if (url.pathname.endsWith('/')) file = path.join(file, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Не найдено');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server, path: '/ws' });

/** @type {Map<string, Room>} */
const rooms = new Map();
/** Очередь быстрого поиска: ключ "size:time" -> client */
const queue = new Map();

function makeCode() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from(crypto.randomBytes(5), (b) => abc[b % abc.length]).join('');
  } while (rooms.has(code));
  return code;
}

function send(client, msg) {
  if (client?.ws?.readyState === 1) client.ws.send(JSON.stringify(msg));
}

class Room {
  constructor(size, time, isPrivate) {
    this.code = makeCode();
    this.size = size;
    this.time = time;
    this.isPrivate = isPrivate;
    this.players = [null, null]; // client; 0 — синий (ходит первым), 1 — красный
    this.game = null;
    this.timer = null;
    this.clocks = [0, 0]; // остаток времени каждого игрока на всю партию, мс
    this.turnStart = 0;
    this.rematch = [false, false];
    this.dropTimers = [null, null];
    rooms.set(this.code, this);
  }

  seatOf(client) {
    return this.players.indexOf(client);
  }

  add(client) {
    const seat = this.players[0] ? 1 : 0;
    this.players[seat] = client;
    client.room = this;
    client.seat = seat;
    return seat;
  }

  start() {
    // Случайно выбираем, кто играет синими (первый ход)
    if (Math.random() < 0.5) this.players.reverse();
    this.players.forEach((c, i) => {
      c.seat = i;
    });
    this.game = new Game(this.size);
    this.rematch = [false, false];
    this.clocks = [this.time * 1000, this.time * 1000];
    this.turnStart = Date.now();
    this.armClock();
    this.players.forEach((c, i) => send(c, { t: 'start', ...this.snapshot(i) }));
  }

  snapshot(seat) {
    return {
      you: seat,
      code: this.code,
      size: this.size,
      time: this.time,
      names: this.players.map((c) => c?.name || 'Игрок'),
      skins: this.players.map((c) => c?.skin || null),
      moves: this.game.history.map(({ type, x, y, o }) => (type === 'wall' ? { type, x, y, o } : { type, x, y })),
      turn: this.game.turn,
      clocks: this.currentClocks(),
    };
  }

  // Шахматные часы: время тикает только у того, чей ход
  currentClocks() {
    const c = this.clocks.slice();
    if (this.game && this.game.winner === -1) c[this.game.turn] = Math.max(0, c[this.game.turn] - (Date.now() - this.turnStart));
    return c;
  }

  armClock() {
    clearTimeout(this.timer);
    if (!this.game || this.game.winner !== -1) return;
    const left = this.clocks[this.game.turn];
    this.timer = setTimeout(() => this.onTimeout(), left + 250);
  }

  onTimeout() {
    if (!this.game || this.game.winner !== -1) return;
    const loser = this.game.turn;
    this.clocks[loser] = 0;
    this.finish(1 - loser, 'timeout');
  }

  apply(move) {
    const by = this.game.turn;
    const spent = Date.now() - this.turnStart;
    if (spent >= this.clocks[by]) {
      this.onTimeout();
      return true;
    }
    if (!this.game.play(move)) return false;
    this.clocks[by] -= spent;
    this.turnStart = Date.now();
    this.armClock();
    const clocks = this.currentClocks();
    this.players.forEach((c) => send(c, { t: 'action', move, by, clocks }));
    if (this.game.winner !== -1) this.finish(this.game.winner, 'goal');
    return true;
  }

  finish(winner, reason) {
    clearTimeout(this.timer);
    if (this.game && this.game.winner === -1) this.game.winner = winner;
    this.players.forEach((c) => send(c, { t: 'over', winner, reason, clocks: this.clocks }));
  }

  leave(client, reason = 'left') {
    const seat = this.seatOf(client);
    if (seat === -1) return;
    clearTimeout(this.dropTimers[seat]);
    this.players[seat] = null;
    client.room = null;
    const other = this.players[1 - seat];
    if (this.game && this.game.winner === -1 && other) {
      this.finish(1 - seat, reason);
    }
    if (other) send(other, { t: 'opponent_left' });
    if (!this.players[0] && !this.players[1]) this.destroy();
  }

  destroy() {
    clearTimeout(this.timer);
    this.dropTimers.forEach(clearTimeout);
    rooms.delete(this.code);
  }
}

function leaveQueue(client) {
  for (const [key, c] of queue) if (c === client) queue.delete(key);
}

function handle(client, msg) {
  switch (msg.t) {
    case 'hello': {
      client.name = String(msg.name || 'Игрок').slice(0, 20).trim() || 'Игрок';
      const skinId = (v) => (typeof v === 'string' && /^[a-z0-9-]{1,24}$/.test(v) ? v : null);
      client.skin = { pawns: skinId(msg.skin?.pawns) || 'c-player', walls: skinId(msg.skin?.walls) };
      // Переподключение к идущей партии
      if (msg.resume && typeof msg.resume.code === 'string') {
        const room = rooms.get(msg.resume.code);
        const seat = room ? room.players.findIndex((c) => c && c.token === msg.resume.token) : -1;
        if (room && seat !== -1 && room.game) {
          const old = room.players[seat];
          clearTimeout(room.dropTimers[seat]);
          client.token = old.token;
          room.players[seat] = client;
          client.room = room;
          client.seat = seat;
          send(client, { t: 'start', resumed: true, ...room.snapshot(seat) });
          send(room.players[1 - seat], { t: 'opponent_back' });
          if (room.game.winner !== -1) send(client, { t: 'over', winner: room.game.winner, reason: 'goal' });
          return;
        }
      }
      send(client, { t: 'hello', token: client.token });
      return;
    }
    case 'quick': {
      if (client.room) client.room.leave(client);
      leaveQueue(client);
      const size = BOARD_SIZES.includes(msg.size) ? msg.size : 9;
      const time = TIMES.includes(msg.time) ? msg.time : 60;
      const key = `${size}:${time}`;
      const waiting = queue.get(key);
      if (waiting && waiting !== client && waiting.ws.readyState === 1) {
        queue.delete(key);
        const room = new Room(size, time, false);
        room.add(waiting);
        room.add(client);
        room.start();
      } else {
        queue.set(key, client);
        send(client, { t: 'searching' });
      }
      return;
    }
    case 'cancel':
      leaveQueue(client);
      if (client.room && !client.room.game) {
        const room = client.room;
        room.leave(client);
      }
      return;
    case 'create': {
      if (client.room) client.room.leave(client);
      leaveQueue(client);
      const size = BOARD_SIZES.includes(msg.size) ? msg.size : 9;
      const time = TIMES.includes(msg.time) ? msg.time : 60;
      const room = new Room(size, time, true);
      room.add(client);
      send(client, { t: 'room', code: room.code, size, time });
      return;
    }
    case 'join': {
      const code = String(msg.code || '').toUpperCase().trim();
      const room = rooms.get(code);
      if (!room || !room.isPrivate) {
        send(client, { t: 'error', msg: 'Комната не найдена. Проверьте ссылку или код.' });
        return;
      }
      if (room.seatOf(client) !== -1) return;
      if (room.players[0] && room.players[1]) {
        send(client, { t: 'error', msg: 'В этой комнате уже идёт игра.' });
        return;
      }
      if (client.room) client.room.leave(client);
      leaveQueue(client);
      room.add(client);
      room.start();
      return;
    }
    case 'action': {
      const room = client.room;
      if (!room?.game || room.game.winner !== -1) return;
      if (room.game.turn !== client.seat) {
        send(client, { t: 'error', msg: 'Сейчас ход соперника.' });
        return;
      }
      const move = sanitizeMove(msg.move);
      if (!move || !room.apply(move)) send(client, { t: 'reject', msg: 'Недопустимый ход.' });
      return;
    }
    case 'resign': {
      const room = client.room;
      if (room?.game && room.game.winner === -1) room.finish(1 - client.seat, 'resign');
      return;
    }
    case 'rematch': {
      const room = client.room;
      if (!room?.game || room.game.winner === -1) return;
      room.rematch[client.seat] = true;
      const other = room.players[1 - client.seat];
      if (!other) {
        send(client, { t: 'error', msg: 'Соперник уже ушёл.' });
        return;
      }
      if (room.rematch[0] && room.rematch[1]) room.start();
      else send(other, { t: 'rematch_offer' });
      return;
    }
    case 'emote': {
      const room = client.room;
      const id = String(msg.id || '').slice(0, 16);
      if (room) send(room.players[1 - client.seat], { t: 'emote', id });
      return;
    }
    case 'leave':
      leaveQueue(client);
      if (client.room) client.room.leave(client);
      return;
    default:
  }
}

wss.on('connection', (ws) => {
  const client = { ws, name: 'Игрок', room: null, seat: -1, token: crypto.randomUUID() };
  ws.isAliveFlag = true;
  ws.on('pong', () => {
    ws.isAliveFlag = true;
  });
  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (msg && typeof msg.t === 'string') handle(client, msg);
  });
  ws.on('close', () => {
    leaveQueue(client);
    const room = client.room;
    if (!room) return;
    const seat = room.seatOf(client);
    if (room.game && room.game.winner === -1 && seat !== -1) {
      // Даём время переподключиться
      send(room.players[1 - seat], { t: 'opponent_dropped', grace: RECONNECT_GRACE_MS });
      room.dropTimers[seat] = setTimeout(() => {
        if (room.players[seat] === client) room.leave(client, 'disconnect');
      }, RECONNECT_GRACE_MS);
    } else {
      room.leave(client);
    }
  });
});

setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAliveFlag === false) {
      ws.terminate();
      continue;
    }
    ws.isAliveFlag = false;
    ws.ping();
  }
}, 30_000).unref();

server.listen(PORT, () => {
  console.log(`Коридор запущен: http://localhost:${PORT}`);
});

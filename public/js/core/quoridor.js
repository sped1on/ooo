// Правила игры «Коридор» (Quoridor). Чистая логика без DOM — используется и
// клиентом, и сервером.
//
// Координаты: клетка (x, y), x — столбец слева направо, y — строка сверху вниз.
// Игрок 0 (синий) стартует снизу и идёт к строке 0.
// Игрок 1 (красный) стартует сверху и идёт к строке n-1.
//
// Стена ставится в «перекрёсток» борозд (x, y), 0 <= x, y <= n-2:
//  'h' — горизонтальная, закрывает проход между строками y и y+1 для столбцов x и x+1;
//  'v' — вертикальная, закрывает проход между столбцами x и x+1 для строк y и y+1.

export const BOARD_SIZES = [5, 7, 9, 11];
export const WALLS_BY_SIZE = { 5: 4, 7: 7, 9: 10, 11: 14 };
export const PLAYER_NAMES = ['Синий', 'Красный'];

const DIRS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

export class Game {
  constructor(n = 9, wallsPerPlayer = WALLS_BY_SIZE[n] ?? 10) {
    if (n < 3 || n % 2 === 0) throw new Error('Размер поля должен быть нечётным');
    this.n = n;
    this.wallsPerPlayer = wallsPerPlayer;
    this.reset();
  }

  reset() {
    const n = this.n;
    const mid = (n - 1) >> 1;
    this.pawns = [
      { x: mid, y: n - 1 },
      { x: mid, y: 0 },
    ];
    this.wallsLeft = [this.wallsPerPlayer, this.wallsPerPlayer];
    this.walls = [];
    // hBlock[x*n+y] — закрыт проход между (x,y) и (x,y+1)
    // vBlock[x*n+y] — закрыт проход между (x,y) и (x+1,y)
    this.hBlock = new Uint8Array(n * n);
    this.vBlock = new Uint8Array(n * n);
    // wallAt[x*(n-1)+y]: 0 — пусто, 1 — 'h', 2 — 'v'
    this.wallAt = new Uint8Array((n - 1) * (n - 1));
    this.turn = 0;
    this.winner = -1;
    this.history = [];
  }

  clone() {
    const g = Object.create(Game.prototype);
    g.n = this.n;
    g.wallsPerPlayer = this.wallsPerPlayer;
    g.pawns = this.pawns.map((p) => ({ ...p }));
    g.wallsLeft = this.wallsLeft.slice();
    g.walls = this.walls.slice();
    g.hBlock = this.hBlock.slice();
    g.vBlock = this.vBlock.slice();
    g.wallAt = this.wallAt.slice();
    g.turn = this.turn;
    g.winner = this.winner;
    g.history = this.history.slice();
    return g;
  }

  goalRow(player) {
    return player === 0 ? 0 : this.n - 1;
  }

  inside(x, y) {
    return x >= 0 && y >= 0 && x < this.n && y < this.n;
  }

  // Можно ли пройти из (x,y) на соседнюю клетку в направлении (dx,dy)
  canStep(x, y, dx, dy) {
    const n = this.n;
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= n || ny >= n) return false;
    if (dy === 1) return !this.hBlock[x * n + y];
    if (dy === -1) return !this.hBlock[x * n + ny];
    if (dx === 1) return !this.vBlock[x * n + y];
    return !this.vBlock[nx * n + y];
  }

  // Допустимые ходы фишки игрока (с учётом прыжков через соперника)
  pawnMoves(player = this.turn) {
    const me = this.pawns[player];
    const op = this.pawns[1 - player];
    const res = [];
    for (const [dx, dy] of DIRS) {
      if (!this.canStep(me.x, me.y, dx, dy)) continue;
      const nx = me.x + dx;
      const ny = me.y + dy;
      if (nx === op.x && ny === op.y) {
        if (this.canStep(op.x, op.y, dx, dy)) {
          res.push({ x: op.x + dx, y: op.y + dy, jump: true });
        } else {
          // Прыжок по диагонали: за соперником стена или край поля
          const sides = dx === 0 ? [[1, 0], [-1, 0]] : [[0, 1], [0, -1]];
          for (const [sx, sy] of sides) {
            if (this.canStep(op.x, op.y, sx, sy)) {
              res.push({ x: op.x + sx, y: op.y + sy, jump: true });
            }
          }
        }
      } else {
        res.push({ x: nx, y: ny, jump: false });
      }
    }
    return res;
  }

  // Проверка геометрии стены (без проверки путей)
  wallFits(x, y, o) {
    const m = this.n - 1;
    if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
    if (x < 0 || y < 0 || x >= m || y >= m) return false;
    if (o !== 'h' && o !== 'v') return false;
    if (this.wallAt[x * m + y]) return false; // тот же перекрёсток (в т.ч. крест)
    const n = this.n;
    if (o === 'h') {
      if (this.hBlock[x * n + y] || this.hBlock[(x + 1) * n + y]) return false;
    } else if (this.vBlock[x * n + y] || this.vBlock[x * n + y + 1]) {
      return false;
    }
    return true;
  }

  _applyWall(x, y, o, sign) {
    const n = this.n;
    const m = n - 1;
    this.wallAt[x * m + y] = sign ? (o === 'h' ? 1 : 2) : 0;
    const v = sign ? 1 : 0;
    if (o === 'h') {
      this.hBlock[x * n + y] = v;
      this.hBlock[(x + 1) * n + y] = v;
    } else {
      this.vBlock[x * n + y] = v;
      this.vBlock[x * n + y + 1] = v;
    }
  }

  // Длина кратчайшего пути до цели (без учёта соперника), -1 если пути нет
  distance(player) {
    return this._bfs(player, false);
  }

  // Кратчайший путь: массив клеток от текущей (не включая) до цели
  shortestPath(player) {
    return this._bfs(player, true);
  }

  _bfs(player, wantPath) {
    const n = this.n;
    const start = this.pawns[player];
    const goal = this.goalRow(player);
    if (start.y === goal) return wantPath ? [] : 0;
    const prev = new Int32Array(n * n).fill(-1);
    const queue = new Int32Array(n * n);
    let head = 0;
    let tail = 0;
    const s = start.x * n + start.y;
    prev[s] = s;
    queue[tail++] = s;
    // Порядок направлений: сначала к цели — путь получается «прямее»
    const dirs = player === 0 ? [[0, -1], [-1, 0], [1, 0], [0, 1]] : [[0, 1], [-1, 0], [1, 0], [0, -1]];
    while (head < tail) {
      const cur = queue[head++];
      const cx = (cur / n) | 0;
      const cy = cur % n;
      for (const [dx, dy] of dirs) {
        if (!this.canStep(cx, cy, dx, dy)) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        const id = nx * n + ny;
        if (prev[id] !== -1) continue;
        prev[id] = cur;
        if (ny === goal) {
          if (!wantPath) {
            let len = 0;
            for (let k = id; k !== s; k = prev[k]) len++;
            return len;
          }
          const path = [];
          for (let k = id; k !== s; k = prev[k]) path.push({ x: (k / n) | 0, y: k % n });
          return path.reverse();
        }
        queue[tail++] = id;
      }
    }
    return wantPath ? null : -1;
  }

  // Полная проверка стены: геометрия + у обоих игроков остаётся путь
  canPlaceWall(x, y, o, player = this.turn) {
    if (this.winner !== -1) return false;
    if (this.wallsLeft[player] <= 0) return false;
    if (!this.wallFits(x, y, o)) return false;
    this._applyWall(x, y, o, true);
    const ok = this.distance(0) !== -1 && this.distance(1) !== -1;
    this._applyWall(x, y, o, false);
    return ok;
  }

  canMovePawn(x, y, player = this.turn) {
    if (this.winner !== -1) return false;
    return this.pawnMoves(player).some((m) => m.x === x && m.y === y);
  }

  isLegal(move) {
    if (!move || this.winner !== -1) return false;
    if (move.type === 'move') return this.canMovePawn(move.x, move.y);
    if (move.type === 'wall') return this.canPlaceWall(move.x, move.y, move.o);
    return false;
  }

  // Применить ход текущего игрока. Возвращает false, если ход недопустим.
  play(move) {
    if (!this.isLegal(move)) return false;
    const p = this.turn;
    if (move.type === 'move') {
      const from = { ...this.pawns[p] };
      this.pawns[p] = { x: move.x, y: move.y };
      this.history.push({ type: 'move', x: move.x, y: move.y, from, player: p });
      if (move.y === this.goalRow(p)) this.winner = p;
    } else {
      this._applyWall(move.x, move.y, move.o, true);
      this.walls.push({ x: move.x, y: move.y, o: move.o, player: p });
      this.wallsLeft[p]--;
      this.history.push({ type: 'wall', x: move.x, y: move.y, o: move.o, player: p });
    }
    this.turn = 1 - p;
    return true;
  }

  // Отмена последнего хода
  undo() {
    const last = this.history.pop();
    if (!last) return null;
    if (last.type === 'move') {
      this.pawns[last.player] = { ...last.from };
    } else {
      this._applyWall(last.x, last.y, last.o, false);
      this.walls.pop();
      this.wallsLeft[last.player]++;
    }
    this.turn = last.player;
    this.winner = -1;
    return last;
  }

  // Все допустимые стены текущего игрока (дорого — используйте осторожно)
  legalWalls(player = this.turn) {
    const res = [];
    if (this.wallsLeft[player] <= 0) return res;
    const m = this.n - 1;
    for (let x = 0; x < m; x++) {
      for (let y = 0; y < m; y++) {
        for (const o of ['h', 'v']) {
          if (this.canPlaceWall(x, y, o, player)) res.push({ type: 'wall', x, y, o });
        }
      }
    }
    return res;
  }

  // Автоматический ход (когда вышло время): шаг по кратчайшему пути
  autoMove(player = this.turn) {
    const moves = this.pawnMoves(player);
    let best = null;
    let bestD = Infinity;
    for (const mv of moves) {
      const saved = this.pawns[player];
      this.pawns[player] = { x: mv.x, y: mv.y };
      const d = mv.y === this.goalRow(player) ? 0 : this.distance(player);
      this.pawns[player] = saved;
      if (d !== -1 && d < bestD) {
        bestD = d;
        best = mv;
      }
    }
    return best ? { type: 'move', x: best.x, y: best.y } : null;
  }

  // Переиграть список ходов (для синхронизации онлайн-партий)
  static fromMoves(n, moves, wallsPerPlayer) {
    const g = new Game(n, wallsPerPlayer);
    for (const mv of moves) {
      if (!g.play(mv)) throw new Error('Недопустимый ход в истории');
    }
    return g;
  }
}

export function sanitizeMove(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const x = Number(raw.x);
  const y = Number(raw.y);
  if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
  if (raw.type === 'move') return { type: 'move', x, y };
  if (raw.type === 'wall' && (raw.o === 'h' || raw.o === 'v')) return { type: 'wall', x, y, o: raw.o };
  return null;
}

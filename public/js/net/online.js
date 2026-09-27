// Клиент онлайн-игры (WebSocket). Адрес сервера:
//  1) параметр ?server=wss://... в адресе страницы,
//  2) window.KORIDOR_SERVER (задаётся при сборке, см. scripts/build.mjs),
//  3) тот же хост, путь /ws (локальный запуск через npm start).

const RESUME_KEY = 'koridor.resume';

export function serverUrl() {
  const param = new URLSearchParams(location.search).get('server');
  if (param) return param;
  if (window.KORIDOR_SERVER) return window.KORIDOR_SERVER;
  if (location.protocol === 'file:') return null;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/ws`;
}

export class OnlineClient {
  constructor(name, skin = null) {
    this.name = name;
    this.skin = skin;
    this.ws = null;
    this.handlers = {};
    this.closedByUser = false;
    this.token = null;
    this.code = null;
  }

  on(type, fn) {
    this.handlers[type] = fn;
    return this;
  }

  connect(timeout = 6000) {
    const url = serverUrl();
    if (!url) return Promise.reject(new Error('no-server'));
    return new Promise((resolve, reject) => {
      let settled = false;
      let ws;
      try {
        ws = new WebSocket(url);
      } catch (e) {
        reject(e);
        return;
      }
      this.ws = ws;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          ws.close();
          reject(new Error('timeout'));
        }
      }, timeout);
      ws.onopen = () => {
        const resume = this._loadResume();
        this.send({ t: 'hello', name: this.name, skin: this.skin, resume });
      };
      ws.onmessage = (ev) => {
        let msg;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (msg.t === 'hello') {
          this.token = msg.token;
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(false);
          }
          return;
        }
        if (msg.t === 'start') {
          this.code = msg.code;
          this._saveResume();
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(true); // сразу вернулись в идущую партию
          }
        }
        if (msg.t === 'over') this._clearResume();
        this.handlers[msg.t]?.(msg);
      };
      ws.onerror = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(new Error('error'));
        }
      };
      ws.onclose = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(new Error('closed'));
        }
        if (!this.closedByUser) this.handlers.disconnect?.();
      };
    });
  }

  send(msg) {
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(msg));
  }

  _saveResume() {
    try {
      sessionStorage.setItem(RESUME_KEY, JSON.stringify({ code: this.code, token: this.token }));
    } catch {
      // нет хранилища
    }
  }

  _loadResume() {
    try {
      return JSON.parse(sessionStorage.getItem(RESUME_KEY) || 'null');
    } catch {
      return null;
    }
  }

  _clearResume() {
    try {
      sessionStorage.removeItem(RESUME_KEY);
    } catch {
      // нет хранилища
    }
  }

  close() {
    this.closedByUser = true;
    this._clearResume();
    this.send({ t: 'leave' });
    this.ws?.close();
  }
}

export function inviteLink(code) {
  const url = new URL(location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('room', code);
  const srv = new URLSearchParams(location.search).get('server');
  if (srv) url.searchParams.set('server', srv);
  return url.toString();
}

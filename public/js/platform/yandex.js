// Обёртка над Yandex Games SDK. Вне Яндекс Игр все методы работают как заглушки,
// поэтому игру можно запускать локально без изменений.

let ysdk = null;
let player = null;
let gameplayActive = false;
const pauseHandlers = new Set();

function loadScript(src, timeout = 4000) {
  return new Promise((resolve) => {
    const s = document.createElement('script');
    const timer = setTimeout(() => resolve(false), timeout);
    s.src = src;
    s.onload = () => {
      clearTimeout(timer);
      resolve(true);
    };
    s.onerror = () => {
      clearTimeout(timer);
      resolve(false);
    };
    document.head.appendChild(s);
  });
}

export async function initPlatform() {
  // На Яндекс Играх SDK доступен по относительному пути /sdk.js
  if (!window.YaGames) {
    const isLocal = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname) || location.protocol === 'file:';
    if (isLocal && !new URLSearchParams(location.search).has('sdk')) return false;
    await loadScript('/sdk.js');
  }
  if (!window.YaGames) return false;
  try {
    ysdk = await window.YaGames.init();
    ysdk.on?.('game_api_pause', () => pauseHandlers.forEach((fn) => fn(true)));
    ysdk.on?.('game_api_resume', () => pauseHandlers.forEach((fn) => fn(false)));
    return true;
  } catch (e) {
    console.warn('Yandex SDK init failed', e);
    ysdk = null;
    return false;
  }
}

export const isYandex = () => !!ysdk;

export function lang() {
  return ysdk?.environment?.i18n?.lang || navigator.language?.slice(0, 2) || 'ru';
}

// Сообщаем платформе, что игра загрузилась и готова
export function loadingReady() {
  try {
    ysdk?.features?.LoadingAPI?.ready();
  } catch {
    // нет SDK
  }
}

export function gameplayStart() {
  if (gameplayActive) return;
  gameplayActive = true;
  try {
    ysdk?.features?.GameplayAPI?.start();
  } catch {
    // нет SDK
  }
}

export function gameplayStop() {
  if (!gameplayActive) return;
  gameplayActive = false;
  try {
    ysdk?.features?.GameplayAPI?.stop();
  } catch {
    // нет SDK
  }
}

// Подписка на паузу (реклама, сворачивание вкладки)
export function onPause(fn) {
  pauseHandlers.add(fn);
  return () => pauseHandlers.delete(fn);
}

document.addEventListener('visibilitychange', () => {
  pauseHandlers.forEach((fn) => fn(document.hidden));
});

let lastFullscreenAd = 0;

// Полноэкранная реклама между партиями. Платформа сама ограничивает частоту,
// дополнительно не показываем чаще раза в 90 секунд.
export function showFullscreenAd() {
  return new Promise((resolve) => {
    if (!ysdk || Date.now() - lastFullscreenAd < 90_000) {
      resolve(false);
      return;
    }
    lastFullscreenAd = Date.now();
    const wasActive = gameplayActive;
    ysdk.adv.showFullscreenAdv({
      callbacks: {
        onOpen: () => pauseHandlers.forEach((fn) => fn(true)),
        onClose: (shown) => {
          pauseHandlers.forEach((fn) => fn(false));
          if (wasActive) gameplayStart();
          resolve(shown);
        },
        onError: () => {
          pauseHandlers.forEach((fn) => fn(false));
          resolve(false);
        },
      },
    });
  });
}

// Реклама за вознаграждение. Возвращает true, если награду нужно выдать.
export function showRewardedAd() {
  return new Promise((resolve) => {
    if (!ysdk) {
      resolve(null); // вне платформы рекламы нет
      return;
    }
    let rewarded = false;
    ysdk.adv.showRewardedVideo({
      callbacks: {
        onOpen: () => pauseHandlers.forEach((fn) => fn(true)),
        onRewarded: () => {
          rewarded = true;
        },
        onClose: () => {
          pauseHandlers.forEach((fn) => fn(false));
          resolve(rewarded);
        },
        onError: () => {
          pauseHandlers.forEach((fn) => fn(false));
          resolve(false);
        },
      },
    });
  });
}

// Облачные сохранения игрока
export async function loadCloud() {
  if (!ysdk) return null;
  try {
    player = await ysdk.getPlayer({ scopes: false });
    const data = await player.getData(['save']);
    return data?.save || null;
  } catch {
    return null;
  }
}

let cloudTimer = null;
export function saveCloud(data) {
  if (!player) return;
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(() => {
    player.setData({ save: data }).catch(() => {});
  }, 1500);
}

export function playerName() {
  try {
    return player?.getName?.() || '';
  } catch {
    return '';
  }
}

export async function submitWins(wins) {
  try {
    await ysdk?.leaderboards?.setScore('wins', wins);
  } catch {
    // таблица лидеров не настроена
  }
}

// Выход из игры (поддерживается не на всех площадках)
export function requestExit() {
  try {
    if (ysdk?.EVENTS?.EXIT) {
      ysdk.dispatchEvent(ysdk.EVENTS.EXIT);
      return true;
    }
  } catch {
    // не поддерживается
  }
  return false;
}

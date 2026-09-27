// Обёртка над Yandex Games SDK. Вне Яндекс Игр все методы работают как заглушки,
// поэтому игру можно запускать локально без изменений.

let ysdk = null;
let player = null;
let payments = null;
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
  if (window.ZROAD_NO_SDK) return false;
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
    try {
      payments = await ysdk.getPayments({ signed: false });
    } catch {
      payments = null;
    }
    return true;
  } catch (e) {
    console.warn('Yandex SDK init failed', e);
    ysdk = null;
    return false;
  }
}

export const isYandex = () => !!ysdk;

export function deviceType() {
  return ysdk?.deviceInfo?.type || (matchMedia('(pointer: coarse)').matches ? 'mobile' : 'desktop');
}

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

export function onPause(fn) {
  pauseHandlers.add(fn);
  return () => pauseHandlers.delete(fn);
}

document.addEventListener('visibilitychange', () => {
  pauseHandlers.forEach((fn) => fn(document.hidden));
});

let lastFullscreenAd = 0;

// Полноэкранная реклама в естественных паузах (не чаще раза в 90 секунд)
export function showFullscreenAd() {
  return new Promise((resolve) => {
    if (!ysdk || Date.now() - lastFullscreenAd < 90_000) {
      resolve(false);
      return;
    }
    lastFullscreenAd = Date.now();
    const wasActive = gameplayActive;
    gameplayStop();
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

// Реклама за вознаграждение. true — награду нужно выдать; null — рекламы нет (вне Яндекса)
export function showRewardedAd() {
  return new Promise((resolve) => {
    if (!ysdk) {
      resolve(null);
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

export function playerAvatar() {
  try {
    return player?.getPhoto?.('small') || '';
  } catch {
    return '';
  }
}

export async function submitScore(name, value) {
  try {
    await ysdk?.leaderboards?.setScore(name, value);
  } catch {
    // таблица не создана в консоли
  }
}

// ------------------------------ покупки ------------------------------

export const hasPayments = () => !!payments;

export async function catalogPrices() {
  if (!payments) return {};
  try {
    const list = await payments.getCatalog();
    const out = {};
    for (const p of list) out[p.id] = p.price;
    return out;
  } catch {
    return {};
  }
}

export async function purchase(id) {
  if (!payments) return false;
  try {
    const p = await payments.purchase({ id });
    await payments.consumePurchase(p.purchaseToken);
    return true;
  } catch {
    return false;
  }
}

// Необработанные покупки (если игра закрылась до выдачи)
export async function pendingPurchases() {
  if (!payments) return [];
  try {
    const list = await payments.getPurchases();
    const ids = [];
    for (const p of list) {
      ids.push(p.productID);
      await payments.consumePurchase(p.purchaseToken);
    }
    return ids;
  } catch {
    return [];
  }
}

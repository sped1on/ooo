// Реклама за вознаграждение. На Яндекс Играх — настоящая (SDK),
// в остальных местах — демо-заглушка, чтобы всё можно было проверить.

import * as platform from '../platform/yandex.js';
import { h, modal } from './dom.js';

export const AD_REWARD = 200;

export function watchRewarded() {
  if (platform.isYandex()) return platform.showRewardedAd().then(Boolean);
  return new Promise((resolve) => {
    let left = 3;
    const counter = h('b', {}, String(left));
    const m = modal({
      title: 'Реклама',
      closable: false,
      body: h(
        'div',
        { style: { textAlign: 'center' } },
        h('div', { class: 'spinner' }),
        h('p', {}, 'Демо-версия: на Яндекс Играх здесь будет показан рекламный ролик.'),
        h('p', {}, 'Осталось ', counter, ' с'),
      ),
    });
    const timer = setInterval(() => {
      left--;
      counter.textContent = String(left);
      if (left <= 0) {
        clearInterval(timer);
        m.close();
        resolve(true);
      }
    }, 1000);
  });
}

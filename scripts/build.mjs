// Сборка игры:
//   dist/yandex/          — папка для Яндекс Игр (index.html в корне)
//   dist/koridor-yandex.zip — архив для загрузки в консоль разработчика
//   dist/koridor.html     — всё в одном файле (для быстрой проверки в браузере)
//
// Переменные окружения:
//   ONLINE_URL=wss://example.com/ws — адрес онлайн-сервера, вшивается в сборку

import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = path.join(root, 'public');
const dist = path.join(root, 'dist');
const out = path.join(dist, 'yandex');

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const result = await build({
  entryPoints: [path.join(pub, 'js', 'main.js')],
  bundle: true,
  minify: true,
  format: 'esm',
  target: ['es2020'],
  write: false,
  legalComments: 'none',
});
const js = result.outputFiles[0].text;
const css = fs.readFileSync(path.join(pub, 'css', 'style.css'), 'utf8');
const favicon = fs.readFileSync(path.join(pub, 'favicon.svg'), 'utf8');

const serverCfg = process.env.ONLINE_URL ? `<script>window.KORIDOR_SERVER=${JSON.stringify(process.env.ONLINE_URL)};</script>` : '';

let html = fs.readFileSync(path.join(pub, 'index.html'), 'utf8');
html = html.replace(/<!-- importmap-start -->[\s\S]*?<!-- importmap-end -->/, serverCfg);

// Папка для Яндекс Игр
fs.mkdirSync(path.join(out, 'css'));
fs.writeFileSync(path.join(out, 'css', 'style.css'), css);
fs.writeFileSync(path.join(out, 'favicon.svg'), favicon);
fs.writeFileSync(path.join(out, 'game.js'), js);
fs.writeFileSync(path.join(out, 'index.html'), html.replace('src="js/main.js"', 'src="game.js"'));

try {
  execFileSync('zip', ['-r', '-q', path.join(dist, 'koridor-yandex.zip'), '.'], { cwd: out });
  console.log('Архив для Яндекс Игр: dist/koridor-yandex.zip');
} catch {
  console.log('Утилита zip не найдена — заархивируйте содержимое dist/yandex вручную');
}

// Однофайловая версия (без SDK Яндекса)
const inlineJs = js.replace(/<\/script/gi, '<\\/script');
let single = html
  .replace('<link rel="stylesheet" href="css/style.css" />', `<style>${css}</style>`)
  .replace('<link rel="icon" href="favicon.svg" type="image/svg+xml" />', `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(favicon)}" />`)
  .replace('<script type="module" src="js/main.js"></script>', () => `<script>window.KORIDOR_NO_SDK=true;</script><script type="module">${inlineJs}</script>`);
fs.writeFileSync(path.join(dist, 'koridor.html'), single);

// Вариант для публикации как Artifact (страница без <html>/<head>/<body>)
const bodyInner = single.slice(single.indexOf('<body>') + 6, single.lastIndexOf('</body>'));
fs.writeFileSync(
  path.join(dist, 'koridor-artifact.html'),
  `<title>Коридор</title>\n<style>${css}</style>\n${bodyInner}`,
);

const kb = (f) => `${Math.round(fs.statSync(f).size / 1024)} КБ`;
console.log(`dist/yandex/game.js — ${kb(path.join(out, 'game.js'))}`);
console.log(`dist/koridor.html — ${kb(path.join(dist, 'koridor.html'))}`);

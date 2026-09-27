// Сборка для Яндекс Игр:
//   dist/yandex/            — папка с игрой (index.html в корне)
//   dist/zombie-road-yandex.zip — архив для загрузки в консоль разработчика

import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const out = path.join(dist, 'yandex');

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

await build({
  entryPoints: [path.join(root, 'js', 'main.js')],
  bundle: true,
  minify: true,
  format: 'esm',
  target: ['es2020'],
  outfile: path.join(out, 'game.js'),
  legalComments: 'none',
});

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<!-- importmap-start -->[\s\S]*?<!-- importmap-end -->/, '');
html = html.replace('src="js/main.js"', 'src="game.js"');
fs.writeFileSync(path.join(out, 'index.html'), html);
fs.mkdirSync(path.join(out, 'css'));
fs.copyFileSync(path.join(root, 'css', 'style.css'), path.join(out, 'css', 'style.css'));
fs.copyFileSync(path.join(root, 'favicon.svg'), path.join(out, 'favicon.svg'));
fs.cpSync(path.join(root, 'assets'), path.join(out, 'assets'), { recursive: true });

const zip = path.join(dist, 'zombie-road-yandex.zip');
try {
  execFileSync('zip', ['-r', '-q', zip, '.'], { cwd: out });
  console.log(`Архив для Яндекс Игр: dist/zombie-road-yandex.zip (${Math.round(fs.statSync(zip).size / 1024)} КБ)`);
} catch {
  console.log('Утилита zip не найдена — заархивируйте содержимое dist/yandex вручную');
}
// Версия одной страницей (для просмотра по ссылке, без SDK Яндекса)
let css = fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8');
css = css.replace(/url\('\.\.\/assets\/fonts\/([^']+)'\)/g, (m, f) => `url(data:font/woff2;base64,${fs.readFileSync(path.join(root, 'assets', 'fonts', f)).toString('base64')})`);
const js = fs.readFileSync(path.join(out, 'game.js'), 'utf8').replace(/<\/script/gi, '<\\/script');
const body = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>')).replace(/<script type="module" src="game.js"><\/script>/, '');
fs.writeFileSync(
  path.join(dist, 'zombie-road-artifact.html'),
  `<title>Дорога Зомби</title>\n<style>:root{color-scheme:dark}\n${css}</style>\n${body}\n<script>window.ZROAD_NO_SDK=true;</script>\n<script type="module">${js}</script>\n`,
);
console.log(`dist/zombie-road-artifact.html — ${Math.round(fs.statSync(path.join(dist, 'zombie-road-artifact.html')).size / 1024)} КБ`);
console.log(`dist/yandex/game.js — ${Math.round(fs.statSync(path.join(out, 'game.js')).size / 1024)} КБ`);

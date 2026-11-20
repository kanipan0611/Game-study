// dist/ のビルド結果を、CSS・JS を埋め込んだ1つのHTMLにまとめる（Webページとして共有・公開する用）。
// 使い方：npm run build:artifact → dist-artifact/fp-quest.html
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const css = [...html.matchAll(/<link rel="stylesheet"[^>]*href="\.?\/?([^"]+)"/g)].map((m) => readFileSync(join(dist, m[1]), 'utf8')).join('\n');
const js = [...html.matchAll(/<script type="module"[^>]*src="\.?\/?([^"]+)"/g)].map((m) => readFileSync(join(dist, m[1]), 'utf8')).join('\n');
if (!css || !js) throw new Error('dist/index.html から CSS/JS を見つけられません。先に npm run build を実行してください。');

const safeJs = js.replace(/<\/script/gi, '<\\/script');
const out = `<title>FP QUEST</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="theme-color" content="#0b1530">
<style>${css}</style>
<div id="root"></div>
<script type="module">${safeJs}</script>
`;
mkdirSync('dist-artifact', { recursive: true });
writeFileSync('dist-artifact/fp-quest.html', out);
console.log(`dist-artifact/fp-quest.html (${(out.length / 1024).toFixed(0)} KB)`);

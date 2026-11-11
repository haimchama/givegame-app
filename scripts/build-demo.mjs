// Builds dist/demo.html: a single self-contained file of the app in demo-only mode (no server).
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
const js = (await build({ entryPoints: ['public/app.js'], bundle: true, format: 'iife', minify: true, write: false, target: 'es2022' })).outputFiles[0].text;
const avatars = Object.fromEntries(readdirSync('public/avatars').filter(f => f.endsWith('.webp')).map(f => [f.replace('.webp', ''), 'data:image/webp;base64,' + readFileSync('public/avatars/' + f).toString('base64')]));
const acc = Object.fromEntries(readdirSync('public/acc').filter(f => f.endsWith('.webp')).map(f => [f.replace('.webp', ''), 'data:image/webp;base64,' + readFileSync('public/acc/' + f).toString('base64')]));
const css = readFileSync('public/style.css', 'utf8');
const html = readFileSync('public/index.html', 'utf8')
  .replace('<link rel="stylesheet" href="/style.css">', `<style>${css}</style>`)
  .replace('<script type="module" src="/app.js"></script>', `<script>window.GG_DEMO_ONLY=true;window.GG_AVATARS=${JSON.stringify(avatars)};window.GG_ACC=${JSON.stringify(acc)};</script><script>${js.replace(/<\/script/gi, '<\\/script')}</script>`)
  .replace(', viewport-fit=cover', '')
  .replace('<title>GiveGame · ערב גיוס שהוא משחק</title>', '<title>GiveGame · דמו</title>');
mkdirSync('dist', { recursive: true });
writeFileSync('dist/demo.html', html);
console.log('dist/demo.html', (html.length / 1024).toFixed(0) + ' KB');

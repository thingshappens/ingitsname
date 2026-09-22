// Assembles the one HSC site into ./dist for Cloudflare.
// /            Home          (home/index.html)
// /maison/     Maison        (maison/index.html)
// /atelier/    Atelier       (vite: index.html)
// /edit/       The Edit      (vite: edit/index.html)
// /tailor/     Tailor        (tailor/, prebuilt)
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, renameSync, readFileSync, writeFileSync, existsSync } from 'node:fs';

const run = (c) => execSync(c, { stdio: 'inherit' });
run('npx vite build');

mkdirSync('dist/atelier', { recursive: true });
renameSync('dist/index.html', 'dist/atelier/index.html');
cpSync('home/index.html', 'dist/index.html');
mkdirSync('dist/maison', { recursive: true });
cpSync('maison/index.html', 'dist/maison/index.html');

mkdirSync('dist/tailor', { recursive: true });
cpSync('tailor/assets', 'dist/tailor/assets', { recursive: true });
const tailorHtml = readFileSync('tailor/index.html', 'utf8')
  .replaceAll('"/assets/', '"/tailor/assets/')
  .replaceAll('https://atelier.hautesoundcouture.com/hsc-nav.js', '/hsc-nav.js');
writeFileSync('dist/tailor/index.html', tailorHtml);

for (const f of ['edit/cut-catalog.json']) if (existsSync(f)) cpSync(f, 'dist/' + f);
console.log('HSC site assembled in dist/');

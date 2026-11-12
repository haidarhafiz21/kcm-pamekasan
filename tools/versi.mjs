// Memberi nomor versi (hash isi file) ke CSS & JavaScript di index.html.
//
// GitHub Pages mengizinkan browser menyimpan file selama 10 menit, dan Safari
// di iPhone sering memakai salinan lama lebih lama lagi. Dengan nomor versi
// (mis. js/main.js?v=3fa2c1d9), setiap file yang isinya berubah mendapat
// alamat baru sehingga semua perangkat langsung mengambil versi terbaru.
//
// Jalankan sebelum commit:   node tools/versi.mjs
// (otomatis lewat .githooks/pre-commit bila `git config core.hooksPath .githooks`)

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(join(root, p));
const hash = (p) => createHash('sha1').update(read(p)).digest('hex').slice(0, 8);
const v = (p) => `${p}?v=${hash(p)}`;
const list = (dir, ext) =>
  readdirSync(join(root, dir)).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(join(root, p)).isDirectory()) return list(p, ext);
    return p.endsWith(ext) ? [p.split(sep).join('/')] : [];
  });

const imports = {
  three: `./${v('vendor/three/three.module.min.js')}`,
};
for (const p of list('vendor/three/addons', '.js')) {
  imports[`three/addons/${relative('vendor/three/addons', p).split(sep).join('/')}`] = `./${v(p)}`;
}
// modul milik sendiri: alamat "./js/x.js" (hasil import relatif) diarahkan ke versi bernomor
for (const p of list('js', '.js').sort()) {
  if (p !== 'js/main.js') imports[`./${p}`] = `./${v(p)}`;
}

const map = JSON.stringify({ imports }, null, 2).replace(/\n/g, '\n  ');
const block = [
  '<!-- versi:mulai — dibuat otomatis oleh tools/versi.mjs, jangan diedit manual -->',
  `  <link rel="stylesheet" href="${v('css/style.css')}">`,
  // import map harus dimuat sebelum modul apa pun (termasuk modulepreload)
  '  <script type="importmap">',
  `  ${map}`,
  '  </script>',
  `  <link rel="modulepreload" href="${imports.three.slice(2)}">`,
  '  <!-- versi:selesai -->',
].join('\n');

const file = join(root, 'index.html');
let html = readFileSync(file, 'utf8');
const before = html;
html = html.replace(/<!-- versi:mulai[\s\S]*?<!-- versi:selesai -->/, block);
html = html.replace(/<script type="module" src="js\/main\.js[^"]*"><\/script>/, `<script type="module" src="${v('js/main.js')}"></script>`);
if (html !== before) {
  writeFileSync(file, html);
  console.log('index.html diperbarui dengan versi file terbaru');
} else {
  console.log('index.html sudah memakai versi terbaru');
}

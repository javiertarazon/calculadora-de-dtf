const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function extractAppShell(swContent) {
  const match = swContent.match(/const APP_SHELL = \[(.*?)\];/s);
  assert(match, 'No se pudo localizar APP_SHELL en sw.js.');

  return [...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]);
}

function extractCacheName(swContent) {
  const match = swContent.match(/const CACHE_NAME = '([^']+)'/);
  assert(match, 'No se pudo localizar CACHE_NAME en sw.js.');
  return match[1];
}

function main() {
  const version = readText('VERSION').trim();
  const manifest = JSON.parse(readText('manifest.webmanifest'));
  const swContent = readText('sw.js');
  const indexHtml = readText('index.html');
  const cacheName = extractCacheName(swContent);
  const appShell = extractAppShell(swContent);

  assert(version.length > 0, 'VERSION está vacío.');
  assert(cacheName.includes(version), 'CACHE_NAME no incluye la versión actual.');

  assert(manifest.name === 'Calculadora DTF PRO', 'El nombre del manifest no coincide con la app.');
  assert(manifest.short_name === 'DTF PRO', 'El short_name del manifest no es el esperado.');
  assert(manifest.display === 'standalone', 'El manifest debe usar display standalone.');
  assert(manifest.start_url === './index.html', 'El start_url del manifest no es el esperado.');
  assert(manifest.scope === './', 'El scope del manifest no es el esperado.');
  assert(Array.isArray(manifest.icons) && manifest.icons.length >= 2, 'El manifest debe declarar al menos dos iconos.');

  const requiredShellEntries = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './manifest.webmanifest',
    './assets/icon-dtf.svg',
    './assets/icon-dtf-maskable.svg',
    './VERSION',
  ];

  requiredShellEntries.forEach((entry) => {
    assert(appShell.includes(entry), `APP_SHELL no incluye ${entry}.`);
  });

  manifest.icons.forEach((icon) => {
    assert(typeof icon.src === 'string' && icon.src.length > 0, 'Hay un icono sin src en manifest.webmanifest.');
    const normalized = icon.src.replace(/^\.\//, '');
    assert(fileExists(normalized), `No existe el icono declarado en manifest: ${icon.src}`);
  });

  assert(indexHtml.includes('rel="manifest" href="manifest.webmanifest"'), 'index.html no enlaza manifest.webmanifest.');
  assert(indexHtml.includes('rel="icon" href="assets/icon-dtf.svg"'), 'index.html no enlaza el icono principal SVG.');
  assert(indexHtml.includes('rel="apple-touch-icon" href="assets/icon-dtf.svg"'), 'index.html no enlaza el apple-touch-icon.');
  assert(indexHtml.includes('<meta name="theme-color" content="#0d0d0f">'), 'index.html no declara theme-color esperado.');
  assert(swContent.includes("caches.match('./index.html')"), 'sw.js no define fallback offline hacia index.html.');

  console.log('PWA OK');
  console.log('- VERSION alineada con CACHE_NAME: OK');
  console.log('- Manifest valido y completo: OK');
  console.log('- Iconos declarados disponibles: OK');
  console.log('- APP_SHELL incluye recursos base: OK');
  console.log('- index.html enlaza recursos PWA: OK');
  console.log('- sw.js mantiene fallback offline a index.html: OK');
}

try {
  main();
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
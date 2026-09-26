/* Cheel Out Shop ERP — service worker
   Guarda os arquivos do site no aparelho: o sistema abre na hora (mesmo com internet lenta).
   Os dados NÃO passam por aqui: continuam indo direto para a planilha. */
const CACHE = 'cheel-erp-v24-1';
const BASE = ['./', './index.html', './logo.webp', './manifest.webmanifest', './favicon-32.png', './icon-192.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE)).catch(() => {}));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const guardar = (req, res) => { if (res && res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(req, c)); } return res; };
const redePrimeiro = req => fetch(req).then(r => guardar(req, r)).catch(() => caches.match(req).then(r => r || caches.match('./index.html')));
const cachePrimeiro = req => caches.match(req).then(r => r || fetch(req).then(x => guardar(req, x)));
const cacheEAtualiza = req => caches.match(req).then(r => { const f = fetch(req).then(x => guardar(req, x)).catch(() => r); return r || f; });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // gravações e a planilha nunca passam pelo cache
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    const p = url.pathname;
    if (req.mode === 'navigate' || p.endsWith('/') || p.endsWith('index.html') || p.endsWith('config.js')) return e.respondWith(redePrimeiro(req));
    if (url.search.includes('v=')) return e.respondWith(cachePrimeiro(req));   // arquivos com versão: nunca mudam
    return e.respondWith(cacheEAtualiza(req));
  }
  if (/fonts\.(googleapis|gstatic)\.com$|cdnjs\.cloudflare\.com$/.test(url.hostname)) e.respondWith(cacheEAtualiza(req));
});

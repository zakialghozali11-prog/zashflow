/* ZashFlow Service Worker
 * - App Shell  : Stale-While-Revalidate (cepat & bisa dibuka offline)
 * - API Pasar  : Network-First (data terbaru, fallback cache saat offline)
 */
const VERSION = 'zashflow-v1.8.12';
const SHELL_CACHE = `${VERSION}-shell`;
const API_CACHE = `${VERSION}-api`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const MAX_API_ENTRIES = 32;

const APP_SHELL = [
  './',
  './index.html',
  './niza.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './manifest-niza.json',
  './icon.svg',
  './icon-pink.svg',
  './icon-blue.png',
  './icon-pink.png',
  './icon-blue-any.png',
  './icon-pink-any.png',
  './badge.png',
  './blank.png'
];
const SHELL_FILES = new Set([
  '', 'index.html', 'niza.html', 'styles.css', 'app.js',
  'manifest.json', 'manifest-niza.json',
  'icon.svg', 'icon-pink.svg', 'icon-blue.png', 'icon-pink.png', 'icon-blue-any.png', 'icon-pink-any.png', 'badge.png', 'blank.png'
]);

const API_HOSTS = new Set([
  'api.gold-api.com',
  'api.coingecko.com',
  'open.er-api.com',
  'api.binance.com',
  'data-api.binance.vision',
  'query1.finance.yahoo.com',
  'query2.finance.yahoo.com'
]);

const FONT_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data !== 'SKIP_WAITING') return;
  if (event.source && typeof event.source.url === 'string' && !event.source.url.startsWith(self.location.origin)) return;
  self.skipWaiting();
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const raw = event.notification?.data?.url;
  const target = (typeof raw === 'string' && raw.startsWith(self.location.origin)) ? raw : new URL('./#schedule', self.location.href).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.startsWith(self.location.origin)) {
          if ('focus' in client) client.focus();
          if (client.navigate && !client.url.endsWith('#schedule')) client.navigate(target).catch(() => {});
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch { return; }

  // API harga pasar (hanya HTTPS ke host allowlist) → Network-First
  if (url.protocol === 'https:' && API_HOSTS.has(url.hostname)) {
    event.respondWith(networkFirst(req));
    return;
  }

  // App Shell (same-origin, hanya berkas statis dikenal) → Stale-While-Revalidate
  if (url.origin === self.location.origin) {
    const isNav = req.mode === 'navigate';
    const baseName = url.pathname.split('/').pop() || '';
    const navFallback = baseName === 'niza.html' ? './niza.html' : './index.html';
    if (isNav || SHELL_FILES.has(baseName)) {
      event.respondWith(staleWhileRevalidate(event, req, SHELL_CACHE, isNav ? navFallback : null, true, false));
    }
    return;
  }

  // Google Fonts (hanya HTTPS) → Stale-While-Revalidate (runtime)
  if (url.protocol === 'https:' && FONT_HOSTS.has(url.hostname)) {
    event.respondWith(staleWhileRevalidate(event, req, RUNTIME_CACHE, null, false, true));
  }
});

async function staleWhileRevalidate(event, req, cacheName, fallbackUrl, ignoreSearch, allowOpaque) {
  const cache = await caches.open(cacheName);
  let cached = await cache.match(req, { ignoreSearch });
  if (!cached && fallbackUrl) cached = await cache.match(fallbackUrl);

  const network = fetch(req)
    .then((res) => {
      if (res && ((res.ok && res.type !== 'opaque') || (allowOpaque && res.type === 'opaque'))) {
        cache.put(req, res.clone()).catch(() => {});
      }
      return res;
    })
    .catch(() => null);

  if (cached) {
    event.waitUntil(network);
    return cached;
  }
  const res = await network;
  if (res) return res;
  if (fallbackUrl) {
    const fb = await cache.match(fallbackUrl);
    if (fb) return fb;
  }
  return new Response('ZashFlow sedang offline.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

async function networkFirst(req) {
  const cache = await caches.open(API_CACHE);
  try {
    const res = await fetch(req, { credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (res && res.ok && res.type !== 'opaque') {
      cache.put(req, res.clone()).then(async () => {
        const keys = await cache.keys();
        if (keys.length > MAX_API_ENTRIES) {
          await Promise.all(keys.slice(0, keys.length - MAX_API_ENTRIES).map((k) => cache.delete(k)));
        }
      }).catch(() => {});
    }
    return res;
  } catch {
    const cached = await cache.match(req, { ignoreSearch: false });
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

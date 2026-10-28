// Road to 70.3 service worker: keeps the app working offline and picks up new versions right away.
// Bump VERSION whenever index.html or the icons change.
const VERSION = 'r703-v7';
const FONTS = 'r703-fonts';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', (event) => {
  // cache: 'reload' skips the browser's HTTP cache so a fresh copy is stored.
  event.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate') {
      // Always check GitHub Pages for a newer page (no-cache revalidates instead of trusting a 10-minute-old copy).
      event.respondWith(
        fetch(new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' }))
          .then((res) => {
            if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put('./index.html', copy)); }
            return res;
          })
          .catch(() => caches.match('./index.html'))
      );
      return;
    }
    // Static files: cache first, refresh in the background.
    event.respondWith(
      caches.match(req, { ignoreSearch: true }).then((hit) => {
        const net = fetch(new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' })).then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
          return res;
        }).catch(() => hit);
        return hit || net;
      })
    );
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONTS).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => { c.put(req, res.clone()); return res; })))
    );
  }
});

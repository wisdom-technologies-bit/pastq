const CACHE = 'pastq-shell-v3';
const ASSETS = ['/', '/brand/favicon.svg', '/brand/pastq-mark.svg', '/brand/pastq-wordmark.svg'];

// Question data, results and review must never be cached: only the app shell is.
const PRIVATE = ['/api', '/result', '/review', '/practice/session/'];
function isPrivate(pathname) {
  return PRIVATE.some((prefix) => pathname.startsWith(prefix));
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isPrivate(url.pathname)) return;
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok && request.destination !== 'document') {
        const clone = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, clone));
      }
      return response;
    }).catch(() => caches.match('/'))),
  );
});

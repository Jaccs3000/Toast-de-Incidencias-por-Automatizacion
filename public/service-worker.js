const CACHE_NAME = 'jira-notifications-shell-v1';
const APP_SHELL = ['/', '/manifest.webmanifest', '/icons/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  if (event.request.method !== 'GET' || requestUrl.origin !== self.location.origin || requestUrl.pathname.startsWith('/api/')) {
    return;
  }

  const isAppShell = requestUrl.pathname === '/' || requestUrl.pathname.endsWith('.html');
  const isStaticAppAsset = requestUrl.pathname.startsWith('/assets/')
    || requestUrl.pathname.startsWith('/icons/')
    || requestUrl.pathname === '/manifest.webmanifest'
    || requestUrl.pathname === '/service-worker.js';
  if (!isAppShell && !isStaticAppAsset) return;

  event.respondWith(
    fetch(event.request).then((response) => {
      if (response.ok && isStaticAppAsset) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)));
      }
      return response;
    }).catch(async () => (await caches.match(event.request)) ?? (isAppShell ? caches.match('/') : undefined)),
  );
});

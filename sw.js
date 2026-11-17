/* Gym Log offline support. Keeps a copy of the app on the device so it opens with no signal.
   It never touches your logs: those live in the app's own storage, not in this cache. */
const CACHE = 'gymlog-e2f11212d0';
const EXTRAS = ['index.html', 'manifest.json', 'icon-180.png', 'icon-192.png', 'icon-512.png'];
const HOME = new URL('./', self.location).pathname;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.add(new Request('./', { cache: 'reload' }));
    await Promise.all(EXTRAS.map((u) => cache.add(new Request(u, { cache: 'reload' })).catch(() => null)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.indexOf('gymlog-') === 0 && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    /* Only the app page itself is stored under './'. Any other file keeps its own slot. */
    const isApp = req.mode === 'navigate' && (url.pathname === HOME || url.pathname === HOME + 'index.html');
    const key = isApp ? './' : req;
    const cached = await cache.match(key, { ignoreSearch: true });
    const fresh = fetch(req).then((res) => {
      const html = (res.headers.get('Content-Type') || '').indexOf('text/html') === 0;
      if (res && res.ok && res.type === 'basic' && !res.redirected && (!isApp || html)) cache.put(key, res.clone()).catch(() => null);
      return res;
    }).catch(() => null);
    if (cached) { event.waitUntil(fresh); return cached; }
    const res = await fresh;
    return res || new Response('Gym Log is offline and this file was not saved yet.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  })());
});

/* VERSION and RESOURCES are injected by the production build. */
const PREFIX = 'metronom-offline-';
const CACHE = PREFIX + VERSION;
const entries = new Map(RESOURCES.map((entry) => [new URL(entry.url, self.registration.scope).href, entry]));
const home = new URL('index.html', self.registration.scope).href;

async function download(url, hash) {
  const response = await fetch(new Request(url, { cache: 'reload', credentials: 'same-origin' }));
  if (!response.ok || response.redirected) throw new Error('Offline resource unavailable');
  const bytes = await response.clone().arrayBuffer();
  const actual = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (byte) => byte.toString(16).padStart(2, '0')).join('');
  if (actual !== hash) throw new Error('Offline resource version mismatch');
  return response;
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    try {
      // Verify the whole release before writing: a partial deployment cannot activate.
      const responses = await Promise.all([...entries].map(async ([url, { hash }]) => [url, await download(url, hash)]));
      const cache = await caches.open(CACHE);
      for (const [url, response] of responses) await cache.put(url, response);
    } catch (error) {
      await caches.delete(CACHE);
      throw error;
    }
  })());
});

self.addEventListener('activate', (event) => {
  // No skipWaiting/claim: an update must not replace the release of an open player.
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name);
    }
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const scope = new URL(self.registration.scope);
  let key = url.href;
  if (request.mode === 'navigate' && (url.pathname === scope.pathname || url.pathname === new URL(home).pathname)) key = home;
  if (!entries.has(key)) return; // No APIs, arbitrary routes, analytics or external fonts.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(key);
    if (cached) return cached;
    const response = await download(key, entries.get(key).hash);
    try { await cache.put(key, response.clone()); } catch { /* A live response is still usable if storage is full. */ }
    return response;
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'CHECK_OFFLINE' || !event.ports[0]) return;
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE);
      const keys = new Set((await cache.keys()).map((request) => request.url));
      event.ports[0].postMessage({ ready: [...entries.keys()].every((url) => keys.has(url)) });
    } catch { event.ports[0].postMessage({ ready: false }); }
  })());
});

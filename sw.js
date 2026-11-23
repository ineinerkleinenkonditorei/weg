// App-shell cache so the app opens instantly / offline. Map tiles are cached as you browse.
const V = 'zh-story-v20';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'zh-boundary.js', 'manifest.json', 'icon-180.png', 'icon-192.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('zh-') && k !== V && k !== 'zh-tiles').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.hostname.includes('nominatim') || u.hostname === 'api.github.com') return;
  const isTile = /arcgisonline\.com|tile\.openstreetmap\.org|wmts\.geo\.admin\.ch/.test(u.hostname);
  if (isTile){
    // cache-first for tiles, keep the cache bounded
    e.respondWith(caches.open('zh-tiles').then(async c => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const r = await fetch(e.request);
      if (r.ok || r.type === 'opaque'){
        c.put(e.request, r.clone());
        c.keys().then(ks => { if (ks.length > 3000) ks.slice(0, 500).forEach(k => c.delete(k)); });
      }
      return r;
    }));
    return;
  }
  // network-first for app files (so updates arrive), fall back to cache offline
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok && (u.origin === location.origin || u.hostname === 'unpkg.com' || u.hostname.includes('fonts.'))){
      const cl = r.clone(); caches.open(V).then(c => c.put(e.request, cl));
    }
    return r;
  }).catch(() => caches.match(e.request)));
});

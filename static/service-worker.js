const CACHE_NAME = 'ketofuel-v4';
const STATIC_ASSETS = [
    '/', '/static/app.js', '/static/style.css',
    '/static/modules/core.js', '/static/modules/fasting.js', '/static/modules/dashboard.js',
    '/static/modules/meals.js', '/static/modules/weight.js', '/static/modules/trackers.js',
    '/static/modules/food.js', '/static/modules/ketosis.js', '/static/modules/settings.js',
    '/static/modules/progress.js',
];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS)));
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ));
    self.clients.claim();
});

self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);
    // Network-only for API calls
    if (url.pathname.startsWith('/api/')) return;
    // Cache-first for static assets
    e.respondWith(
        caches.match(e.request).then(cached => cached || fetch(e.request).then(resp => {
            if (resp.ok) {
                const clone = resp.clone();
                caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
            }
            return resp;
        }))
    );
});

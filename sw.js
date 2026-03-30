const CACHE_NAME = 'potager-v3'; // Incrémentez ici (v4, v5...) pour forcer la mise à jour
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-512.png'
];

// Installation et mise en cache
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Nettoyage des anciens caches lors de l'activation
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    })
  );
});

// Stratégie : Réseau d'abord, puis Cache si hors-ligne
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});

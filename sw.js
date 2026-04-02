const CACHE_NAME = 'potager-auto-update';
const ASSETS = ['./', './index.html', './manifest.json', './icon-512.png'];

self.addEventListener('install', (e) => {
  self.skipWaiting(); // Force l'activation immédiate
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim()); // Prend le contrôle des pages immédiatement
});

self.addEventListener('fetch', (event) => {
  // Stratégie : Réseau d'abord, on ne pioche dans le cache QUE si on est hors-ligne
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

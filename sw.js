const CACHE_NAME = 'potager-v2'; // Change ce nom à chaque grosse mise à jour

// Installation : on met en cache pour le mode hors-ligne
self.addEventListener('install', (e) => {
  self.skipWaiting(); // Force le nouveau SW à s'activer tout de suite
});

// Stratégie : On cherche sur le réseau d'abord, sinon on prend le cache
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});

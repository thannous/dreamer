// Minimal service worker to make the app installable as a PWA.
// You can extend this with Workbox precaching if you need offline support.

self.addEventListener('install', event => {
  // Activate immediately after install.
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  // Take control of all clients immediately.
  event.waitUntil(self.clients.claim());
});

// Placeholder fetch handler; extend for offline caching strategies.
self.addEventListener('fetch', () => {});

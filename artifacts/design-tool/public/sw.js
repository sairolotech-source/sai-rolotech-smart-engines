self.addEventListener("install", function() { self.skipWaiting(); });
self.addEventListener("activate", function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(names.map(function(n) { return caches.delete(n); }));
    })
  );
});
self.addEventListener("fetch", function(event) {
  event.respondWith(fetch(event.request));
});

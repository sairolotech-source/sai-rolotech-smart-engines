self.addEventListener("install", function() { self.skipWaiting(); });
self.addEventListener("activate", function(event) {
  event.waitUntil(
    self.clients.claim().then(function() {
      return caches.keys();
    }).then(function(names) {
      return Promise.all(names.map(function(n) { return caches.delete(n); }));
    }).then(function() {
      return self.clients.matchAll({type: "window"});
    }).then(function(windowClients) {
      windowClients.forEach(function(c) {
        try { c.navigate(c.url); } catch(e) {}
      });
    })
  );
});
self.addEventListener("fetch", function(event) {
  event.respondWith(fetch(event.request));
});

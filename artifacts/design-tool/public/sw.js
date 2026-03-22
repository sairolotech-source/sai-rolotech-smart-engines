/**
 * SAI ROLOTECH SMART ENGINES
 * Progressive Service Worker — Play Store style progressive download
 *
 * PHASE 1 (Install):  Cache only the critical shell (< 10 KB)
 * PHASE 2 (Activate): Discover & pre-cache ALL chunks in background
 *                     — sends real-time progress back to the page
 * PHASE 3 (Fetch):    Serve everything from cache (offline-first)
 */

const CACHE_VERSION = "v3.2";
const CACHE_NAME = `sai-rolotech-${CACHE_VERSION}`;

const SHELL_URLS = [
  "/",
  "/manifest.json",
  "/favicon.svg",
  "/icon-192.png",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function broadcast(msg) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  clients.forEach((c) => c.postMessage(msg));
}

function urlIsAsset(url) {
  return (
    url.endsWith(".js") ||
    url.endsWith(".css") ||
    url.endsWith(".woff2") ||
    url.endsWith(".woff") ||
    url.endsWith(".png") ||
    url.endsWith(".svg") ||
    url.endsWith(".webp")
  );
}

// ─── Phase 1: Install ─────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

// ─── Phase 2: Activate + Progressive Pre-cache ────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Delete all old caches
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
      await self.clients.claim();

      // Kick off background pre-caching (don't block activate)
      progressivePreCache();
    })()
  );
});

async function progressivePreCache() {
  try {
    await broadcast({ type: "PRECACHE_START" });

    // Fetch the root HTML to extract all asset URLs
    const rootResp = await fetch("/", { cache: "no-store" });
    if (!rootResp.ok) return;

    const html = await rootResp.text();

    // Parse all src/href references from the HTML
    const srcMatches = [...html.matchAll(/\bsrc="([^"]+)"/g)].map((m) => m[1]);
    const hrefMatches = [...html.matchAll(/\bhref="([^"]+)"/g)].map((m) => m[1]);
    const modulePreloads = [...html.matchAll(/rel="modulepreload"[^>]+href="([^"]+)"/g)].map((m) => m[1]);

    const discovered = [...new Set([...srcMatches, ...hrefMatches, ...modulePreloads])]
      .filter(urlIsAsset)
      .filter((u) => !u.startsWith("http")); // only same-origin

    // Add any additional known paths
    const extraPaths = [
      "/icon-512.png",
      "/icon-maskable-192.png",
      "/opengraph.jpg",
    ];

    const allAssets = [...new Set([...discovered, ...extraPaths])];
    const total = allAssets.length;
    let done = 0;
    let bytes = 0;

    await broadcast({ type: "PRECACHE_TOTAL", total });

    const cache = await caches.open(CACHE_NAME);

    // Download in batches of 4 (like a download manager)
    const BATCH = 4;
    for (let i = 0; i < allAssets.length; i += BATCH) {
      const batch = allAssets.slice(i, i + BATCH);

      await Promise.all(
        batch.map(async (url) => {
          try {
            const req = new Request(url, { cache: "no-store" });
            const cached = await cache.match(url);
            if (!cached) {
              const res = await fetch(req);
              if (res.ok) {
                const clone = res.clone();
                const buf = await res.arrayBuffer();
                bytes += buf.byteLength;
                await cache.put(url, new Response(buf, {
                  status: res.status,
                  headers: res.headers,
                }));
              }
            } else {
              // Already cached — count it
              const buf = await cached.arrayBuffer();
              bytes += buf.byteLength;
            }
          } catch {}
          done++;

          const progress = Math.round((done / total) * 100);
          const kb = Math.round(bytes / 1024);

          await broadcast({
            type: "PRECACHE_PROGRESS",
            done,
            total,
            progress,
            kb,
            file: url.split("/").pop().split("?")[0],
          });
        })
      );
    }

    await broadcast({ type: "PRECACHE_COMPLETE", total, kb: Math.round(bytes / 1024) });
  } catch (err) {
    await broadcast({ type: "PRECACHE_ERROR", error: String(err) });
  }
}

// ─── Phase 3: Fetch (Offline-first, API pass-through) ─────────────────────────

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Skip API calls — always go to network
  if (url.pathname.startsWith("/api/")) return;

  // Skip cross-origin (fonts, external CDNs)
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      // Not in cache — fetch and cache for next time
      return fetch(event.request).then((response) => {
        if (response.ok && event.request.url.includes(self.location.origin)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});

// ─── Messages from App ────────────────────────────────────────────────────────

self.addEventListener("message", (event) => {
  if (!event.data) return;

  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data.type === "START_PRECACHE") {
    progressivePreCache();
  }

  if (event.data.type === "CLEAR_CACHE") {
    caches.delete(CACHE_NAME);
  }
});

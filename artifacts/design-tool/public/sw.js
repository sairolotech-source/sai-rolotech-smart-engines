/**
 * SAI ROLOTECH SMART ENGINES — Service Worker v3.4
 * PHASE 1 (Install):  Cache only critical shell (< 10 KB) — instant
 * PHASE 2 (Activate): Progressive pre-cache in background — never blocks UI
 * PHASE 3 (Fetch):    Serve from cache (offline-first); HTML always from network
 */

const CACHE_VERSION = "v3.4";
const CACHE_NAME = `sai-rolotech-${CACHE_VERSION}`;

const SHELL_URLS = ["/", "/manifest.json", "/favicon.svg", "/icon-192.png"];

async function broadcast(msg) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  clients.forEach((c) => c.postMessage(msg));
}

function urlIsAsset(url) {
  return /\.(js|css|woff2?|png|svg|webp|jpg|jpeg)$/.test(url);
}

// ─── Phase 1: Install ─────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((c) => c.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

// ─── Phase 2: Activate ────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
      // Start background pre-cache — NOT awaited, fully non-blocking for UI
      progressivePreCache();
    })()
  );
});

// ─── Progressive Pre-cache (background, never blocks main thread) ─────────────
async function progressivePreCache() {
  try {
    await broadcast({ type: "PRECACHE_START" });

    const rootResp = await fetch("/", { cache: "no-store" });
    if (!rootResp.ok) return;
    const html = await rootResp.text();

    const discovered = [
      ...[...html.matchAll(/\bsrc="([^"]+)"/g)].map((m) => m[1]),
      ...[...html.matchAll(/\bhref="([^"]+)"/g)].map((m) => m[1]),
      ...[...html.matchAll(/rel="modulepreload"[^>]+href="([^"]+)"/g)].map((m) => m[1]),
    ].filter((u) => urlIsAsset(u) && !u.startsWith("http"));

    const extraPaths = ["/icon-512.png", "/icon-maskable-192.png", "/opengraph.jpg"];
    const allAssets = [...new Set([...discovered, ...extraPaths])];
    const total = allAssets.length;

    await broadcast({ type: "PRECACHE_TOTAL", total });

    const cache = await caches.open(CACHE_NAME);
    let done = 0;

    // Sequential download — progress fires BEFORE each fetch so UI never appears stuck
    for (const url of allAssets) {
      // Broadcast BEFORE download → progress bar always moves
      await broadcast({
        type: "PRECACHE_PROGRESS",
        done,
        total,
        progress: Math.round((done / total) * 100),
        file: url.split("/").pop().split("?")[0],
      });

      try {
        const cached = await cache.match(url);
        if (!cached) {
          const res = await fetch(new Request(url, { cache: "no-store" }));
          if (res.ok) {
            await cache.put(url, res); // direct put, no arrayBuffer() = no stall
          }
        }
      } catch { /* network error — skip silently */ }

      done++;
    }

    await broadcast({
      type: "PRECACHE_COMPLETE",
      total,
      done,
      progress: 100,
    });
  } catch (err) {
    await broadcast({ type: "PRECACHE_ERROR", error: String(err) });
  }
}

// ─── Phase 3: Fetch (offline-first, API pass-through) ─────────────────────────
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  // Skip API calls
  if (url.pathname.startsWith("/api/")) return;
  // Skip cross-origin
  if (url.origin !== self.location.origin) return;

  // HTML pages (index.html / "/") — ALWAYS network-first, never serve stale HTML
  // This ensures users always get the latest JS asset references
  const isHtml = url.pathname === "/" || url.pathname.endsWith(".html") ||
    event.request.headers.get("accept")?.includes("text/html");
  if (isHtml) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Assets — cache-first (content-hashed filenames change on deploy)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
        }
        return res;
      });
    })
  );
});

// ─── Messages from App ────────────────────────────────────────────────────────
self.addEventListener("message", (event) => {
  if (!event.data) return;
  if (event.data.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data.type === "START_PRECACHE") progressivePreCache();
  if (event.data.type === "CLEAR_CACHE") caches.delete(CACHE_NAME);
});

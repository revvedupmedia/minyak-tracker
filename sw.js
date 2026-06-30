// Minimal service worker — exists ONLY to satisfy PWA installability
// requirements (so "Add to Home Screen" works). It deliberately does
// NOT cache anything. Every request always goes straight to the network.
//
// Why: an earlier version of this service worker cached the app shell,
// and because the cache name didn't change between deploys, phones that
// had already installed the app kept serving old, buggy files indefinitely
// — updates to GitHub Pages never reached the installed app. Since this
// app needs live Supabase data anyway (no real offline use case), the
// safest choice is no caching at all: you will always get the latest
// files, every time you open the app.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Clean up any caches left behind by older versions of this file.
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// Pass-through: just let every request go to the network normally.
self.addEventListener("fetch", () => {
  // Intentionally no event.respondWith() — the browser handles the
  // request as if no service worker were present.
});

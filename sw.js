// Minimal service worker — enables "Add to Home Screen" installability.
// Not doing heavy offline caching since this app needs live Supabase data.
// IMPORTANT: bump this version string every time app files change, otherwise
// installed PWAs (Add to Home Screen) can stay stuck on old cached files.
const CACHE_NAME = "minyak-tracker-v2";
const APP_SHELL = [
  "./index.html",
  "./style.css",
  "./app.js",
  "./config.js",
  "./manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
      // Force every open tab/PWA window to reload once, so a stale page
      // (already loaded before this SW activated) picks up new files.
      const allClients = await self.clients.matchAll({ type: "window" });
      allClients.forEach((client) => client.navigate(client.url));
    })()
  );
});

// Network-first for app shell, fall back to cache when offline.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // Don't intercept Supabase API/storage calls — always go to network.
  if (url.hostname.includes("supabase.co")) return;

  event.respondWith(
    fetch(event.request, { cache: "no-store" })
      .then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

// Minimal service worker — enables "Add to Home Screen" installability.
// Not doing heavy offline caching since this app needs live Supabase data.
const CACHE_NAME = "minyak-tracker-v1";
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
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first for app shell, fall back to cache when offline.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // Don't intercept Supabase API/storage calls — always go to network.
  if (url.hostname.includes("supabase.co")) return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

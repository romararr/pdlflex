const CACHE_NAME = "padelflex-pro-v4-4-cache-1";
const APP_FILES = [
  "./",
  "./index.html",
  "./setup.html",
  "./players.html",
  "./matches.html",
  "./leaderboard.html",
  "./display.html",
  "./settings.html",
  "./manifest.webmanifest",
  "./assets/css/app.css",
  "./assets/js/storage.js",
  "./assets/js/scheduler.js",
  "./assets/js/core.js",
  "./assets/js/common.js",
  "./assets/js/pages/hub.js",
  "./assets/js/pages/setup.js",
  "./assets/js/pages/players.js",
  "./assets/js/pages/matches.js",
  "./assets/js/pages/leaderboard.js",
  "./assets/js/pages/display.js",
  "./assets/js/pages/settings.js",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200) {
          const copy = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, copy));
        }

        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);

        if (cached) return cached;

        if (event.request.mode === "navigate") {
          return caches.match("./index.html");
        }

        return Response.error();
      })
  );
});

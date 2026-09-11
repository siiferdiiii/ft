const CACHE_NAME = "finance-tracker-v2";
const STATIC_ASSETS = [
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable.png",
  "/apple-touch-icon.png",
  "/icon.svg",
];

// Install Event: cache core static icons only
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("PWA SW pre-cache partial warning:", err);
      });
    })
  );
  self.skipWaiting();
});

// Activate Event: purge all old caches (v1, etc.)
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event: Network-First for navigations, Cache-First for static assets
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // 1. Jangan intersep request non-GET, API, atau upload
  if (
    event.request.method !== "GET" ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/image")
  ) {
    return;
  }

  // 2. Navigasi halaman HTML (/, /dashboard, /register, dll) SELALU Network-First!
  // JANGAN PERNAH menyajikan cache redirect HTML basi agar user tidak terlempar ke /register.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request);
      })
    );
    return;
  }

  // 3. Cache-First hanya untuk aset statis (gambar, font, css chunk)
  if (
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|ico|woff2?)$/) ||
    url.pathname.startsWith("/_next/static/")
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return networkResponse;
        });
      })
    );
  }
});

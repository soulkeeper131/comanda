const CACHE_NAME = "komanda-v2";
const CACHE_URLS = ["/", "/dashboard", "/login", "/register", "/logo.png"];
const API_CACHE_NAME = "komanda-api-v1";

// API paths to cache (GET only, cache-first offline strategy)
const CACHEABLE_API = ["/api/jobs", "/api/properties", "/api/templates", "/api/stats", "/api/users", "/api/findings", "/api/offers"];

function isCacheableApi(url) {
  try {
    const parsed = new URL(url);
    if (!parsed.pathname.startsWith("/api/")) return false;
    return CACHEABLE_API.some((prefix) => parsed.pathname.startsWith(prefix));
  } catch {
    return false;
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CACHE_URLS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== API_CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== "GET") return;

  // --- Cache-first strategy for cacheable API GET requests ---
  if (isCacheableApi(request.url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        // Network-first with cache fallback
        const fetchPromise = fetch(request)
          .then((response) => {
            if (response.ok) {
              const cloned = response.clone();
              caches.open(API_CACHE_NAME).then((cache) => {
                cache.put(request, cloned);
              });
            }
            return response;
          })
          .catch(() => cached || new Response(JSON.stringify({ error: "Offline" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          }));

        // If cached, return immediately; otherwise wait for network
        return cached ? cached : fetchPromise;
      })
    );
    return;
  }

  // --- Non-API: network-first with cache fallback ---
  if (request.url.includes("/api/")) return; // Skip non-cacheable API

  event.respondWith(
    fetch(request)
      .then((response) => {
        const cloned = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Push notification handler
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || "",
      icon: "/logo.png",
      badge: "/logo.png",
      data: { url: data.url || "/dashboard" },
      vibrate: [200, 100, 200],
      tag: "komanda-notification",
      requireInteraction: true,
    };

    event.waitUntil(
      self.registration.showNotification(data.title || "Ко Манда", options)
    );
  } catch (e) {
    console.error("Push parse error:", e);
  }
});

// Notification click handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

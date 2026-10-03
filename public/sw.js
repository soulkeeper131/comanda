// Ко Манда — service worker
//
// API заявките НЕ минават през кеша. Предишната версия връщаше кеширан
// отговор преди мрежата — екранът винаги беше „една стъпка назад", а кешът
// беше общ за всички акаунти на устройството (след смяна на потребител се
// виждаха чужди данни). Офлайн работата на инспектора има собствен кеш в
// IndexedDB (src/lib/offline-queue-idb.ts), вързан към неговите действия.
//
// Тук се кешират само статичните файлове, за да се отваря приложението без
// мрежа. Страниците — мрежата първо, кешът само ако няма връзка.

const CACHE_NAME = "komanda-v4";
const STATIC_URLS = ["/logo.png", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_URLS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Трие всички стари кешове, включително komanda-api-v1 с чужди API данни.
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  // При изход страницата казва да се изчисти всичко кеширано.
  if (event.data === "logout") {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))));
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // винаги мрежата

  const isStatic = url.pathname.startsWith("/_next/static/") || STATIC_URLS.includes(url.pathname);
  if (isStatic) {
    // Хешираните файлове не се менят — кеш първо.
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE_NAME).then((c) => c.put(request, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok && !res.redirected) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match("/dashboard"))),
    );
  }
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
      // Всяко известие е отделно (собствен tag); само спешните остават на
      // екрана, докато не бъдат отворени.
      tag: data.tag || "komanda-" + Date.now(),
      requireInteraction: !!data.urgent,
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

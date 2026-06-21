const CACHE_NAME = "kayala-farm-v2";
const OFFLINE_URL = "/offline.html";

const OFFLINE_CACHE = [
  "/offline.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
];

const isFirebaseRequest = (hostname) =>
  hostname.includes("firebaseio.com") ||
  hostname.includes("firebasedatabase.app") ||
  hostname.includes("googleapis.com") ||
  hostname.includes("gstatic.com");

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin && !isFirebaseRequest(url.hostname)) {
    return;
  }

  if (isFirebaseRequest(url.hostname)) {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(JSON.stringify({ error: "Offline" }), {
            headers: { "Content-Type": "application/json" },
          })
      )
    );
    return;
  }

  const isAppShell =
    request.mode === "navigate" ||
    url.pathname === "/" ||
    url.pathname === "/index.html" ||
    url.pathname.startsWith("/assets/");

  if (isAppShell) {
    event.respondWith(
      fetch(request).catch(() => {
        if (request.mode === "navigate") {
          return caches.match(OFFLINE_URL);
        }
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
    )
  );
});

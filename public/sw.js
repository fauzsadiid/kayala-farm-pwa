const CACHE_NAME = "kayala-farm-v3";
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

const offlineResponse = () =>
  new Response("Offline", {
    status: 503,
    statusText: "Service Unavailable",
  });

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

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const offline = await caches.match(OFFLINE_URL);
        return offline || offlineResponse();
      })
    );
  }
});

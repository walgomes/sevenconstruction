// Service worker minimalista pro PWA do cliente final.
// Estrategia: network-first, fallback ao cache se offline.
// Versionado por CACHE_NAME — bumpar quando mudar UI critica.

const CACHE_NAME = "sc-cliente-v1";
const ROTAS_BASICAS = [
  "/cliente",
  "/cliente/painel",
  "/manifest.webmanifest",
  "/icon-192.svg",
  "/icon-512.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(ROTAS_BASICAS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((nomes) =>
      Promise.all(nomes.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (!url.pathname.startsWith("/cliente") && url.pathname !== "/manifest.webmanifest" && !url.pathname.startsWith("/icon-")) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        // Atualiza cache em background pra GETs OK
        if (res.ok && req.method === "GET") {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((c) => c || new Response("offline", { status: 503 })))
  );
});

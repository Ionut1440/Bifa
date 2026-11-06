// Funcționare fără internet: rețeaua are prioritate (ca să vină actualizările), altfel copia salvată.
const CACHE = "calendar-birou-v3";
const FISIERE = ["./", "index.html", "manifest.json", "icon-180.png", "icon-192.png", "icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FISIERE)));
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  // no-cache: ocolește cache-ul HTTP de 10 minute al GitHub Pages, ca actualizările să vină imediat
  e.respondWith(fetch(e.request, { cache: "no-cache" }).then(r => {
    const copie = r.clone();
    caches.open(CACHE).then(c => c.put(e.request, copie));
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});

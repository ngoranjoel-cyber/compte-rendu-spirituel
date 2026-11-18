/* Garde le site utilisable hors connexion (site web uniquement ; l'application Android a ses fichiers). */
var CACHE = "compte-rendu-v8";
var FICHIERS = ["./", "index.html", "style.css", "app.js", "xl.js", "rapport.js", "compte.js", "config.js", "modele.js", "jszip.min.js", "confidentialite.html", "conditions.html",
  "manifest.webmanifest", "icone.svg", "logo.png", "icone-192.png", "icone-512.png", "icone-maskable.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FICHIERS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (noms) {
    return Promise.all(noms.filter(function (n) { return n !== CACHE; }).map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});

/* Réseau d'abord pour recevoir les mises à jour, cache en secours hors connexion.
   Les appels au serveur des comptes (autre adresse) ne passent pas par le cache. */
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request).then(function (r) {
      if (r.ok) {
        var copie = r.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copie); });
      }
      return r;
    }).catch(function () { return caches.match(e.request, { ignoreSearch: true }); })
  );
});

/* Garde le site utilisable hors connexion (site web uniquement ; l'application Android a ses fichiers).
   - Tous les fichiers de l'application, y compris les 5 dictionnaires de langue, sont gardés dès la première visite.
   - Les polices (Google Fonts, Adobe Fonts) sont gardées après leur premier chargement.
   - Hors connexion, toute page de l'application s'ouvre depuis le cache.
   Les saisies faites hors connexion sont gardées sur l'appareil et envoyées au retour du réseau (voir compte.js). */
var CACHE = "compte-rendu-v30";
var POLICES = "compte-rendu-polices-v1";
var FICHIERS = ["./", "index.html", "style.css", "langues.js", "tableur.js", "rapport-finance.js", "app.js", "xl.js", "rapport.js", "finance.js", "compte.js", "config.js", "modele.js", "jszip.min.js", "confidentialite.html", "conditions.html",
  "manifest.webmanifest", "icone.svg", "logo.png", "pdf-lib.min.js", "icone-192.png", "icone-512.png", "icone-maskable.png", "oiseau-192.png", "oiseau-512.png",
  "langue-en.js", "langue-es.js", "langue-pt.js", "langue-zh.js", "langue-ar.js"];
var HOTES_POLICES = ["fonts.googleapis.com", "fonts.gstatic.com", "use.typekit.net", "p.typekit.net"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    /* Un fichier manquant ne doit pas empêcher l'installation : chacun est gardé séparément. */
    return Promise.all(FICHIERS.map(function (f) {
      return fetch(f, { cache: "reload" }).then(function (r) { if (r.ok) return c.put(f, r); }).catch(function () {});
    }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (noms) {
    return Promise.all(noms.filter(function (n) { return n !== CACHE && n !== POLICES; }).map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);

  /* Polices : le cache d'abord (elles ne changent pas), le réseau la première fois. */
  if (HOTES_POLICES.indexOf(url.hostname) >= 0) {
    e.respondWith(caches.open(POLICES).then(function (c) {
      return c.match(req).then(function (r) {
        return r || fetch(req).then(function (rep) { if (rep.ok || rep.type === "opaque") c.put(req, rep.clone()); return rep; });
      });
    }).catch(function () { return new Response("", { status: 504 }); }));
    return;
  }

  /* Les appels au serveur des comptes (autre adresse) ne passent pas par le cache. */
  if (url.origin !== self.location.origin) return;

  /* Fichiers de l'application : le réseau d'abord pour recevoir les mises à jour, le cache en secours hors connexion. */
  e.respondWith(
    fetch(req).then(function (r) {
      if (r.ok) { var copie = r.clone(); caches.open(CACHE).then(function (c) { c.put(req, copie); }); }
      return r;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (r) {
        if (r) return r;
        /* Une page de l'application jamais visitée (lien de partage, adresse avec #…) : on ouvre l'accueil. */
        if (req.mode === "navigate") return caches.match("index.html").then(function (i) { return i || caches.match("./"); });
        return new Response("", { status: 504 });
      });
    })
  );
});

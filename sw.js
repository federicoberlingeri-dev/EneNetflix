/* EleNetflix · service worker
   - Pagina: prima la rete (così gli aggiornamenti arrivano subito), senza rete la copia salvata.
   - Locandine TMDB e caratteri: prima la copia salvata, così si aprono all'istante e anche offline.
   - Nessun dato personale passa di qui: voti e visti restano nella memoria del browser. */
var VERSIONE = "elenetflix-v4";
var GUSCIO = "guscio-" + VERSIONE;
var IMMAGINI = "locandine-v1";
var CARATTERI = "caratteri-v1";
var FILE_GUSCIO = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192-v2.png", "./icons/icon-512-v2.png", "./icons/apple-touch-icon-v2.png"];
var MAX_IMMAGINI = 160;

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(GUSCIO).then(function (c) { return c.addAll(FILE_GUSCIO); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (chiavi) {
    return Promise.all(chiavi.filter(function (k) { return k.indexOf("guscio-") === 0 && k !== GUSCIO; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function prima_cache(nome, req, limite) {
  return caches.open(nome).then(function (c) {
    return c.match(req).then(function (trovata) {
      if (trovata) return trovata;
      return fetch(req).then(function (r) {
        if (r && (r.ok || r.type === "opaque")) {
          c.put(req, r.clone());
          if (limite) c.keys().then(function (k) { if (k.length > limite) c.delete(k[0]); });
        }
        return r;
      });
    });
  });
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);

  if (url.hostname === "image.tmdb.org") { e.respondWith(prima_cache(IMMAGINI, req, MAX_IMMAGINI)); return; }
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") { e.respondWith(prima_cache(CARATTERI, req)); return; }
  if (url.origin !== self.location.origin) return;
  /* video: lo gestisce il browser (richieste a pezzi), senza passare dalla cache */
  if (url.pathname.indexOf("/media/") !== -1) return;

  if (req.mode === "navigate" || url.pathname.endsWith(".html") || url.pathname.endsWith("/")) {
    /* "no-cache": il telefono chiede sempre al sito se c'è una versione nuova (risposta leggera se non è cambiato nulla) */
    e.respondWith(fetch(req, { cache: "no-cache" }).then(function (r) {
      var copia = r.clone();
      caches.open(GUSCIO).then(function (c) { c.put("./index.html", copia); });
      return r;
    }).catch(function () {
      return caches.match("./index.html").then(function (r) { return r || caches.match("./"); });
    }));
    return;
  }
  /* icone e manifest: prima la rete, così un'icona nuova arriva; senza rete la copia salvata */
  e.respondWith(fetch(req, { cache: "no-cache" }).then(function (r) {
    if (r && r.ok) { var copia = r.clone(); caches.open(GUSCIO).then(function (c) { c.put(req, copia); }); }
    return r;
  }).catch(function () { return caches.match(req); }));
});

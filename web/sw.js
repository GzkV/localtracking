const CACHE_NAME = "moon-time-shell-v5";
const APP_SHELL = [
  "/", "/index.html", "/about.html", "/privacy.html", "/manifest.webmanifest",
  "/css/style.css", "/js/main.js", "/js/browser-support.js", "/js/data-manager.js",
  "/js/notification-manager.js", "/js/util.js", "/js/window-resize.js", "/js/auth-worker.js", "/js/period-prediction.js",
  "/js/external/argon2.umd.min.js", "/js/external/idb-keyval.umd.js",
  "/js/external/base64-arraybuffer.umd.js", "/js/external/idb-keyval.js",
  "/js/passphrase/random-integer.js", "/js/passphrase/random-phrase.js", "/js/passphrase/wordlist.js",
  "/icons/app-icon.svg", "/icons/app-icon-192.svg", "/icons/app-icon-512.svg"
];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const isNavigation = event.request.mode === "navigate";
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok && new URL(event.request.url).origin === self.location.origin &&
        (isNavigation || !response.headers.get("content-type")?.toLowerCase().includes("text/html"))) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
    }
    return response;
  }).catch(() => caches.match(event.request).then(cached => cached || (event.request.mode === "navigate" ? caches.match("/index.html") : Response.error()))));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
    const client = clients.find(item => "focus" in item);
    return client ? client.focus() : self.clients.openWindow("/");
  }));
});

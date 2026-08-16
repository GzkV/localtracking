const CACHE_NAME = "moon-time-shell-v9";
const APP_SHELL = [
  "/", "/index.html", "/about.html", "/privacy.html", "/manifest.webmanifest",
  "/css/style.css", "/js/main.js", "/js/browser-support.js", "/js/data-manager.js",
  "/js/notification-manager.js", "/js/util.js", "/js/window-resize.js", "/js/auth-worker.js", "/js/period-prediction.js",
  "/js/external/argon2.umd.min.js", "/js/external/idb-keyval.umd.js",
  "/js/external/base64-arraybuffer.umd.js", "/js/external/idb-keyval.js",
  "/js/passphrase/random-integer.js", "/js/passphrase/random-phrase.js", "/js/passphrase/wordlist.js",
  "/icons/howling-wolf-app-icon.png",
  "/assets/forest background.png", "/assets/moonlit-sky-panel-background.png", "/assets/moonlit-wolf-banner-sprite.png",
  "/assets/wolf-moon-medallion-motif-ornate.png", "/assets/crescent-star-corner-motif-gold-upper-left.png",
  "/assets/crescent-star-motif-lavender.png", "/assets/sparkle-motif-icy.png",
  "/assets/wolf-icon-lavender-front.png", "/assets/wolf-avatar-howling-moon.png",
  "/assets/home-icon-cyan.png", "/assets/calendar-wolf-moon-icon.png", "/assets/calendar-check-icon-cyan.png",
  "/assets/settings-gear-icon-cyan.png", "/assets/bell-icon-gold.png", "/assets/bell-icon-cyan.png",
  "/assets/user-icon-teal.png", "/assets/trend-up-icon-cyan.png", "/assets/undo-icon-left.png",
  "/assets/moon-phase-icon-cyan-glow.png", "/assets/moon-icon-crescent-left-bright.png", "/assets/moon-icon-full-cyan.png",
	  "/assets/sprite-6-1.png", "/assets/sprite-8-6.png",
	  "/assets/chevron-left-icon-dark.png", "/assets/chevron-right-icon-slate.png", "/assets/eclipse-ring-icon-icy.png",
	  "/assets/calendar-paw-icon.png",
	  "/assets/home-button-gold.png", "/assets/diamond-gem-gold.png",
	  "/assets/chevron-double-left-gold.png", "/assets/chevron-double-right-gold.png",
	  "/assets/paw-print-button-gold.png", "/assets/panel-texture-center-gold.png",
	  "/assets/wolf-banner-gold.png"
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

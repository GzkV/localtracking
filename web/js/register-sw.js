if ("serviceWorker" in navigator) {
  window.addEventListener("beforeinstallprompt", event => {
    console.info("[PWA] install prompt is available", {
      platforms: event.platforms,
      timestamp: new Date().toISOString(),
    });
  });
  window.addEventListener("appinstalled", () => {
    console.info("[PWA] app installed", { timestamp: new Date().toISOString() });
  });
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js")
    .then(registration => {
      console.info("[PWA] service worker registered", {
        scope: registration.scope,
        updateViaCache: registration.updateViaCache,
      });
      return registration;
    })
    .catch(error => {
      console.warn("[PWA] service worker registration failed; offline support is unavailable.", {
        name: error && error.name,
        message: error && error.message,
      });
    }));
} else {
  console.warn("[PWA] service workers are unavailable in this browser/context");
}

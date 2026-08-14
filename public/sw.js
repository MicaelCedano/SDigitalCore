/*
 * Registration is intentionally enough for installability. We do not cache
 * authenticated pages or API responses, so users always receive live data.
 */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

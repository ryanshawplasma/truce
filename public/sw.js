/**
 * The smallest service worker that will do.
 *
 * It exists for exactly one reason: Chrome will not fire `beforeinstallprompt`
 * — the event our "Add to Home Screen" button waits for — unless the site has a
 * service worker with a fetch handler. Chrome dropped that requirement for
 * installing from the browser's own menu (mobile 108, desktop 112), but the
 * prompt algorithm still wants one, so without this file the button on Android
 * would simply never appear.
 *
 * It deliberately does NOT cache anything.
 *
 * That is the whole design. Truce's corner is a chat: showing somebody a cached
 * copy of a conversation that has since moved on would be worse than showing
 * them nothing, and a caching bug in a service worker is the kind that survives
 * a redeploy and follows people around for weeks. Network-only costs a few
 * milliseconds and cannot go stale.
 *
 * If offline support is ever wanted, this is the place — but it should be a
 * deliberate piece of work with its own tests, not a quiet addition here.
 */

/* Take over as soon as a new copy is installed rather than waiting for every
   tab to close, so an update to this file can never leave two versions live. */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  /* Only GETs are worth touching; posts and server actions go straight past. */
  if (event.request.method !== 'GET') return;

  /* Network, always. See the note above about staleness. */
  event.respondWith(fetch(event.request));
});

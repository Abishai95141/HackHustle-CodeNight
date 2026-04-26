// Minimal service worker for HackHustle ERP browser notifications.
// Mobile browsers (Android Chrome, iOS Safari/PWA) refuse to show
// notifications via `new Notification(...)` and require them to be fired
// through a registered service worker's showNotification(). This SW exists
// solely to be that registration target — no caching, no offline behavior.

self.addEventListener('install', (event) => {
  // Activate as soon as installed so the very first page load can use it.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  // Take control of all open clients (tabs) immediately, otherwise the page
  // that just registered us has to be reloaded before it can call
  // registration.showNotification().
  event.waitUntil(self.clients.claim());
});

// Clicking the notification focuses an existing tab on the target URL or
// opens a new one. Without this the tap does nothing on mobile.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/me/notifications';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        try {
          const url = new URL(client.url);
          if (url.pathname === target && 'focus' in client) return client.focus();
        } catch {
          // ignore malformed urls
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
      return null;
    }),
  );
});

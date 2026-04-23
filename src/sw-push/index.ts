// Custom service worker additions — injected by next-pwa (customWorkerSrc)
// Handles Web Push notifications and notification click events.

declare const self: ServiceWorkerGlobalScope;

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json() as { title: string; body: string; url?: string };

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url ?? "/" },
      // Vibrate pattern for Android
      // @ts-expect-error — vibrate is valid but not in all TS lib defs
      vibrate: [100, 50, 100],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    // Focus existing window or open new one
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        const url = (event.notification.data?.url as string) ?? "/";
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      })
  );
});

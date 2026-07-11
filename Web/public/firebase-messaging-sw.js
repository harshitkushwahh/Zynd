importScripts("/firebase-config.js");
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js");

const config = self.__ZYND_FIREBASE_CONFIG__ || {};

if (config.apiKey) {
  firebase.initializeApp(config);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || payload.data?.title || "Zynd";
    const body = payload.notification?.body || payload.data?.body || "";
    const targetUrl = payload.data?.web_url || payload.fcmOptions?.link || "/dashboard/notifications";

    self.registration.showNotification(title, {
      body,
      icon: "/favicon.ico",
      data: {
        ...payload.data,
        web_url: targetUrl,
      },
    });
  });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.web_url || "/dashboard/notifications";
  const absoluteUrl = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client) {
          if ("navigate" in client && typeof client.navigate === "function") {
            client.navigate(absoluteUrl);
          }
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(absoluteUrl);
      }

      return undefined;
    }),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "ZYND_PUSH" && event.data.payload) {
    const payload = event.data.payload;
    const title = payload.title || "Zynd";
    const body = payload.body || "";

    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon: "/favicon.ico",
        data: payload,
      }),
    );
  }
});

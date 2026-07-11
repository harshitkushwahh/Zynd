"use client";

import {
  FIREBASE_CONFIG_SCRIPT_PATH,
  FIREBASE_MESSAGING_SW_PATH,
  getFirebaseWebConfig,
  isFirebaseWebConfigured,
} from "@/features/notifications/lib/firebase-web-config";

let messagingRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;
let foregroundListenerAttached = false;

async function registerMessagingServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  if (!messagingRegistrationPromise) {
    messagingRegistrationPromise = (async () => {
      const existing = await navigator.serviceWorker.getRegistration("/");
      if (existing?.active?.scriptURL.includes("firebase-messaging-sw.js")) {
        return existing;
      }

      return navigator.serviceWorker.register(FIREBASE_MESSAGING_SW_PATH, {
        scope: "/",
      });
    })();
  }

  try {
    return await messagingRegistrationPromise;
  } catch {
    messagingRegistrationPromise = null;
    return null;
  }
}

export async function ensureFirebaseMessagingServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isFirebaseWebConfigured()) {
    return null;
  }

  const registration = await registerMessagingServiceWorker();
  if (!registration) {
    return null;
  }

  await navigator.serviceWorker.ready;

  try {
    await fetch(FIREBASE_CONFIG_SCRIPT_PATH, { cache: "no-store" });
  } catch {
    return registration;
  }

  return registration;
}

export async function getWebFcmToken(): Promise<string | null> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return null;
  }

  if (!isFirebaseWebConfigured()) {
    return null;
  }

  if (Notification.permission === "denied") {
    return null;
  }

  if (Notification.permission === "default") {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return null;
    }
  }

  const registration = await ensureFirebaseMessagingServiceWorker();
  if (!registration) {
    return null;
  }

  try {
    const { initializeApp, getApps } = await import("firebase/app");
    const { getMessaging, getToken, isSupported } = await import("firebase/messaging");

    if (!(await isSupported())) {
      return null;
    }

    const config = getFirebaseWebConfig();
    const apps = getApps();
    const app =
      apps.length > 0
        ? apps[0]
        : initializeApp({
            apiKey: config.apiKey,
            authDomain: config.authDomain,
            projectId: config.projectId,
            storageBucket: config.storageBucket,
            messagingSenderId: config.messagingSenderId,
            appId: config.appId,
          });

    const messaging = getMessaging(app);
    return await getToken(messaging, {
      vapidKey: config.vapidKey,
      serviceWorkerRegistration: registration,
    });
  } catch {
    return null;
  }
}

export async function attachWebPushForegroundListener(
  onPayload: (payload: Record<string, string | undefined>) => void,
): Promise<(() => void) | null> {
  if (!isFirebaseWebConfigured() || foregroundListenerAttached) {
    return null;
  }

  const registration = await ensureFirebaseMessagingServiceWorker();
  if (!registration) {
    return null;
  }

  try {
    const { initializeApp, getApps } = await import("firebase/app");
    const { getMessaging, isSupported, onMessage } = await import("firebase/messaging");

    if (!(await isSupported())) {
      return null;
    }

    const config = getFirebaseWebConfig();
    const apps = getApps();
    const app =
      apps.length > 0
        ? apps[0]
        : initializeApp({
            apiKey: config.apiKey,
            authDomain: config.authDomain,
            projectId: config.projectId,
            storageBucket: config.storageBucket,
            messagingSenderId: config.messagingSenderId,
            appId: config.appId,
          });

    const messaging = getMessaging(app);
    foregroundListenerAttached = true;

    return onMessage(messaging, (message) => {
      const data = Object.fromEntries(
        Object.entries(message.data ?? {}).map(([key, value]) => [key, String(value)]),
      ) as Record<string, string | undefined>;
      onPayload(data);
    });
  } catch {
    foregroundListenerAttached = false;
    return null;
  }
}

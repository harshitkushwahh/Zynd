import { env } from "@/lib/env";

export type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  vapidKey: string;
};

export function isFirebaseWebConfigured(): boolean {
  const { firebase } = env;
  return Boolean(
    firebase.apiKey &&
      firebase.messagingSenderId &&
      firebase.appId &&
      firebase.vapidKey,
  );
}

export function getFirebaseWebConfig(): FirebaseWebConfig {
  return { ...env.firebase };
}

export const FIREBASE_MESSAGING_SW_PATH = "/firebase-messaging-sw.js";
export const FIREBASE_CONFIG_SCRIPT_PATH = "/firebase-config.js";
export const WEB_PUSH_NOTIFICATION_EVENT = "zynd:notification-push";

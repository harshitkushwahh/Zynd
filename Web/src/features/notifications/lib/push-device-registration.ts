import { PUSH_DEVICE_STORAGE_KEY } from "@zynd/shared/notifications";

import {
  registerPushDevice,
  revokePushDevice,
  type PushPlatform,
} from "@/features/notifications/api/notifications-api";
import { getWebFcmToken } from "@/features/notifications/lib/firebase-web-messaging";
import { isFirebaseWebConfigured } from "@/features/notifications/lib/firebase-web-config";

const PUSH_TOKEN_STORAGE_KEY = "zynd_push_fcm_token";

export function getStoredPushDeviceId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(PUSH_DEVICE_STORAGE_KEY);
}

function setStoredPushDeviceId(deviceId: string | null) {
  if (typeof window === "undefined") {
    return;
  }
  if (deviceId) {
    window.localStorage.setItem(PUSH_DEVICE_STORAGE_KEY, deviceId);
    return;
  }
  window.localStorage.removeItem(PUSH_DEVICE_STORAGE_KEY);
}

function getStoredPushToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
}

function setStoredPushToken(token: string | null) {
  if (typeof window === "undefined") {
    return;
  }
  if (token) {
    window.localStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
    return;
  }
  window.localStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
}

export function isWebPushAvailable(): boolean {
  return isFirebaseWebConfigured();
}

export async function registerWebPushDevice(): Promise<boolean> {
  if (!isFirebaseWebConfigured()) {
    return false;
  }

  const token = await getWebFcmToken();
  if (!token) {
    return false;
  }

  const previousToken = getStoredPushToken();
  const previousDeviceId = getStoredPushDeviceId();

  if (previousToken === token && previousDeviceId) {
    return true;
  }

  const platform: PushPlatform = "web";
  const device = await registerPushDevice({
    platform,
    fcmToken: token,
    deviceLabel: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 120) : undefined,
  });

  setStoredPushDeviceId(device.id);
  setStoredPushToken(token);
  return true;
}

export async function refreshWebPushDeviceIfNeeded(): Promise<void> {
  if (!isFirebaseWebConfigured()) {
    return;
  }

  await registerWebPushDevice();
}

export async function revokeWebPushDevice(): Promise<void> {
  const deviceId = getStoredPushDeviceId();
  if (!deviceId) {
    setStoredPushToken(null);
    return;
  }

  try {
    await revokePushDevice(deviceId);
  } catch {
    // Best-effort revoke during logout.
  } finally {
    setStoredPushDeviceId(null);
    setStoredPushToken(null);
  }
}

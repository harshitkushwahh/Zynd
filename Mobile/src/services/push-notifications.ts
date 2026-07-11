import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { registerPushDevice, revokePushDevice } from "@/services/api";
import { resolveNotificationDeepLink } from "@zynd/shared/notifications";

const PUSH_DEVICE_ID_KEY = "zynd_push_device_id";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

export type PushRegistrationResult = {
  deviceId: string;
  fcmToken: string;
};

export async function ensurePushPermissions(): Promise<boolean> {
  if (!Device.isDevice) {
    return false;
  }

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function getNativePushToken(): Promise<string | null> {
  if (!(await ensurePushPermissions())) {
    return null;
  }

  const token = await Notifications.getDevicePushTokenAsync();
  return typeof token.data === "string" ? token.data : null;
}

export async function registerMobilePushDevice(
  storage: { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void>; removeItem: (key: string) => Promise<void> },
): Promise<PushRegistrationResult | null> {
  const fcmToken = await getNativePushToken();
  if (!fcmToken) {
    return null;
  }

  const platform = Platform.OS === "ios" ? "ios" : "android";
  const device = await registerPushDevice({
    platform,
    fcmToken,
    deviceLabel: Device.modelName ?? undefined,
    appVersion: Constants.expoConfig?.version,
  });

  await storage.setItem(PUSH_DEVICE_ID_KEY, device.id);
  return { deviceId: device.id, fcmToken };
}

export async function revokeMobilePushDevice(
  storage: { getItem: (key: string) => Promise<string | null>; removeItem: (key: string) => Promise<void> },
) {
  const deviceId = await storage.getItem(PUSH_DEVICE_ID_KEY);
  if (!deviceId) {
    return;
  }

  try {
    await revokePushDevice(deviceId);
  } finally {
    await storage.removeItem(PUSH_DEVICE_ID_KEY);
  }
}

export function resolvePushDeepLink(data: Record<string, unknown> | undefined) {
  const notificationType = typeof data?.notification_type === "string" ? data.notification_type : "";
  const category = typeof data?.category === "string" ? data.category : undefined;

  return resolveNotificationDeepLink({
    notification_type: notificationType,
    category: category as "security" | "kyc" | "referral" | "account" | undefined,
  });
}

export function attachNotificationListeners(handlers: {
  onForeground?: (notification: Notifications.Notification) => void;
  onResponse?: (response: Notifications.NotificationResponse) => void;
}) {
  const foregroundSub = Notifications.addNotificationReceivedListener((notification) => {
    handlers.onForeground?.(notification);
  });

  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    handlers.onResponse?.(response);
  });

  return () => {
    foregroundSub.remove();
    responseSub.remove();
  };
}

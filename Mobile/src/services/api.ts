const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(`API ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export type PushDevice = {
  id: string;
  platform: "ios" | "android" | "web";
};

export async function registerPushDevice(payload: {
  platform: "ios" | "android" | "web";
  fcmToken: string;
  deviceLabel?: string;
  appVersion?: string;
}) {
  return apiRequest<PushDevice>("/notifications/devices", {
    method: "POST",
    body: JSON.stringify({
      platform: payload.platform,
      fcm_token: payload.fcmToken,
      device_label: payload.deviceLabel,
      app_version: payload.appVersion,
    }),
  });
}

export async function revokePushDevice(deviceId: string) {
  return apiRequest<{ revoked: boolean }>(`/notifications/devices/${deviceId}`, {
    method: "DELETE",
  });
}

export async function markNotificationRead(notificationId: string) {
  return apiRequest(`/notifications/${notificationId}/read`, {
    method: "PATCH",
  });
}

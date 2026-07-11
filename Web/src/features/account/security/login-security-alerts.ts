import { storageKeys } from "@/shared/config/storage-keys";

export type LoginSecurityAlerts = {
  newDevice: boolean;
  velocityFlagged: boolean;
};

export function storeLoginSecurityAlerts(alerts: LoginSecurityAlerts) {
  if (typeof window === "undefined") return;
  if (!alerts.newDevice && !alerts.velocityFlagged) return;
  sessionStorage.setItem(storageKeys.loginSecurityAlerts, JSON.stringify(alerts));
}

export function consumeLoginSecurityAlerts(): LoginSecurityAlerts | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(storageKeys.loginSecurityAlerts);
  if (!raw) return null;
  sessionStorage.removeItem(storageKeys.loginSecurityAlerts);
  try {
    const parsed = JSON.parse(raw) as LoginSecurityAlerts;
    return {
      newDevice: Boolean(parsed.newDevice),
      velocityFlagged: Boolean(parsed.velocityFlagged),
    };
  } catch {
    return null;
  }
}

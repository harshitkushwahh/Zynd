import type { DistributorWorkGeolocation } from "@/lib/distributor-work-geolocation";
import type {
  DistributorWorkModeId,
} from "@/lib/distributor-work-attendance-config";

export type DistributorWorkSession = {
  id: string;
  signedInAt: string;
  signedOutAt: string | null;
  workSiteId: "office" | "client-site";
  workModeId: DistributorWorkModeId;
  timeSlotId: string;
  remarks: string | null;
  geolocation: DistributorWorkGeolocation;
};

const STORAGE_KEY = "zynd-mitra-work-session";

export function readActiveWorkSession(): DistributorWorkSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DistributorWorkSession;
    if (!parsed?.id || parsed.signedOutAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeActiveWorkSession(session: DistributorWorkSession | null): void {
  if (typeof window === "undefined") return;
  if (!session) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function createWorkSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `work-${Date.now()}`;
}

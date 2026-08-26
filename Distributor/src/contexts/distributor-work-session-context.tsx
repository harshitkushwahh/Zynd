"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { DistributorWorkModeId } from "@/lib/distributor-work-attendance-config";
import type { DistributorWorkGeolocation } from "@/lib/distributor-work-geolocation";
import {
  fetchActiveDistributorWorkSession,
  signInDistributorWorkSession,
  signOutDistributorWorkSession,
  type ApiWorkSession,
} from "@/lib/distributor-work-api";

export type DistributorWorkSignInPayload = {
  workSiteId: "office" | "client-site";
  workModeId: DistributorWorkModeId;
  timeSlotId: string;
  remarks: string | null;
  geolocation: DistributorWorkGeolocation;
};

type DistributorWorkSessionContextValue = {
  activeSession: ApiWorkSession | null;
  isHydrated: boolean;
  isBusy: boolean;
  signIn: (payload: DistributorWorkSignInPayload) => Promise<void>;
  signOut: () => Promise<void>;
  elapsedMs: number;
  refreshSession: () => Promise<void>;
};

const DistributorWorkSessionContext = createContext<DistributorWorkSessionContextValue | null>(null);

export function DistributorWorkSessionProvider({ children }: { children: ReactNode }) {
  const [activeSession, setActiveSession] = useState<ApiWorkSession | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  const refreshSession = useCallback(async () => {
    try {
      const session = await fetchActiveDistributorWorkSession();
      setActiveSession(session);
    } catch {
      setActiveSession(null);
    }
  }, []);

  useEffect(() => {
    void refreshSession().finally(() => setIsHydrated(true));
  }, [refreshSession]);

  useEffect(() => {
    if (!activeSession?.signedInAt || activeSession.signedOutAt) {
      setElapsedMs(0);
      return;
    }

    const signedInAtMs = Date.parse(activeSession.signedInAt);
    const tick = () => setElapsedMs(Math.max(0, Date.now() - signedInAtMs));
    tick();
    const intervalId = window.setInterval(tick, 30_000);
    return () => window.clearInterval(intervalId);
  }, [activeSession]);

  const signIn = useCallback(async (payload: DistributorWorkSignInPayload) => {
    setIsBusy(true);
    try {
      const session = await signInDistributorWorkSession(payload);
      setActiveSession(session);
    } finally {
      setIsBusy(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setIsBusy(true);
    try {
      await signOutDistributorWorkSession();
      setActiveSession(null);
    } finally {
      setIsBusy(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      activeSession,
      isHydrated,
      isBusy,
      signIn,
      signOut,
      elapsedMs,
      refreshSession,
    }),
    [activeSession, elapsedMs, isBusy, isHydrated, refreshSession, signIn, signOut],
  );

  return (
    <DistributorWorkSessionContext.Provider value={value}>
      {children}
    </DistributorWorkSessionContext.Provider>
  );
}

export function useDistributorWorkSession(): DistributorWorkSessionContextValue {
  const context = useContext(DistributorWorkSessionContext);
  if (!context) {
    throw new Error("useDistributorWorkSession must be used within DistributorWorkSessionProvider");
  }
  return context;
}

export function formatWorkElapsedDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

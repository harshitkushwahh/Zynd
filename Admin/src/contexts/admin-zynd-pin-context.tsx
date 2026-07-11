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

import { verifyZyndPin } from "@/lib/pin-api";
import {
  clearPinUnlock,
  isPinUnlockedLocally,
  markPinUnlocked,
  shouldRequirePinUnlock,
  touchPinUnlockActivity,
} from "@/lib/pin-unlock-storage";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import { ApiError } from "@/lib/api-client";

type AdminZyndPinContextValue = {
  locked: boolean;
  unlock: (pin: string) => Promise<void>;
  unlockError: string;
  clearUnlockError: () => void;
  markUnlocked: () => void;
};

const AdminZyndPinContext = createContext<AdminZyndPinContextValue | null>(null);

export function AdminZyndPinProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAdminAuth();
  const [locked, setLocked] = useState(false);
  const [unlockError, setUnlockError] = useState("");

  const evaluateLock = useCallback(() => {
    if (!user?.pin_enrolled) {
      setLocked(false);
      return;
    }
    setLocked(shouldRequirePinUnlock(true));
  }, [user?.pin_enrolled]);

  useEffect(() => {
    if (loading) return;
    evaluateLock();
  }, [evaluateLock, loading, user?.id, user?.pin_enrolled]);

  useEffect(() => {
    if (!user?.pin_enrolled || locked) return;

    const onActivity = () => touchPinUnlockActivity();
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const;
    events.forEach((event) => window.addEventListener(event, onActivity, { passive: true }));

    const intervalId = window.setInterval(() => {
      if (!isPinUnlockedLocally()) setLocked(true);
    }, 30_000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") evaluateLock();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      events.forEach((event) => window.removeEventListener(event, onActivity));
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [evaluateLock, locked, user?.pin_enrolled]);

  useEffect(() => {
    if (!loading && !user) {
      clearPinUnlock();
      setLocked(false);
    }
  }, [loading, user]);

  const unlock = useCallback(async (pin: string) => {
    setUnlockError("");
    try {
      const result = await verifyZyndPin(pin);
      markPinUnlocked(result.expires_in ?? 3600);
      setLocked(false);
    } catch (error) {
      setUnlockError(error instanceof ApiError ? error.message : "Could not verify PIN.");
      throw error;
    }
  }, []);

  const value = useMemo<AdminZyndPinContextValue>(
    () => ({
      locked,
      unlock,
      unlockError,
      clearUnlockError: () => setUnlockError(""),
      markUnlocked: () => {
        markPinUnlocked();
        setLocked(false);
      },
    }),
    [locked, unlock, unlockError]
  );

  return (
    <AdminZyndPinContext.Provider value={value}>{children}</AdminZyndPinContext.Provider>
  );
}

export function useAdminZyndPin() {
  const context = useContext(AdminZyndPinContext);
  if (!context) {
    throw new Error("useAdminZyndPin must be used within AdminZyndPinProvider");
  }
  return context;
}

export function useAdminZyndPinOptional() {
  return useContext(AdminZyndPinContext);
}

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

import { useDistributorAuth } from "@/contexts/distributor-auth-context";
import { ApiError } from "@/lib/api-client";
import { unlockWithPinBiometric } from "@/lib/distributor-pin-biometric";
import { getLocalPinBiometricCredentialId } from "@/lib/distributor-pin-biometric-storage";
import { verifyZyndPin } from "@/lib/distributor-pin-api";
import {
  clearPinUnlock,
  isPinUnlockedLocally,
  markPinUnlocked,
  shouldRequirePinUnlock,
  touchPinUnlockActivity,
} from "@/lib/distributor-pin-unlock-storage";

const PIN_IDLE_SECONDS = 60 * 60;

type DistributorZyndPinContextValue = {
  locked: boolean;
  unlock: (pin: string) => Promise<void>;
  unlockWithBiometric: (credentialId?: string | null) => Promise<void>;
  unlockError: string;
  clearUnlockError: () => void;
  markUnlocked: () => void;
};

const DistributorZyndPinContext = createContext<DistributorZyndPinContextValue | null>(null);

export function DistributorZyndPinProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useDistributorAuth();
  const [locked, setLocked] = useState(false);
  const [unlockError, setUnlockError] = useState("");
  const pinEnrolled = Boolean(user?.pinEnrolled);

  const evaluateLock = useCallback(() => {
    if (!pinEnrolled) {
      setLocked(false);
      return;
    }
    setLocked(shouldRequirePinUnlock(true));
  }, [pinEnrolled]);

  useEffect(() => {
    if (loading) return;
    evaluateLock();
  }, [evaluateLock, loading, user?.id, pinEnrolled]);

  useEffect(() => {
    if (!pinEnrolled || locked) return;

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
  }, [evaluateLock, locked, pinEnrolled]);

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
      markPinUnlocked(result.expires_in ?? PIN_IDLE_SECONDS);
      setLocked(false);
    } catch (error) {
      setUnlockError(error instanceof ApiError ? error.message : "Could not verify PIN.");
      throw error;
    }
  }, []);

  const unlockWithBiometric = useCallback(
    async (credentialId?: string | null) => {
      setUnlockError("");
      const localCredentialId =
        credentialId ?? (user?.id ? getLocalPinBiometricCredentialId(user.id) : null);
      try {
        const result = await unlockWithPinBiometric(localCredentialId);
        markPinUnlocked(result.expires_in ?? PIN_IDLE_SECONDS);
        setLocked(false);
      } catch (error) {
        setUnlockError(error instanceof ApiError ? error.message : "Could not verify biometrics.");
        throw error;
      }
    },
    [user?.id],
  );

  const value = useMemo<DistributorZyndPinContextValue>(
    () => ({
      locked,
      unlock,
      unlockWithBiometric,
      unlockError,
      clearUnlockError: () => setUnlockError(""),
      markUnlocked: () => {
        markPinUnlocked();
        setLocked(false);
      },
    }),
    [locked, unlock, unlockWithBiometric, unlockError],
  );

  return (
    <DistributorZyndPinContext.Provider value={value}>{children}</DistributorZyndPinContext.Provider>
  );
}

export function useDistributorZyndPin() {
  const context = useContext(DistributorZyndPinContext);
  if (!context) {
    throw new Error("useDistributorZyndPin must be used within DistributorZyndPinProvider");
  }
  return context;
}

export function useDistributorZyndPinOptional() {
  return useContext(DistributorZyndPinContext);
}

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
import { fetchPinUnlockStatus, verifyZyndPin } from "@/lib/distributor-pin-api";
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
  const { user, loading, refreshUser } = useDistributorAuth();
  const [locked, setLocked] = useState(false);
  const [unlockError, setUnlockError] = useState("");
  const pinEnrolled = Boolean(user?.pinEnrolled);
  const userId = user?.id ?? null;

  const syncUnlockFromServer = useCallback(async () => {
    if (!userId || !pinEnrolled) return false;

    try {
      const status = await fetchPinUnlockStatus();
      if (status.unlocked && status.expires_in > 0) {
        markPinUnlocked(userId, status.expires_in);
        return true;
      }
      clearPinUnlock(userId);
      return false;
    } catch {
      return isPinUnlockedLocally(userId);
    }
  }, [pinEnrolled, userId]);

  const recoverFromPinMismatch = useCallback(async () => {
    try {
      const refreshed = await refreshUser();
      if (refreshed && !refreshed.pinEnrolled) {
        clearPinUnlock(userId ?? undefined);
        setLocked(false);
        setUnlockError("");
        return true;
      }
    } catch {
      // Keep the lock screen if we cannot confirm enrollment state.
    }
    setUnlockError("Could not verify PIN. Try again or use Forgot PIN.");
    return false;
  }, [refreshUser, userId]);

  const evaluateLock = useCallback(async () => {
    if (!pinEnrolled || !userId) {
      setLocked(false);
      return;
    }

    await syncUnlockFromServer();
    setLocked(shouldRequirePinUnlock(true, userId));
  }, [pinEnrolled, syncUnlockFromServer, userId]);

  useEffect(() => {
    if (loading) return;
    void evaluateLock();
  }, [evaluateLock, loading, userId, pinEnrolled]);

  useEffect(() => {
    if (!pinEnrolled || locked || !userId) return;

    const onActivity = () => touchPinUnlockActivity(userId);
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const;
    events.forEach((event) => window.addEventListener(event, onActivity, { passive: true }));

    const intervalId = window.setInterval(() => {
      if (!isPinUnlockedLocally(userId)) setLocked(true);
    }, 30_000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") void evaluateLock();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      events.forEach((event) => window.removeEventListener(event, onActivity));
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [evaluateLock, locked, pinEnrolled, userId]);

  useEffect(() => {
    if (!loading && !user) {
      clearPinUnlock();
      setLocked(false);
    }
  }, [loading, user]);

  const unlock = useCallback(
    async (pin: string) => {
      if (!userId) return;

      setUnlockError("");
      try {
        const result = await verifyZyndPin(pin);
        markPinUnlocked(userId, result.expires_in ?? PIN_IDLE_SECONDS);
        setLocked(false);
      } catch (error) {
        if (error instanceof ApiError && error.code === "pin_not_set") {
          const recovered = await recoverFromPinMismatch();
          if (recovered) return;
        }
        setUnlockError(error instanceof ApiError ? error.message : "Could not verify PIN.");
        throw error;
      }
    },
    [recoverFromPinMismatch, userId],
  );

  const unlockWithBiometric = useCallback(
    async (credentialId?: string | null) => {
      if (!userId) return;

      setUnlockError("");
      const localCredentialId =
        credentialId ?? getLocalPinBiometricCredentialId(userId);
      try {
        const result = await unlockWithPinBiometric(localCredentialId);
        markPinUnlocked(userId, result.expires_in ?? PIN_IDLE_SECONDS);
        setLocked(false);
      } catch (error) {
        setUnlockError(error instanceof ApiError ? error.message : "Could not verify biometrics.");
        throw error;
      }
    },
    [userId],
  );

  const value = useMemo<DistributorZyndPinContextValue>(
    () => ({
      locked,
      unlock,
      unlockWithBiometric,
      unlockError,
      clearUnlockError: () => setUnlockError(""),
      markUnlocked: () => {
        if (!userId) return;
        markPinUnlocked(userId);
        setLocked(false);
      },
    }),
    [locked, unlock, unlockWithBiometric, unlockError, userId],
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

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

import {
  clearPinUnlock,
  isPinUnlockedLocally,
  markPinUnlocked,
  shouldRequirePinUnlock,
  touchPinUnlockActivity,
} from "@/features/account/pin/storage/pin-unlock-storage";
import { unlockWithPinBiometric } from "@/features/account/pin/lib/pin-biometric";
import { getLocalPinBiometricCredentialId } from "@/features/account/pin/storage/pin-biometric-storage";
import { verifyZyndPin } from "@/features/account/pin/api/pin-api";
import { useAuth } from "@/contexts/auth-context";
import { ApiError } from "@/lib/api-client";
import { appConfig } from "@/shared/config/app-config";
import { copy } from "@/shared/config/copy";

type ZyndPinContextValue = {
  locked: boolean;
  unlock: (pin: string) => Promise<void>;
  unlockWithBiometric: (credentialId?: string | null) => Promise<void>;
  unlockError: string;
  clearUnlockError: () => void;
  markUnlocked: () => void;
  lock: () => void;
};

const ZyndPinContext = createContext<ZyndPinContextValue | null>(null);

export function ZyndPinProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
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
      if (!isPinUnlockedLocally()) {
        setLocked(true);
      }
    }, 30_000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        evaluateLock();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      events.forEach((event) => window.removeEventListener(event, onActivity));
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [evaluateLock, locked, user?.pin_enrolled]);

  const unlock = useCallback(async (pin: string) => {
    setUnlockError("");
    try {
      const result = await verifyZyndPin(pin);
      markPinUnlocked(result.expires_in ?? appConfig.pinIdleTimeoutMs / 1000);
      setLocked(false);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : copy.pin.couldNotVerify;
      setUnlockError(message);
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
        markPinUnlocked(result.expires_in ?? appConfig.pinIdleTimeoutMs / 1000);
        setLocked(false);
      } catch (error) {
        const message =
          error instanceof ApiError ? error.message : copy.pin.couldNotVerify;
        setUnlockError(message);
        throw error;
      }
    },
    [user?.id]
  );

  const value = useMemo<ZyndPinContextValue>(
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
      lock: () => {
        clearPinUnlock();
        setLocked(true);
      },
    }),
    [locked, unlock, unlockWithBiometric, unlockError]
  );

  useEffect(() => {
    if (!loading && !user) {
      clearPinUnlock();
      setLocked(false);
    }
  }, [loading, user]);

  return <ZyndPinContext.Provider value={value}>{children}</ZyndPinContext.Provider>;
}

export function useZyndPin() {
  const context = useContext(ZyndPinContext);
  if (!context) {
    throw new Error("useZyndPin must be used within ZyndPinProvider");
  }
  return context;
}

export function useZyndPinOptional() {
  return useContext(ZyndPinContext);
}

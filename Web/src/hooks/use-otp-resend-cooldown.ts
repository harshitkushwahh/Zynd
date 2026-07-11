"use client";

import { useCallback, useEffect, useState } from "react";

function readStoredRemaining(storageKey: string) {
  if (typeof window === "undefined") return 0;
  const stored = sessionStorage.getItem(storageKey);
  if (!stored) return 0;
  const remaining = Math.ceil((Number(stored) - Date.now()) / 1000);
  return remaining > 0 ? remaining : 0;
}

export function useOtpResendCooldown(storageKey?: string) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    storageKey ? readStoredRemaining(storageKey) : 0
  );

  useEffect(() => {
    if (!storageKey) return;
    const remaining = readStoredRemaining(storageKey);
    if (remaining > 0) {
      setSecondsLeft(remaining);
    }
  }, [storageKey]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          if (storageKey) sessionStorage.removeItem(storageKey);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [secondsLeft, storageKey]);

  const startCooldown = useCallback(
    (seconds: number) => {
      const next = Math.max(seconds, 0);
      setSecondsLeft(next);
      if (storageKey && next > 0) {
        sessionStorage.setItem(storageKey, String(Date.now() + next * 1000));
      }
    },
    [storageKey]
  );

  const syncFromError = useCallback(
    (retryAfterSeconds?: number) => {
      if (retryAfterSeconds && retryAfterSeconds > 0) {
        startCooldown(retryAfterSeconds);
      }
    },
    [startCooldown]
  );

  return {
    secondsLeft,
    canResend: secondsLeft <= 0,
    startCooldown,
    syncFromError,
  };
}

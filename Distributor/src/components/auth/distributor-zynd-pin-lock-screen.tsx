"use client";

import { Fingerprint, LockKeyhole } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { DistributorPinInput } from "@/components/auth/distributor-pin-input";
import { DistributorZyndPinForgotDialog } from "@/components/auth/distributor-zynd-pin-forgot-dialog";
import { DistributorProfileAvatar } from "@/components/ui/distributor-profile-avatar";
import { useDistributorAuth } from "@/contexts/distributor-auth-context";
import { useDistributorZyndPin } from "@/contexts/distributor-zynd-pin-context";
import { fetchPinBiometricStatus } from "@/lib/distributor-pin-api";
import { isPlatformBiometricAvailable } from "@/lib/distributor-pin-biometric";
import {
  clearLocalPinBiometricCredentialId,
  getLocalPinBiometricCredentialId,
} from "@/lib/distributor-pin-biometric-storage";
import { cn } from "@/lib/utils";

type UnlockMode = "biometric" | "pin";

export function DistributorZyndPinLockScreen() {
  const { displayName, user } = useDistributorAuth();
  const { unlock, unlockWithBiometric, unlockError, clearUnlockError } = useDistributorZyndPin();
  const [mode, setMode] = useState<UnlockMode>("pin");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricReady, setBiometricReady] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const submittingRef = useRef(false);
  const biometricAttemptedRef = useRef(false);

  const localCredentialId = user?.id ? getLocalPinBiometricCredentialId(user.id) : null;

  useEffect(() => {
    let cancelled = false;

    async function prepareBiometric() {
      const available = await isPlatformBiometricAvailable();
      if (!available || !user?.id || !localCredentialId) {
        if (!cancelled) setMode("pin");
        return;
      }

      try {
        const status = await fetchPinBiometricStatus();
        const enrolledHere = status.credentials.some(
          (credential) => credential.credential_id === localCredentialId,
        );
        if (!enrolledHere) {
          clearLocalPinBiometricCredentialId(user.id);
          if (!cancelled) setMode("pin");
          return;
        }
        if (!cancelled) {
          setBiometricReady(true);
          setMode("biometric");
        }
      } catch {
        if (!cancelled) setMode("pin");
      }
    }

    void prepareBiometric();
    return () => {
      cancelled = true;
    };
  }, [localCredentialId, user?.id]);

  const attemptBiometricUnlock = useCallback(async () => {
    if (biometricLoading || !biometricReady) return;

    setBiometricLoading(true);
    clearUnlockError();
    try {
      await unlockWithBiometric(localCredentialId);
    } catch {
      setMode("pin");
    } finally {
      setBiometricLoading(false);
    }
  }, [biometricLoading, biometricReady, clearUnlockError, localCredentialId, unlockWithBiometric]);

  useEffect(() => {
    if (mode !== "biometric" || !biometricReady || biometricAttemptedRef.current) return;
    biometricAttemptedRef.current = true;
    void attemptBiometricUnlock();
  }, [attemptBiometricUnlock, biometricReady, mode]);

  const submitPin = useCallback(
    async (pinValue: string) => {
      if (pinValue.length !== 4 || submittingRef.current) return;

      submittingRef.current = true;
      setLoading(true);
      clearUnlockError();
      try {
        await unlock(pinValue);
        setPin("");
      } catch {
        setPin("");
      } finally {
        submittingRef.current = false;
        setLoading(false);
      }
    },
    [clearUnlockError, unlock],
  );

  useEffect(() => {
    if (mode !== "pin" || pin.length !== 4) return;
    void submitPin(pin);
  }, [mode, pin, submitPin]);

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 p-6 backdrop-blur-sm">
        <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-border bg-card p-6">
          <div className="mb-5 flex flex-col items-center text-center">
            <DistributorProfileAvatar
              name={displayName}
              imageSrc={user?.avatarUrl}
              size="lg"
              className="mb-3"
            />
            <div className="mb-3 flex size-12 items-center justify-center rounded-[var(--radius-card)] bg-primary/10 text-primary">
              <LockKeyhole className="size-5" />
            </div>
            <h1 className="text-h4 font-semibold text-foreground">Enter your Zynd PIN</h1>
            <p className="mt-1 text-caption text-muted-foreground">
              {displayName
                ? `Unlock the Zynd Mitra console, ${displayName}.`
                : "Unlock the Zynd Mitra console."}
            </p>
          </div>

          {mode === "biometric" ? (
            <div className="space-y-4">
              <button
                type="button"
                className="group flex w-full flex-col items-center rounded-[var(--radius-card)] border border-border bg-muted/40 px-4 py-6 transition-colors hover:bg-muted/60"
                disabled={biometricLoading}
                onClick={() => {
                  biometricAttemptedRef.current = false;
                  void attemptBiometricUnlock();
                }}
              >
                <div
                  className={cn(
                    "mb-3 flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform",
                    biometricLoading && "scale-105 animate-pulse",
                  )}
                >
                  <Fingerprint className="size-8" strokeWidth={1.75} />
                </div>
                <p className="text-compact font-semibold text-foreground">Unlock with biometrics</p>
                <p className="mt-1 text-center text-caption leading-relaxed text-muted-foreground">
                  {biometricLoading
                    ? "Waiting for biometric verification…"
                    : "Use Touch ID, Windows Hello, or your device fingerprint."}
                </p>
              </button>

              {unlockError ? (
                <p className="text-center text-caption text-destructive">{unlockError}</p>
              ) : null}

              <div className="flex flex-col items-center gap-3 pt-1">
                <button
                  type="button"
                  className="text-caption text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => {
                    clearUnlockError();
                    setMode("pin");
                  }}
                >
                  Use PIN instead
                </button>
                <button
                  type="button"
                  className="text-caption text-muted-foreground transition-colors hover:text-foreground"
                  disabled={biometricLoading}
                  onClick={() => setForgotOpen(true)}
                >
                  Forgot PIN?
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div
                className={cn(
                  "transition-opacity duration-200",
                  loading && "pointer-events-none opacity-60",
                )}
              >
                <DistributorPinInput
                  value={pin}
                  autoFocus
                  onChange={(value) => {
                    setPin(value);
                    if (unlockError) clearUnlockError();
                  }}
                  error={!!unlockError}
                />
              </div>

              {loading ? (
                <p className="text-center text-caption text-muted-foreground">Verifying…</p>
              ) : null}

              {unlockError ? (
                <p className="text-center text-caption text-destructive">{unlockError}</p>
              ) : null}

              <div className="flex flex-col items-center gap-3 pt-1">
                {biometricReady ? (
                  <button
                    type="button"
                    className="text-caption text-muted-foreground transition-colors hover:text-foreground"
                    disabled={loading}
                    onClick={() => {
                      clearUnlockError();
                      setPin("");
                      setMode("biometric");
                      biometricAttemptedRef.current = false;
                    }}
                  >
                    Unlock with biometrics
                  </button>
                ) : null}
                <button
                  type="button"
                  className="text-caption text-muted-foreground transition-colors hover:text-foreground"
                  disabled={loading}
                  onClick={() => setForgotOpen(true)}
                >
                  Forgot PIN?
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <DistributorZyndPinForgotDialog open={forgotOpen} onOpenChange={setForgotOpen} />
    </>
  );
}

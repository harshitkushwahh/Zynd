"use client";

import Image from "next/image";
import { Fingerprint } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { PinInput } from "@/features/account/pin/components/pin-input";
import { ZyndPinForgotDialog } from "@/features/account/pin/components/zynd-pin-forgot-dialog";
import { fetchPinBiometricStatus } from "@/features/account/pin/api/pin-api";
import { isPlatformBiometricAvailable } from "@/features/account/pin/lib/pin-biometric";
import {
  clearLocalPinBiometricCredentialId,
  getLocalPinBiometricCredentialId,
} from "@/features/account/pin/storage/pin-biometric-storage";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PageTitle } from "@/components/ui/page-title";
import { FieldMessage } from "@/components/ui/ui-message";
import { useAuth } from "@/contexts/auth-context";
import { useProfileImage } from "@/contexts/profile-image-context";
import { useZyndPin } from "@/contexts/zynd-pin-context";
import { appConfig } from "@/shared/config/app-config";
import { APP_NAME } from "@/shared/config/brand";
import { copy } from "@/shared/config/copy";
import { getUserInitials } from "@/shared/utils/user-display";
import { cn } from "@/lib/utils";

type UnlockMode = "biometric" | "pin";

export function ZyndPinLockScreen() {
  const { displayName, user } = useAuth();
  const { profileUrl } = useProfileImage();
  const { unlock, unlockWithBiometric, unlockError, clearUnlockError } = useZyndPin();
  const [mode, setMode] = useState<UnlockMode>("biometric");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricReady, setBiometricReady] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const submittingRef = useRef(false);
  const biometricAttemptedRef = useRef(false);

  const localCredentialId = user?.id ? getLocalPinBiometricCredentialId(user.id) : null;
  const initials = getUserInitials(user?.first_name, user?.email);

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
          (credential) => credential.credential_id === localCredentialId
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
      if (pinValue.length !== appConfig.pinLength || submittingRef.current) return;

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
    [clearUnlockError, unlock]
  );

  useEffect(() => {
    if (mode !== "pin" || pin.length !== appConfig.pinLength) return;
    void submitPin(pin);
  }, [mode, pin, submitPin]);

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 p-6 backdrop-blur-sm">
        <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-border bg-card px-6 py-7">
          <div className="mb-6 flex flex-col items-center">
            <Image
              src="/hori.png"
              alt={APP_NAME}
              width={132}
              height={36}
              className="h-9 object-contain"
              style={{ width: "auto" }}
              priority
            />

            <PageTitle className="mt-5">{copy.pin.lockTitle}</PageTitle>

            <div className="mt-4 w-full rounded-[var(--radius-card)] border border-border bg-muted px-4 py-3.5">
              <div className="flex items-start gap-3">
                <Avatar className="size-10 shrink-0">
                  {profileUrl ? (
                    <AvatarImage src={profileUrl} alt={displayName || "Profile photo"} />
                  ) : null}
                  <AvatarFallback className="bg-primary/10 text-caption font-semibold text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 space-y-1 pt-0.5 text-left">
                  {displayName ? (
                    <p className="truncate text-compact font-semibold text-foreground">
                      Hi, {displayName}.
                    </p>
                  ) : (
                    <p className="text-compact font-semibold text-foreground">Welcome back.</p>
                  )}
                  <p className="text-caption leading-relaxed text-muted-foreground">
                    {copy.pin.lockDescription}
                  </p>
                </div>
              </div>
            </div>
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
                    biometricLoading && "animate-pulse scale-105"
                  )}
                >
                  <Fingerprint className="size-8" strokeWidth={1.75} />
                </div>
                <p className="text-compact font-semibold text-foreground">{copy.pin.biometricTitle}</p>
                <p className="mt-1 text-center text-caption leading-relaxed text-muted-foreground">
                  {biometricLoading ? copy.pin.biometricPrompt : copy.pin.biometricDescription}
                </p>
              </button>

              <FieldMessage message={unlockError} className="text-center" />

              <div className="flex flex-col items-center gap-3 pt-1">
                <button
                  type="button"
                  className="auth-link"
                  onClick={() => {
                    clearUnlockError();
                    setMode("pin");
                  }}
                >
                  {copy.pin.biometricUsePin}
                </button>
                <button
                  type="button"
                  className="auth-link"
                  disabled={biometricLoading}
                  onClick={() => setForgotOpen(true)}
                >
                  {copy.pin.forgotLink}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div
                className={cn(
                  "transition-opacity duration-200",
                  loading && "pointer-events-none opacity-60"
                )}
              >
                <PinInput
                  value={pin}
                  onChange={(value) => {
                    setPin(value);
                    if (unlockError) clearUnlockError();
                  }}
                  error={!!unlockError}
                  autoFocus
                />
              </div>

              {loading ? (
                <p className="text-center text-caption text-muted-foreground">{copy.mfa.verifying}</p>
              ) : null}

              <FieldMessage message={unlockError} className="text-center" />

              <div className="flex flex-col items-center gap-3 pt-1">
                {biometricReady ? (
                  <button
                    type="button"
                    className="auth-link"
                    disabled={loading}
                    onClick={() => {
                      clearUnlockError();
                      setPin("");
                      setMode("biometric");
                      biometricAttemptedRef.current = false;
                    }}
                  >
                    {copy.pin.biometricTitle}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="auth-link"
                  disabled={loading}
                  onClick={() => setForgotOpen(true)}
                >
                  {copy.pin.forgotLink}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ZyndPinForgotDialog open={forgotOpen} onOpenChange={setForgotOpen} />
    </>
  );
}

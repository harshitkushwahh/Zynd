"use client";

import { useEffect, useState } from "react";
import { Fingerprint, LockKeyhole } from "lucide-react";

import { DistributorPinInput } from "@/components/auth/distributor-pin-input";
import { DistributorZyndPinForgotDialog } from "@/components/auth/distributor-zynd-pin-forgot-dialog";
import { OtpInput } from "@/components/auth/otp-input";
import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import { DistributorFeedbackMessage } from "@/components/ui/distributor-feedback-message";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDistributorAuth } from "@/contexts/distributor-auth-context";
import { useDistributorZyndPinOptional } from "@/contexts/distributor-zynd-pin-context";
import { ApiError } from "@/lib/api-client";
import {
  deletePinBiometricCredential,
  fetchPinBiometricStatus,
  setupZyndPin,
} from "@/lib/distributor-pin-api";
import {
  isPlatformBiometricAvailable,
  registerPinBiometricUnlock,
} from "@/lib/distributor-pin-biometric";
import {
  clearLocalPinBiometricCredentialId,
  getLocalPinBiometricCredentialId,
  hasLocalPinBiometricCredential,
} from "@/lib/distributor-pin-biometric-storage";
function isValidOtp(value: string) {
  return /^\d{6}$/.test(value);
}

function isValidPassword(password: string) {
  return password.length >= 8;
}

export function DistributorZyndPinSettingsSection() {
  const { user, refreshUser } = useDistributorAuth();
  const pinContext = useDistributorZyndPinOptional();
  const [setupOpen, setSetupOpen] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [setupStep, setSetupStep] = useState<"verify" | "pin">("verify");
  const [currentPassword, setCurrentPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [deviceEnrolled, setDeviceEnrolled] = useState(false);
  const [credentialRecordId, setCredentialRecordId] = useState<string | null>(null);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricError, setBiometricError] = useState("");

  const mfaEnabled = Boolean(user?.mfaEnrolled);
  const pinEnrolled = Boolean(user?.pinEnrolled);

  const resetSetupState = () => {
    setSetupStep("verify");
    setCurrentPassword("");
    setTotpCode("");
    setPin("");
    setConfirmPin("");
    setError("");
    setLoading(false);
  };

  useEffect(() => {
    if (!setupOpen) resetSetupState();
  }, [setupOpen]);

  useEffect(() => {
    let cancelled = false;

    async function loadBiometricState() {
      if (!user?.id || !pinEnrolled) {
        if (!cancelled) {
          setBiometricAvailable(false);
          setDeviceEnrolled(false);
          setCredentialRecordId(null);
        }
        return;
      }

      const available = await isPlatformBiometricAvailable();
      if (!available) {
        if (!cancelled) {
          setBiometricAvailable(false);
          setDeviceEnrolled(false);
        }
        return;
      }

      try {
        const status = await fetchPinBiometricStatus();
        const localCredentialId = getLocalPinBiometricCredentialId(user.id);
        const match = status.credentials.find(
          (credential) => credential.credential_id === localCredentialId,
        );
        if (!cancelled) {
          setBiometricAvailable(true);
          setDeviceEnrolled(Boolean(match && hasLocalPinBiometricCredential(user.id)));
          setCredentialRecordId(match?.id ?? null);
        }
      } catch {
        if (!cancelled) {
          setBiometricAvailable(false);
          setDeviceEnrolled(false);
        }
      }
    }

    void loadBiometricState();
    return () => {
      cancelled = true;
    };
  }, [pinEnrolled, user?.id]);

  const handleSetupPin = async () => {
    if (pin !== confirmPin) {
      setError("PIN entries do not match.");
      return;
    }
    if (pin.length !== 4) {
      setError("Enter a 4-digit PIN.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await setupZyndPin({ currentPassword, totpCode, pin, confirmPin });
      await refreshUser();
      pinContext?.markUnlocked();
      setSetupOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not set up PIN lock.");
    } finally {
      setLoading(false);
    }
  };

  const handleEnableBiometric = async () => {
    if (!user?.id) return;
    setBiometricLoading(true);
    setBiometricError("");
    try {
      await registerPinBiometricUnlock(user.id);
      const status = await fetchPinBiometricStatus();
      const localCredentialId = getLocalPinBiometricCredentialId(user.id);
      const match = status.credentials.find(
        (credential) => credential.credential_id === localCredentialId,
      );
      setDeviceEnrolled(true);
      setCredentialRecordId(match?.id ?? null);
    } catch (err) {
      setBiometricError(
        err instanceof ApiError ? err.message : "Could not enable biometric unlock.",
      );
    } finally {
      setBiometricLoading(false);
    }
  };

  const handleRemoveBiometric = async () => {
    if (!user?.id || !credentialRecordId) return;
    setBiometricLoading(true);
    setBiometricError("");
    try {
      await deletePinBiometricCredential(credentialRecordId);
      clearLocalPinBiometricCredentialId(user.id);
      setDeviceEnrolled(false);
      setCredentialRecordId(null);
    } catch (err) {
      setBiometricError(
        err instanceof ApiError ? err.message : "Could not remove biometric unlock.",
      );
    } finally {
      setBiometricLoading(false);
    }
  };

  if (!user) return null;

  return (
    <>
      <div className="space-y-4">
        <div className="rounded-[var(--radius-card)] border border-border p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-card)] bg-primary/10 text-primary">
                <LockKeyhole className="size-5" />
              </div>
              <div className="space-y-2">
                <p className="text-compact font-semibold text-foreground">PIN lock</p>
                <p className="text-caption text-muted-foreground">
                  {!mfaEnabled
                    ? "Enable two-factor authentication first, then set a 4-digit PIN to lock the console after inactivity."
                    : pinEnrolled
                      ? "Your PIN is required to unlock the Zynd Mitra console on this device."
                      : "Set a 4-digit PIN to lock the console after inactivity."}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {!pinEnrolled ? (
                <DistributorActionButton
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={!mfaEnabled}
                  onClick={() => setSetupOpen(true)}
                >
                  Set up PIN
                </DistributorActionButton>
              ) : (
                <DistributorActionButton
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setForgotOpen(true)}
                >
                  Reset PIN
                </DistributorActionButton>
              )}
            </div>
          </div>
        </div>

        {pinEnrolled ? (
          <div className="rounded-[var(--radius-card)] border border-border p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-card)] bg-primary/10 text-primary">
                  <Fingerprint className="size-5" />
                </div>
                <div className="space-y-2">
                  <p className="text-compact font-semibold text-foreground">Fingerprint unlock</p>
                  <p className="text-caption text-muted-foreground">
                    {biometricAvailable
                      ? deviceEnrolled
                        ? "Biometric unlock is enabled on this device."
                        : "Use Touch ID, Windows Hello, or your device fingerprint to unlock faster."
                      : "Biometric unlock is not available in this browser."}
                  </p>
                </div>
              </div>
              {biometricAvailable ? (
                deviceEnrolled ? (
                  <DistributorActionButton
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={biometricLoading}
                    onClick={() => void handleRemoveBiometric()}
                  >
                    Remove from this device
                  </DistributorActionButton>
                ) : (
                  <DistributorActionButton
                    type="button"
                    variant="primary"
                    size="sm"
                    disabled={biometricLoading}
                    onClick={() => void handleEnableBiometric()}
                  >
                    {biometricLoading ? "Enabling…" : "Enable on this device"}
                  </DistributorActionButton>
                )
              ) : null}
            </div>
            {biometricError ? (
              <DistributorFeedbackMessage variant="error" className="mt-3">
                {biometricError}
              </DistributorFeedbackMessage>
            ) : null}
          </div>
        ) : null}
      </div>

      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent className="max-w-md gap-0 p-0">
          <DialogHeader className="border-b border-border px-5 py-4">
            <DialogTitle>Set up PIN lock</DialogTitle>
            <DialogDescription>
              Verify your password and authenticator code, then choose a 4-digit PIN.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-5 py-5">
            {setupStep === "verify" ? (
              <>
                <div className="space-y-1">
                  <Label htmlFor="pin-setup-password">Current password</Label>
                  <Input
                    id="pin-setup-password"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    className="auth-input-underline"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Authenticator code</Label>
                  <OtpInput value={totpCode} onChange={setTotpCode} />
                </div>
                {error ? <DistributorFeedbackMessage variant="error">{error}</DistributorFeedbackMessage> : null}
                <DistributorActionButton
                  type="button"
                  variant="primary"
                  className="w-full"
                  disabled={!isValidPassword(currentPassword) || !isValidOtp(totpCode)}
                  onClick={() => {
                    setError("");
                    setSetupStep("pin");
                  }}
                >
                  Continue
                </DistributorActionButton>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <p className="text-center text-caption font-medium text-foreground">Create PIN</p>
                  <DistributorPinInput value={pin} onChange={setPin} error={!!error} />
                </div>
                <div className="space-y-2">
                  <p className="text-center text-caption font-medium text-foreground">Confirm PIN</p>
                  <DistributorPinInput
                    value={confirmPin}
                    onChange={setConfirmPin}
                    error={!!error || (confirmPin.length === 4 && pin !== confirmPin)}
                  />
                </div>
                {error ? <DistributorFeedbackMessage variant="error">{error}</DistributorFeedbackMessage> : null}
                <div className="flex gap-2">
                  <DistributorActionButton
                    type="button"
                    variant="outline"
                    className="flex-1"
                    disabled={loading}
                    onClick={() => {
                      setSetupStep("verify");
                      setPin("");
                      setConfirmPin("");
                      setError("");
                    }}
                  >
                    Back
                  </DistributorActionButton>
                  <DistributorActionButton
                    type="button"
                    variant="primary"
                    className="flex-1"
                    disabled={loading || pin.length !== 4 || confirmPin.length !== 4}
                    onClick={() => void handleSetupPin()}
                  >
                    {loading ? "Saving…" : "Save PIN"}
                  </DistributorActionButton>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <DistributorZyndPinForgotDialog open={forgotOpen} onOpenChange={setForgotOpen} />
    </>
  );
}

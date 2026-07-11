"use client";

import { useCallback, useEffect, useState } from "react";
import { Fingerprint, LockKeyhole } from "lucide-react";

import {
  ZyndPinForgotDialog,
  ZyndPinSetupDialog,
} from "@/features/account/pin";
import {
  deletePinBiometricCredential,
  fetchPinBiometricStatus,
} from "@/features/account/pin/api/pin-api";
import {
  clearPinBiometricEnrollment,
  isPlatformBiometricAvailable,
  registerPinBiometricUnlock,
} from "@/features/account/pin/lib/pin-biometric";
import {
  getLocalPinBiometricCredentialId,
  hasLocalPinBiometricCredential,
} from "@/features/account/pin/storage/pin-biometric-storage";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { FieldMessage } from "@/components/ui/ui-message";
import { useAuth } from "@/contexts/auth-context";
import { ApiError } from "@/lib/api-client";
import { copy } from "@/shared/config/copy";

type ZyndPinSettingsPanelProps = {
  mfaEnabled: boolean;
  pinEnrolled: boolean;
};

export function ZyndPinSettingsPanel({ mfaEnabled, pinEnrolled }: ZyndPinSettingsPanelProps) {
  const { user } = useAuth();
  const [setupOpen, setSetupOpen] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [deviceEnrolled, setDeviceEnrolled] = useState(false);
  const [credentialRecordId, setCredentialRecordId] = useState<string | null>(null);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricError, setBiometricError] = useState("");

  const refreshBiometricState = useCallback(async () => {
    if (!user?.id || !pinEnrolled) {
      setDeviceEnrolled(false);
      setCredentialRecordId(null);
      return;
    }

    const available = await isPlatformBiometricAvailable();
    setBiometricAvailable(available);
    if (!available) {
      setDeviceEnrolled(false);
      setCredentialRecordId(null);
      return;
    }

    try {
      const status = await fetchPinBiometricStatus();
      const localCredentialId = getLocalPinBiometricCredentialId(user.id);
      const match = status.credentials.find(
        (credential) => credential.credential_id === localCredentialId
      );
      setDeviceEnrolled(Boolean(match && hasLocalPinBiometricCredential(user.id)));
      setCredentialRecordId(match?.id ?? null);
    } catch {
      setDeviceEnrolled(false);
      setCredentialRecordId(null);
    }
  }, [pinEnrolled, user?.id]);

  useEffect(() => {
    void refreshBiometricState();
  }, [refreshBiometricState]);

  const handleEnableBiometric = async () => {
    if (!user?.id) return;
    setBiometricLoading(true);
    setBiometricError("");
    try {
      await registerPinBiometricUnlock(user.id);
      await refreshBiometricState();
    } catch (error) {
      setBiometricError(
        error instanceof ApiError ? error.message : copy.pin.biometricCouldNotEnable
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
      clearPinBiometricEnrollment(user.id);
      await refreshBiometricState();
    } catch (error) {
      setBiometricError(
        error instanceof ApiError ? error.message : copy.pin.biometricCouldNotEnable
      );
    } finally {
      setBiometricLoading(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-card)] bg-primary/10 text-primary">
            <LockKeyhole className="size-5" />
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-compact font-semibold text-foreground">{copy.settings.zyndPinTitle}</p>
              <StatusBadge variant={pinEnrolled ? "success" : "neutral"}>
                {pinEnrolled ? copy.pin.enrolledLabel : copy.pin.notEnrolledLabel}
              </StatusBadge>
            </div>
            <p className="text-caption text-muted-foreground">
              {!mfaEnabled
                ? copy.pin.mfaRequiredHint
                : pinEnrolled
                  ? copy.settings.zyndPinEnrolledHint
                  : copy.settings.zyndPinDescription}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {!pinEnrolled ? (
            <Button size="sm" disabled={!mfaEnabled} onClick={() => setSetupOpen(true)}>
              {copy.pin.setUpButton}
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setForgotOpen(true)}>
              {copy.pin.forgotLink}
            </Button>
          )}
        </div>
      </div>

      {pinEnrolled ? (
        <div className="border-b border-border py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-card)] bg-primary/10 text-primary">
                <Fingerprint className="size-5" />
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-compact font-semibold text-foreground">
                    {copy.pin.biometricEnableTitle}
                  </p>
                  {deviceEnrolled ? (
                    <StatusBadge variant="success">{copy.pin.biometricEnabledLabel}</StatusBadge>
                  ) : null}
                </div>
                <p className="max-w-xl text-caption text-muted-foreground">
                  {biometricAvailable
                    ? copy.pin.biometricEnableDescription
                    : copy.pin.biometricNotAvailable}
                </p>
              </div>
            </div>

            {biometricAvailable ? (
              <div className="flex flex-wrap gap-2">
                {deviceEnrolled ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={biometricLoading}
                    onClick={() => void handleRemoveBiometric()}
                  >
                    {copy.pin.biometricRemoveButton}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={biometricLoading}
                    onClick={() => void handleEnableBiometric()}
                  >
                    {biometricLoading ? copy.mfa.verifying : copy.pin.biometricEnableButton}
                  </Button>
                )}
              </div>
            ) : null}
          </div>
          <FieldMessage message={biometricError} className="mt-3" />
        </div>
      ) : null}

      <ZyndPinSetupDialog
        open={setupOpen}
        onOpenChange={(open) => {
          setSetupOpen(open);
          if (!open) void refreshBiometricState();
        }}
        onCompleted={() => void refreshBiometricState()}
      />
      <ZyndPinForgotDialog open={forgotOpen} onOpenChange={setForgotOpen} />
    </>
  );
}

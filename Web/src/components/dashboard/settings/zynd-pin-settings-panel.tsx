"use client";

import { useCallback, useEffect, useState } from "react";
import { LockKeyhole } from "lucide-react";

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
import { SecurityFeatureCard } from "@/components/dashboard/settings/security-feature-card";
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

  const pinDescription = !mfaEnabled
    ? copy.pin.mfaRequiredHint
    : pinEnrolled
      ? copy.settings.zyndPinEnrolledHint
      : copy.settings.zyndPinDescription;

  return (
    <>
      <SecurityFeatureCard
        title={copy.settings.zyndPinTitle}
        description={pinDescription}
        icon={LockKeyhole}
        tone={pinEnrolled ? "success" : "muted"}
        badge={
          <StatusBadge variant={pinEnrolled ? "success" : "neutral"} showIcon={false}>
            {pinEnrolled ? copy.pin.enrolledLabel : copy.settings.mfaNotSetUpBadge}
          </StatusBadge>
        }
        actions={
          !pinEnrolled ? (
            <Button size="sm" disabled={!mfaEnabled} onClick={() => setSetupOpen(true)}>
              <LockKeyhole className="size-3.5" />
              {copy.pin.setUpButton}
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setForgotOpen(true)}>
              {copy.pin.forgotLink}
            </Button>
          )
        }
      >
        {pinEnrolled ? (
          <div className="space-y-3">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-compact font-semibold text-foreground">
                    {copy.pin.biometricEnableTitle}
                  </p>
                  {deviceEnrolled ? (
                    <StatusBadge variant="success" showIcon={false}>
                      {copy.pin.biometricEnabledLabel}
                    </StatusBadge>
                  ) : null}
                </div>
                <p className="text-caption leading-relaxed text-muted-foreground">
                  {biometricAvailable
                    ? copy.pin.biometricEnableDescription
                    : copy.pin.biometricNotAvailable}
                </p>
              </div>

              {biometricAvailable ? (
                <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
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
            <FieldMessage message={biometricError} />
          </div>
        ) : null}
      </SecurityFeatureCard>

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

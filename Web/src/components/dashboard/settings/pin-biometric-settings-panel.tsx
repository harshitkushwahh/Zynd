"use client";

import { useCallback, useEffect, useState } from "react";
import { Fingerprint } from "lucide-react";

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

type PinBiometricSettingsPanelProps = {
  pinEnrolled: boolean;
};

export function PinBiometricSettingsPanel({ pinEnrolled }: PinBiometricSettingsPanelProps) {
  const { user } = useAuth();
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [deviceEnrolled, setDeviceEnrolled] = useState(false);
  const [credentialRecordId, setCredentialRecordId] = useState<string | null>(null);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricError, setBiometricError] = useState("");

  const refreshBiometricState = useCallback(async () => {
    if (!user?.id || !pinEnrolled) {
      setBiometricAvailable(false);
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
        (credential) => credential.credential_id === localCredentialId,
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
        error instanceof ApiError ? error.message : copy.pin.biometricCouldNotEnable,
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
        error instanceof ApiError ? error.message : copy.pin.biometricCouldNotEnable,
      );
    } finally {
      setBiometricLoading(false);
    }
  };

  if (!pinEnrolled) return null;

  return (
    <>
      <SecurityFeatureCard
        title={copy.pin.biometricEnableTitle}
        description={
          biometricAvailable
            ? copy.pin.biometricEnableDescription
            : copy.pin.biometricNotAvailable
        }
        icon={Fingerprint}
        tone={deviceEnrolled ? "success" : "muted"}
        badge={
          deviceEnrolled ? (
            <StatusBadge variant="success" showIcon={false}>
              {copy.pin.biometricEnabledLabel}
            </StatusBadge>
          ) : null
        }
        actions={
          biometricAvailable ? (
            deviceEnrolled ? (
              <Button
                size="sm"
                variant="outline"
                disabled={biometricLoading}
                onClick={() => void handleRemoveBiometric()}
              >
                {copy.pin.biometricRemoveButton}
              </Button>
            ) : (
              <Button size="sm" disabled={biometricLoading} onClick={() => void handleEnableBiometric()}>
                {biometricLoading ? copy.mfa.verifying : copy.pin.biometricEnableButton}
              </Button>
            )
          ) : null
        }
      />
      <FieldMessage message={biometricError} />
    </>
  );
}

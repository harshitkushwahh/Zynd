"use client";

import { useState } from "react";

import { BackupCodesSettingsPanel } from "@/components/dashboard/settings/backup-codes-settings-panel";
import { MfaSettingsPanel } from "@/components/dashboard/settings/mfa-settings-panel";
import { PinBiometricSettingsPanel } from "@/components/dashboard/settings/pin-biometric-settings-panel";
import { ZyndPinSettingsPanel } from "@/components/dashboard/settings/zynd-pin-settings-panel";

type SecuritySettingsPanelProps = {
  backupStatus: {
    enrolled: boolean;
    total: number;
    remaining: number;
    used: number;
  };
  backupCodesLoading: boolean;
  backupCodesHydrated: boolean;
  storedBackupCodes: string[];
  onRefreshBackupCodes: () => Promise<void>;
  autoOpenEnroll?: boolean;
  onAutoOpenEnrollHandled?: () => void;
  mfaEnabled: boolean;
  pinEnrolled: boolean;
};

export function SecuritySettingsPanel({
  mfaEnabled,
  pinEnrolled,
  backupStatus,
  backupCodesLoading,
  backupCodesHydrated,
  storedBackupCodes,
  onRefreshBackupCodes,
  autoOpenEnroll,
  onAutoOpenEnrollHandled,
}: SecuritySettingsPanelProps) {
  const [backupCodesRevealed, setBackupCodesRevealed] = useState(false);

  return (
    <div className="space-y-4">
      <MfaSettingsPanel
        onRefreshBackupCodes={onRefreshBackupCodes}
        autoOpenEnroll={autoOpenEnroll}
        onAutoOpenEnrollHandled={onAutoOpenEnrollHandled}
        onEnrollCompleted={() => setBackupCodesRevealed(true)}
      />
      <ZyndPinSettingsPanel mfaEnabled={mfaEnabled} pinEnrolled={pinEnrolled} />
      <PinBiometricSettingsPanel pinEnrolled={pinEnrolled} />
      <BackupCodesSettingsPanel
        mfaEnabled={mfaEnabled}
        backupStatus={backupStatus}
        backupCodesLoading={backupCodesLoading}
        backupCodesHydrated={backupCodesHydrated}
        storedBackupCodes={storedBackupCodes}
        onRefreshBackupCodes={onRefreshBackupCodes}
        backupCodesRevealed={backupCodesRevealed}
        onBackupCodesRevealed={setBackupCodesRevealed}
      />
    </div>
  );
}

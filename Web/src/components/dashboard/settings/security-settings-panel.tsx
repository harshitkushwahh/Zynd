"use client";

import { MfaSettingsPanel } from "@/components/dashboard/settings/mfa-settings-panel";
import { ZyndPinSettingsPanel } from "@/components/dashboard/settings/zynd-pin-settings-panel";

type SecuritySettingsPanelProps = {
  backupStatus: {
    enrolled: boolean;
    total: number;
    remaining: number;
    used: number;
  };
  backupCodesLoading: boolean;
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
  ...mfaProps
}: SecuritySettingsPanelProps) {
  return (
    <div className="space-y-4">
      <MfaSettingsPanel {...mfaProps} />
      <ZyndPinSettingsPanel mfaEnabled={mfaEnabled} pinEnrolled={pinEnrolled} />
    </div>
  );
}

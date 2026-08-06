"use client";

import { DistributorMfaSettingsSection } from "@/components/settings/distributor-mfa-settings-section";
import { DistributorSessionsSettingsSection } from "@/components/settings/distributor-sessions-settings-section";

export function DistributorSecuritySettingsPanel() {
  return (
    <div className="space-y-10">
      <DistributorSessionsSettingsSection />
      <DistributorMfaSettingsSection />
    </div>
  );
}

"use client";

import { Info } from "lucide-react";

import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { DistributorSettingsSection } from "@/lib/distributor-settings-navigation";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";

const SECTION_HELP: Record<DistributorSettingsSection, string> = {
  profile: ZYND_MITRA_COPY.adminContact,
  "change-password":
    "Use a strong password you do not reuse elsewhere. Changes take effect on your next sign-in.",
  security:
    "Review where you are signed in and enable two-factor authentication when enrollment is available.",
  notifications:
    "These preferences are stored on this device. Email and push delivery will follow your choices here.",
};

const SECTION_ARIA: Record<DistributorSettingsSection, string> = {
  profile: "Profile update policy",
  "change-password": "Password update guidance",
  security: "Security settings guidance",
  notifications: "Notification preferences guidance",
};

type DistributorSettingsSectionHeaderHelpProps = {
  section: DistributorSettingsSection;
};

export function DistributorSettingsSectionHeaderHelp({
  section,
}: DistributorSettingsSectionHeaderHelpProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <DistributorActionButton
            type="button"
            variant="icon"
            className="distributor-settings-content-card__header-help"
            aria-label={SECTION_ARIA[section]}
          >
            <Info className="size-4" strokeWidth={2.25} />
          </DistributorActionButton>
        }
      />
      <TooltipContent side="left" align="end" className="max-w-xs text-left leading-snug">
        {SECTION_HELP[section]}
      </TooltipContent>
    </Tooltip>
  );
}

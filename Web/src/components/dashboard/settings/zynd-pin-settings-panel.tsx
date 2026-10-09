"use client";

import { useState } from "react";
import { HelpCircle, LockKeyhole } from "lucide-react";

import {
  ZyndPinForgotDialog,
  ZyndPinSetupDialog,
} from "@/features/account/pin";
import { SecurityFeatureCard } from "@/components/dashboard/settings/security-feature-card";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { TooltipProvider } from "@/components/ui/tooltip";
import { copy } from "@/shared/config/copy";

type ZyndPinSettingsPanelProps = {
  mfaEnabled: boolean;
  pinEnrolled: boolean;
};

export function ZyndPinSettingsPanel({ mfaEnabled, pinEnrolled }: ZyndPinSettingsPanelProps) {
  const [setupOpen, setSetupOpen] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

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
          <TooltipProvider>
            <div className="flex flex-wrap items-center gap-1">
              {!pinEnrolled ? (
                <IconActionButton
                  label={copy.pin.setUpButton}
                  icon={LockKeyhole}
                  disabled={!mfaEnabled}
                  onClick={() => setSetupOpen(true)}
                />
              ) : (
                <IconActionButton
                  label={copy.pin.forgotLink}
                  icon={HelpCircle}
                  onClick={() => setForgotOpen(true)}
                />
              )}
            </div>
          </TooltipProvider>
        }
      />

      <ZyndPinSetupDialog open={setupOpen} onOpenChange={setSetupOpen} />
      <ZyndPinForgotDialog open={forgotOpen} onOpenChange={setForgotOpen} />
    </>
  );
}

"use client";

import { useState } from "react";
import { LockKeyhole } from "lucide-react";

import {
  ZyndPinForgotDialog,
  ZyndPinSetupDialog,
} from "@/features/account/pin";
import { SecurityFeatureCard } from "@/components/dashboard/settings/security-feature-card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
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
      />

      <ZyndPinSetupDialog open={setupOpen} onOpenChange={setSetupOpen} />
      <ZyndPinForgotDialog open={forgotOpen} onOpenChange={setForgotOpen} />
    </>
  );
}

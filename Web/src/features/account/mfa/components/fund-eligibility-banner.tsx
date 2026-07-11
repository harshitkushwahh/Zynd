"use client";

import { useState } from "react";

import { MfaEnrollDialog } from "@/features/account/mfa/components/mfa-enroll-dialog";
import { ZyndPinSetupDialog } from "@/features/account/pin";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { copy } from "@/shared/config/copy";

export function FundEligibilityBanner() {
  const { user, refreshUser } = useAuth();
  const [mfaOpen, setMfaOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);

  if (!user || user.fund_movement_eligible) {
    return null;
  }

  const needsMfa = !user.mfa_enrolled;
  const needsPin = user.mfa_enrolled && !user.pin_enrolled;

  if (!needsMfa && !needsPin) {
    return null;
  }

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-background p-4 shadow-zynd-low sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-compact font-medium text-foreground">
            {needsMfa ? copy.mfa.fundEligibilityTitle : copy.pin.fundEligibilityTitle}
          </p>
          <p className="text-caption text-muted-foreground">
            {needsMfa ? copy.mfa.fundEligibilityDescription : copy.pin.fundEligibilityDescription}
          </p>
        </div>
        <Button onClick={() => (needsMfa ? setMfaOpen(true) : setPinOpen(true))}>
          {needsMfa ? copy.mfa.setupButton : copy.pin.setUpButton}
        </Button>
      </div>
      <MfaEnrollDialog
        open={mfaOpen}
        onOpenChange={(open) => {
          setMfaOpen(open);
          if (!open) {
            void refreshUser();
          }
        }}
      />
      <ZyndPinSetupDialog open={pinOpen} onOpenChange={setPinOpen} />
    </>
  );
}

"use client";

import Link from "next/link";

import { MfaEnrollDialog } from "@/features/account/mfa";
import { ZyndPinSetupDialog } from "@/features/account/pin";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import type { KycEligibilityReason } from "@/features/kyc/lib/kyc-api";
import { copy } from "@/shared/config/copy";
import { useState } from "react";

type KycEntryGateProps = {
  reasons: KycEligibilityReason[];
  onReady?: () => void;
};

function reasonCopy(reason: KycEligibilityReason) {
  switch (reason) {
    case "email_not_verified":
      return copy.kyc.entryGate.email;
    case "phone_not_verified":
      return copy.kyc.entryGate.phone;
    case "mfa_required":
      return copy.kyc.entryGate.mfa;
    case "pin_required":
      return copy.kyc.entryGate.pin;
    default:
      return copy.kyc.entryGate.accountInactive;
  }
}

export function KycEntryGate({ reasons, onReady }: KycEntryGateProps) {
  const { refreshUser } = useAuth();
  const [mfaOpen, setMfaOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);

  const handleRefresh = async () => {
    const updated = await refreshUser();
    if (
      updated?.email_verified_at &&
      updated.phone_verified_at &&
      updated.mfa_enrolled &&
      updated.pin_enrolled
    ) {
      onReady?.();
    }
  };

  return (
    <>
      <div className="space-y-4 py-4">
        <div className="space-y-1 text-center">
          <p className="text-h4 font-semibold text-foreground">{copy.kyc.entryGate.title}</p>
          <p className="text-compact text-muted-foreground">{copy.kyc.entryGate.description}</p>
        </div>
        <ul className="space-y-2 rounded-[var(--radius-card)] border border-border bg-muted/20 p-4">
          {reasons.map((reason) => (
            <li key={reason} className="flex items-start gap-2 text-caption text-foreground">
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
              <span>{reasonCopy(reason)}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2">
          {reasons.includes("mfa_required") ? (
            <Button type="button" onClick={() => setMfaOpen(true)}>
              {copy.kyc.entryGate.setupMfa}
            </Button>
          ) : null}
          {reasons.includes("pin_required") ? (
            <Button type="button" variant="secondary" onClick={() => setPinOpen(true)}>
              {copy.kyc.entryGate.setupPin}
            </Button>
          ) : null}
          {reasons.includes("phone_not_verified") || reasons.includes("email_not_verified") ? (
            <Button type="button" variant="secondary" asChild>
              <Link href="/dashboard/settings">{copy.kyc.entryGate.openSettings}</Link>
            </Button>
          ) : null}
        </div>
      </div>
      <MfaEnrollDialog
        open={mfaOpen}
        onOpenChange={async (next) => {
          setMfaOpen(next);
          if (!next) await handleRefresh();
        }}
      />
      <ZyndPinSetupDialog
        open={pinOpen}
        onOpenChange={async (next) => {
          setPinOpen(next);
          if (!next) await handleRefresh();
        }}
      />
    </>
  );
}

"use client";

import { useState } from "react";

import { MfaEnrollDialog } from "@/features/account/mfa";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { copy } from "@/shared/config/copy";

type KycMfaGateProps = {
  onEnrolled?: () => void;
};

export function KycMfaGate({ onEnrolled }: KycMfaGateProps) {
  const { refreshUser } = useAuth();
  const [mfaOpen, setMfaOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <p className="text-h4 font-semibold text-foreground">{copy.kyc.mfaGate.title}</p>
        <p className="max-w-sm text-compact text-muted-foreground">
          {copy.kyc.mfaGate.description}
        </p>
        <Button
          type="button"
          onClick={() => setMfaOpen(true)}
        >
          {copy.kyc.mfaGate.setupButton}
        </Button>
      </div>
      <MfaEnrollDialog
        open={mfaOpen}
        onOpenChange={async (next) => {
          setMfaOpen(next);
          if (!next) {
            const updated = await refreshUser();
            if (updated?.mfa_enrolled) {
              onEnrolled?.();
            }
          }
        }}
      />
    </>
  );
}

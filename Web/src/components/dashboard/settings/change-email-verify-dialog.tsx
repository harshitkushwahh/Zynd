"use client";

import { useCallback, useState } from "react";

import type { StepUpVerification } from "@/features/account/mfa/types/step-up-types";
import { StepUpSecondFactorFields } from "@/features/account/mfa/components/step-up-second-factor-fields";
import { AuthSubmitFooter } from "@/components/auth/auth-shared";
import { ChangeEmailHeroImage } from "@/components/dashboard/settings/change-email-hero-image";
import { BrandDialog } from "@/components/ui/brand-dialog";
import { Button } from "@/components/ui/button";
import { copy } from "@/shared/config/copy";
import { useResetWhenDialogOpens } from "@/hooks/use-reset-when-dialog-opens";

type ChangeEmailVerifyDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading?: boolean;
  error?: string;
  onErrorChange?: (message: string) => void;
  onSubmit: (verification: StepUpVerification) => void;
};

export function ChangeEmailVerifyDialog({
  open,
  onOpenChange,
  loading = false,
  error = "",
  onErrorChange,
  onSubmit,
}: ChangeEmailVerifyDialogProps) {
  const [totp, setTotp] = useState("");
  const [smsOtp, setSmsOtp] = useState("");
  const [useSms, setUseSms] = useState(false);
  const [smsSent, setSmsSent] = useState(false);

  const reset = useCallback(() => {
    setTotp("");
    setSmsOtp("");
    setUseSms(false);
    setSmsSent(false);
    onErrorChange?.("");
  }, [onErrorChange]);

  useResetWhenDialogOpens(open, reset);

  const canSubmit = useSms ? smsOtp.length === 6 : totp.length === 6;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || loading) return;
    onSubmit(useSms ? { smsOtp } : { totpCode: totp });
  };

  return (
    <BrandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={copy.settings.changeEmailMfaTitle}
      maxWidth="lg"
    >
      <form className="space-y-4 px-5 pb-5 pt-1.5" onSubmit={handleSubmit}>
        <ChangeEmailHeroImage />

        <div className="rounded-[var(--radius-xl)] border border-border bg-muted/30 p-4 shadow-zynd-low">
          <StepUpSecondFactorFields
            embedded
            centered
            useSms={useSms}
            onUseSmsChange={setUseSms}
            totpCode={totp}
            onTotpCodeChange={setTotp}
            smsOtp={smsOtp}
            onSmsOtpChange={setSmsOtp}
            smsSent={smsSent}
            onSmsSentChange={setSmsSent}
            disabled={loading}
            error={error}
            onErrorChange={onErrorChange}
          />
        </div>

        <AuthSubmitFooter className="pt-0">
          <Button type="submit" className="w-full" disabled={loading || !canSubmit}>
            {loading ? copy.settings.changeEmailSubmitting : copy.settings.changeEmailSubmit}
          </Button>
        </AuthSubmitFooter>
      </form>
    </BrandDialog>
  );
}

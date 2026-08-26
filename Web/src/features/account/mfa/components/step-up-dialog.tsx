"use client";

import { useCallback, useState } from "react";

import { AuthSubmitFooter } from "@/components/auth/auth-shared";
import { BrandDialog } from "@/components/ui/brand-dialog";
import { Button } from "@/components/ui/button";
import { StepUpSecondFactorFields } from "@/features/account/mfa/components/step-up-second-factor-fields";
import type { StepUpVerification } from "@/features/account/mfa/types/step-up-types";
import { copy } from "@/shared/config/copy";
import { useResetWhenDialogOpens } from "@/hooks/use-reset-when-dialog-opens";

type StepUpDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  submitLabel?: string;
  loading?: boolean;
  error?: string;
  onErrorChange?: (message: string) => void;
  onSubmit: (verification: StepUpVerification) => void;
};

export function StepUpDialog({
  open,
  onOpenChange,
  title = copy.mfa.secondFactor.stepUpTitle,
  description = copy.mfa.secondFactor.stepUpDescription,
  submitLabel = "Verify and continue",
  loading = false,
  error = "",
  onErrorChange,
  onSubmit,
}: StepUpDialogProps) {
  const [totpCode, setTotpCode] = useState("");
  const [smsOtp, setSmsOtp] = useState("");
  const [useSms, setUseSms] = useState(false);
  const [smsSent, setSmsSent] = useState(false);

  const reset = useCallback(() => {
    setTotpCode("");
    setSmsOtp("");
    setUseSms(false);
    setSmsSent(false);
    onErrorChange?.("");
  }, [onErrorChange]);

  useResetWhenDialogOpens(open, reset);

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
  };

  const canSubmit = useSms ? smsOtp.length === 6 : totpCode.length === 6;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || loading) return;
    onSubmit(useSms ? { smsOtp } : { totpCode });
  };

  return (
    <BrandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
    >
      <form className="space-y-4 p-6" onSubmit={handleSubmit}>
        <StepUpSecondFactorFields
          useSms={useSms}
          onUseSmsChange={setUseSms}
          totpCode={totpCode}
          onTotpCodeChange={setTotpCode}
          smsOtp={smsOtp}
          onSmsOtpChange={setSmsOtp}
          smsSent={smsSent}
          onSmsSentChange={setSmsSent}
          disabled={loading}
          error={error}
          onErrorChange={onErrorChange}
        />

        <AuthSubmitFooter>
          <Button type="submit" className="w-full" disabled={loading || !canSubmit}>
            {loading ? "Verifying..." : submitLabel}
          </Button>
        </AuthSubmitFooter>
      </form>
    </BrandDialog>
  );
}

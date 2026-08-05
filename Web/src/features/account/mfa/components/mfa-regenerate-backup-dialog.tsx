"use client";

import { KeyRound } from "lucide-react";
import { useState } from "react";

import { AuthSubmitFooter } from "@/components/auth/auth-shared";
import { PasswordInput } from "@/components/auth/password-input";
import { BrandDialog } from "@/components/ui/brand-dialog";
import { Button } from "@/components/ui/button";
import { StepUpSecondFactorFields } from "@/features/account/mfa/components/step-up-second-factor-fields";
import { saveMfaBackupCodes } from "@/features/account/mfa/storage/mfa-backup-codes-storage";
import { useAuth } from "@/contexts/auth-context";
import { ApiError } from "@/lib/api-client";
import { regenerateMfaBackupCodes } from "@/lib/auth-api";
import { copy } from "@/shared/config/copy";

type MfaRegenerateBackupDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void;
};

export function MfaRegenerateBackupDialog({
  open,
  onOpenChange,
  onCompleted,
}: MfaRegenerateBackupDialogProps) {
  const { user } = useAuth();
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [smsOtp, setSmsOtp] = useState("");
  const [useSms, setUseSms] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setPassword("");
    setTotp("");
    setSmsOtp("");
    setUseSms(false);
    setSmsSent(false);
    setError("");
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const canSubmit = password.length > 0 && (useSms ? smsOtp.length === 6 : totp.length === 6);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;

    setLoading(true);
    setError("");
    try {
      const result = await regenerateMfaBackupCodes({
        currentPassword: password,
        totpCode: useSms ? undefined : totp || undefined,
        smsOtp: useSms ? smsOtp : undefined,
      });
      saveMfaBackupCodes(user.id, result.backup_codes);
      onCompleted?.();
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : copy.mfa.regenerate.couldNotRegenerate);
    } finally {
      setLoading(false);
    }
  };

  return (
    <BrandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={copy.mfa.regenerate.title}
      description={copy.mfa.regenerate.description}
      icon={KeyRound}
    >
      <form className="space-y-4 p-6" onSubmit={handleSubmit}>
        <PasswordInput
          placeholder="Current password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
        />
        <StepUpSecondFactorFields
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
          onErrorChange={setError}
        />
        <AuthSubmitFooter>
          <Button type="submit" className="w-full" disabled={loading || !canSubmit}>
            {loading ? copy.mfa.regenerate.regenerating : copy.mfa.regenerate.submit}
          </Button>
        </AuthSubmitFooter>
      </form>
    </BrandDialog>
  );
}

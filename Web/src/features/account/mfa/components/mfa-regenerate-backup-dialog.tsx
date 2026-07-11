"use client";

import { KeyRound } from "lucide-react";
import { useState } from "react";

import { AuthSubmitFooter } from "@/components/auth/auth-shared";
import { PasswordInput } from "@/components/auth/password-input";
import { BrandDialog } from "@/components/ui/brand-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldMessage } from "@/components/ui/ui-message";
import { useAuth } from "@/contexts/auth-context";
import { ApiError } from "@/lib/api-client";
import { regenerateMfaBackupCodes } from "@/lib/auth-api";
import { saveMfaBackupCodes } from "@/features/account/mfa/storage/mfa-backup-codes-storage";
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setPassword("");
    setTotp("");
    setError("");
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;

    setLoading(true);
    setError("");
    try {
      const result = await regenerateMfaBackupCodes({
        currentPassword: password,
        totpCode: totp || undefined,
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
        <Input
          inputMode="numeric"
          placeholder="Authenticator code"
          value={totp}
          onChange={(event) =>
            setTotp(event.target.value.replace(/\D/g, "").slice(0, 6))
          }
        />
        <FieldMessage message={error} />
        <AuthSubmitFooter>
          <Button type="submit" className="w-full" disabled={loading || !password}>
            {loading ? copy.mfa.regenerate.regenerating : copy.mfa.regenerate.submit}
          </Button>
        </AuthSubmitFooter>
      </form>
    </BrandDialog>
  );
}

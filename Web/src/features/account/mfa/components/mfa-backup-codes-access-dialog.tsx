"use client";

import { useState } from "react";
import { LockKeyhole } from "lucide-react";

import { PinInput } from "@/features/account/pin/components/pin-input";
import { verifyZyndPin } from "@/features/account/pin/api/pin-api";
import { AuthSubmitFooter } from "@/components/auth/auth-shared";
import { BrandDialog } from "@/components/ui/brand-dialog";
import { Button } from "@/components/ui/button";
import { PasswordVerifyDialog } from "@/features/account/mfa/components/password-verify-dialog";
import { FieldMessage } from "@/components/ui/ui-message";
import { verifyAccountPassword } from "@/features/account/api/account-api";
import { ApiError } from "@/lib/api-client";
import { appConfig } from "@/shared/config/app-config";
import { copy } from "@/shared/config/copy";

type MfaBackupCodesAccessDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pinEnrolled: boolean;
  onVerified: () => void;
};

export function MfaBackupCodesAccessDialog({
  open,
  onOpenChange,
  pinEnrolled,
  onVerified,
}: MfaBackupCodesAccessDialogProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const reset = () => {
    setPin("");
    setError("");
    setLoading(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handlePinSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pin.length !== appConfig.pinLength || loading) return;

    setLoading(true);
    setError("");
    try {
      await verifyZyndPin(pin);
      reset();
      onVerified();
      handleOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : copy.mfa.backupAccess.invalidPin);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (password: string) => {
    setLoading(true);
    try {
      await verifyAccountPassword(password);
      setPasswordOpen(false);
      reset();
      onVerified();
      handleOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError) {
        throw err;
      }
      throw new Error(copy.mfa.backupAccess.invalidPassword);
    } finally {
      setLoading(false);
    }
  };

  if (!pinEnrolled) {
    return (
      <PasswordVerifyDialog
        open={open}
        onOpenChange={handleOpenChange}
        title={copy.mfa.backupAccess.passwordTitle}
        description={copy.mfa.backupAccess.passwordDescription}
        submitLabel={copy.mfa.backupAccess.reveal}
        loading={loading}
        error={error}
        onSubmit={(password) => {
          void handlePasswordSubmit(password).catch((err) => {
            if (err instanceof ApiError) {
              setError(err.message);
            } else {
              setError(copy.mfa.backupAccess.invalidPassword);
            }
          });
        }}
      />
    );
  }

  return (
    <>
      <BrandDialog
        open={open}
        onOpenChange={handleOpenChange}
        title={copy.mfa.backupAccess.pinTitle}
        description={copy.mfa.backupAccess.pinDescription}
        icon={LockKeyhole}
        headerDensity="compact"
      >
        <form className="space-y-4 p-5" onSubmit={handlePinSubmit}>
          <PinInput value={pin} onChange={setPin} autoFocus error={Boolean(error)} />
          <FieldMessage message={error} />
          <AuthSubmitFooter className="space-y-2 pt-0">
            <Button
              type="submit"
              className="w-full"
              disabled={loading || pin.length !== appConfig.pinLength}
            >
              {loading ? copy.mfa.verifying : copy.mfa.backupAccess.reveal}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-8 w-full"
              disabled={loading}
              onClick={() => setPasswordOpen(true)}
            >
              {copy.mfa.backupAccess.usePasswordInstead}
            </Button>
          </AuthSubmitFooter>
        </form>
      </BrandDialog>

      <PasswordVerifyDialog
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
        title={copy.mfa.backupAccess.passwordTitle}
        description={copy.mfa.backupAccess.passwordDescription}
        submitLabel={copy.mfa.backupAccess.reveal}
        loading={loading}
        onSubmit={(password) => {
          void handlePasswordSubmit(password);
        }}
      />
    </>
  );
}

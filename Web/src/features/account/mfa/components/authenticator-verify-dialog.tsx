"use client";

import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { AuthSubmitFooter } from "@/components/auth/auth-shared";
import { BrandDialog } from "@/components/ui/brand-dialog";
import { Button } from "@/components/ui/button";
import { FieldMessage } from "@/components/ui/ui-message";
import { copy } from "@/shared/config/copy";

type AuthenticatorVerifyDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  submitLabel?: string;
  loading?: boolean;
  error?: string;
  onSubmit: (totpCode: string) => void;
};

export function AuthenticatorVerifyDialog({
  open,
  onOpenChange,
  title = "Verify authenticator",
  description = copy.auth.mfaAuthenticatorHint,
  submitLabel = "Verify and continue",
  loading = false,
  error = "",
  onSubmit,
}: AuthenticatorVerifyDialogProps) {
  const [totpCode, setTotpCode] = useState("");

  useEffect(() => {
    if (!open) {
      setTotpCode("");
    }
  }, [open]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setTotpCode("");
    }
    onOpenChange(next);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (totpCode.length !== 6 || loading) return;
    onSubmit(totpCode);
  };

  return (
    <BrandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description={description}
      icon={ShieldCheck}
    >
      <form className="space-y-4 p-6" onSubmit={handleSubmit}>
        <div className="rounded-[var(--radius-card)] border border-border bg-muted/15 p-5">
          <p className="text-center text-compact font-medium text-foreground">
            Authenticator code
          </p>
          <p className="mt-1 text-center text-caption text-muted-foreground">
            {copy.auth.mfaAuthenticatorForApp}
          </p>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            value={totpCode}
            onChange={(event) =>
              setTotpCode(event.target.value.replace(/\D/g, "").slice(0, 6))
            }
            maxLength={6}
            className="auth-input-underline mt-5 w-full text-center tracking-[0.35em] text-body font-medium"
          />
        </div>

        <FieldMessage message={error} />

        <AuthSubmitFooter>
          <Button
            type="submit"
            className="w-full"
            disabled={loading || totpCode.length !== 6}
          >
            {loading ? "Verifying..." : submitLabel}
          </Button>
        </AuthSubmitFooter>
      </form>
    </BrandDialog>
  );
}

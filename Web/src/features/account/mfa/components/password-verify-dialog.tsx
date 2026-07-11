"use client";

import { KeyRound } from "lucide-react";
import { useEffect, useState } from "react";

import { AuthSubmitFooter } from "@/components/auth/auth-shared";
import { PasswordInput } from "@/components/auth/password-input";
import { BrandDialog } from "@/components/ui/brand-dialog";
import { Button } from "@/components/ui/button";
import { FieldMessage } from "@/components/ui/ui-message";

type PasswordVerifyDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  submitLabel?: string;
  loading?: boolean;
  error?: string;
  onSubmit: (password: string) => void;
};

export function PasswordVerifyDialog({
  open,
  onOpenChange,
  title = "Confirm your password",
  description = "Enter your current password to continue.",
  submitLabel = "Continue",
  loading = false,
  error = "",
  onSubmit,
}: PasswordVerifyDialogProps) {
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!open) {
      setPassword("");
    }
  }, [open]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setPassword("");
    }
    onOpenChange(next);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!password || loading) return;
    onSubmit(password);
  };

  return (
    <BrandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description={description}
      icon={KeyRound}
    >
      <form className="space-y-4 p-6" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <PasswordInput
            placeholder="Current password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </div>

        <FieldMessage message={error} />

        <AuthSubmitFooter>
          <Button type="submit" className="w-full" disabled={loading || !password}>
            {loading ? "Verifying..." : submitLabel}
          </Button>
        </AuthSubmitFooter>
      </form>
    </BrandDialog>
  );
}

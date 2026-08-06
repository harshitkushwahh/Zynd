"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { DistributorGlobalLoading } from "@/components/auth/distributor-global-loading";
import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import { DistributorFeedbackMessage } from "@/components/ui/distributor-feedback-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api-client";
import { resetDistributorPassword } from "@/lib/distributor-password-api";

function isPasswordValid(password: string) {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) {
      setError("This reset link is invalid or has expired.");
      return;
    }
    if (!isPasswordValid(password)) {
      setError("Use at least 8 characters with letters and numbers.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      await resetDistributorPassword(token, password, {
        totpCode: totpCode || undefined,
        backupCode: backupCode || undefined,
      });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.code === "mfa_required_for_reset") {
        setRequiresMfa(true);
        setError("Enter your authenticator code or a backup code to finish resetting.");
        return;
      }
      if (err instanceof ApiError && err.code === "distributor_partner_pending_review") {
        setError(
          "Your Zynd Mitra application is still pending HO review. You will receive an email to set your password once it is approved.",
        );
        return;
      }
      setError(err instanceof ApiError ? err.message : "Could not reset password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-title font-semibold text-foreground">Invalid reset link</h1>
        <p className="mt-2 text-compact text-muted-foreground">
          Open the link from your email again or request a new reset link from the sign-in page.
        </p>
        <DistributorActionButton
          type="button"
          variant="primary"
          className="mt-6"
          onClick={() => router.push("/")}
        >
          Back to sign in
        </DistributorActionButton>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-title font-semibold text-foreground">Password updated</h1>
        <p className="mt-2 text-compact text-muted-foreground">
          Your password has been changed. Sign in with your new password.
        </p>
        <DistributorActionButton
          type="button"
          variant="primary"
          className="mt-6"
          onClick={() => router.push("/")}
        >
          Back to sign in
        </DistributorActionButton>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-title font-semibold text-foreground">Reset password</h1>
      <p className="mt-2 text-compact text-muted-foreground">
        Choose a new password for your Zynd Mitra console account.
      </p>
      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div className="space-y-1">
          <Label htmlFor="reset-password" className="text-caption text-muted-foreground">
            New password
          </Label>
          <Input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (error) setError("");
            }}
            className="auth-input-underline"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="reset-confirm-password" className="text-caption text-muted-foreground">
            Confirm password
          </Label>
          <Input
            id="reset-confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              if (error) setError("");
            }}
            className="auth-input-underline"
          />
        </div>
        {requiresMfa ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="reset-totp" className="text-caption text-muted-foreground">
                Authenticator code
              </Label>
              <Input
                id="reset-totp"
                type="text"
                inputMode="numeric"
                value={totpCode}
                onChange={(event) => setTotpCode(event.target.value)}
                className="auth-input-underline"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="reset-backup" className="text-caption text-muted-foreground">
                Backup code
              </Label>
              <Input
                id="reset-backup"
                type="text"
                value={backupCode}
                onChange={(event) => setBackupCode(event.target.value)}
                className="auth-input-underline"
              />
            </div>
          </div>
        ) : null}
        {error ? (
          <DistributorFeedbackMessage variant="error" onDismiss={() => setError("")}>
            {error}
          </DistributorFeedbackMessage>
        ) : null}
        <DistributorActionButton
          type="submit"
          variant="primary"
          disabled={!isPasswordValid(password) || isSubmitting}
          className="w-full"
        >
          {isSubmitting ? "Updating…" : "Update password"}
        </DistributorActionButton>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<DistributorGlobalLoading />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

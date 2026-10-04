"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { DistributorAuthShellThemeToggle } from "@/components/auth/distributor-auth-shell-theme-toggle";
import { DistributorGlobalLoading } from "@/components/auth/distributor-global-loading";
import { DistributorLoginVisualPanel } from "@/components/auth/distributor-login-visual-panel";
import { PasswordCriteriaList } from "@/components/auth/password-criteria-list";
import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import { DistributorFeedbackMessage } from "@/components/ui/distributor-feedback-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api-client";
import {
  ZYND_DISTRIBUTOR_LOGIN_VISUAL_GRADIENT,
  ZYND_DISTRIBUTOR_LOGO_HORIZONTAL_SRC,
} from "@/lib/distributor-brand-assets";
import { resetDistributorPassword } from "@/lib/distributor-password-api";
import { isPasswordValid } from "@/lib/password-criteria";
import { cn } from "@/lib/utils";

function ResetPasswordShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="distributor-login-page">
      <DistributorAuthShellThemeToggle />
      <div className="distributor-login-page__visual" aria-hidden>
        <DistributorLoginVisualPanel gradient={ZYND_DISTRIBUTOR_LOGIN_VISUAL_GRADIENT} />
      </div>

      <div className="distributor-login-page__form">
        <div className="distributor-login-page__form-body">
          <div className="distributor-login-page__form-inner">
            <div className="distributor-login-page__brand">
              <Image
                src={ZYND_DISTRIBUTOR_LOGO_HORIZONTAL_SRC}
                alt="Zynd Distributor"
                width={220}
                height={48}
                className="distributor-login-page__logo distributor-login-page__logo--horizontal"
                priority
              />
            </div>

            <div className="distributor-invite-onboarding-intro">
              <h1 className="distributor-invite-onboarding-title">{title}</h1>
              <p className="distributor-invite-onboarding-subtitle">{subtitle}</p>
            </div>

            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [verifyMethod, setVerifyMethod] = useState<"authenticator" | "backup" | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const confirmMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const verificationReady =
    verifyMethod === "authenticator"
      ? totpCode.replace(/\D/g, "").length === 6
      : verifyMethod === "backup"
        ? backupCode.trim().length >= 8
        : true;
  const canSubmit = isPasswordValid(password) && passwordsMatch && verificationReady && !isSubmitting;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) {
      setError("This reset link is invalid or has expired.");
      return;
    }
    if (!isPasswordValid(password)) {
      setError("Use a stronger password that meets all requirements below.");
      return;
    }
    if (!passwordsMatch) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      await resetDistributorPassword(token, password, {
        totpCode: verifyMethod === "authenticator" ? totpCode : undefined,
        backupCode: verifyMethod === "backup" ? backupCode.trim() : undefined,
      });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.code === "mfa_required_for_reset") {
        setVerifyMethod("authenticator");
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
      <ResetPasswordShell
        title="Invalid reset link"
        subtitle="Open the link from your email again or request a new reset link from the sign-in page."
      >
        <div className="distributor-login-page__fields">
          <DistributorActionButton
            type="button"
            variant="primary"
            className="distributor-login-page__submit w-full"
            onClick={() => router.push("/")}
          >
            Back to sign in
          </DistributorActionButton>
        </div>
      </ResetPasswordShell>
    );
  }

  if (done) {
    return (
      <ResetPasswordShell
        title="Password updated"
        subtitle="Your password has been changed. Sign in with your new password."
      >
        <div className="distributor-login-page__fields">
          <DistributorFeedbackMessage variant="success">
            All other sessions were signed out for your security.
          </DistributorFeedbackMessage>
          <DistributorActionButton
            type="button"
            variant="primary"
            className="distributor-login-page__submit w-full"
            onClick={() => router.push("/")}
          >
            Back to sign in
          </DistributorActionButton>
        </div>
      </ResetPasswordShell>
    );
  }

  return (
    <ResetPasswordShell
      title={verifyMethod ? "Confirm it's you" : "Reset password"}
      subtitle={
        verifyMethod === "backup"
          ? "Enter one unused backup code. The authenticator code is not required."
          : verifyMethod === "authenticator"
            ? "Enter the 6-digit code from your authenticator app."
            : "Choose a new password for your Zynd Mitra console account."
      }
    >
      <form onSubmit={handleSubmit} className="distributor-login-page__fields">
        {verifyMethod ? null : (
        <>
        <div className="space-y-1">
          <Label htmlFor="reset-password" className="text-caption text-muted-foreground">
            New password
          </Label>
          <div className="relative">
            <Input
              id="reset-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (error) setError("");
              }}
              className="auth-input-underline distributor-login-page__input pr-10"
            />
            <button
              type="button"
              className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="size-4" strokeWidth={2.25} />
              ) : (
                <Eye className="size-4" strokeWidth={2.25} />
              )}
            </button>
          </div>
          <PasswordCriteriaList password={password} />
        </div>

        <div className="space-y-1">
          <Label htmlFor="reset-confirm-password" className="text-caption text-muted-foreground">
            Confirm password
          </Label>
          <div className="relative">
            <Input
              id="reset-confirm-password"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                if (error) setError("");
              }}
              aria-invalid={confirmMismatch}
              className={cn(
                "auth-input-underline distributor-login-page__input pr-10",
                confirmMismatch && "border-destructive",
              )}
            />
            <button
              type="button"
              className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setShowConfirmPassword((current) => !current)}
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            >
              {showConfirmPassword ? (
                <EyeOff className="size-4" strokeWidth={2.25} />
              ) : (
                <Eye className="size-4" strokeWidth={2.25} />
              )}
            </button>
          </div>
          {confirmMismatch ? (
            <p className="text-caption text-destructive">Passwords do not match.</p>
          ) : null}
        </div>
        </>
        )}

        {verifyMethod === "authenticator" ? (
          <div className="space-y-1">
            <Label htmlFor="reset-totp" className="text-caption text-muted-foreground">
              Authenticator code
            </Label>
            <Input
              id="reset-totp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={totpCode}
              onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              className="auth-input-underline distributor-login-page__input"
            />
          </div>
        ) : null}

        {verifyMethod === "backup" ? (
          <div className="space-y-1">
            <Label htmlFor="reset-backup" className="text-caption text-muted-foreground">
              Backup code
            </Label>
            <Input
              id="reset-backup"
              type="text"
              autoComplete="one-time-code"
              value={backupCode}
              onChange={(event) => setBackupCode(event.target.value.toUpperCase())}
              className="auth-input-underline distributor-login-page__input"
            />
          </div>
        ) : null}

        {verifyMethod ? (
          <div className="flex flex-col items-start gap-2">
            <button
              type="button"
              className="text-caption font-medium text-primary"
              onClick={() => {
                setError("");
                if (verifyMethod === "authenticator") {
                  setTotpCode("");
                  setVerifyMethod("backup");
                  return;
                }
                setBackupCode("");
                setVerifyMethod("authenticator");
              }}
            >
              {verifyMethod === "backup" ? "Use authenticator app instead" : "Use a backup code instead"}
            </button>
            <button
              type="button"
              className="text-caption font-medium text-primary"
              onClick={() => {
                setError("");
                setTotpCode("");
                setBackupCode("");
                setVerifyMethod(null);
              }}
            >
              Edit password
            </button>
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
          disabled={!canSubmit}
          className="distributor-login-page__submit w-full"
        >
          {isSubmitting ? "Updating…" : verifyMethod ? "Update password" : "Continue"}
        </DistributorActionButton>
      </form>
    </ResetPasswordShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<DistributorGlobalLoading />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

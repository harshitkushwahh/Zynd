"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { OtpInput, PasswordCriteriaList } from "@/components/auth/auth-shared";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageTitle } from "@/components/ui/page-title";
import { ZyndGlobalLoader } from "@/components/ui/zynd-global-loader";
import { FieldMessage } from "@/components/ui/ui-message";
import { resetPassword } from "@/lib/auth-api";
import { ApiError } from "@/lib/api-client";
import { isPasswordValid } from "@/lib/password-criteria";
import { copy } from "@/shared/config/copy";

type ResetStep = "password" | "authenticator" | "backup";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [step, setStep] = useState<ResetStep>("password");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitReset = async (method: "none" | "authenticator" | "backup") => {
    if (!token) {
      setError(copy.resetPassword.invalidLinkError);
      return;
    }
    if (!isPasswordValid(password)) {
      setError(copy.resetPassword.weakPasswordError);
      setStep("password");
      return;
    }
    if (method === "authenticator" && totpCode.length !== 6) {
      setError(copy.resetPassword.verifyDescription);
      return;
    }
    if (method === "backup" && backupCode.trim().length < 8) {
      setError(copy.resetPassword.backupDescription);
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      await resetPassword(token, password, {
        totpCode: method === "authenticator" ? totpCode : undefined,
        backupCode: method === "backup" ? backupCode.trim() : undefined,
      });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.code === "mfa_required_for_reset") {
        setStep("authenticator");
        return;
      }
      setError(err instanceof ApiError ? err.message : copy.resetPassword.couldNotReset);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void submitReset(step === "password" ? "none" : step);
  };

  if (!token) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <PageTitle>{copy.resetPassword.invalidLinkTitle}</PageTitle>
        <p className="mt-2 text-compact text-muted-foreground">
          {copy.resetPassword.invalidLinkDescription}
        </p>
        <Button className="mt-6" onClick={() => router.push("/")}>
          {copy.resetPassword.backToHome}
        </Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <PageTitle>{copy.resetPassword.successTitle}</PageTitle>
        <p className="mt-2 text-compact text-muted-foreground">
          {copy.resetPassword.successDescription}
        </p>
        <Button className="mt-6" onClick={() => router.push("/")}>
          {copy.resetPassword.backToSignIn}
        </Button>
      </div>
    );
  }

  const onVerifyStep = step !== "password";

  return (
    <div className="mx-auto w-full max-w-md px-6 py-16">
      <div className="rounded-[var(--radius-card)] border border-border bg-card p-6 shadow-zynd-low sm:p-8">
        {onVerifyStep ? (
          <p className="text-caption font-medium text-muted-foreground">Step 2 of 2</p>
        ) : null}
        <PageTitle>{onVerifyStep ? copy.resetPassword.verifyTitle : copy.resetPassword.title}</PageTitle>
        <p className="mt-2 text-compact text-muted-foreground">
          {step === "backup"
            ? copy.resetPassword.backupDescription
            : onVerifyStep
              ? copy.resetPassword.verifyDescription
              : copy.account.resetPasswordIntro}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          {step === "password" ? (
            <div className="space-y-1.5">
              <label htmlFor="reset-password" className="text-caption font-medium text-muted-foreground">
                {copy.resetPassword.newPasswordLabel}
              </label>
              <PasswordInput
                id="reset-password"
                placeholder={copy.resetPassword.newPasswordPlaceholder}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (error) setError("");
                }}
                aria-invalid={!!error}
                className="h-11"
                autoComplete="new-password"
              />
              <PasswordCriteriaList password={password} />
            </div>
          ) : step === "authenticator" ? (
            <div className="space-y-1.5">
              <label htmlFor="reset-totp" className="text-caption font-medium text-muted-foreground">
                {copy.resetPassword.authenticatorLabel}
              </label>
              <OtpInput
                id="reset-totp"
                value={totpCode}
                error={!!error}
                onChange={(value) => {
                  setTotpCode(value);
                  if (error) setError("");
                }}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <label htmlFor="reset-backup" className="text-caption font-medium text-muted-foreground">
                {copy.resetPassword.backupCodeLabel}
              </label>
              <Input
                id="reset-backup"
                type="text"
                autoComplete="one-time-code"
                placeholder={copy.resetPassword.backupCodePlaceholder}
                value={backupCode}
                onChange={(event) => {
                  setBackupCode(event.target.value.toUpperCase());
                  if (error) setError("");
                }}
                className="h-11"
              />
            </div>
          )}

          <FieldMessage message={error} />

          <Button
            type="submit"
            size="auth"
            className="w-full"
            disabled={
              isSubmitting ||
              (step === "password" && !isPasswordValid(password)) ||
              (step === "authenticator" && totpCode.length !== 6) ||
              (step === "backup" && backupCode.trim().length < 8)
            }
          >
            {isSubmitting
              ? copy.resetPassword.updating
              : step === "password"
                ? copy.resetPassword.continue
                : copy.resetPassword.updatePassword}
          </Button>

          {onVerifyStep ? (
            <div className="flex flex-col items-start gap-2">
              <button
                type="button"
                className="auth-link"
                onClick={() => {
                  setError("");
                  if (step === "authenticator") {
                    setTotpCode("");
                    setStep("backup");
                    return;
                  }
                  setBackupCode("");
                  setStep("authenticator");
                }}
              >
                {step === "backup"
                  ? copy.resetPassword.useAuthenticator
                  : copy.resetPassword.useBackupCode}
              </button>
              <button
                type="button"
                className="auth-link"
                onClick={() => {
                  setError("");
                  setTotpCode("");
                  setBackupCode("");
                  setStep("password");
                }}
              >
                {copy.resetPassword.editPassword}
              </button>
            </div>
          ) : null}
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ZyndGlobalLoader />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

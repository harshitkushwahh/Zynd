"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { ZyndGlobalLoader } from "@/components/ui/zynd-global-loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import { resetPassword } from "@/lib/auth-api";
import { isPasswordValid } from "@/lib/password-criteria";
import { PasswordCriteriaList } from "@/components/auth/auth-shared";
import { PasswordInput } from "@/components/auth/password-input";
import { FieldMessage } from "@/components/ui/ui-message";
import { copy } from "@/shared/config/copy";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) {
      setError(copy.resetPassword.invalidLinkError);
      return;
    }
    if (!isPasswordValid(password)) {
      setError(copy.resetPassword.weakPasswordError);
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      await resetPassword(token, password, {
        totpCode: totpCode || undefined,
        backupCode: backupCode || undefined,
      });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.code === "mfa_required_for_reset") {
        setRequiresMfa(true);
        setError(copy.resetPassword.mfaRequiredError);
        return;
      }
      setError(err instanceof ApiError ? err.message : copy.resetPassword.couldNotReset);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-h3 font-semibold text-foreground">{copy.resetPassword.invalidLinkTitle}</h1>
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
        <h1 className="text-h3 font-semibold text-foreground">{copy.resetPassword.successTitle}</h1>
        <p className="mt-2 text-compact text-muted-foreground">
          {copy.resetPassword.successDescription}
        </p>
        <Button className="mt-6" onClick={() => router.push("/")}>
          {copy.resetPassword.backToSignIn}
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-h3 font-semibold text-foreground">{copy.resetPassword.title}</h1>
      <p className="mt-2 text-compact text-muted-foreground">
        {copy.account.resetPasswordIntro}
      </p>
      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <PasswordInput
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
        {requiresMfa ? (
          <div className="space-y-3">
            <Input
              type="text"
              inputMode="numeric"
              placeholder={copy.resetPassword.authenticatorPlaceholder}
              value={totpCode}
              onChange={(event) => setTotpCode(event.target.value)}
              className="h-11"
            />
            <Input
              type="text"
              placeholder={copy.resetPassword.backupCodePlaceholder}
              value={backupCode}
              onChange={(event) => setBackupCode(event.target.value)}
              className="h-11"
            />
          </div>
        ) : null}
        <FieldMessage message={error} />
        <Button
          type="submit"
          size="auth"
          disabled={!isPasswordValid(password) || isSubmitting}
        >
          {isSubmitting ? copy.resetPassword.updating : copy.resetPassword.updatePassword}
        </Button>
      </form>
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

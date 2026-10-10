"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { OtpInput } from "@/components/auth/otp-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useSupportAuth } from "@/contexts/support-auth-context";
import { ApiError } from "@/lib/api-client";
import { ZYND_SUPPORT_FAVICON_PNG_SRC } from "@/lib/support-brand-assets";
import { completeSupportLogin } from "@/lib/support-auth-api";
import { isPasswordValid } from "@/lib/password-criteria";
import {
  acceptSupportInvite,
  completeSupportInvite,
  supportInviteMfaConfirm,
  supportInviteMfaStart,
  validateSupportInvite,
  type SupportInvitePreview,
} from "@/lib/support-invite-api";

type Step = "loading" | "invalid" | "account" | "mfa" | "backup" | "pin" | "done";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

function SupportInviteOnboardingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const { refreshUser } = useSupportAuth();

  const [step, setStep] = useState<Step>("loading");
  const [preview, setPreview] = useState<SupportInvitePreview | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [onboardingToken, setOnboardingToken] = useState("");
  const [enrollToken, setEnrollToken] = useState("");
  const [qrUri, setQrUri] = useState("");
  const [manualSecret, setManualSecret] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinTotp, setPinTotp] = useState("");

  useEffect(() => {
    if (!token) {
      setPreviewError("This invitation link is missing its secure token.");
      setStep("invalid");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const result = await validateSupportInvite(token);
        if (cancelled) return;
        if (result.target_console !== "support") {
          setPreviewError("This invitation is not for the Support console.");
          setStep("invalid");
          return;
        }
        setPreview(result);
        setFirstName(result.first_name ?? "");
        setLastName(result.last_name ?? "");
        setStep("account");
      } catch (error) {
        if (cancelled) return;
        setPreviewError(getErrorMessage(error, "This invitation link is invalid or expired."));
        setStep("invalid");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleAcceptAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError("");
    if (!isPasswordValid(password)) {
      setFormError("Choose a stronger password (8+ chars with upper, lower, number, special).");
      return;
    }
    setIsSubmitting(true);
    try {
      const accept = await acceptSupportInvite({
        token,
        first_name: firstName.trim(),
        last_name: lastName.trim() || undefined,
        password,
      });
      setOnboardingToken(accept.onboarding_token);
      const mfa = await supportInviteMfaStart(accept.onboarding_token);
      setEnrollToken(mfa.enroll_token);
      setQrUri(mfa.qr_uri);
      setManualSecret(mfa.manual_secret);
      setStep("mfa");
    } catch (error) {
      setFormError(getErrorMessage(error, "Could not accept invitation."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmMfa = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError("");
    if (!/^\d{6}$/.test(mfaCode)) {
      setFormError("Enter the 6-digit authenticator code.");
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await supportInviteMfaConfirm(onboardingToken, enrollToken, mfaCode);
      setBackupCodes(result.backup_codes);
      setStep("backup");
    } catch (error) {
      setFormError(getErrorMessage(error, "Could not confirm MFA."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompletePin = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError("");
    if (pin.length !== 6 || confirmPin.length !== 6) {
      setFormError("Enter and confirm your 6-digit PIN.");
      return;
    }
    if (pin !== confirmPin) {
      setFormError("PIN and confirmation do not match.");
      return;
    }
    if (!/^\d{6}$/.test(pinTotp)) {
      setFormError("Enter your current authenticator code to finish setup.");
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await completeSupportInvite({
        onboardingToken,
        pin,
        confirmPin,
        totpCode: pinTotp,
      });
      await completeSupportLogin(result.user);
      await refreshUser();
      setStep("done");
    } catch (error) {
      setFormError(getErrorMessage(error, "Could not complete setup."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-lg shadow-zynd-mid">
        <CardContent className="space-y-6 p-6 sm:p-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <Image
              src={ZYND_SUPPORT_FAVICON_PNG_SRC}
              alt="ZYND Support"
              width={40}
              height={40}
              className="size-10 object-contain"
            />
            <h1 className="font-heading text-h3 font-semibold text-foreground">Support invitation</h1>
          </div>

          {step === "loading" ? (
            <p className="text-center text-caption text-muted-foreground">Validating invitation…</p>
          ) : null}

          {step === "invalid" ? (
            <div className="space-y-4 text-center">
              <FieldError>{previewError}</FieldError>
              <Button
                nativeButton={false}
                render={<Link href="/" className="inline-flex w-full justify-center" />}
              >
                Back to sign in
              </Button>
            </div>
          ) : null}

          {step === "account" && preview ? (
            <form onSubmit={handleAcceptAccount} className="space-y-4">
              <p className="text-caption text-muted-foreground">
                Set up <span className="font-medium text-foreground">{preview.email}</span> as{" "}
                {preview.role_name ?? preview.role_key}.
              </p>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="invite-first">First name</FieldLabel>
                  <Input
                    id="invite-first"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="invite-last">Last name</FieldLabel>
                  <Input
                    id="invite-last"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="invite-password">Password</FieldLabel>
                  <Input
                    id="invite-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                </Field>
              </FieldGroup>
              {formError ? <FieldError>{formError}</FieldError> : null}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Continuing…" : "Continue"}
              </Button>
            </form>
          ) : null}

          {step === "mfa" ? (
            <form onSubmit={handleConfirmMfa} className="space-y-4">
              <p className="text-caption text-muted-foreground">
                Scan this setup URI in your authenticator app, or enter the secret manually:{" "}
                <span className="font-mono text-foreground">{manualSecret}</span>
              </p>
              {qrUri ? (
                <p className="break-all text-caption text-muted-foreground">{qrUri}</p>
              ) : null}
              <OtpInput value={mfaCode} onChange={setMfaCode} />
              {formError ? <FieldError>{formError}</FieldError> : null}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Confirming…" : "Confirm MFA"}
              </Button>
            </form>
          ) : null}

          {step === "backup" ? (
            <div className="space-y-4">
              <p className="text-caption text-muted-foreground">
                Save these backup codes in a secure place. Each can be used once.
              </p>
              <ul className="rounded-[var(--radius-card)] border border-border bg-muted/30 p-3 font-mono text-caption">
                {backupCodes.map((code) => (
                  <li key={code}>{code}</li>
                ))}
              </ul>
              <Button type="button" className="w-full" onClick={() => setStep("pin")}>
                Continue to PIN
              </Button>
            </div>
          ) : null}

          {step === "pin" ? (
            <form onSubmit={handleCompletePin} className="space-y-4">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="pin">Zynd PIN (6 digits)</FieldLabel>
                  <Input
                    id="pin"
                    inputMode="numeric"
                    maxLength={6}
                    value={pin}
                    onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="confirm-pin">Confirm PIN</FieldLabel>
                  <Input
                    id="confirm-pin"
                    inputMode="numeric"
                    maxLength={6}
                    value={confirmPin}
                    onChange={(event) =>
                      setConfirmPin(event.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>Authenticator code</FieldLabel>
                  <OtpInput value={pinTotp} onChange={setPinTotp} />
                </Field>
              </FieldGroup>
              {formError ? <FieldError>{formError}</FieldError> : null}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Finishing…" : "Complete setup"}
              </Button>
            </form>
          ) : null}

          {step === "done" ? (
            <div className="space-y-4 text-center">
              <p className="text-body text-foreground">Your Support console account is ready.</p>
              <Button type="button" className="w-full" onClick={() => router.replace("/dashboard")}>
                Go to dashboard
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

export function SupportInviteOnboardingPageShell() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh items-center justify-center text-caption text-muted-foreground">
          Loading invitation…
        </div>
      }
    >
      <SupportInviteOnboardingInner />
    </Suspense>
  );
}

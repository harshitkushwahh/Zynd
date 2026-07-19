"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "react-qr-code";
import { Check, LockKeyhole, Shield, ShieldCheck } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";

import { OtpInput } from "@/components/auth/otp-input";
import { PasswordInput } from "@/components/auth/password-input";
import { AdminPinInput } from "@/components/settings/admin-pin-input";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import { useAdminZyndPinOptional } from "@/contexts/admin-zynd-pin-context";
import { mfaEnrollConfirm, mfaEnrollStart } from "@/lib/admin-account-api";
import { isValidOtp, isValidPassword } from "@/lib/admin-validation";
import { ApiError } from "@/lib/api-client";
import {
  acceptAdminInvite,
  validateAdminInvite,
  type AdminInvitePreview,
} from "@/lib/auth-api";
import { setupZyndPin } from "@/lib/pin-api";
import { cn } from "@/lib/utils";

type OnboardingStep = "account" | "mfa" | "pin" | "done";

const STEPS: Array<{ id: OnboardingStep; label: string }> = [
  { id: "account", label: "Account" },
  { id: "mfa", label: "MFA" },
  { id: "pin", label: "PIN lock" },
  { id: "done", label: "Done" },
];


export function AdminInviteOnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const { user, loading, completeSession, refreshUser } = useAdminAuth();
  const pinContext = useAdminZyndPinOptional();

  const [preview, setPreview] = useState<AdminInvitePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState("");
  const [step, setStep] = useState<OnboardingStep>("account");
  const [formError, setFormError] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [enrollToken, setEnrollToken] = useState("");
  const [qrUri, setQrUri] = useState("");
  const [manualSecret, setManualSecret] = useState("");
  const [enrollOtp, setEnrollOtp] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  const [totpCode, setTotpCode] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  const activeStepIndex = useMemo(
    () => STEPS.findIndex((item) => item.id === step),
    [step],
  );

  const loadPreview = useCallback(async () => {
    if (!token) {
      setPreviewError("This invitation link is missing its secure token.");
      setPreviewLoading(false);
      return;
    }

    setPreviewLoading(true);
    setPreviewError("");
    try {
      const result = await validateAdminInvite(token);
      setPreview(result);
      setFirstName(result.first_name ?? "");
      setLastName(result.last_name ?? "");
    } catch (err) {
      setPreview(null);
      setPreviewError(getErrorMessage(err, "This invitation link is invalid or expired."));
    } finally {
      setPreviewLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  useEffect(() => {
    if (loading || previewLoading || previewError || !user) return;
    if (user.mfa_enrolled && user.pin_enrolled) {
      setStep("done");
      return;
    }
    if (user.mfa_enrolled) {
      setStep("pin");
      return;
    }
    setStep("mfa");
  }, [loading, previewError, previewLoading, user]);

  useEffect(() => {
    if (step !== "mfa" || !user || user.mfa_enrolled || enrollToken) return;
    void (async () => {
      setSubmitting(true);
      setFormError("");
      try {
        const result = await mfaEnrollStart();
        setEnrollToken(result.enroll_token);
        setQrUri(result.qr_uri);
        setManualSecret(result.manual_secret);
      } catch (err) {
        setFormError(getErrorMessage(err, "Could not start MFA setup."));
      } finally {
        setSubmitting(false);
      }
    })();
  }, [enrollToken, step, user]);

  const handleAcceptAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!preview) return;

    if (!firstName.trim()) {
      setFormError("First name is required.");
      return;
    }
    if (!isValidPassword(password)) {
      setFormError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    setFormError("");
    try {
      await acceptAdminInvite({
        token,
        first_name: firstName.trim(),
        last_name: lastName.trim() || undefined,
        password,
      });
      await completeSession();
      sessionStorage.setItem("zynd_admin_onboard_password", password);
      setStep("mfa");
      setFormMessage("Account created. Set up MFA to continue.");
    } catch (err) {
      setFormError(getErrorMessage(err, "Could not accept invitation."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmMfa = async () => {
    if (!isValidOtp(enrollOtp)) {
      setFormError("Enter a valid authenticator code.");
      return;
    }

    setSubmitting(true);
    setFormError("");
    try {
      const result = await mfaEnrollConfirm(enrollToken, enrollOtp);
      setBackupCodes(result.backup_codes);
      await refreshUser();
      setFormMessage("MFA enabled. Save your backup codes, then set your PIN.");
      setStep("pin");
    } catch (err) {
      setFormError(getErrorMessage(err, "Could not confirm MFA setup."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetupPin = async () => {
    const setupPassword = password || sessionStorage.getItem("zynd_admin_onboard_password") || "";
    if (!setupPassword) {
      setFormError("Enter your password again to set up PIN lock.");
      return;
    }
    if (pin !== confirmPin) {
      setFormError("PIN entries do not match.");
      return;
    }
    if (pin.length !== 4) {
      setFormError("Enter a 4-digit PIN.");
      return;
    }
    if (!isValidOtp(totpCode)) {
      setFormError("Enter your authenticator code.");
      return;
    }

    setSubmitting(true);
    setFormError("");
    try {
      await setupZyndPin({
        currentPassword: setupPassword,
        totpCode,
        pin,
        confirmPin,
      });
      await refreshUser();
      pinContext?.markUnlocked();
      sessionStorage.removeItem("zynd_admin_onboard_password");
      setStep("done");
      setFormMessage("Your admin console is ready.");
    } catch (err) {
      setFormError(getErrorMessage(err, "Could not set up PIN lock."));
    } finally {
      setSubmitting(false);
    }
  };

  if (previewLoading || loading) {
    return (
      <div className="admin-login-shell flex min-h-full flex-1 items-center justify-center px-4 py-10">
        <p className="text-caption text-muted-foreground">Opening your invitation…</p>
      </div>
    );
  }

  if (previewError || !preview) {
    return (
      <div className="admin-login-shell flex min-h-full flex-1 items-center justify-center px-4 py-10">
        <Card className="w-full max-w-lg">
          <CardContent className="space-y-4 p-6 text-center">
            <AdminFeedbackMessage variant="destructive">{previewError}</AdminFeedbackMessage>
            <Button variant="outline" onClick={() => router.replace("/")}>
              Back to sign in
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="admin-login-shell flex min-h-full flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <Image src="/logo.png" alt="ZYND" width={120} height={32} className="mx-auto h-8 w-auto admin-login-logo" />
          <h1 className="mt-4 font-heading text-h3 font-semibold text-foreground">
            Join the ZYND Admin Console
          </h1>
          <p className="mt-2 text-caption text-muted-foreground">
            {preview.inviter_name ? `${preview.inviter_name} invited you` : "You were invited"} as{" "}
            <span className="font-medium text-foreground">
              {preview.role_name ?? preview.role_key}
            </span>
            .
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-4">
          {STEPS.map((item, index) => (
            <div
              key={item.id}
              className={cn(
                "rounded-[var(--radius-control)] border px-3 py-2 text-center text-caption",
                index <= activeStepIndex
                  ? "border-primary/30 bg-primary/5 text-foreground"
                  : "border-border text-muted-foreground",
              )}
            >
              {item.label}
            </div>
          ))}
        </div>

        <Card>
          <CardContent className="space-y-4 p-6">
            {formError ? <AdminFeedbackMessage variant="destructive">{formError}</AdminFeedbackMessage> : null}
            {formMessage ? <AdminFeedbackMessage variant="success">{formMessage}</AdminFeedbackMessage> : null}

            {step === "account" ? (
              <form onSubmit={(event) => void handleAcceptAccount(event)} className="space-y-4">
                <div className="rounded-[var(--radius-card)] border border-border bg-muted/15 px-4 py-3 text-caption text-muted-foreground">
                  Invitation for <span className="font-medium text-foreground">{preview.email}</span>
                </div>

                <FieldGroup>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="invite-first-name">First name</FieldLabel>
                      <Input
                        id="invite-first-name"
                        value={firstName}
                        onChange={(event) => setFirstName(event.target.value)}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="invite-last-name">Last name</FieldLabel>
                      <Input
                        id="invite-last-name"
                        value={lastName}
                        onChange={(event) => setLastName(event.target.value)}
                      />
                    </Field>
                  </div>

                  <Field>
                    <FieldLabel htmlFor="invite-password">Password</FieldLabel>
                    <PasswordInput
                      id="invite-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                    <FieldError>Use at least 8 characters.</FieldError>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="invite-confirm-password">Confirm password</FieldLabel>
                    <PasswordInput
                      id="invite-confirm-password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                    />
                  </Field>
                </FieldGroup>

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Creating account…" : "Continue to MFA setup"}
                </Button>
              </form>
            ) : null}

            {step === "mfa" ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-card)] bg-primary/10 text-primary">
                    <Shield className="size-5" />
                  </div>
                  <div>
                    <p className="text-compact font-semibold text-foreground">
                      Set up authenticator MFA
                    </p>
                    <p className="mt-1 text-caption text-muted-foreground">
                      Scan the QR code, then enter the 6-digit code from your authenticator app.
                    </p>
                  </div>
                </div>

                {qrUri ? (
                  <div className="mx-auto w-fit rounded-[var(--radius-card)] border border-border bg-card p-4">
                    <QRCode value={qrUri} size={168} />
                  </div>
                ) : null}

                {manualSecret ? (
                  <p className="break-all text-center font-mono text-caption text-muted-foreground">
                    Manual key: {manualSecret}
                  </p>
                ) : null}

                <OtpInput value={enrollOtp} onChange={setEnrollOtp} />

                <Button className="w-full" disabled={submitting} onClick={() => void handleConfirmMfa()}>
                  {submitting ? "Verifying…" : "Enable MFA"}
                </Button>
              </div>
            ) : null}

            {step === "pin" ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-card)] bg-primary/10 text-primary">
                    <LockKeyhole className="size-5" />
                  </div>
                  <div>
                    <p className="text-compact font-semibold text-foreground">Set your console PIN</p>
                    <p className="mt-1 text-caption text-muted-foreground">
                      Choose a 4-digit PIN to lock the admin console after inactivity.
                    </p>
                  </div>
                </div>

                {backupCodes.length > 0 ? (
                  <div className="rounded-[var(--radius-card)] border border-border bg-muted/15 p-4">
                    <p className="text-caption font-medium text-foreground">Backup codes</p>
                    <p className="mt-1 text-caption text-muted-foreground">
                      Store these somewhere safe before continuing.
                    </p>
                    <div className="mt-3 grid gap-1 font-mono text-caption sm:grid-cols-2">
                      {backupCodes.map((code) => (
                        <span key={code}>{code}</span>
                      ))}
                    </div>
                  </div>
                ) : null}

                <Field>
                  <FieldLabel>Authenticator code</FieldLabel>
                  <OtpInput value={totpCode} onChange={setTotpCode} />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>PIN</FieldLabel>
                    <AdminPinInput value={pin} onChange={setPin} />
                  </Field>
                  <Field>
                    <FieldLabel>Confirm PIN</FieldLabel>
                    <AdminPinInput value={confirmPin} onChange={setConfirmPin} />
                  </Field>
                </div>

                <Button className="w-full" disabled={submitting} onClick={() => void handleSetupPin()}>
                  {submitting ? "Saving PIN…" : "Finish setup"}
                </Button>
              </div>
            ) : null}

            {step === "done" ? (
              <div className="space-y-4 text-center">
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-success/10 text-success">
                  <ShieldCheck className="size-7" />
                </div>
                <div>
                  <p className="text-compact font-semibold text-foreground">Setup complete</p>
                  <p className="mt-1 text-caption text-muted-foreground">
                    Your admin account is secured with password, MFA, and PIN lock.
                  </p>
                </div>
                <Button className="w-full" onClick={() => router.replace("/dashboard")}>
                  <Check className="size-4" />
                  Open admin console
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

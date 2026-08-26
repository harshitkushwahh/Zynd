"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import QRCode from "react-qr-code";
import {
  Check,
  CircleX,
  Clock,
  Copy,
  KeyRound,
  LockKeyhole,
  Mail,
  Shield,
  ShieldCheck,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { getErrorMessage } from "@/lib/errors";

import { AdminAuthButton } from "@/components/auth/admin-auth-button";
import { AdminAuthShellThemeToggle } from "@/components/auth/admin-auth-shell-theme-toggle";
import { AdminBackupCodesPanel } from "@/components/auth/admin-backup-codes-panel";
import { ADMIN_MENU_EASE } from "@/components/ui/admin-menu-motion";
import { ADMIN_INVITE_LOTTIE_SRC } from "@/components/auth/admin-login-visual-lottie";
import { AdminLoginVisualPanel } from "@/components/auth/admin-login-visual-panel";
import { OtpInput } from "@/components/auth/otp-input";
import { PasswordInput } from "@/components/auth/password-input";
import { AdminPinInput } from "@/components/settings/admin-pin-input";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import { useAdminZyndPinOptional } from "@/contexts/admin-zynd-pin-context";
import { PasswordCriteriaList } from "@/components/auth/password-criteria-list";
import { isValidOtp } from "@/lib/admin-validation";
import { INPUT_RULES, inputRuleProps } from "@/lib/input-rules";
import { isPasswordValid } from "@/lib/password-criteria";
import {
  acceptAdminInvite,
  adminInviteMfaConfirm,
  adminInviteMfaStart,
  completeAdminInvite,
  validateAdminInvite,
  type AdminInvitePreview,
} from "@/lib/auth-api";
import { env } from "@/lib/env";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

function isRevokedInviteError(error: unknown) {
  return error instanceof ApiError && error.code === "invite_revoked";
}

type OnboardingStep = "welcome" | "account" | "mfa" | "backup-codes" | "pin" | "done";
type PinSetupSlide = "verify" | "pin";

const STEPS: Array<{ id: OnboardingStep; label: string; icon: LucideIcon }> = [
  { id: "welcome", label: "Welcome", icon: Sparkles },
  { id: "account", label: "Account", icon: UserRound },
  { id: "mfa", label: "MFA", icon: Shield },
  { id: "backup-codes", label: "Backup codes", icon: KeyRound },
  { id: "pin", label: "PIN lock", icon: LockKeyhole },
  { id: "done", label: "Complete", icon: Check },
];

const ONBOARDING_TOKEN_STORAGE_KEY = "zynd_admin_onboard_token";
const ONBOARD_STEP_STORAGE_KEY = "zynd_admin_onboard_step";
const ONBOARD_BACKUP_CODES_STORAGE_KEY = "zynd_admin_onboard_backup_codes";
const underlineInputClass = "auth-input-underline admin-login-form__input";

const INVITE_STEP_MOTION = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.32, ease: ADMIN_MENU_EASE },
} as const;

function getStepTitle(step: OnboardingStep) {
  switch (step) {
    case "welcome":
      return "You're invited";
    case "account":
      return "Create your account";
    case "mfa":
      return "Set up MFA";
    case "backup-codes":
      return "Save backup codes";
    case "pin":
      return "Set your PIN";
    case "done":
      return "You're all set";
  }
}

function readStoredOnboardingToken(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(ONBOARDING_TOKEN_STORAGE_KEY) ?? "";
}

function readStoredOnboardingStep(): OnboardingStep {
  if (typeof window === "undefined") return "welcome";
  const stored = sessionStorage.getItem(ONBOARD_STEP_STORAGE_KEY);
  if (
    stored === "welcome" ||
    stored === "account" ||
    stored === "mfa" ||
    stored === "backup-codes" ||
    stored === "pin" ||
    stored === "done"
  ) {
    return stored;
  }
  return readStoredOnboardingToken() ? "mfa" : "welcome";
}

function storeOnboardingToken(value: string) {
  sessionStorage.setItem(ONBOARDING_TOKEN_STORAGE_KEY, value);
}

function storeOnboardingStep(value: OnboardingStep) {
  sessionStorage.setItem(ONBOARD_STEP_STORAGE_KEY, value);
}

function clearOnboardingStorage() {
  sessionStorage.removeItem(ONBOARDING_TOKEN_STORAGE_KEY);
  sessionStorage.removeItem(ONBOARD_STEP_STORAGE_KEY);
  sessionStorage.removeItem(ONBOARD_BACKUP_CODES_STORAGE_KEY);
}

function readStoredBackupCodes(): string[] {
  if (typeof window === "undefined") return [];
  const stored = sessionStorage.getItem(ONBOARD_BACKUP_CODES_STORAGE_KEY);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function AuthStepIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon className="admin-auth-step-icon size-5" aria-hidden="true" />;
}

function AdminInviteOnboardingSkeleton() {
  return (
    <>
      <header className="admin-login-form-panel__header">
        <Skeleton className="admin-login-form-panel__logo rounded-full" />
        <Skeleton className="h-8 w-52 max-w-full" />
        <Skeleton className="h-4 w-full max-w-xs" />
      </header>

      <div className="admin-invite-onboarding-steps-scroll" aria-hidden="true">
        <div className="admin-invite-onboarding-steps">
          {Array.from({ length: STEPS.length }).map((_, index) => (
            <div key={`invite-step-skeleton-${index}`} className="admin-invite-onboarding-steps__item">
              <div className="admin-invite-onboarding-steps__track">
                <Skeleton className="admin-invite-onboarding-steps__line h-0.5 rounded-full" />
                <Skeleton className="size-7 shrink-0 rounded-full" />
                <Skeleton className="admin-invite-onboarding-steps__line h-0.5 rounded-full" />
              </div>
              <Skeleton className="h-3 w-10 rounded-full" />
            </div>
          ))}
        </div>
      </div>

      <div className="admin-login-form space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-11 w-full rounded-[var(--radius-control)]" />
          <Skeleton className="h-11 w-full rounded-[var(--radius-control)]" />
        </div>
        <Skeleton className="h-11 w-full rounded-[var(--radius-control)]" />
        <Skeleton className="h-24 w-full rounded-[var(--radius-control)]" />
        <Skeleton className="h-11 w-full rounded-[var(--radius-control)]" />
      </div>
    </>
  );
}

function AdminInviteMfaSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center space-y-5 text-center">
      <Skeleton className="h-44 w-44 max-w-full rounded-[var(--radius-card)]" />
      <Skeleton className="h-20 w-full rounded-[var(--radius-control)]" />
      <Skeleton className="h-11 w-full max-w-sm rounded-[var(--radius-control)]" />
      <Skeleton className="h-11 w-full max-w-sm rounded-[var(--radius-control)]" />
    </div>
  );
}

function InviteWelcomeCard({ preview }: { preview: AdminInvitePreview }) {
  const expiresLabel = new Date(preview.expires_at).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="admin-invite-welcome-card">
      <div className="admin-invite-welcome-card__header">
        <Sparkles className="admin-auth-step-icon size-5" aria-hidden="true" />
        <p className="admin-invite-welcome-card__title">Invitation details</p>
      </div>

      <dl className="admin-invite-welcome-card__details">
        <div className="admin-invite-welcome-card__detail-row">
          <Mail className="admin-invite-welcome-card__detail-icon" aria-hidden="true" />
          <div className="admin-invite-welcome-card__detail-copy">
            <dt className="admin-invite-welcome-card__detail-label">Email</dt>
            <dd className="admin-invite-welcome-card__detail-value">{preview.email}</dd>
          </div>
        </div>
        <div className="admin-invite-welcome-card__detail-row">
          <Clock className="admin-invite-welcome-card__detail-icon" aria-hidden="true" />
          <div className="admin-invite-welcome-card__detail-copy">
            <dt className="admin-invite-welcome-card__detail-label">Expires</dt>
            <dd className="admin-invite-welcome-card__detail-value">{expiresLabel}</dd>
          </div>
        </div>
      </dl>
    </div>
  );
}

export function AdminInviteOnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const { user, loading, completeSession, signOut } = useAdminAuth();
  const pinContext = useAdminZyndPinOptional();

  const [preview, setPreview] = useState<AdminInvitePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState("");
  const [inviteRevoked, setInviteRevoked] = useState(false);
  const [step, setStepState] = useState<OnboardingStep>(() => readStoredOnboardingStep());
  const [onboardingToken, setOnboardingToken] = useState(() => readStoredOnboardingToken());

  const setStep = useCallback((next: OnboardingStep) => {
    storeOnboardingStep(next);
    setStepState(next);
  }, []);
  const [formError, setFormError] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");

  const [enrollToken, setEnrollToken] = useState("");
  const [qrUri, setQrUri] = useState("");
  const [manualSecret, setManualSecret] = useState("");
  const [enrollOtp, setEnrollOtp] = useState("");
  const [manualSecretCopied, setManualSecretCopied] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>(() => readStoredBackupCodes());

  const [totpCode, setTotpCode] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinSetupSlide, setPinSetupSlide] = useState<PinSetupSlide>("verify");

  const activeStepIndex = useMemo(
    () => STEPS.findIndex((item) => item.id === step),
    [step],
  );
  const stepItemRefs = useRef<Array<HTMLLIElement | null>>([]);

  useEffect(() => {
    const activeStep = stepItemRefs.current[activeStepIndex];
    activeStep?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeStepIndex]);
  const previewBlocked = inviteRevoked || Boolean(previewError);
  const canSubmitAccount =
    firstName.trim().length >= INPUT_RULES.firstName.minLength && isPasswordValid(password);

  const loadPreview = useCallback(async () => {
    if (!token) {
      setPreviewError("This invitation link is missing its secure token.");
      setPreviewLoading(false);
      return;
    }

    setPreviewLoading(true);
    setPreviewError("");
    setInviteRevoked(false);
    try {
      const result = await validateAdminInvite(token);
      if (result.target_console === "distributor") {
        const redirectUrl = `${env.distributorUrl.replace(/\/$/, "")}/accept-invite?token=${encodeURIComponent(token)}`;
        window.location.replace(redirectUrl);
        return;
      }
      setPreview(result);
      setFirstName(result.first_name ?? "");
      setLastName(result.last_name ?? "");
    } catch (err) {
      setPreview(null);
      if (isRevokedInviteError(err)) {
        setInviteRevoked(true);
        setPreviewError("");
      } else {
        setInviteRevoked(false);
        setPreviewError(getErrorMessage(err, "This invitation link is invalid or expired."));
      }
    } finally {
      setPreviewLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  useEffect(() => {
    if (loading || previewLoading || previewBlocked) return;
    if (user?.mfa_enrolled && user?.pin_enrolled) {
      router.replace("/dashboard");
    }
  }, [loading, previewBlocked, previewLoading, router, user]);

  useEffect(() => {
    if (step !== "mfa" || !onboardingToken || enrollToken) return;
    if (readStoredBackupCodes().length > 0) return;
    void (async () => {
      setSubmitting(true);
      setFormError("");
      try {
        const result = await adminInviteMfaStart(onboardingToken);
        setEnrollToken(result.enroll_token);
        setQrUri(result.qr_uri);
        setManualSecret(result.manual_secret);
      } catch (err) {
        setFormError(getErrorMessage(err, "Could not start MFA setup."));
      } finally {
        setSubmitting(false);
      }
    })();
  }, [enrollToken, onboardingToken, step]);

  useEffect(() => {
    if (step !== "pin") return;
    setPinSetupSlide("verify");
    setFormError("");
  }, [step]);

  const handleContinueToPinSlide = () => {
    if (!isValidOtp(totpCode)) {
      setFormError("Enter a valid authenticator code.");
      return;
    }
    setFormError("");
    setPinSetupSlide("pin");
  };

  const handleBackToVerifySlide = () => {
    setFormError("");
    setPin("");
    setConfirmPin("");
    setPinSetupSlide("verify");
  };

  const handleAcceptAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!preview || !canSubmitAccount) return;

    setSubmitting(true);
    setFormError("");
    try {
      const result = await acceptAdminInvite({
        token,
        first_name: firstName.trim(),
        last_name: lastName.trim() || undefined,
        password,
      });
      storeOnboardingToken(result.onboarding_token);
      setOnboardingToken(result.onboarding_token);
      setStep("mfa");
      setFormMessage("Continue with MFA to finish securing your account.");
    } catch (err) {
      if (isRevokedInviteError(err)) {
        setInviteRevoked(true);
        setFormError("");
        return;
      }
      setFormError(getErrorMessage(err, "Could not accept invitation."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyManualSecret = async () => {
    if (!manualSecret) return;
    await navigator.clipboard.writeText(manualSecret);
    setManualSecretCopied(true);
    window.setTimeout(() => setManualSecretCopied(false), 2000);
  };

  const handleConfirmMfa = async () => {
    if (!onboardingToken) {
      setFormError("Your setup session expired. Start again from the Account step.");
      return;
    }
    if (!isValidOtp(enrollOtp)) {
      setFormError("Enter a valid authenticator code.");
      return;
    }

    setSubmitting(true);
    setFormError("");
    try {
      const result = await adminInviteMfaConfirm(onboardingToken, enrollToken, enrollOtp);
      setBackupCodes(result.backup_codes);
      sessionStorage.setItem(ONBOARD_BACKUP_CODES_STORAGE_KEY, JSON.stringify(result.backup_codes));
      setFormMessage("");
      setStep("backup-codes");
    } catch (err) {
      setFormError(getErrorMessage(err, "Could not confirm MFA setup."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetupPin = async () => {
    if (!onboardingToken) {
      setFormError("Your setup session expired. Start again from the Account step.");
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
      await completeAdminInvite({
        onboardingToken,
        pin,
        confirmPin,
        totpCode,
      });
      await completeSession();
      pinContext?.markUnlocked();
      clearOnboardingStorage();
      setStep("done");
      setFormMessage("Your admin account is ready. Sign in to open the console.");
    } catch (err) {
      setFormError(getErrorMessage(err, "Could not set up PIN lock."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeclineInvite = () => {
    router.replace("/");
  };

  const handleGoToSignIn = async () => {
    clearOnboardingStorage();
    await signOut();
    router.replace("/");
  };

  const renderShell = (content: React.ReactNode) => (
    <div className="admin-login-split-card min-h-dvh w-full">
      <AdminAuthShellThemeToggle />
      <AdminLoginVisualPanel
        hello="Join ZYND Admin"
        lottieSrc={ADMIN_INVITE_LOTTIE_SRC}
        description="You've been invited to join the team. A short setup is all it takes to activate your secure access."
      />
      <div className="admin-login-form-panel">
        <div className="admin-login-form-panel__inner admin-invite-onboarding-panel__inner">{content}</div>
      </div>
    </div>
  );

  if (previewLoading || loading) {
    return renderShell(<AdminInviteOnboardingSkeleton />);
  }

  if (inviteRevoked) {
    return (
      <div className="admin-login-shell admin-invite-revoked-shell min-h-dvh w-full">
        <AdminAuthShellThemeToggle />
        <div className="admin-invite-revoked-shell__content">
          <div className="admin-invite-revoked-shell__icon" aria-hidden="true">
            <CircleX className="size-8" strokeWidth={2} />
          </div>
          <h1 className="admin-invite-revoked-shell__title">This invitation was revoked.</h1>
          <Button variant="outline" onClick={() => router.replace("/")}>
            Back to sign in
          </Button>
        </div>
      </div>
    );
  }

  if (previewError || !preview) {
    return renderShell(
      <div className="space-y-4 text-center">
        <AdminFeedbackMessage variant="destructive" onDismiss={() => setPreviewError("")}>{previewError}</AdminFeedbackMessage>
        <Button variant="outline" onClick={() => router.replace("/")}>
          Back to sign in
        </Button>
      </div>,
    );
  }

  const roleLabel = preview.role_name ?? preview.role_key;
  const inviterCopy = preview.inviter_name
    ? `${preview.inviter_name} invited you`
    : "You were invited";

  return renderShell(
    <>
      <header className="admin-login-form-panel__header">
        <Image
          src="/zynda.png"
          alt="ZYND"
          width={56}
          height={56}
          className="admin-login-form-panel__logo"
          priority
        />
      </header>

      <div className="admin-invite-onboarding-steps-scroll">
        <ol className="admin-invite-onboarding-steps" aria-label="Setup progress">
          {STEPS.map((item, index) => {
            const StepIcon = item.icon;
            const isComplete = index < activeStepIndex || step === "done";
            const isActive = index === activeStepIndex && step !== "done";
            const isLast = index === STEPS.length - 1;
            const lineBeforeComplete = index > 0 && (index <= activeStepIndex || step === "done");
            const lineAfterComplete = !isLast && (index < activeStepIndex || step === "done");

            return (
              <li
                key={item.id}
                ref={(node) => {
                  stepItemRefs.current[index] = node;
                }}
                className={cn(
                  "admin-invite-onboarding-steps__item",
                  isActive && "admin-invite-onboarding-steps__item--active",
                  isComplete && "admin-invite-onboarding-steps__item--complete",
                )}
                aria-current={isActive ? "step" : undefined}
              >
                <div className="admin-invite-onboarding-steps__track">
                  <span
                    className={cn(
                      "admin-invite-onboarding-steps__line",
                      "admin-invite-onboarding-steps__line--start",
                      index === 0 && "admin-invite-onboarding-steps__line--hidden",
                      lineBeforeComplete && "admin-invite-onboarding-steps__line--complete",
                    )}
                    aria-hidden="true"
                  />
                  <span className="admin-invite-onboarding-steps__indicator" aria-hidden="true">
                    <StepIcon className="admin-invite-onboarding-steps__icon" strokeWidth={2} />
                  </span>
                  <span
                    className={cn(
                      "admin-invite-onboarding-steps__line",
                      "admin-invite-onboarding-steps__line--end",
                      isLast && "admin-invite-onboarding-steps__line--hidden",
                      lineAfterComplete && "admin-invite-onboarding-steps__line--complete",
                    )}
                    aria-hidden="true"
                  />
                </div>
                <span className="admin-invite-onboarding-steps__label">{item.label}</span>
              </li>
            );
          })}
        </ol>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          className="admin-invite-onboarding-step-shell"
          {...INVITE_STEP_MOTION}
        >
          <div className="admin-login-form-panel__header-copy">
            <h1 className="admin-login-form-panel__title">{getStepTitle(step)}</h1>
            <p className="admin-login-form-panel__hint">
              {inviterCopy} as{" "}
              <span className="admin-login-form-panel__hint-emphasis">{roleLabel}</span>.
            </p>
          </div>

          <div className="admin-login-form">
            {formError ? <AdminFeedbackMessage variant="destructive" onDismiss={() => setFormError("")}>{formError}</AdminFeedbackMessage> : null}
            {formMessage ? <AdminFeedbackMessage variant="success" onDismiss={() => setFormMessage("")}>{formMessage}</AdminFeedbackMessage> : null}

            {step === "welcome" ? (
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  setStep("account");
                }}
              >
                <InviteWelcomeCard preview={preview} />

                <div className="grid gap-2 sm:grid-cols-2">
                  <AdminAuthButton type="submit">Accept invitation</AdminAuthButton>
                  <Button type="button" variant="outline" className="h-11" onClick={handleDeclineInvite}>
                    Decline
                  </Button>
                </div>
              </form>
            ) : null}

            {step === "account" ? (
              <form onSubmit={(event) => void handleAcceptAccount(event)} className="space-y-4">
                <FieldGroup className="admin-login-form__fields">
                  <div className="grid grid-cols-2 gap-4">
                    <Field>
                      <FieldLabel htmlFor="invite-first-name">First name</FieldLabel>
                      <Input
                        id="invite-first-name"
                        value={firstName}
                        onChange={(event) => setFirstName(event.target.value)}
                        className={underlineInputClass}
                        autoComplete="given-name"
                        {...inputRuleProps("firstName")}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="invite-last-name">Last name</FieldLabel>
                      <Input
                        id="invite-last-name"
                        value={lastName}
                        onChange={(event) => setLastName(event.target.value)}
                        className={underlineInputClass}
                        autoComplete="family-name"
                      />
                    </Field>
                  </div>
                  <Field>
                    <FieldLabel htmlFor="invite-password">Password</FieldLabel>
                    <PasswordInput
                      id="invite-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className={underlineInputClass}
                      {...inputRuleProps("password")}
                    />
                    {password ? <PasswordCriteriaList password={password} /> : null}
                  </Field>
                </FieldGroup>

                <AdminAuthButton type="submit" disabled={submitting || !canSubmitAccount}>
                  {submitting ? "Creating account…" : "Continue to MFA"}
                </AdminAuthButton>
              </form>
            ) : null}

            {step === "mfa" ? (
              !qrUri && (submitting || !enrollToken) ? (
                <AdminInviteMfaSkeleton />
              ) : (
                <form
                  className="mx-auto flex w-full max-w-md flex-col items-center space-y-5 text-center"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleConfirmMfa();
                  }}
                >
                  {qrUri ? (
                    <div className="rounded-[var(--radius-card)] border border-border bg-card p-4">
                      <div className="mx-auto w-fit rounded-[var(--radius-control)] border border-border bg-white p-3 shadow-zynd-low">
                        <QRCode value={qrUri} size={168} bgColor="#FFFFFF" fgColor="#000000" />
                      </div>
                    </div>
                  ) : null}

                  {manualSecret ? (
                    <div className="w-full rounded-[var(--radius-control)] border border-border bg-card px-3 py-3 text-left">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-caption font-medium text-muted-foreground">Manual key</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          aria-label={manualSecretCopied ? "Manual key copied" : "Copy manual key"}
                          onClick={() => void handleCopyManualSecret()}
                        >
                          {manualSecretCopied ? (
                            <Check className="size-3.5 text-success" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                        </Button>
                      </div>
                      <p className="break-all font-mono text-caption leading-relaxed text-foreground">
                        {manualSecret}
                      </p>
                    </div>
                  ) : null}

                  <div className="w-full max-w-sm">
                    <OtpInput value={enrollOtp} onChange={setEnrollOtp} />
                  </div>

                  <AdminAuthButton
                    type="submit"
                    className="max-w-sm"
                    disabled={submitting || !isValidOtp(enrollOtp)}
                  >
                    {submitting ? "Verifying…" : "Enable MFA"}
                  </AdminAuthButton>
                </form>
              )
            ) : null}

            {step === "backup-codes" ? (
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  setStep("pin");
                }}
              >
                <AdminBackupCodesPanel
                  codes={backupCodes}
                  onActionMessage={(message) => setFormMessage(message)}
                />
                <AdminAuthButton type="submit">I&apos;ve saved my codes, Continue</AdminAuthButton>
              </form>
            ) : null}

            {step === "pin" ? (
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (pinSetupSlide === "verify") {
                    handleContinueToPinSlide();
                    return;
                  }
                  void handleSetupPin();
                }}
              >
                <div className="admin-invite-pin-swiper">
                  <motion.div
                    className="admin-invite-pin-swiper__track"
                    animate={{ x: pinSetupSlide === "verify" ? "0%" : "-50%" }}
                    transition={{ duration: 0.35, ease: ADMIN_MENU_EASE }}
                  >
                    <div className="admin-invite-pin-swiper__slide">
                      <div className="space-y-4 p-1">
                        <div className="flex flex-col items-center gap-3 text-center">
                          <AuthStepIcon icon={Shield} />
                          <div>
                            <p className="text-compact font-semibold text-foreground">Authenticator code</p>
                            <p className="mt-1 text-caption text-muted-foreground">
                              Please enter the authentication code to verify you&apos;re genuine.
                            </p>
                          </div>
                        </div>
                        <OtpInput value={totpCode} onChange={setTotpCode} />
                        {pinSetupSlide === "verify" ? (
                          <AdminAuthButton type="submit" disabled={!isValidOtp(totpCode)}>
                            Continue
                          </AdminAuthButton>
                        ) : null}
                      </div>
                    </div>

                    <div className="admin-invite-pin-swiper__slide">
                      <div className="space-y-4 p-1">
                        <div className="flex flex-col items-center gap-3 text-center">
                          <AuthStepIcon icon={LockKeyhole} />
                          <div>
                            <p className="text-compact font-semibold text-foreground">Zynd PIN lock</p>
                            <p className="mt-1 text-caption text-muted-foreground">
                              Create a 4-digit PIN to secure the admin console.
                            </p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="flex justify-center">
                            <AdminPinInput value={pin} onChange={setPin} />
                          </div>
                          <div className="flex justify-center">
                            <AdminPinInput value={confirmPin} onChange={setConfirmPin} />
                          </div>
                        </div>

                        {pinSetupSlide === "pin" ? (
                          <div className="grid gap-2 sm:grid-cols-2">
                            <Button type="button" variant="outline" className="h-11" onClick={handleBackToVerifySlide}>
                              Back
                            </Button>
                            <AdminAuthButton
                              type="submit"
                              disabled={submitting || pin.length !== 4 || confirmPin.length !== 4}
                            >
                              {submitting ? "Saving PIN…" : "Finish setup"}
                            </AdminAuthButton>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </motion.div>
                </div>

                <div className="admin-user-kyc-carousel-dots" role="tablist" aria-label="PIN setup steps">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={pinSetupSlide === "verify"}
                    aria-label="Verify authenticator code"
                    className={cn(
                      "admin-user-kyc-carousel-dots__dot",
                      pinSetupSlide === "verify" && "admin-user-kyc-carousel-dots__dot--active",
                    )}
                    onClick={() => {
                      if (pinSetupSlide === "pin") handleBackToVerifySlide();
                    }}
                  />
                  <button
                    type="button"
                    role="tab"
                    aria-selected={pinSetupSlide === "pin"}
                    aria-label="Set Zynd PIN"
                    className={cn(
                      "admin-user-kyc-carousel-dots__dot",
                      pinSetupSlide === "pin" && "admin-user-kyc-carousel-dots__dot--active",
                    )}
                    disabled={!isValidOtp(totpCode)}
                    onClick={() => {
                      if (isValidOtp(totpCode)) handleContinueToPinSlide();
                    }}
                  />
                </div>
              </form>
            ) : null}

            {step === "done" ? (
              <form
                className="space-y-4 text-center"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleGoToSignIn();
                }}
              >
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-success/10 text-success">
                  <ShieldCheck className="size-7" />
                </div>
                <p className="text-caption text-muted-foreground">
                  Your admin account is secured with password, MFA, backup codes, and PIN lock. Sign in to
                  open the console.
                </p>
                <AdminAuthButton type="submit">
                  <Check className="size-4" />
                  Go to sign in
                </AdminAuthButton>
              </form>
            ) : null}
          </div>
        </motion.div>
      </AnimatePresence>
    </>,
  );
}

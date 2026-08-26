"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  Check,
  Clock,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Mail,
  Shield,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { DistributorAuthShellThemeToggle } from "@/components/auth/distributor-auth-shell-theme-toggle";
import { DistributorBackupCodesPanel } from "@/components/auth/distributor-backup-codes-panel";
import { DistributorInviteDoneCard } from "@/components/auth/distributor-invite-done-card";
import { InviteMfaBrandedQrCode } from "@/components/auth/invite-mfa-branded-qr-code";

import { DistributorGlobalLoading } from "@/components/auth/distributor-global-loading";
import { DistributorLoginVisualPanel } from "@/components/auth/distributor-login-visual-panel";
import { DistributorPinInput } from "@/components/auth/distributor-pin-input";
import { DISTRIBUTOR_MENU_EASE } from "@/components/ui/distributor-menu-motion";
import { OtpInput } from "@/components/auth/otp-input";
import { PasswordCriteriaList } from "@/components/auth/password-criteria-list";
import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import { DistributorFeedbackMessage } from "@/components/ui/distributor-feedback-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDistributorAuth } from "@/contexts/distributor-auth-context";
import { useDistributorZyndPinOptional } from "@/contexts/distributor-zynd-pin-context";
import { ApiError } from "@/lib/api-client";
import {
  ZYND_DISTRIBUTOR_LOGIN_VISUAL_GRADIENT,
  ZYND_DISTRIBUTOR_LOGO_HORIZONTAL_SRC,
} from "@/lib/distributor-brand-assets";
import { completeDistributorLogin } from "@/lib/distributor-auth-api";
import {
  acceptDistributorInvite,
  completeDistributorInvite,
  distributorInviteMfaConfirm,
  distributorInviteMfaStart,
  validateDistributorInvite,
  type DistributorInvitePreview,
} from "@/lib/distributor-invite-api";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";
import { isPasswordValid } from "@/lib/password-criteria";
import { cn } from "@/lib/utils";

type Step = "welcome" | "account" | "mfa" | "backup" | "pin" | "done";
type PinSetupSlide = "verify" | "pin";

const STEPS: Array<{ id: Step; label: string; icon: LucideIcon }> = [
  { id: "welcome", label: "Welcome", icon: Sparkles },
  { id: "account", label: "Account", icon: UserRound },
  { id: "mfa", label: "MFA", icon: Shield },
  { id: "backup", label: "Backup", icon: KeyRound },
  { id: "pin", label: "PIN", icon: LockKeyhole },
  { id: "done", label: "Done", icon: Check },
];

function isValidOtp(value: string) {
  return /^\d{6}$/.test(value);
}

function getStepTitle(step: Step) {
  switch (step) {
    case "welcome":
      return "You're invited";
    case "account":
      return "Create your account";
    case "mfa":
      return "Set up MFA";
    case "backup":
      return "Save backup codes";
    case "pin":
      return "Set your PIN";
    case "done":
      return "You're all set";
  }
}

function AuthStepIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="distributor-invite-auth-step-icon" aria-hidden="true">
      <Icon className="size-5" strokeWidth={2} />
    </span>
  );
}

function InviteWelcomeDetails({ preview }: { preview: DistributorInvitePreview }) {
  const expiresLabel = new Date(preview.expires_at).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-card p-4 text-left">
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-caption text-muted-foreground">Email</p>
            <p className="truncate text-compact font-medium text-foreground">{preview.email}</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="text-caption text-muted-foreground">Expires</p>
            <p className="text-compact font-medium text-foreground">{expiresLabel}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function InviteStepProgress({ step }: { step: Step }) {
  const activeIndex = STEPS.findIndex((item) => item.id === step);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stepItemRefs = useRef<Array<HTMLLIElement | null>>([]);

  useEffect(() => {
    const container = scrollRef.current;
    const activeStep = stepItemRefs.current[activeIndex];
    if (!container || !activeStep) return;

    const containerRect = container.getBoundingClientRect();
    const stepRect = activeStep.getBoundingClientRect();
    const targetLeft =
      container.scrollLeft +
      (stepRect.left - containerRect.left) -
      (containerRect.width - stepRect.width) / 2;

    container.scrollTo({ left: Math.max(0, targetLeft), behavior: "smooth" });
  }, [activeIndex]);

  return (
    <div ref={scrollRef} className="distributor-invite-onboarding-steps-scroll">
      <ol className="distributor-invite-onboarding-steps" aria-label="Setup progress">
        {STEPS.map((item, index) => {
          const StepIcon = item.icon;
          const isComplete = index < activeIndex || step === "done";
          const isActive = index === activeIndex && step !== "done";
          const isLast = index === STEPS.length - 1;
          const lineBeforeComplete = index > 0 && (index <= activeIndex || step === "done");
          const lineAfterComplete = !isLast && (index < activeIndex || step === "done");

          return (
            <li
              key={item.id}
              ref={(node) => {
                stepItemRefs.current[index] = node;
              }}
              className={cn(
                "distributor-invite-onboarding-steps__item",
                isActive && "distributor-invite-onboarding-steps__item--active",
                isComplete && "distributor-invite-onboarding-steps__item--complete",
              )}
              aria-current={isActive ? "step" : undefined}
            >
              <div className="distributor-invite-onboarding-steps__track">
                <span
                  className={cn(
                    "distributor-invite-onboarding-steps__line",
                    index === 0 && "distributor-invite-onboarding-steps__line--hidden",
                    lineBeforeComplete && "distributor-invite-onboarding-steps__line--complete",
                  )}
                  aria-hidden="true"
                />
                <span className="distributor-invite-onboarding-steps__indicator" aria-hidden="true">
                  <StepIcon className="distributor-invite-onboarding-steps__icon" strokeWidth={2} />
                </span>
                <span
                  className={cn(
                    "distributor-invite-onboarding-steps__line",
                    isLast && "distributor-invite-onboarding-steps__line--hidden",
                    lineAfterComplete && "distributor-invite-onboarding-steps__line--complete",
                  )}
                  aria-hidden="true"
                />
              </div>
              <span className="distributor-invite-onboarding-steps__label">{item.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function DistributorInviteOnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const { loading, refreshUser } = useDistributorAuth();
  const pinContext = useDistributorZyndPinOptional();

  const [preview, setPreview] = useState<DistributorInvitePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState("");
  const [step, setStep] = useState<Step>("welcome");
  const [onboardingToken, setOnboardingToken] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [enrollToken, setEnrollToken] = useState("");
  const [qrUri, setQrUri] = useState("");
  const [manualSecret, setManualSecret] = useState("");
  const [manualSecretCopied, setManualSecretCopied] = useState(false);
  const [enrollOtp, setEnrollOtp] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [totpCode, setTotpCode] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinSetupSlide, setPinSetupSlide] = useState<PinSetupSlide>("verify");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const stepContentRef = useRef<HTMLDivElement>(null);

  const roleLabel = preview?.role_name ?? preview?.role_key ?? "team member";
  const inviterCopy = useMemo(() => {
    if (!preview) return "";
    return preview.inviter_name
      ? `${preview.inviter_name} invited you`
      : "You were invited";
  }, [preview]);

  const canSubmitAccount = firstName.trim().length >= 2 && isPasswordValid(password);

  const loadPreview = useCallback(async () => {
    if (!token) {
      setPreviewError("This invitation link is missing its secure token.");
      setPreviewLoading(false);
      return;
    }
    setPreviewLoading(true);
    setPreviewError("");
    try {
      const result = await validateDistributorInvite(token);
      if (result.target_console !== "distributor") {
        setPreviewError("This invitation is for the admin portal, not the Zynd Mitra console.");
        setPreview(null);
        return;
      }
      setPreview(result);
      setFirstName(result.first_name ?? "");
      setLastName(result.last_name ?? "");
    } catch (error) {
      setPreview(null);
      setPreviewError(
        error instanceof ApiError ? error.message : "This invitation link is invalid or expired.",
      );
    } finally {
      setPreviewLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  useEffect(() => {
    if (step !== "mfa" || !onboardingToken || enrollToken) return;
    void (async () => {
      setSubmitting(true);
      setFormError("");
      try {
        const result = await distributorInviteMfaStart(onboardingToken);
        setEnrollToken(result.enroll_token);
        setQrUri(result.qr_uri);
        setManualSecret(result.manual_secret);
      } catch (error) {
        setFormError(error instanceof ApiError ? error.message : "Could not start MFA setup.");
      } finally {
        setSubmitting(false);
      }
    })();
  }, [enrollToken, onboardingToken, step]);

  useEffect(() => {
    if (previewLoading || previewError || !preview || submitting) return;

    const handleEnter = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.repeat) return;

      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON") {
        return;
      }

      const form = stepContentRef.current?.querySelector("form");
      if (form instanceof HTMLFormElement) {
        const submitButton = form.querySelector<HTMLButtonElement>(
          'button[type="submit"]:not([disabled])',
        );
        if (submitButton) {
          event.preventDefault();
          form.requestSubmit(submitButton);
        }
      }
    };

    window.addEventListener("keydown", handleEnter);
    return () => window.removeEventListener("keydown", handleEnter);
  }, [preview, previewError, previewLoading, step, submitting]);

  useEffect(() => {
    if (step !== "pin") return;
    setPinSetupSlide("verify");
    setFormError("");
  }, [step]);

  const handleContinueToPinSlide = () => {
    if (!isValidOtp(totpCode)) return;
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
      const result = await acceptDistributorInvite({
        token,
        first_name: firstName.trim(),
        last_name: lastName.trim() || undefined,
        password,
      });
      setOnboardingToken(result.onboarding_token);
      setStep("mfa");
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Could not accept invitation.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmMfa = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!onboardingToken || !isValidOtp(enrollOtp) || submitting) return;
    setSubmitting(true);
    setFormError("");
    try {
      const result = await distributorInviteMfaConfirm(onboardingToken, enrollToken, enrollOtp);
      setBackupCodes(result.backup_codes);
      setStep("backup");
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Could not confirm MFA setup.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pinSetupSlide === "verify") {
      handleContinueToPinSlide();
      return;
    }
    if (pin.length !== 4 || confirmPin.length !== 4) return;
    if (pin !== confirmPin) {
      setFormError("Enter matching 4-digit PINs.");
      return;
    }
    if (!isValidOtp(totpCode)) return;
    setSubmitting(true);
    setFormError("");
    try {
      const result = await completeDistributorInvite({
        onboardingToken,
        pin,
        confirmPin,
        totpCode,
      });
      await completeDistributorLogin(result.user);
      await refreshUser();
      pinContext?.markUnlocked();
      setStep("done");
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : "Could not finish setup.");
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

  if (loading) {
    return <DistributorGlobalLoading />;
  }

  const renderInviteHeader = () => {
    if (previewLoading) {
      return (
        <div className="distributor-invite-onboarding-intro">
          <h1 className="distributor-invite-onboarding-title">Opening invitation…</h1>
          <p className="distributor-invite-onboarding-subtitle">
            Please wait while we verify your link.
          </p>
        </div>
      );
    }

    if (previewError || !preview) {
      return (
        <div className="distributor-invite-onboarding-intro">
          <h1 className="distributor-invite-onboarding-title">Invitation unavailable</h1>
          <p className="distributor-invite-onboarding-subtitle">
            This invitation could not be opened.
          </p>
        </div>
      );
    }

    return (
      <>
        <InviteStepProgress step={step} />
        {step !== "done" ? (
          <div className="distributor-invite-onboarding-intro">
            <h1 className="distributor-invite-onboarding-title">{getStepTitle(step)}</h1>
            <p className="distributor-invite-onboarding-subtitle">
              {step === "welcome" ? (
                <>
                  Join the {ZYND_MITRA_COPY.consoleName} as{" "}
                  <span className="font-semibold text-foreground">{roleLabel}</span>.
                </>
              ) : (
                <>
                  {inviterCopy} as{" "}
                  <span className="font-semibold text-foreground">{roleLabel}</span>.
                </>
              )}
            </p>
          </div>
        ) : null}
      </>
    );
  };

  const renderStepContent = () => {
    if (previewLoading) {
      return null;
    }

    if (previewError || !preview) {
      return (
        <form
          className="distributor-login-page__fields"
          onSubmit={(event) => {
            event.preventDefault();
            router.replace("/");
          }}
        >
          <DistributorFeedbackMessage variant="error">{previewError}</DistributorFeedbackMessage>
          <DistributorActionButton
            type="submit"
            variant="primary"
            className="distributor-login-page__submit w-full"
          >
            Back to sign in
          </DistributorActionButton>
        </form>
      );
    }

    return (
      <>
        {step === "welcome" ? (
          <form
            className="distributor-login-page__fields"
            onSubmit={(event) => {
              event.preventDefault();
              setStep("account");
            }}
          >
            <InviteWelcomeDetails preview={preview} />
            <div className="grid gap-3 sm:grid-cols-2">
              <DistributorActionButton
                type="submit"
                variant="primary"
                className="distributor-login-page__submit w-full"
              >
                Accept invitation
              </DistributorActionButton>
              <DistributorActionButton
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => router.replace("/")}
              >
                Decline
              </DistributorActionButton>
            </div>
          </form>
        ) : null}

        {step === "account" ? (
          <form
            className="distributor-login-page__fields"
            onSubmit={(event) => void handleAcceptAccount(event)}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="invite-first-name" className="text-caption text-muted-foreground">
                  First name
                </Label>
                <Input
                  id="invite-first-name"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  autoComplete="given-name"
                  className="auth-input-underline distributor-login-page__input"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="invite-last-name" className="text-caption text-muted-foreground">
                  Last name
                </Label>
                <Input
                  id="invite-last-name"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  autoComplete="family-name"
                  className="auth-input-underline distributor-login-page__input"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="invite-password" className="text-caption text-muted-foreground">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="invite-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="auth-input-underline distributor-login-page__input pr-10"
                />
                <button
                  type="button"
                  className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => setShowPassword((prev) => !prev)}
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

            {formError ? (
              <DistributorFeedbackMessage variant="error" onDismiss={() => setFormError("")}>
                {formError}
              </DistributorFeedbackMessage>
            ) : null}

            <DistributorActionButton
              type="submit"
              variant="primary"
              disabled={submitting || !canSubmitAccount}
              className="distributor-login-page__submit w-full"
            >
              {submitting ? "Creating account…" : "Continue to MFA"}
            </DistributorActionButton>
          </form>
        ) : null}

        {step === "mfa" ? (
          <form
            className="distributor-login-page__fields distributor-invite-mfa-fields"
            onSubmit={(event) => void handleConfirmMfa(event)}
          >
            {!qrUri && submitting ? (
              <p className="text-compact text-muted-foreground">Preparing QR code…</p>
            ) : null}

            {qrUri && enrollToken ? (
              <div className="distributor-invite-mfa-setup">
                <div className="distributor-invite-mfa-setup__qr">
                  <InviteMfaBrandedQrCode
                    onboardingToken={onboardingToken}
                    enrollToken={enrollToken}
                    size={200}
                    alt="MFA authenticator QR code"
                  />
                </div>

                {manualSecret ? (
                  <div className="distributor-invite-mfa-manual-key">
                    <div className="distributor-invite-mfa-manual-key__header">
                      <p className="distributor-invite-mfa-manual-key__label">Manual key</p>
                      <button
                        type="button"
                        className="distributor-invite-mfa-manual-key__copy"
                        aria-label={manualSecretCopied ? "Manual key copied" : "Copy manual key"}
                        onClick={() => void handleCopyManualSecret()}
                      >
                        {manualSecretCopied ? (
                          <Check className="size-3.5 text-success" />
                        ) : (
                          <Copy className="size-3.5" />
                        )}
                      </button>
                    </div>
                    <p className="distributor-invite-mfa-manual-key__value">{manualSecret}</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="distributor-login-page__otp">
              <Label className="text-caption text-muted-foreground">Authentication code</Label>
              <OtpInput value={enrollOtp} onChange={setEnrollOtp} />
            </div>

            {formError ? (
              <DistributorFeedbackMessage variant="error" onDismiss={() => setFormError("")}>
                {formError}
              </DistributorFeedbackMessage>
            ) : null}

            <DistributorActionButton
              type="submit"
              variant="primary"
              disabled={submitting || !isValidOtp(enrollOtp)}
              className="distributor-login-page__submit w-full"
            >
              {submitting ? "Verifying…" : "Enable MFA"}
            </DistributorActionButton>
          </form>
        ) : null}

        {step === "backup" ? (
          <form
            className="distributor-login-page__fields"
            onSubmit={(event) => {
              event.preventDefault();
              setStep("pin");
            }}
          >
            <DistributorBackupCodesPanel codes={backupCodes} />
            <DistributorActionButton
              type="submit"
              variant="primary"
              className="distributor-login-page__submit w-full"
            >
              I&apos;ve saved my codes, Continue
            </DistributorActionButton>
          </form>
        ) : null}

        {step === "pin" ? (
          <form
            className="distributor-login-page__fields distributor-invite-pin-fields"
            onSubmit={(event) => void handleComplete(event)}
          >
            <div className="distributor-invite-pin-swiper">
              <motion.div
                className="distributor-invite-pin-swiper__track"
                animate={{ x: pinSetupSlide === "verify" ? "0%" : "-50%" }}
                transition={{ duration: 0.35, ease: DISTRIBUTOR_MENU_EASE }}
              >
                <div className="distributor-invite-pin-swiper__slide">
                  <div className="space-y-4 p-1">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <AuthStepIcon icon={Shield} />
                      <div>
                        <p className="text-compact font-semibold text-foreground">Authenticator code</p>
                        <p className="mt-1 text-caption text-muted-foreground">
                          Enter the authentication code to verify you&apos;re genuine.
                        </p>
                      </div>
                    </div>
                    <div className="distributor-login-page__otp">
                      <OtpInput value={totpCode} onChange={setTotpCode} />
                    </div>
                    {pinSetupSlide === "verify" ? (
                      <DistributorActionButton
                        type="submit"
                        variant="primary"
                        disabled={!isValidOtp(totpCode)}
                        className="distributor-login-page__submit w-full"
                      >
                        Continue
                      </DistributorActionButton>
                    ) : null}
                  </div>
                </div>

                <div className="distributor-invite-pin-swiper__slide">
                  <div className="space-y-4 p-1">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <AuthStepIcon icon={LockKeyhole} />
                      <div>
                        <p className="text-compact font-semibold text-foreground">Zynd PIN lock</p>
                        <p className="mt-1 text-caption text-muted-foreground">
                          Create a 4-digit PIN to secure the {ZYND_MITRA_COPY.consoleName}.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-center">
                        <DistributorPinInput value={pin} onChange={setPin} />
                      </div>
                      <div className="flex justify-center">
                        <DistributorPinInput value={confirmPin} onChange={setConfirmPin} />
                      </div>
                    </div>

                    {pinSetupSlide === "pin" ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <DistributorActionButton
                          type="button"
                          variant="outline"
                          className="w-full"
                          onClick={handleBackToVerifySlide}
                        >
                          Back
                        </DistributorActionButton>
                        <DistributorActionButton
                          type="submit"
                          variant="primary"
                          disabled={submitting || pin.length !== 4 || confirmPin.length !== 4}
                          className="distributor-login-page__submit w-full"
                        >
                          {submitting ? "Saving PIN…" : "Finish setup"}
                        </DistributorActionButton>
                      </div>
                    ) : null}
                  </div>
                </div>
              </motion.div>
            </div>

            {formError ? (
              <DistributorFeedbackMessage variant="error" onDismiss={() => setFormError("")}>
                {formError}
              </DistributorFeedbackMessage>
            ) : null}

            <div
              className="distributor-invite-pin-carousel-dots"
              role="tablist"
              aria-label="PIN setup steps"
            >
              <button
                type="button"
                role="tab"
                aria-selected={pinSetupSlide === "verify"}
                aria-label="Verify authenticator code"
                className={cn(
                  "distributor-invite-pin-carousel-dots__dot",
                  pinSetupSlide === "verify" && "distributor-invite-pin-carousel-dots__dot--active",
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
                  "distributor-invite-pin-carousel-dots__dot",
                  pinSetupSlide === "pin" && "distributor-invite-pin-carousel-dots__dot--active",
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
            className="distributor-login-page__fields distributor-invite-done-fields"
            onSubmit={(event) => {
              event.preventDefault();
              router.replace("/dashboard");
            }}
          >
            <DistributorInviteDoneCard />
            <DistributorActionButton
              type="submit"
              variant="primary"
              className="distributor-login-page__submit w-full"
            >
              Open dashboard
            </DistributorActionButton>
          </form>
        ) : null}
      </>
    );
  };

  return (
    <div className="distributor-login-page">
      <DistributorAuthShellThemeToggle />
      <div className="distributor-login-page__visual" aria-hidden>
        <DistributorLoginVisualPanel gradient={ZYND_DISTRIBUTOR_LOGIN_VISUAL_GRADIENT} />
      </div>

      <div className="distributor-login-page__form">
        <div className="distributor-login-page__form-body distributor-login-page__form-body--invite">
          <div className="distributor-login-page__form-inner distributor-invite-onboarding-form">
            <div className="distributor-invite-onboarding-form__header">
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

              {renderInviteHeader()}
            </div>

            <div ref={stepContentRef} className="distributor-invite-onboarding-form__content">
              {renderStepContent()}
            </div>
          </div>
        </div>

        <p className="distributor-login-page__copyright">
          © {new Date().getFullYear()} Zynd. All rights reserved.
        </p>
      </div>
    </div>
  );
}

export function DistributorInviteOnboardingPageShell() {
  return (
    <Suspense fallback={<DistributorGlobalLoading />}>
      <DistributorInviteOnboardingPage />
    </Suspense>
  );
}

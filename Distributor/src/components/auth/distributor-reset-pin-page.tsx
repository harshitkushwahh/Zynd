"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { motion } from "motion/react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";

import { DistributorAuthShellThemeToggle } from "@/components/auth/distributor-auth-shell-theme-toggle";
import { DistributorGlobalLoading } from "@/components/auth/distributor-global-loading";
import { DistributorLoginVisualPanel } from "@/components/auth/distributor-login-visual-panel";
import { DistributorPinInput } from "@/components/auth/distributor-pin-input";
import { OtpInput } from "@/components/auth/otp-input";
import { DISTRIBUTOR_MENU_EASE } from "@/components/ui/distributor-menu-motion";
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
import { resetZyndPinWithLink, validateZyndPinResetLink } from "@/lib/distributor-pin-api";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";

type ResetStep = "verify" | "pin" | "done";

function isValidOtp(value: string) {
  return /^\d{6}$/.test(value);
}

function ResetPinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const { user, refreshUser } = useDistributorAuth();
  const pinContext = useDistributorZyndPinOptional();

  const [step, setStep] = useState<ResetStep>("verify");
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setValidating(false);
      setTokenValid(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        await validateZyndPinResetLink(token);
        if (!cancelled) setTokenValid(true);
      } catch {
        if (!cancelled) setTokenValid(false);
      } finally {
        if (!cancelled) setValidating(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleVerifyContinue = (event: React.FormEvent) => {
    event.preventDefault();
    if (!password.trim()) {
      setError("Enter your account password.");
      return;
    }
    if (!isValidOtp(totpCode)) {
      setError("Enter a valid authenticator code.");
      return;
    }
    setError("");
    setStep("pin");
  };

  const handleResetPin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pin.length !== 4 || confirmPin.length !== 4) return;
    if (pin !== confirmPin) {
      setError("PIN entries do not match.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await resetZyndPinWithLink({
        token,
        currentPassword: password,
        totpCode,
        pin,
        confirmPin,
      });
      if (user) {
        await refreshUser();
        pinContext?.markUnlocked();
      }
      setStep("done");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reset PIN.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderBody = () => {
    if (validating) {
      return <DistributorGlobalLoading />;
    }

    if (!token || !tokenValid) {
      return (
        <div className="distributor-login-page__fields">
          <DistributorFeedbackMessage variant="error">
            This PIN reset link is invalid or has expired. Request a new link from the PIN lock screen.
          </DistributorFeedbackMessage>
          <DistributorActionButton
            type="button"
            variant="primary"
            className="distributor-login-page__submit w-full"
            onClick={() => router.replace("/")}
          >
            Back to sign in
          </DistributorActionButton>
        </div>
      );
    }

    if (step === "done") {
      return (
        <div className="distributor-login-page__fields">
          <DistributorFeedbackMessage variant="success">
            Your Zynd PIN has been reset. {user ? "Returning to your console…" : "Sign in to continue."}
          </DistributorFeedbackMessage>
          <DistributorActionButton
            type="button"
            variant="primary"
            className="distributor-login-page__submit w-full"
            onClick={() => router.replace(user ? "/dashboard" : "/")}
          >
            {user ? "Open dashboard" : "Back to sign in"}
          </DistributorActionButton>
        </div>
      );
    }

    if (step === "verify") {
      return (
        <form className="distributor-login-page__fields" onSubmit={handleVerifyContinue}>
          <div className="space-y-1">
            <Label htmlFor="reset-pin-password" className="text-caption text-muted-foreground">
              Account password
            </Label>
            <div className="relative">
              <Input
                id="reset-pin-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (error) setError("");
                }}
                className="auth-input-underline pr-10"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-caption font-medium text-foreground">Authenticator code</p>
            <div className="distributor-login-page__otp">
              <OtpInput value={totpCode} onChange={setTotpCode} error={!!error} />
            </div>
          </div>

          {error ? (
            <DistributorFeedbackMessage variant="error" onDismiss={() => setError("")}>
              {error}
            </DistributorFeedbackMessage>
          ) : null}

          <DistributorActionButton
            type="submit"
            variant="primary"
            className="distributor-login-page__submit w-full"
            disabled={!password.trim() || !isValidOtp(totpCode)}
          >
            Continue
          </DistributorActionButton>
        </form>
      );
    }

    return (
      <form className="distributor-login-page__fields distributor-invite-pin-fields" onSubmit={handleResetPin}>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: DISTRIBUTOR_MENU_EASE }}
          className="w-full max-w-[22rem] space-y-4"
        >
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="distributor-invite-auth-step-icon" aria-hidden="true">
              <LockKeyhole className="size-5" strokeWidth={2} />
            </span>
            <div>
              <p className="text-compact font-semibold text-foreground">Choose a new PIN</p>
              <p className="mt-1 text-caption text-muted-foreground">
                Create a new 4-digit PIN for the {ZYND_MITRA_COPY.consoleName}.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-center">
              <DistributorPinInput value={pin} onChange={setPin} autoFocus error={!!error} />
            </div>
            <div className="flex justify-center">
              <DistributorPinInput
                value={confirmPin}
                onChange={setConfirmPin}
                error={!!error || (confirmPin.length === 4 && pin !== confirmPin)}
              />
            </div>
          </div>
        </motion.div>

        {error ? (
          <DistributorFeedbackMessage variant="error" onDismiss={() => setError("")}>
            {error}
          </DistributorFeedbackMessage>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2">
          <DistributorActionButton
            type="button"
            variant="outline"
            className="w-full"
            disabled={submitting}
            onClick={() => {
              setError("");
              setPin("");
              setConfirmPin("");
              setStep("verify");
            }}
          >
            Back
          </DistributorActionButton>
          <DistributorActionButton
            type="submit"
            variant="primary"
            disabled={submitting || pin.length !== 4 || confirmPin.length !== 4}
            className="distributor-login-page__submit w-full"
          >
            {submitting ? "Saving PIN…" : "Reset PIN"}
          </DistributorActionButton>
        </div>
      </form>
    );
  };

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
              <h1 className="distributor-invite-onboarding-title">
                {step === "done" ? "PIN updated" : step === "pin" ? "Set new PIN" : "Reset your PIN"}
              </h1>
              <p className="distributor-invite-onboarding-subtitle">
                {step === "done"
                  ? "Your console PIN has been changed."
                  : step === "pin"
                    ? "Enter and confirm your new 4-digit PIN."
                    : "Confirm your identity with your password and authenticator app."}
              </p>
            </div>

            {renderBody()}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DistributorResetPinPage() {
  return (
    <Suspense fallback={<DistributorGlobalLoading />}>
      <ResetPinForm />
    </Suspense>
  );
}

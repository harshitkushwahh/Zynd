"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { DistributorAuthShellThemeToggle } from "@/components/auth/distributor-auth-shell-theme-toggle";
import { DistributorLoginVisualPanel } from "@/components/auth/distributor-login-visual-panel";
import { DistributorGlobalLoading } from "@/components/auth/distributor-global-loading";
import { OtpInput } from "@/components/auth/otp-input";
import { TurnstileWidget, isTurnstileRequired } from "@/components/auth/turnstile-widget";
import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import { DistributorFeedbackMessage } from "@/components/ui/distributor-feedback-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDistributorAuth } from "@/contexts/distributor-auth-context";
import {
  isAuthenticatedResponse,
  isMfaRequiredResponse,
  isSmsOtpRequiredResponse,
} from "@/lib/distributor-auth-api";
import { forgotDistributorPassword } from "@/lib/distributor-password-api";
import {
  ZYND_DISTRIBUTOR_LOGIN_VISUAL_GRADIENT,
  ZYND_DISTRIBUTOR_LOGO_SRC,
} from "@/lib/distributor-brand-assets";
import { ApiError } from "@/lib/api-client";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";
import { cn } from "@/lib/utils";

type LoginStep = "credentials" | "mfa" | "sms-otp" | "forgot-password";

function isValidOtp(value: string) {
  return /^\d{6}$/.test(value);
}

export function DistributorLoginCard() {
  const router = useRouter();
  const { user, loading, signIn, verifyMfa, verifyLoginSms, resendLoginSms } = useDistributorAuth();
  const [loginStep, setLoginStep] = useState<LoginStep>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [mfaToken, setMfaToken] = useState("");
  const [loginToken, setLoginToken] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [smsResendSeconds, setSmsResendSeconds] = useState(0);
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const [otpError, setOtpError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [isSendingResetLink, setIsSendingResetLink] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileError, setTurnstileError] = useState("");
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);

  useEffect(() => {
    if (user) {
      router.replace("/dashboard");
    }
  }, [router, user]);

  useEffect(() => {
    if (smsResendSeconds <= 0) return;
    const timerId = window.setInterval(() => {
      setSmsResendSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timerId);
  }, [smsResendSeconds]);

  if (user) {
    return <DistributorGlobalLoading />;
  }

  if (loading) {
    return <DistributorGlobalLoading />;
  }

  const handleCredentialsSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError("");

    if (!email.trim() || !password) {
      setFormError("Enter email and password.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await signIn(email.trim(), password);
      if (isAuthenticatedResponse(result)) {
        router.push("/dashboard");
        return;
      }
      if (isMfaRequiredResponse(result)) {
        setMfaToken(result.mfa_token);
        setLoginToken("");
        setMaskedPhone(result.masked_phone ?? "");
        setOtp("");
        setOtpError("");
        setLoginStep("mfa");
        return;
      }
      if (isSmsOtpRequiredResponse(result)) {
        setLoginToken(result.login_token);
        setMfaToken("");
        setMaskedPhone(result.masked_phone);
        setOtp("");
        setOtpError("");
        setSmsResendSeconds(result.retry_after_seconds ?? 30);
        setLoginStep("sms-otp");
        return;
      }
      setFormError("Unexpected sign-in response. Try again.");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not sign in.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMfaSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValidOtp(otp)) {
      setOtpError("Enter the 6-digit code from your authenticator app.");
      return;
    }

    setIsSubmitting(true);
    setFormError("");
    setOtpError("");
    try {
      await verifyMfa(mfaToken, otp);
      router.push("/dashboard");
    } catch (error) {
      setOtpError(error instanceof Error ? error.message : "Invalid authentication code.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSmsOtpSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValidOtp(otp)) {
      setOtpError("Enter the 6-digit SMS code.");
      return;
    }

    setIsSubmitting(true);
    setFormError("");
    setOtpError("");
    try {
      await verifyLoginSms(loginToken, otp);
      router.push("/dashboard");
    } catch (error) {
      setOtpError(error instanceof Error ? error.message : "Invalid verification code.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendSms = async () => {
    if (!loginToken || smsResendSeconds > 0) return;
    setOtpError("");
    try {
      const retryAfter = await resendLoginSms(loginToken);
      setSmsResendSeconds(retryAfter);
    } catch (error) {
      setOtpError(error instanceof Error ? error.message : "Could not resend SMS code.");
    }
  };

  const resetTurnstile = () => {
    setTurnstileToken("");
    setTurnstileError("");
    setTurnstileResetKey((value) => value + 1);
  };

  const goBackToCredentials = () => {
    setFormError("");
    setOtpError("");
    setForgotSent(false);
    resetTurnstile();
    setMfaToken("");
    setLoginToken("");
    setMaskedPhone("");
    setOtp("");
    setLoginStep("credentials");
  };

  const goToForgotPassword = () => {
    setFormError("");
    setOtpError("");
    setForgotSent(false);
    resetTurnstile();
    setLoginStep("forgot-password");
  };

  const handleForgotPasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError("");
    setTurnstileError("");

    if (!email.trim()) {
      setFormError("Enter your email address.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFormError("Enter a valid email address.");
      return;
    }

    if (isTurnstileRequired() && !turnstileToken) {
      setTurnstileError("Complete the verification check.");
      return;
    }

    setIsSendingResetLink(true);
    try {
      await forgotDistributorPassword(email.trim(), turnstileToken || null);
      setForgotSent(true);
      resetTurnstile();
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(error.message);
      } else {
        setFormError(error instanceof Error ? error.message : "Could not send reset link.");
      }
      resetTurnstile();
    } finally {
      setIsSendingResetLink(false);
    }
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
                src={ZYND_DISTRIBUTOR_LOGO_SRC}
                alt="ZYND"
                width={160}
                height={48}
                className="distributor-login-page__logo"
                priority
              />
            </div>

            <div className="distributor-login-page__steps">
              <div
                className={cn(
                  "distributor-login-page__step-panel",
                  loginStep === "credentials" && "distributor-login-page__step-panel--visible",
                )}
                aria-hidden={loginStep !== "credentials"}
              >
                <div className="distributor-login-page__intro">
                  <h1 className="distributor-login-page__title">Welcome back!</h1>
                  <p className="distributor-login-page__subtitle">{ZYND_MITRA_COPY.signInSubtitle}</p>
                </div>

                <form onSubmit={handleCredentialsSubmit} className="distributor-login-page__fields">
                  <div className="space-y-1">
                    <Label htmlFor="distributor-email" className="text-caption text-muted-foreground">
                      Email
                    </Label>
                    <Input
                      id="distributor-email"
                      type="email"
                      autoComplete="username"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="hello@zynd.distributor"
                      className="auth-input-underline distributor-login-page__input"
                      tabIndex={loginStep === "credentials" ? 0 : -1}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label
                      htmlFor="distributor-password"
                      className="text-caption text-muted-foreground"
                    >
                      Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="distributor-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="••••••••"
                        className="auth-input-underline distributor-login-page__input pr-10"
                        tabIndex={loginStep === "credentials" ? 0 : -1}
                      />
                      <button
                        type="button"
                        className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-muted-foreground transition-colors hover:text-foreground"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        tabIndex={loginStep === "credentials" ? 0 : -1}
                      >
                        {showPassword ? (
                          <EyeOff className="size-4" strokeWidth={2.25} />
                        ) : (
                          <Eye className="size-4" strokeWidth={2.25} />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-1">
                    <label className="flex cursor-pointer items-center gap-2 text-caption text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(event) => setRememberMe(event.target.checked)}
                        className="size-3.5 rounded border-border text-primary accent-primary"
                        tabIndex={loginStep === "credentials" ? 0 : -1}
                      />
                      Remember me
                    </label>
                    <button
                      type="button"
                      className="text-caption text-muted-foreground transition-colors hover:text-foreground"
                      onClick={goToForgotPassword}
                      tabIndex={loginStep === "credentials" ? 0 : -1}
                    >
                      Forgot password?
                    </button>
                  </div>

                  {formError && loginStep === "credentials" ? (
                    <DistributorFeedbackMessage variant="error" onDismiss={() => setFormError("")}>
                      {formError}
                    </DistributorFeedbackMessage>
                  ) : null}

                  <DistributorActionButton
                    type="submit"
                    variant="primary"
                    disabled={isSubmitting}
                    className="distributor-login-page__submit w-full"
                    tabIndex={loginStep === "credentials" ? 0 : -1}
                  >
                    {isSubmitting ? "Signing in…" : "Sign in"}
                  </DistributorActionButton>
                </form>
              </div>

              <div
                className={cn(
                  "distributor-login-page__step-panel",
                  loginStep === "mfa" && "distributor-login-page__step-panel--visible",
                )}
                aria-hidden={loginStep !== "mfa"}
              >
                <div className="distributor-login-page__intro">
                  <h1 className="distributor-login-page__title">Verify your identity</h1>
                  <p className="distributor-login-page__subtitle">
                    Enter the 6-digit code from your authenticator app for{" "}
                    <span className="font-semibold text-foreground">{email.trim()}</span>.
                  </p>
                </div>

                <form onSubmit={handleMfaSubmit} className="distributor-login-page__fields">
                  <div className="space-y-1">
                    <Label htmlFor="distributor-otp" className="text-caption text-muted-foreground">
                      Authentication code
                    </Label>
                    <OtpInput
                      id="distributor-otp"
                      value={otp}
                      error={!!otpError}
                      onChange={(value) => {
                        setOtp(value);
                        if (otpError) setOtpError("");
                      }}
                    />
                  </div>

                  {otpError ? (
                    <DistributorFeedbackMessage variant="error" onDismiss={() => setOtpError("")}>
                      {otpError}
                    </DistributorFeedbackMessage>
                  ) : null}

                  {formError && loginStep === "mfa" ? (
                    <DistributorFeedbackMessage variant="error" onDismiss={() => setFormError("")}>
                      {formError}
                    </DistributorFeedbackMessage>
                  ) : null}

                  <DistributorActionButton
                    type="submit"
                    variant="primary"
                    disabled={isSubmitting || !isValidOtp(otp)}
                    className="distributor-login-page__submit w-full"
                    tabIndex={loginStep === "mfa" ? 0 : -1}
                  >
                    {isSubmitting ? "Verifying…" : "Verify & sign in"}
                  </DistributorActionButton>

                  <button
                    type="button"
                    className="mx-auto block text-caption text-muted-foreground transition-colors hover:text-foreground"
                    onClick={goBackToCredentials}
                    tabIndex={loginStep === "mfa" ? 0 : -1}
                  >
                    Back to sign in
                  </button>
                </form>
              </div>

              <div
                className={cn(
                  "distributor-login-page__step-panel",
                  loginStep === "sms-otp" && "distributor-login-page__step-panel--visible",
                )}
                aria-hidden={loginStep !== "sms-otp"}
              >
                <div className="distributor-login-page__intro">
                  <h1 className="distributor-login-page__title">Check your phone</h1>
                  <p className="distributor-login-page__subtitle">
                    Enter the 6-digit code sent to{" "}
                    <span className="font-semibold text-foreground">
                      {maskedPhone || "your verified mobile number"}
                    </span>
                    .
                  </p>
                </div>

                <form onSubmit={handleSmsOtpSubmit} className="distributor-login-page__fields">
                  <div className="space-y-1">
                    <Label htmlFor="distributor-sms-otp" className="text-caption text-muted-foreground">
                      SMS code
                    </Label>
                    <OtpInput
                      id="distributor-sms-otp"
                      value={otp}
                      error={!!otpError}
                      onChange={(value) => {
                        setOtp(value);
                        if (otpError) setOtpError("");
                      }}
                    />
                  </div>

                  {otpError ? (
                    <DistributorFeedbackMessage variant="error" onDismiss={() => setOtpError("")}>
                      {otpError}
                    </DistributorFeedbackMessage>
                  ) : null}

                  <DistributorActionButton
                    type="submit"
                    variant="primary"
                    disabled={isSubmitting || !isValidOtp(otp)}
                    className="distributor-login-page__submit w-full"
                    tabIndex={loginStep === "sms-otp" ? 0 : -1}
                  >
                    {isSubmitting ? "Verifying…" : "Verify & sign in"}
                  </DistributorActionButton>

                  <div className="flex flex-col items-center gap-3">
                    <button
                      type="button"
                      className="text-caption text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                      disabled={smsResendSeconds > 0}
                      onClick={() => void handleResendSms()}
                      tabIndex={loginStep === "sms-otp" ? 0 : -1}
                    >
                      {smsResendSeconds > 0
                        ? `Resend code in ${smsResendSeconds}s`
                        : "Resend code"}
                    </button>
                    <button
                      type="button"
                      className="text-caption text-muted-foreground transition-colors hover:text-foreground"
                      onClick={goBackToCredentials}
                      tabIndex={loginStep === "sms-otp" ? 0 : -1}
                    >
                      Back to sign in
                    </button>
                  </div>
                </form>
              </div>

              <div
                className={cn(
                  "distributor-login-page__step-panel",
                  loginStep === "forgot-password" && "distributor-login-page__step-panel--visible",
                )}
                aria-hidden={loginStep !== "forgot-password"}
              >
                <div className="distributor-login-page__intro">
                  <h1 className="distributor-login-page__title">Forgot password?</h1>
                  <p className="distributor-login-page__subtitle">
                    {forgotSent
                      ? "Check your inbox and follow the link to reset your password."
                      : "Enter your email and we'll send you a link to reset your password."}
                  </p>
                </div>

                <form onSubmit={handleForgotPasswordSubmit} className="distributor-login-page__fields">
                  {forgotSent ? (
                    <DistributorFeedbackMessage variant="success">
                      Reset link sent to <span className="font-semibold">{email.trim()}</span>. Check
                      your inbox and follow the instructions.
                    </DistributorFeedbackMessage>
                  ) : (
                    <div className="space-y-1">
                      <Label
                        htmlFor="distributor-forgot-email"
                        className="text-caption text-muted-foreground"
                      >
                        Email
                      </Label>
                      <Input
                        id="distributor-forgot-email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="hello@zynd.distributor"
                        className="auth-input-underline distributor-login-page__input"
                        tabIndex={loginStep === "forgot-password" ? 0 : -1}
                        autoFocus={loginStep === "forgot-password"}
                      />
                    </div>
                  )}

                  {!forgotSent && isTurnstileRequired() ? (
                    <div className="space-y-2">
                      <TurnstileWidget
                        resetKey={`forgot-${turnstileResetKey}`}
                        onVerify={setTurnstileToken}
                        onExpire={() => setTurnstileToken("")}
                      />
                      {turnstileError ? (
                        <DistributorFeedbackMessage variant="error" onDismiss={() => setTurnstileError("")}>
                          {turnstileError}
                        </DistributorFeedbackMessage>
                      ) : null}
                    </div>
                  ) : !forgotSent ? (
                    <p className="text-caption text-muted-foreground">
                      Security check is not configured. Add{" "}
                      <code className="font-mono text-xs">NEXT_PUBLIC_TURNSTILE_SITE_KEY</code> to{" "}
                      <code className="font-mono text-xs">Distributor/.env</code> (same value as Web) and
                      restart the dev server.
                    </p>
                  ) : null}

                  {formError && loginStep === "forgot-password" ? (
                    <DistributorFeedbackMessage variant="error" onDismiss={() => setFormError("")}>
                      {formError}
                    </DistributorFeedbackMessage>
                  ) : null}

                  {!forgotSent ? (
                    <DistributorActionButton
                      type="submit"
                      variant="primary"
                      disabled={isSendingResetLink}
                      className="distributor-login-page__submit w-full"
                      tabIndex={loginStep === "forgot-password" ? 0 : -1}
                    >
                      {isSendingResetLink ? "Sending link…" : "Send reset link"}
                    </DistributorActionButton>
                  ) : (
                    <DistributorActionButton
                      type="button"
                      variant="primary"
                      className="distributor-login-page__submit w-full"
                      onClick={goBackToCredentials}
                      tabIndex={loginStep === "forgot-password" ? 0 : -1}
                    >
                      Back to sign in
                    </DistributorActionButton>
                  )}

                  {!forgotSent ? (
                    <button
                      type="button"
                      className="mx-auto block text-caption text-muted-foreground transition-colors hover:text-foreground"
                      onClick={goBackToCredentials}
                      tabIndex={loginStep === "forgot-password" ? 0 : -1}
                    >
                      Back to sign in
                    </button>
                  ) : null}
                </form>
              </div>
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

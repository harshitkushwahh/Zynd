"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { OtpInput } from "@/components/auth/otp-input";
import { SupportAuthShellThemeToggle } from "@/components/auth/support-auth-shell-theme-toggle";
import { SupportGlobalLoading } from "@/components/auth/support-global-loading";
import { SupportAuthHorizontalLogo } from "@/components/auth/support-auth-horizontal-logo";
import { SupportLoginVisualPanel } from "@/components/auth/support-login-visual-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SupportFeedbackMessage } from "@/components/ui/support-feedback-message";
import { useSupportAuth } from "@/contexts/support-auth-context";
import {
  isAuthenticatedResponse,
  isMfaRequiredResponse,
  isSmsOtpRequiredResponse,
} from "@/lib/support-auth-api";
import { ZYND_SUPPORT_LOGIN_VISUAL_GRADIENT } from "@/lib/support-brand-assets";
import { cn } from "@/lib/utils";

type LoginStep = "credentials" | "mfa" | "sms-otp";

function isValidOtp(value: string) {
  return /^\d{6}$/.test(value);
}

export function SupportLoginCard() {
  const router = useRouter();
  const { user, loading, signIn, verifyMfa, verifyLoginSms, resendLoginSms } = useSupportAuth();
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
    return <SupportGlobalLoading message="Opening dashboard" />;
  }

  if (loading) {
    return <SupportGlobalLoading />;
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
        setOtp("");
        setLoginStep("mfa");
        return;
      }
      if (isSmsOtpRequiredResponse(result)) {
        setLoginToken(result.login_token);
        setMaskedPhone(result.masked_phone);
        setSmsResendSeconds(result.retry_after_seconds ?? 30);
        setOtp("");
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

  const goBackToCredentials = () => {
    setFormError("");
    setOtpError("");
    setMfaToken("");
    setLoginToken("");
    setMaskedPhone("");
    setOtp("");
    setLoginStep("credentials");
  };

  return (
    <div className="support-login-page">
      <SupportAuthShellThemeToggle />
      <div className="support-login-page__visual" aria-hidden>
        <SupportLoginVisualPanel gradient={ZYND_SUPPORT_LOGIN_VISUAL_GRADIENT} />
      </div>

      <div className="support-login-page__form">
        <div className="support-login-page__form-body">
          <div className="support-login-page__form-inner">
            <div className="support-login-page__brand">
              <SupportAuthHorizontalLogo />
            </div>

            <div className="support-login-page__steps">
              <div
                className={cn(
                  "support-login-page__step-panel",
                  loginStep === "credentials" && "support-login-page__step-panel--visible",
                )}
                aria-hidden={loginStep !== "credentials"}
              >
                <div className="support-login-page__intro">
                  <h1 className="support-login-page__title">Welcome back!</h1>
                  <p className="support-login-page__subtitle">
                    Sign in to the Zynd Support console with your platform account.
                  </p>
                </div>

                <form onSubmit={handleCredentialsSubmit} className="support-login-page__fields">
                  <div className="space-y-1">
                    <Label htmlFor="support-email" className="text-caption text-muted-foreground">
                      Email
                    </Label>
                    <Input
                      id="support-email"
                      type="email"
                      autoComplete="username"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@company.com"
                      className="auth-input-underline support-login-page__input"
                      tabIndex={loginStep === "credentials" ? 0 : -1}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label
                      htmlFor="support-password"
                      className="text-caption text-muted-foreground"
                    >
                      Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="support-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="••••••••"
                        className="auth-input-underline support-login-page__input pr-10"
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
                  </div>

                  {formError && loginStep === "credentials" ? (
                    <SupportFeedbackMessage variant="error" onDismiss={() => setFormError("")}>
                      {formError}
                    </SupportFeedbackMessage>
                  ) : null}

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="support-login-page__submit"
                    tabIndex={loginStep === "credentials" ? 0 : -1}
                  >
                    {isSubmitting ? "Signing in…" : "Sign in"}
                  </Button>
                </form>
              </div>

              <div
                className={cn(
                  "support-login-page__step-panel",
                  loginStep === "mfa" && "support-login-page__step-panel--visible",
                )}
                aria-hidden={loginStep !== "mfa"}
              >
                <div className="support-login-page__intro">
                  <h1 className="support-login-page__title">Verify your identity</h1>
                  <p className="support-login-page__subtitle">
                    Enter the 6-digit code from your authenticator app for{" "}
                    <span className="font-semibold text-foreground">{email.trim()}</span>.
                  </p>
                </div>

                <form onSubmit={handleMfaSubmit} className="support-login-page__fields">
                  <div className="support-login-page__otp space-y-1">
                    <Label htmlFor="support-otp" className="text-caption text-muted-foreground">
                      Authentication code
                    </Label>
                    <OtpInput
                      id="support-otp"
                      value={otp}
                      error={Boolean(otpError)}
                      onChange={(value) => {
                        setOtp(value);
                        if (otpError) setOtpError("");
                      }}
                    />
                  </div>

                  {otpError ? (
                    <SupportFeedbackMessage variant="error" onDismiss={() => setOtpError("")}>
                      {otpError}
                    </SupportFeedbackMessage>
                  ) : null}

                  <Button
                    type="submit"
                    disabled={isSubmitting || !isValidOtp(otp)}
                    className="support-login-page__submit"
                    tabIndex={loginStep === "mfa" ? 0 : -1}
                  >
                    {isSubmitting ? "Verifying…" : "Verify & sign in"}
                  </Button>

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
                  "support-login-page__step-panel",
                  loginStep === "sms-otp" && "support-login-page__step-panel--visible",
                )}
                aria-hidden={loginStep !== "sms-otp"}
              >
                <div className="support-login-page__intro">
                  <h1 className="support-login-page__title">Check your phone</h1>
                  <p className="support-login-page__subtitle">
                    Enter the 6-digit code sent to{" "}
                    <span className="font-semibold text-foreground">
                      {maskedPhone || "your verified mobile number"}
                    </span>
                    .
                  </p>
                </div>

                <form onSubmit={handleSmsOtpSubmit} className="support-login-page__fields">
                  <div className="support-login-page__otp space-y-1">
                    <Label htmlFor="support-sms-otp" className="text-caption text-muted-foreground">
                      SMS code
                    </Label>
                    <OtpInput
                      id="support-sms-otp"
                      value={otp}
                      error={Boolean(otpError)}
                      onChange={(value) => {
                        setOtp(value);
                        if (otpError) setOtpError("");
                      }}
                    />
                  </div>

                  {otpError ? (
                    <SupportFeedbackMessage variant="error" onDismiss={() => setOtpError("")}>
                      {otpError}
                    </SupportFeedbackMessage>
                  ) : null}

                  <Button
                    type="submit"
                    disabled={isSubmitting || !isValidOtp(otp)}
                    className="support-login-page__submit"
                    tabIndex={loginStep === "sms-otp" ? 0 : -1}
                  >
                    {isSubmitting ? "Verifying…" : "Verify & sign in"}
                  </Button>

                  <button
                    type="button"
                    className="mx-auto block text-caption text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                    disabled={smsResendSeconds > 0}
                    onClick={async () => {
                      try {
                        const retry = await resendLoginSms(loginToken);
                        setSmsResendSeconds(retry);
                      } catch (error) {
                        setOtpError(
                          error instanceof Error ? error.message : "Could not resend SMS code.",
                        );
                      }
                    }}
                    tabIndex={loginStep === "sms-otp" ? 0 : -1}
                  >
                    {smsResendSeconds > 0
                      ? `Resend code in ${smsResendSeconds}s`
                      : "Resend SMS code"}
                  </button>

                  <button
                    type="button"
                    className="mx-auto block text-caption text-muted-foreground transition-colors hover:text-foreground"
                    onClick={goBackToCredentials}
                    tabIndex={loginStep === "sms-otp" ? 0 : -1}
                  >
                    Back to sign in
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>

        <p className="support-login-page__copyright">
          © {new Date().getFullYear()} Zynd. All rights reserved.
        </p>
      </div>
    </div>
  );
}

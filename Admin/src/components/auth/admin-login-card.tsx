"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getErrorMessage } from "@/lib/errors";

import { AdminAuthButton } from "@/components/auth/admin-auth-button";
import { AdminGlobalLoading } from "@/components/auth/admin-global-loading";
import { AdminLoginVisualPanel } from "@/components/auth/admin-login-visual-panel";
import { OtpInput } from "@/components/auth/otp-input";
import { PasswordInput } from "@/components/auth/password-input";
import { TurnstileWidget, isTurnstileRequired } from "@/components/auth/turnstile-widget";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import { ApiError } from "@/lib/api-client";
import { isAuthenticatedResponse } from "@/lib/auth-api";
import { isValidEmail, isValidOtp, isValidPassword } from "@/lib/admin-validation";
import { clampToMaxLength, inputRuleProps, INPUT_RULES } from "@/lib/input-rules";

const underlineInputClass = "auth-input-underline admin-login-form__input";

type LoginStep = "credentials" | "mfa";

export function AdminLoginCard() {
  const router = useRouter();
  const { user, loading, signIn, verifyMfa } = useAdminAuth();
  const [step, setStep] = useState<LoginStep>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [mfaToken, setMfaToken] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [otpError, setOtpError] = useState("");
  const [formError, setFormError] = useState("");
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileError, setTurnstileError] = useState("");
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [loading, router, user]);

  if (loading || user) {
    return <AdminGlobalLoading />;
  }

  const handleCredentialsSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    let hasError = false;

    if (!isValidEmail(email)) {
      setEmailError(INPUT_RULES.email.title);
      hasError = true;
    } else {
      setEmailError("");
    }

    if (!isValidPassword(password)) {
      setPasswordError(INPUT_RULES.password.title);
      hasError = true;
    } else {
      setPasswordError("");
    }

    if (hasError) return;

    if (captchaRequired && isTurnstileRequired() && !turnstileToken) {
      setTurnstileError("Complete the verification check.");
      return;
    }
    setTurnstileError("");

    setIsSubmitting(true);
    setFormError("");
    try {
      const result = await signIn(email.trim(), password, turnstileToken || null);
      setCaptchaRequired(false);
      setTurnstileToken("");
      if (isAuthenticatedResponse(result)) {
        router.push("/dashboard");
        return;
      }
      setMfaToken(result.mfa_token);
      setOtp("");
      setOtpError("");
      setStep("mfa");
    } catch (error) {
      if (error instanceof ApiError && error.captchaRequired) {
        setCaptchaRequired(true);
        setTurnstileToken("");
        setTurnstileResetKey((value) => value + 1);
      }
      setFormError(getErrorMessage(error, "Could not sign in."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMfaSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValidOtp(otp)) {
      setOtpError(INPUT_RULES.otp.title);
      return;
    }

    setIsSubmitting(true);
    setFormError("");
    try {
      await verifyMfa(mfaToken, otp);
      router.push("/dashboard");
    } catch (error) {
      setOtpError(getErrorMessage(error, "Invalid authentication code."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="admin-login-split-card">
      <AdminLoginVisualPanel />

      <div className="admin-login-form-panel">
        <div className="admin-login-form-panel__inner">
          <header className="admin-login-form-panel__header">
            <Image
              src="/zynda.png"
              alt="ZYND"
              width={56}
              height={56}
              className="admin-login-form-panel__logo"
              priority
            />
            <h1 className="admin-login-form-panel__title">
              {step === "credentials" ? "Welcome Back!" : "Verify your identity"}
            </h1>
            {step === "mfa" ? (
              <p className="admin-login-form-panel__hint">
                Enter the 6-digit code from your authenticator app for{" "}
                <span className="admin-login-form-panel__hint-emphasis">{email.trim()}</span>.
              </p>
            ) : null}
          </header>

          {step === "credentials" ? (
            <form onSubmit={(event) => void handleCredentialsSubmit(event)} className="admin-login-form">
              <FieldGroup className="admin-login-form__fields">
                <Field data-invalid={!!emailError}>
                  <FieldLabel htmlFor="admin-email" className="sr-only">
                    Email
                  </FieldLabel>
                  <Input
                    id="admin-email"
                    type="email"
                    autoComplete="username"
                    placeholder="Email"
                    required
                    value={email}
                    onChange={(event) => {
                      setEmail(clampToMaxLength(event.target.value, "email"));
                      if (emailError) setEmailError("");
                    }}
                    aria-invalid={!!emailError}
                    className={underlineInputClass}
                    {...inputRuleProps("email")}
                  />
                  <FieldError>{emailError}</FieldError>
                </Field>

                <Field data-invalid={!!passwordError}>
                  <FieldLabel htmlFor="admin-password" className="sr-only">
                    Password
                  </FieldLabel>
                  <PasswordInput
                    id="admin-password"
                    autoComplete="current-password"
                    placeholder="Password"
                    required
                    value={password}
                    onChange={(event) => {
                      setPassword(clampToMaxLength(event.target.value, "password"));
                      if (passwordError) setPasswordError("");
                    }}
                    aria-invalid={!!passwordError}
                    className={underlineInputClass}
                    {...inputRuleProps("password")}
                  />
                  <FieldError>{passwordError}</FieldError>
                </Field>
              </FieldGroup>

              {captchaRequired ? (
                <>
                  <TurnstileWidget
                    resetKey={`admin-login-${turnstileResetKey}`}
                    onVerify={setTurnstileToken}
                    onExpire={() => setTurnstileToken("")}
                    className="mt-4"
                  />
                  {turnstileError ? (
                    <AdminFeedbackMessage
                      variant="destructive"
                      onDismiss={() => setTurnstileError("")}
                    >
                      {turnstileError}
                    </AdminFeedbackMessage>
                  ) : null}
                </>
              ) : null}

              {formError ? (
                <AdminFeedbackMessage variant="destructive" onDismiss={() => setFormError("")}>
                  {formError}
                </AdminFeedbackMessage>
              ) : null}

              <AdminAuthButton type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Please wait..." : "Login Now"}
              </AdminAuthButton>

              <p className="admin-login-form-panel__footer">
                Need access?{" "}
                <span className="admin-login-form-panel__footer-emphasis">Contact admin</span>
              </p>
            </form>
          ) : (
            <form onSubmit={(event) => void handleMfaSubmit(event)} className="admin-login-form">
              <FieldGroup className="admin-login-form__fields">
                <Field data-invalid={!!otpError}>
                  <FieldLabel htmlFor="admin-otp" className="sr-only">
                    Authentication code
                  </FieldLabel>
                  <OtpInput
                    id="admin-otp"
                    value={otp}
                    error={!!otpError}
                    onChange={(value) => {
                      setOtp(value);
                      if (otpError) setOtpError("");
                    }}
                  />
                </Field>
              </FieldGroup>

              {otpError ? (
                <AdminFeedbackMessage variant="destructive" onDismiss={() => setOtpError("")}>
                  {otpError}
                </AdminFeedbackMessage>
              ) : null}

              {formError ? (
                <AdminFeedbackMessage variant="destructive" onDismiss={() => setFormError("")}>
                  {formError}
                </AdminFeedbackMessage>
              ) : null}

              <div className="admin-login-form__actions">
                <AdminAuthButton
                  type="submit"
                  disabled={isSubmitting || !isValidOtp(otp)}
                >
                  {isSubmitting ? "Please wait..." : "Verify & Login"}
                </AdminAuthButton>

                <button
                  type="button"
                  className="admin-login-form__link"
                  onClick={() => {
                    setStep("credentials");
                    setOtp("");
                    setOtpError("");
                    setFormError("");
                  }}
                >
                  Back to sign in
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}

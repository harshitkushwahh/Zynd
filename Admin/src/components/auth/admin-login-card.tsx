"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { OtpInput } from "@/components/auth/otp-input";
import { PasswordInput } from "@/components/auth/password-input";
import { TurnstileWidget, isTurnstileRequired } from "@/components/auth/turnstile-widget";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import { ApiError } from "@/lib/api-client";
import { isAuthenticatedResponse } from "@/lib/auth-api";
import { isValidEmail, isValidOtp, isValidPassword } from "@/lib/admin-validation";
import { clampToMaxLength, inputRuleProps, INPUT_RULES } from "@/lib/input-rules";

const underlineInputClass = "auth-input-underline";

type LoginStep = "credentials" | "mfa";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

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
    <Card className="admin-login-card w-full max-w-[400px] ring-0">
      <div className="admin-login-accent" aria-hidden="true" />

      <CardContent className="px-8 pb-8 pt-7">
        <div className="mb-7 flex flex-col items-center gap-3.5 text-center">
          <div className="admin-logo-placeholder" aria-hidden="true" />
          <h1 className="font-heading text-h4 font-semibold tracking-tight text-foreground">
            <span className="admin-login-title-brand">ZYND</span> Admin Console
          </h1>
        </div>

        {step === "credentials" ? (
          <form onSubmit={(event) => void handleCredentialsSubmit(event)}>
            <FieldGroup className="gap-5">
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
                  <p className="mt-2 text-caption text-destructive">{turnstileError}</p>
                ) : null}
              </>
            ) : null}

            {formError ? <p className="mt-4 text-caption text-destructive">{formError}</p> : null}

            <Button
              type="submit"
              className="mt-7 h-11 w-full"
              size="lg"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Please wait..." : "Continue"}
            </Button>
          </form>
        ) : (
          <form onSubmit={(event) => void handleMfaSubmit(event)}>
            {email.trim() ? (
              <p className="mb-5 truncate text-center text-caption text-muted-foreground">
                {email.trim()}
              </p>
            ) : null}

            <FieldGroup className="gap-4">
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
                <FieldError>{otpError}</FieldError>
              </Field>
            </FieldGroup>

            {formError ? <p className="mt-3 text-caption text-destructive">{formError}</p> : null}

            <div className="mt-7 space-y-4">
              <Button
                type="submit"
                className="h-11 w-full"
                size="lg"
                disabled={isSubmitting || !isValidOtp(otp)}
              >
                {isSubmitting ? "Please wait..." : "Continue"}
              </Button>

              <button
                type="button"
                className="auth-link mx-auto"
                onClick={() => {
                  setStep("credentials");
                  setOtp("");
                  setOtpError("");
                  setFormError("");
                }}
              >
                Back
              </button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

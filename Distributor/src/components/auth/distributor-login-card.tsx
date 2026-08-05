"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { DistributorLoginVisualPanel } from "@/components/auth/distributor-login-visual-panel";
import { DistributorGlobalLoading } from "@/components/auth/distributor-global-loading";
import { AddInvestorOtpField } from "@/components/add-investor/add-investor-otp-field";
import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import { DistributorFeedbackMessage } from "@/components/ui/distributor-feedback-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDistributorAuth } from "@/contexts/distributor-auth-context";
import { DISTRIBUTOR_DEMO_AGENTS, findDistributorAgent } from "@/lib/distributor-agents";
import {
  ZYND_DISTRIBUTOR_LOGIN_VISUAL_GRADIENT,
  ZYND_DISTRIBUTOR_LOGO_SRC,
} from "@/lib/distributor-brand-assets";
import { ADD_INVESTOR_DEMO_OTP } from "@/lib/add-investor/add-investor-journey";
import { env } from "@/lib/env";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";
import { cn } from "@/lib/utils";

const DISTRIBUTOR_LOGIN_DEMO_OTP = ADD_INVESTOR_DEMO_OTP;

type LoginStep = "credentials" | "otp" | "forgot-password";

export function DistributorLoginCard() {
  const router = useRouter();
  const { user, loading, signIn } = useDistributorAuth();
  const [loginStep, setLoginStep] = useState<LoginStep>("credentials");
  const [email, setEmail] = useState(DISTRIBUTOR_DEMO_AGENTS[0]!.email);
  const [password, setPassword] = useState(DISTRIBUTOR_DEMO_AGENTS[0]!.password);
  const [otp, setOtp] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [isSendingResetLink, setIsSendingResetLink] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [loading, router, user]);

  if (loading || user) {
    return <DistributorGlobalLoading />;
  }

  const handleCredentialsSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setFormError("");

    if (!email.trim() || !password) {
      setFormError("Enter email and password.");
      return;
    }

    if (!env.useBackendClients && !findDistributorAgent(email, password)) {
      setFormError("Invalid email or password.");
      return;
    }

    setOtp("");
    setLoginStep("otp");
  };

  const handleOtpSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError("");

    if (otp.length !== 6) {
      setFormError("Enter the 6-digit verification code.");
      return;
    }

    if (otp !== DISTRIBUTOR_LOGIN_DEMO_OTP) {
      setFormError("Invalid verification code.");
      return;
    }

    setIsSubmitting(true);
    try {
      await signIn(email, password);
      router.push("/dashboard");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not sign in.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const goBackToCredentials = () => {
    setFormError("");
    setOtp("");
    setForgotSent(false);
    setLoginStep("credentials");
  };

  const goToForgotPassword = () => {
    setFormError("");
    setForgotSent(false);
    setLoginStep("forgot-password");
  };

  const handleForgotPasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError("");

    if (!email.trim()) {
      setFormError("Enter your email address.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFormError("Enter a valid email address.");
      return;
    }

    setIsSendingResetLink(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 600));
      setForgotSent(true);
    } finally {
      setIsSendingResetLink(false);
    }
  };

  return (
    <div className="distributor-login-page">
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
                {env.useBackendClients ? (
                  <p className="distributor-login-page__subtitle">
                    {ZYND_MITRA_COPY.signInSubtitle}
                  </p>
                ) : null}
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
                    <DistributorFeedbackMessage
                      variant="error"
                      onDismiss={() => setFormError("")}
                    >
                      {formError}
                    </DistributorFeedbackMessage>
                  ) : null}

                  <DistributorActionButton
                    type="submit"
                    variant="primary"
                    className="distributor-login-page__submit w-full"
                    tabIndex={loginStep === "credentials" ? 0 : -1}
                  >
                    Continue
                  </DistributorActionButton>
                </form>
              </div>

              <div
                className={cn(
                  "distributor-login-page__step-panel",
                  loginStep === "otp" && "distributor-login-page__step-panel--visible",
                )}
                aria-hidden={loginStep !== "otp"}
              >
                <div className="distributor-login-page__intro">
                  <h1 className="distributor-login-page__title">Two-factor authentication</h1>
                  <p className="distributor-login-page__subtitle">
                    Enter the 6-digit code from your authenticator app.
                  </p>
                </div>

                <form onSubmit={handleOtpSubmit} className="distributor-login-page__fields">
                  <div className="distributor-login-page__otp">
                    <AddInvestorOtpField
                      id="distributor-login-otp"
                      value={otp}
                      onChange={setOtp}
                      disabled={isSubmitting || loginStep !== "otp"}
                      autoFocus={loginStep === "otp"}
                    />
                  </div>

                  {formError && loginStep === "otp" ? (
                    <DistributorFeedbackMessage variant="error" onDismiss={() => setFormError("")}>
                      {formError}
                    </DistributorFeedbackMessage>
                  ) : null}

                  <DistributorActionButton
                    type="submit"
                    variant="primary"
                    disabled={isSubmitting}
                    className="distributor-login-page__submit w-full"
                    tabIndex={loginStep === "otp" ? 0 : -1}
                  >
                    {isSubmitting ? "Signing in…" : "Verify and log in"}
                  </DistributorActionButton>

                  <button
                    type="button"
                    className="mx-auto block text-caption text-muted-foreground transition-colors hover:text-foreground"
                    onClick={goBackToCredentials}
                    tabIndex={loginStep === "otp" ? 0 : -1}
                  >
                    Back to sign in
                  </button>
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
                      ? "If an account exists for this email, a reset link is on its way."
                      : "Enter your email and we'll send you a link to reset your password."}
                  </p>
                </div>

                <form
                  onSubmit={handleForgotPasswordSubmit}
                  className="distributor-login-page__fields"
                >
                  {forgotSent ? (
                    <DistributorFeedbackMessage variant="success">
                      Reset link sent to{" "}
                      <span className="font-semibold">{email.trim()}</span>. Check your inbox and
                      follow the instructions.
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

                  {formError && loginStep === "forgot-password" ? (
                    <DistributorFeedbackMessage
                      variant="error"
                      onDismiss={() => setFormError("")}
                    >
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

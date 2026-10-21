"use client";

import { AppleIcon, GoogleIcon } from "@/components/auth/oauth-provider-icons";
import {
  AuthSubmitFooter,
  stepPanelClass,
  underlineInputClass,
} from "@/components/auth/auth-shared";
import { isTurnstileRequired, TurnstileWidget } from "@/components/auth/turnstile-widget";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { ClearableInput } from "@/components/ui/clearable-input";
import { FieldMessage } from "@/components/ui/ui-message";
import { Separator } from "@/components/ui/separator";
import { useAuthDialogFlow } from "@/features/auth/hooks/auth-dialog-flow";
import { env } from "@/lib/env";
import { copy } from "@/shared/config/copy";
import { clampToMaxLength, inputRuleProps } from "@/lib/input-rules";
import { Gift, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function AuthEmailStep() {
  const flow = useAuthDialogFlow();
  const {
    step,
    isSubmitting,
    email,
    setEmail,
    password,
    setPassword,
    emailError,
    setEmailError,
    loginError,
    setLoginError,
    isLoginMode,
    setIsLoginMode,
    turnstileResetKey,
    turnstileMountKey,
    surfaceOpen,
    referralDialogOpen,
    setTurnstileToken,
    turnstileVerified,
    turnstileError,
    loginCaptchaRequired,
    handleEmailContinue,
    handleGoogleSignIn,
    handleAppleSignIn,
    goToForgotPassword,
    appliedReferralCode,
    openReferralDialog,
    clearAppliedReferralCode,
  } = flow;

  return (
    <form onSubmit={handleEmailContinue} className={stepPanelClass(step === "email")}>
      <div className="grid grid-cols-2 gap-2.5">
        <Button
          type="button"
          variant="auth-oauth"
          size="auth"
          className="rounded-[0.75rem]"
          disabled={isSubmitting || !env.googleClientId}
          title={env.googleClientId ? undefined : copy.auth.googleNotConfigured}
          onClick={() => void handleGoogleSignIn()}
        >
          <GoogleIcon />
          {copy.auth.oauthGoogle}
        </Button>

        <Button
          type="button"
          variant="auth-oauth"
          size="auth"
          className="rounded-[0.75rem]"
          disabled={isSubmitting || !env.appleClientId}
          title={env.appleClientId ? undefined : copy.auth.appleNotConfigured}
          onClick={() => void handleAppleSignIn()}
        >
          <AppleIcon />
          {copy.auth.oauthApple}
        </Button>
      </div>

      <div className="my-5 flex items-center gap-3">
        <Separator className="flex-1 bg-border" />
        <span className="rounded-[var(--radius-control)] bg-muted px-2 py-0.5 text-caption text-muted-foreground">
          Or
        </span>
        <Separator className="flex-1 bg-border" />
      </div>

      <ClearableInput
        type="email"
        name="email"
        autoComplete="email"
        placeholder="Your Email Address"
        required
        value={email}
        onClear={() => {
          setEmail("");
          setEmailError("");
          setIsLoginMode(false);
          setPassword("");
          setLoginError("");
        }}
        onChange={(event) => {
          setEmail(clampToMaxLength(event.target.value, "email"));
          if (emailError) setEmailError("");
          if (isLoginMode) {
            setIsLoginMode(false);
            setPassword("");
            setLoginError("");
          }
        }}
        aria-invalid={!!emailError}
        className={underlineInputClass}
        {...inputRuleProps("email")}
      />
      <FieldMessage message={emailError} />

      {!isLoginMode ? (
        <div className="mt-3 flex justify-end">
          {appliedReferralCode ? (
            <div
              className={cn(
                "flex max-w-full items-center gap-1.5",
                "rounded-full border border-border/70 bg-background/75 py-1 pl-2 pr-1",
                "font-mono text-[0.6875rem] font-medium tracking-wide text-foreground shadow-zynd-low",
                "backdrop-blur-md backdrop-saturate-150",
              )}
              title={appliedReferralCode}
            >
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                <Gift className="size-3" strokeWidth={2.25} aria-hidden />
              </span>
              <span className="min-w-0 max-w-[10rem] truncate sm:max-w-[12rem]">{appliedReferralCode}</span>
              <button
                type="button"
                className="flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
                aria-label={copy.auth.referralAppliedAriaRemove}
                onClick={clearAppliedReferralCode}
              >
                <X className="size-3" strokeWidth={2.25} aria-hidden />
              </button>
            </div>
          ) : (
            <button type="button" onClick={openReferralDialog} className="auth-link shrink-0">
              {copy.auth.referralCodeToggle}
            </button>
          )}
        </div>
      ) : null}

      {isLoginMode ? (
        <>
          <PasswordInput
            name="password"
            autoComplete="current-password"
            placeholder="Your password"
            required
            value={password}
            onChange={(event) => {
              setPassword(clampToMaxLength(event.target.value, "password"));
              if (loginError) setLoginError("");
            }}
            aria-invalid={!!loginError}
            className={`${underlineInputClass} mt-4`}
            {...inputRuleProps("password")}
          />
          <FieldMessage message={loginError} />
        </>
      ) : null}

      {isLoginMode ? (
        <div className="mt-3">
          <button type="button" onClick={goToForgotPassword} className="auth-link">
            Forgot password?
          </button>
        </div>
      ) : null}

      {isLoginMode && loginCaptchaRequired && isTurnstileRequired() && surfaceOpen && !referralDialogOpen ? (
        <div
          className={
            turnstileVerified
              ? "max-h-0 overflow-hidden opacity-0 transition-[max-height,opacity,margin] duration-300 ease-out"
              : "relative z-[2] mt-4 mb-4 min-h-[4.5rem] overflow-visible opacity-100 transition-[max-height,opacity,margin] duration-300 ease-out"
          }
          aria-hidden={turnstileVerified}
        >
          {!turnstileVerified ? (
            <>
              <TurnstileWidget
                resetKey={`login-${turnstileResetKey}-${turnstileMountKey}`}
                onVerify={setTurnstileToken}
                onExpire={() => setTurnstileToken("")}
              />
              <FieldMessage message={turnstileError} />
            </>
          ) : null}
        </div>
      ) : null}

      {!isLoginMode && isTurnstileRequired() && surfaceOpen && !referralDialogOpen ? (
        <div
          className={
            turnstileVerified
              ? "max-h-0 overflow-hidden opacity-0 transition-[max-height,opacity,margin] duration-300 ease-out"
              : "relative z-[2] mt-4 mb-4 min-h-[4.5rem] overflow-visible opacity-100 transition-[max-height,opacity,margin] duration-300 ease-out"
          }
          aria-hidden={turnstileVerified}
        >
          {!turnstileVerified ? (
            <>
              <TurnstileWidget
                resetKey={`email-${turnstileResetKey}-${turnstileMountKey}`}
                onVerify={setTurnstileToken}
                onExpire={() => setTurnstileToken("")}
              />
              <FieldMessage message={turnstileError} />
            </>
          ) : null}
        </div>
      ) : null}

      <AuthSubmitFooter
        hint={
          isLoginMode ? undefined : (
            <>
              By proceeding, I agree to{" "}
              <button type="button" className="text-primary hover:underline">
                T&amp;C
              </button>
              ,{" "}
              <button type="button" className="text-primary hover:underline">
                Privacy Policy
              </button>{" "}
              &amp;{" "}
              <button type="button" className="text-primary hover:underline">
                Tariff Rates
              </button>
            </>
          )
        }
      >
        <Button
          type="submit"
          size="auth"
          disabled={isSubmitting || (isLoginMode && password.length < 8)}
        >
          {isSubmitting
            ? isLoginMode
              ? "Signing in..."
              : "Please wait..."
            : isLoginMode
              ? "Sign in"
              : "Continue"}
        </Button>
      </AuthSubmitFooter>
    </form>
  );
}

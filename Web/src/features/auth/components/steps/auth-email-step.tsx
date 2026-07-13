"use client";

import { AppleIcon, GoogleIcon } from "@/components/auth/oauth-provider-icons";
import {
  AuthSubmitFooter,
  stepPanelClass,
  underlineInputClass,
} from "@/components/auth/auth-shared";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { ClearableInput } from "@/components/ui/clearable-input";
import { FieldMessage } from "@/components/ui/ui-message";
import { Separator } from "@/components/ui/separator";
import { useAuthDialogFlow } from "@/features/auth/hooks/auth-dialog-flow";
import { env } from "@/lib/env";
import { copy } from "@/shared/config/copy";
import { clampToMaxLength, inputRuleProps } from "@/lib/input-rules";

function normalizeReferralCodeInput(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 16);
}

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
    setTurnstileToken,
    turnstileVerified,
    turnstileError,
    loginCaptchaRequired,
    handleEmailContinue,
    handleGoogleSignIn,
    handleAppleSignIn,
    goToForgotPassword,
    referralCodeInput,
    setReferralCodeInput,
    showReferralCodeInput,
    toggleReferralCodeInput,
    referralCodeError,
    setReferralCodeError,
    commitReferralCodeInput,
  } = flow;

  return (
    <form onSubmit={handleEmailContinue} className={stepPanelClass(step === "email")}>
      <Button
        type="button"
        variant="auth-oauth"
        size="auth"
        disabled={isSubmitting || !env.googleClientId}
        title={env.googleClientId ? undefined : copy.auth.googleNotConfigured}
        onClick={() => void handleGoogleSignIn()}
      >
        <GoogleIcon />
        {copy.auth.continueWithGoogle}
      </Button>

      <Button
        type="button"
        variant="auth-oauth"
        size="auth"
        className="mt-2"
        disabled={isSubmitting || !env.appleClientId}
        title={env.appleClientId ? undefined : copy.auth.appleNotConfigured}
        onClick={() => void handleAppleSignIn()}
      >
        <AppleIcon />
        {copy.auth.continueWithApple}
      </Button>

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

      <div className="mt-3 flex items-center justify-between gap-3">
        {isLoginMode ? (
          <button type="button" onClick={goToForgotPassword} className="auth-link">
            Forgot password?
          </button>
        ) : (
          <span aria-hidden className="min-w-0" />
        )}
        <button type="button" onClick={toggleReferralCodeInput} className="auth-link shrink-0">
          {showReferralCodeInput
            ? copy.auth.referralCodeToggleHide
            : copy.auth.referralCodeToggle}
        </button>
      </div>

      {showReferralCodeInput ? (
        <>
          <ClearableInput
            type="text"
            name="referral_code"
            autoComplete="off"
            spellCheck={false}
            placeholder={copy.auth.referralCodePlaceholder}
            value={referralCodeInput}
            onClear={() => {
              setReferralCodeInput("");
              setReferralCodeError("");
            }}
            onChange={(event) => {
              setReferralCodeInput(normalizeReferralCodeInput(event.target.value));
              if (referralCodeError) setReferralCodeError("");
            }}
            onBlur={() => {
              void commitReferralCodeInput();
            }}
            aria-invalid={!!referralCodeError}
            className={`${underlineInputClass} mt-3`}
            maxLength={16}
          />
          <FieldMessage message={referralCodeError} />
          {!referralCodeError ? (
            <p className="mt-1 text-caption text-muted-foreground">{copy.auth.referralCodeHint}</p>
          ) : null}
        </>
      ) : null}

      {isLoginMode && loginCaptchaRequired && !turnstileVerified ? (
        <>
          <TurnstileWidget
            resetKey={`login-${turnstileResetKey}`}
            onVerify={setTurnstileToken}
            onExpire={() => setTurnstileToken("")}
            className="mt-4 mb-4"
          />
          <FieldMessage message={turnstileError} />
        </>
      ) : null}

      {!isLoginMode && !turnstileVerified ? (
        <>
          <TurnstileWidget
            resetKey={`email-${turnstileResetKey}`}
            onVerify={setTurnstileToken}
            onExpire={() => setTurnstileToken("")}
            className="mt-4 mb-4"
          />
          <FieldMessage message={turnstileError} />
        </>
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

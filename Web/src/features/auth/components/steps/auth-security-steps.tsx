"use client";

import {
  AuthSubmitFooter,
  OtpInfoBanner,
  OtpInput,
  stepPanelClass,
  underlineInputClass,
} from "@/components/auth/auth-shared";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { ClearableInput } from "@/components/ui/clearable-input";
import { Input } from "@/components/ui/input";
import { FieldMessage, UiMessage } from "@/components/ui/ui-message";
import {
  getOAuthProviderLabel,
} from "@/features/auth/constants/auth-steps";
import { useAuthDialogFlow } from "@/features/auth/hooks/auth-dialog-flow";
import { clampToMaxLength, inputRuleProps } from "@/lib/input-rules";
import { copy } from "@/shared/config/copy";
import { ArrowLeft, KeyRound, ShieldCheck, Smartphone } from "lucide-react";

const mfaIconCircleClass =
  "size-[3.25rem] shrink-0 rounded-full p-0 shadow-none";

export function AuthMfaChallengeStep() {
  const flow = useAuthDialogFlow();
  const {
    step,
    useBackupCode,
    setUseBackupCode,
    backupCode,
    setBackupCode,
    mfaCode,
    setMfaCode,
    mfaError,
    setMfaError,
    isSubmitting,
    handleMfaSubmit,
    mfaSmsFallbackAvailable,
    mfaMaskedPhone,
    useMfaSmsOtp,
    setUseMfaSmsOtp,
    mfaSmsOtp,
    setMfaSmsOtp,
    mfaSmsSent,
    mfaLoginSmsOtpCooldown,
    handleSendMfaLoginSms,
    handleResendMfaLoginSms,
  } = flow;

  const bannerMessage = useMfaSmsOtp
    ? mfaMaskedPhone
      ? `${copy.mfa.secondFactor.smsLoginDescription} (${mfaMaskedPhone})`
      : copy.mfa.secondFactor.smsLoginDescription
    : useBackupCode
      ? "Enter one of your backup codes."
      : copy.auth.mfaAuthenticatorHint;

  return (
    <form onSubmit={handleMfaSubmit} className={stepPanelClass(step === "mfa-challenge")}>
      <OtpInfoBanner
        message={bannerMessage}
        resend={
          useMfaSmsOtp && mfaSmsSent
            ? {
                canResend: mfaLoginSmsOtpCooldown.canResend,
                secondsLeft: mfaLoginSmsOtpCooldown.secondsLeft,
                onResend: () => void handleResendMfaLoginSms(),
                disabled: isSubmitting,
              }
            : undefined
        }
      />
      {useMfaSmsOtp ? (
        <>
          <OtpInput
            id="mfaSmsOtp"
            value={mfaSmsOtp}
            error={!!mfaError}
            onChange={(value) => {
              setMfaSmsOtp(value);
              if (mfaError) setMfaError("");
            }}
          />
        </>
      ) : (
        <>
          {useBackupCode ? (
            <Input
              placeholder={copy.auth.backupCodePlaceholder}
              value={backupCode}
              onChange={(event) => {
                setBackupCode(event.target.value.toUpperCase());
                if (mfaError) setMfaError("");
              }}
              className={underlineInputClass}
            />
          ) : (
            <OtpInput
              id="mfaCode"
              value={mfaCode}
              error={!!mfaError}
              onChange={(value) => {
                setMfaCode(value);
                if (mfaError) setMfaError("");
              }}
            />
          )}
        </>
      )}
      <FieldMessage message={mfaError} />
      <AuthSubmitFooter>
        <div className="flex gap-2">
          <div className="flex shrink-0 items-center gap-2">
            {useMfaSmsOtp || useBackupCode ? (
              <Button
                type="button"
                variant="auth-oauth"
                size="icon"
                className={mfaIconCircleClass}
                disabled={isSubmitting}
                aria-label={copy.mfa.secondFactor.stepUpUseAuthenticatorShort}
                title={copy.mfa.secondFactor.stepUpUseAuthenticatorShort}
                onClick={() => {
                  setUseMfaSmsOtp(false);
                  setUseBackupCode(false);
                  setMfaSmsOtp("");
                  setMfaError("");
                }}
              >
                <ShieldCheck className="size-4 shrink-0" strokeWidth={2.25} aria-hidden />
              </Button>
            ) : (
              <Button
                type="button"
                variant="auth-oauth"
                size="icon"
                className={mfaIconCircleClass}
                disabled={isSubmitting}
                aria-label={copy.auth.useBackupCodeShort}
                title={copy.auth.useBackupCodeShort}
                onClick={() => {
                  setUseBackupCode(true);
                  setMfaError("");
                }}
              >
                <KeyRound className="size-4 shrink-0" strokeWidth={2.25} aria-hidden />
              </Button>
            )}
            {mfaSmsFallbackAvailable && !useMfaSmsOtp ? (
              <Button
                type="button"
                variant="auth-oauth"
                size="icon"
                className={mfaIconCircleClass}
                disabled={isSubmitting}
                aria-label={copy.mfa.secondFactor.stepUpSendSmsShort}
                title={copy.mfa.secondFactor.stepUpSendSmsShort}
                onClick={() => void handleSendMfaLoginSms()}
              >
                <Smartphone className="size-4 shrink-0" strokeWidth={2.25} aria-hidden />
              </Button>
            ) : null}
          </div>
          <Button
            type="submit"
            size="auth"
            className="min-w-0 flex-1"
            disabled={isSubmitting}
          >
            {isSubmitting ? copy.mfa.verifying : copy.auth.mfaLetsGo}
          </Button>
        </div>
      </AuthSubmitFooter>
    </form>
  );
}

export function AuthSmsOtpLoginStep() {
  const flow = useAuthDialogFlow();
  const {
    step,
    maskedPhone,
    loginSmsOtp,
    setLoginSmsOtp,
    loginSmsOtpError,
    setLoginSmsOtpError,
    isSubmitting,
    loginSmsOtpCooldown,
    handleLoginSmsOtpSubmit,
    handleResendLoginSmsOtp,
  } = flow;

  return (
    <form onSubmit={handleLoginSmsOtpSubmit} className={stepPanelClass(step === "sms-otp-login")}>
      <OtpInfoBanner
        message={
          maskedPhone
            ? `${copy.mfa.secondFactor.smsLoginDescription} (${maskedPhone})`
            : copy.mfa.secondFactor.smsLoginDescription
        }
        resend={{
          canResend: loginSmsOtpCooldown.canResend,
          secondsLeft: loginSmsOtpCooldown.secondsLeft,
          onResend: () => void handleResendLoginSmsOtp(),
          disabled: isSubmitting,
        }}
      />
      <OtpInput
        id="loginSmsOtp"
        value={loginSmsOtp}
        error={!!loginSmsOtpError}
        onChange={(value) => {
          setLoginSmsOtp(value);
          if (loginSmsOtpError) setLoginSmsOtpError("");
        }}
      />
      <FieldMessage message={loginSmsOtpError} />
      <AuthSubmitFooter>
        <Button type="submit" size="auth" disabled={isSubmitting}>
          {isSubmitting ? copy.mfa.verifying : copy.auth.mfaLetsGo}
        </Button>
      </AuthSubmitFooter>
    </form>
  );
}

export function AuthOAuthLinkStep() {
  const flow = useAuthDialogFlow();
  const {
    step,
    emailHint,
    oauthLinkProvider,
    oauthLinkOtp,
    setOauthLinkOtp,
    oauthLinkPassword,
    setOauthLinkPassword,
    oauthLinkError,
    setOauthLinkError,
    isSubmitting,
    oauthLinkCooldown,
    handleOAuthLinkSubmit,
    handleResendOAuthLinkOtp,
  } = flow;

  return (
    <form onSubmit={handleOAuthLinkSubmit} className={stepPanelClass(step === "oauth-link")}>
      <OtpInfoBanner
        message={`We sent a verification code to ${emailHint || "your registered email"}. Enter it with your password to link ${getOAuthProviderLabel(oauthLinkProvider)}.`}
        resend={{
          canResend: oauthLinkCooldown.canResend,
          secondsLeft: oauthLinkCooldown.secondsLeft,
          onResend: () => void handleResendOAuthLinkOtp(),
          disabled: isSubmitting,
        }}
      />
      <OtpInput
        id="oauthLinkOtp"
        value={oauthLinkOtp}
        error={!!oauthLinkError}
        onChange={(value) => {
          setOauthLinkOtp(value);
          if (oauthLinkError) setOauthLinkError("");
        }}
      />
      <PasswordInput
        placeholder="Your account password"
        value={oauthLinkPassword}
        onChange={(event) => {
          setOauthLinkPassword(clampToMaxLength(event.target.value, "password"));
          if (oauthLinkError) setOauthLinkError("");
        }}
        className={`${underlineInputClass} mt-4`}
        {...inputRuleProps("password")}
      />
      <FieldMessage message={oauthLinkError} />
      <AuthSubmitFooter>
        <Button
          type="submit"
          size="auth"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? "Linking..."
            : `Confirm and link ${getOAuthProviderLabel(oauthLinkProvider)}`}
        </Button>
      </AuthSubmitFooter>
    </form>
  );
}

export function AuthForgotPasswordStep() {
  const flow = useAuthDialogFlow();
  const {
    step,
    forgotEmail,
    setForgotEmail,
    forgotEmailError,
    setForgotEmailError,
    forgotSent,
    turnstileResetKey,
    setTurnstileToken,
    turnstileVerified,
    turnstileError,
    handleForgotSubmit,
    backToSignInFromForgot,
  } = flow;

  return (
    <form onSubmit={handleForgotSubmit} className={stepPanelClass(step === "forgot-password")}>
      {forgotSent ? (
        <UiMessage variant="success" className="mt-0">
          Reset link sent to <span className="font-medium">{forgotEmail}</span>. Check your inbox
          and follow the instructions.
        </UiMessage>
      ) : (
        <>
          <ClearableInput
            type="email"
            name="forgotEmail"
            autoComplete="email"
            placeholder="Your Email Address"
            required
            value={forgotEmail}
            onClear={() => {
              setForgotEmail("");
              setForgotEmailError("");
            }}
            onChange={(event) => {
              setForgotEmail(clampToMaxLength(event.target.value, "email"));
              if (forgotEmailError) setForgotEmailError("");
            }}
            aria-invalid={!!forgotEmailError}
            className={underlineInputClass}
            {...inputRuleProps("email")}
          />
          <FieldMessage message={forgotEmailError} />
          {!turnstileVerified ? (
            <>
              <TurnstileWidget
                resetKey={`forgot-${turnstileResetKey}`}
                onVerify={setTurnstileToken}
                onExpire={() => setTurnstileToken("")}
                className="relative z-[2] mt-4 mb-4 overflow-visible"
              />
              <FieldMessage message={turnstileError} />
            </>
          ) : null}
        </>
      )}
      <AuthSubmitFooter>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="auth-oauth"
            size="icon"
            className={mfaIconCircleClass}
            aria-label={copy.auth.backToSignIn}
            title={copy.auth.backToSignIn}
            onClick={backToSignInFromForgot}
          >
            <ArrowLeft className="size-4 shrink-0" strokeWidth={2.25} aria-hidden />
          </Button>
          {!forgotSent ? (
            <Button type="submit" size="auth" className="min-w-0 flex-1">
              Send reset link
            </Button>
          ) : (
            <Button type="button" size="auth" className="min-w-0 flex-1" onClick={backToSignInFromForgot}>
              {copy.auth.backToSignIn}
            </Button>
          )}
        </div>
      </AuthSubmitFooter>
    </form>
  );
}

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
import { isValidOtp } from "@/lib/auth-validation";
import { clampToMaxLength, inputRuleProps } from "@/lib/input-rules";
import { copy } from "@/shared/config/copy";

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
  } = flow;

  return (
    <form onSubmit={handleMfaSubmit} className={stepPanelClass(step === "mfa-challenge")}>
      <OtpInfoBanner
        message={
          useBackupCode ? "Enter one of your backup codes." : copy.auth.mfaAuthenticatorHint
        }
      />
      {useBackupCode ? (
        <Input
          placeholder="Backup code"
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
      <FieldMessage message={mfaError} />
      <button
        type="button"
        className="auth-link mt-3"
        onClick={() => {
          setUseBackupCode((current) => !current);
          setMfaError("");
        }}
      >
        {useBackupCode ? "Use authenticator app instead" : "Use a backup code instead"}
      </button>
      <AuthSubmitFooter>
        <Button
          type="submit"
          size="auth"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Verifying..." : "Verify and sign in"}
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
                className="mt-4 mb-4"
              />
              <FieldMessage message={turnstileError} />
            </>
          ) : null}
        </>
      )}
      <button type="button" onClick={backToSignInFromForgot} className="auth-link mt-3">
        Back to sign in
      </button>
      <AuthSubmitFooter>
        {!forgotSent ? (
          <Button type="submit" size="auth">
            Send reset link
          </Button>
        ) : (
          <Button
            type="button"
            size="auth"
            onClick={backToSignInFromForgot}
          >
            Back to sign in
          </Button>
        )}
      </AuthSubmitFooter>
    </form>
  );
}

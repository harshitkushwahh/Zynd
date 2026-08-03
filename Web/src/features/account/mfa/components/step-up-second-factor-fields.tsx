"use client";

import { useEffect, useState } from "react";

import { OtpInfoBanner, OtpInput } from "@/components/auth/auth-shared";
import { Input } from "@/components/ui/input";
import { FieldMessage } from "@/components/ui/ui-message";
import { fetchStepUpOptions, sendStepUpSms } from "@/features/account/mfa/api/step-up-api";
import { useOtpResendCooldown } from "@/hooks/use-otp-resend-cooldown";
import { ApiError } from "@/lib/api-client";
import { copy } from "@/shared/config/copy";
import { storageKeys } from "@/shared/config/storage-keys";

type StepUpSecondFactorFieldsProps = {
  useSms: boolean;
  onUseSmsChange: (useSms: boolean) => void;
  totpCode: string;
  onTotpCodeChange: (value: string) => void;
  smsOtp: string;
  onSmsOtpChange: (value: string) => void;
  smsSent: boolean;
  onSmsSentChange: (sent: boolean) => void;
  disabled?: boolean;
  error?: string;
  onErrorChange?: (message: string) => void;
};

export function StepUpSecondFactorFields({
  useSms,
  onUseSmsChange,
  totpCode,
  onTotpCodeChange,
  smsOtp,
  onSmsOtpChange,
  smsSent,
  onSmsSentChange,
  disabled = false,
  error = "",
  onErrorChange,
}: StepUpSecondFactorFieldsProps) {
  const [smsFallbackAvailable, setSmsFallbackAvailable] = useState(false);
  const [maskedPhone, setMaskedPhone] = useState<string | null>(null);
  const [sendingSms, setSendingSms] = useState(false);
  const smsCooldown = useOtpResendCooldown(storageKeys.stepUpSmsCooldown);

  useEffect(() => {
    let cancelled = false;
    void fetchStepUpOptions()
      .then((options) => {
        if (cancelled) return;
        setSmsFallbackAvailable(options.sms_fallback_available);
        setMaskedPhone(options.masked_phone);
      })
      .catch(() => {
        if (!cancelled) {
          setSmsFallbackAvailable(false);
          setMaskedPhone(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSendSms = async () => {
    setSendingSms(true);
    onErrorChange?.("");
    try {
      const result = await sendStepUpSms();
      onSmsSentChange(true);
      onUseSmsChange(true);
      setMaskedPhone(result.masked_phone);
      smsCooldown.startCooldown(result.retry_after_seconds);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : copy.mfa.secondFactor.couldNotSendSms;
      onErrorChange?.(message);
      if (err instanceof ApiError) {
        smsCooldown.syncFromError(err.retryAfterSeconds);
      }
    } finally {
      setSendingSms(false);
    }
  };

  const handleResendSms = async () => {
    if (!smsCooldown.canResend || disabled || sendingSms) return;
    await handleSendSms();
  };

  const bannerMessage = useSms
    ? maskedPhone
      ? `${copy.mfa.secondFactor.stepUpDescription} (${maskedPhone})`
      : copy.mfa.secondFactor.stepUpDescription
    : copy.auth.mfaAuthenticatorHint;

  return (
    <div className="space-y-3">
      {useSms ? (
        <>
          <OtpInfoBanner
            message={bannerMessage}
            resend={
              smsSent
                ? {
                    canResend: smsCooldown.canResend,
                    secondsLeft: smsCooldown.secondsLeft,
                    onResend: () => void handleResendSms(),
                    disabled: disabled || sendingSms,
                  }
                : undefined
            }
          />
          <OtpInput
            id="stepUpSmsOtp"
            value={smsOtp}
            error={!!error}
            onChange={(value) => {
              onSmsOtpChange(value);
              if (error) onErrorChange?.("");
            }}
          />
        </>
      ) : (
        <div className="rounded-[var(--radius-card)] border border-border bg-muted/15 p-5">
          <p className="text-center text-compact font-medium text-foreground">Authenticator code</p>
          <p className="mt-1 text-center text-caption text-muted-foreground">
            {copy.auth.mfaAuthenticatorForApp}
          </p>
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            value={totpCode}
            onChange={(event) => {
              onTotpCodeChange(event.target.value.replace(/\D/g, "").slice(0, 6));
              if (error) onErrorChange?.("");
            }}
            maxLength={6}
            disabled={disabled}
            className="auth-input-underline mt-5 w-full text-center tracking-[0.35em] text-body font-medium"
          />
        </div>
      )}

      {smsFallbackAvailable && !useSms ? (
        <button
          type="button"
          className="auth-link block"
          disabled={disabled || sendingSms}
          onClick={() => void handleSendSms()}
        >
          {copy.mfa.secondFactor.stepUpSendSms}
        </button>
      ) : null}

      {useSms ? (
        <button
          type="button"
          className="auth-link block"
          disabled={disabled}
          onClick={() => {
            onUseSmsChange(false);
            onSmsOtpChange("");
            onSmsSentChange(false);
            onErrorChange?.("");
          }}
        >
          {copy.mfa.secondFactor.stepUpUseAuthenticator}
        </button>
      ) : null}

      <FieldMessage message={error} />
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Smartphone } from "lucide-react";

import { OtpInfoBanner, OtpInput } from "@/components/auth/auth-shared";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FieldMessage } from "@/components/ui/ui-message";
import { fetchStepUpOptions, sendStepUpSms } from "@/features/account/mfa/api/step-up-api";
import { useOtpResendCooldown } from "@/hooks/use-otp-resend-cooldown";
import { ApiError } from "@/lib/api-client";
import { copy } from "@/shared/config/copy";
import { storageKeys } from "@/shared/config/storage-keys";
import { cn } from "@/lib/utils";

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
  embedded?: boolean;
  centered?: boolean;
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
  embedded = false,
  centered = false,
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
    : copy.auth.mfaAuthenticatorForApp;

  const authenticatorFields = (
    <div className={cn("space-y-3", !embedded && "rounded-[var(--radius-xl)] border border-border bg-muted/15 p-4")}>
      <div className={cn("space-y-1", centered && "text-center")}>
        {embedded && centered ? (
          <div className="flex items-center justify-center gap-2">
            <ShieldCheck className="size-4 text-primary" strokeWidth={2.25} aria-hidden />
            <Label htmlFor="stepUpTotp" className="text-caption font-medium">
              {copy.pin.setupStepMfa}
            </Label>
          </div>
        ) : embedded ? (
          <Label htmlFor="stepUpTotp" className="text-caption font-medium">
            {copy.pin.setupStepMfa}
          </Label>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <ShieldCheck className="size-4 text-primary" strokeWidth={2.25} aria-hidden />
            <p className="text-compact font-medium text-foreground">Authenticator code</p>
          </div>
        )}
        <p className={cn("text-caption text-muted-foreground", centered || !embedded ? "text-center" : "")}>
          {copy.auth.mfaAuthenticatorForApp}
        </p>
      </div>
      <OtpInput
        id="stepUpTotp"
        value={totpCode}
        error={!!error}
        onChange={(value) => {
          onTotpCodeChange(value);
          if (error) onErrorChange?.("");
        }}
      />
    </div>
  );

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
                    readyLabel: copy.mfa.secondFactor.smsLoginResend,
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
        authenticatorFields
      )}

      {smsFallbackAvailable && !useSms ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={disabled || sendingSms}
            onClick={() => void handleSendSms()}
          >
            <Smartphone className="size-3.5" strokeWidth={2.25} aria-hidden />
            {sendingSms ? copy.mfa.verifying : copy.mfa.secondFactor.stepUpSendSms}
          </Button>
        </div>
      ) : null}

      {useSms ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-muted-foreground"
            disabled={disabled}
            onClick={() => {
              onUseSmsChange(false);
              onSmsOtpChange("");
              onSmsSentChange(false);
              onErrorChange?.("");
            }}
          >
            {copy.mfa.secondFactor.stepUpUseAuthenticator}
          </Button>
        </div>
      ) : null}

      <FieldMessage message={error} className={centered ? "text-center" : undefined} />
    </div>
  );
}

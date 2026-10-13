"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

import { AuthSubmitFooter, OtpInput } from "@/components/auth/auth-shared";
import {
  OtpDeliveryConnector,
  type OtpDeliveryVisualState,
} from "@/components/otp/otp-delivery-connector";
import { OtpVerificationLottie } from "@/components/otp/otp-verification-lottie";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FieldMessage } from "@/components/ui/ui-message";
import { useOtpResendCooldown } from "@/hooks/use-otp-resend-cooldown";
import { appConfig } from "@/shared/config/app-config";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

export type OtpSendTimingResult =
  | number
  | {
      retry_after_seconds?: number;
      expires_in?: number;
    }
  | void;

function parseOtpSendTiming(result: OtpSendTimingResult): {
  resendSeconds: number;
  expiresSeconds: number;
} {
  const defaultResend = appConfig.otpResendCooldownSeconds;
  const defaultExpires = appConfig.otpExpiresInSeconds;
  if (typeof result === "number" && result > 0) {
    return { resendSeconds: result, expiresSeconds: defaultExpires };
  }
  if (result && typeof result === "object") {
    const resendSeconds =
      typeof result.retry_after_seconds === "number" && result.retry_after_seconds > 0
        ? result.retry_after_seconds
        : defaultResend;
    const expiresSeconds =
      typeof result.expires_in === "number" && result.expires_in > 0
        ? result.expires_in
        : defaultExpires;
    return { resendSeconds, expiresSeconds };
  }
  return { resendSeconds: defaultResend, expiresSeconds: defaultExpires };
}

function formatOtpTimer(seconds: number) {
  const clamped = Math.max(seconds, 0);
  const minutes = Math.floor(clamped / 60);
  const remainder = clamped % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function OtpConsentVerifySkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-5", className)} aria-busy="true" aria-live="polite">
      <Skeleton className="mx-auto size-[7.25rem] rounded-full" />
      <Skeleton className="mx-auto h-4 w-[85%]" />
      <div className="flex w-full gap-2 sm:gap-2.5">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="aspect-square min-w-0 flex-1 rounded-[var(--radius-control)]" />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-10" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-10 w-full rounded-[var(--radius-control)]" />
    </div>
  );
}

type OtpConsentVerifyPanelProps = {
  loading?: boolean;
  otpSent: boolean;
  otp: string;
  onOtpChange: (value: string) => void;
  sending: boolean;
  onSendOtp: () => Promise<OtpSendTimingResult> | OtpSendTimingResult;
  submitting: boolean;
  onConfirm: () => void;
  error?: string;
  bannerError?: string;
  inputError?: boolean;
  confirmLabel: string;
  infoMessage: string;
  /** Resend cooldown from send-otp (retry_after_seconds). */
  sentResendCooldownSeconds?: number | null;
  /** OTP validity countdown from send-otp (expires_in) — shown on the left. */
  otpExpiresInSeconds?: number | null;
  /** Invest payment card: full-height layout, footer pinned, Zynd→phone connector. */
  embedded?: boolean;
  deliveryVisualState?: OtpDeliveryVisualState;
  className?: string;
  lottieClassName?: string;
};

export function OtpConsentVerifyPanel({
  loading = false,
  otpSent,
  otp,
  onOtpChange,
  sending,
  onSendOtp,
  submitting,
  onConfirm,
  error,
  bannerError,
  inputError = false,
  confirmLabel,
  infoMessage,
  sentResendCooldownSeconds,
  otpExpiresInSeconds,
  embedded = false,
  deliveryVisualState = "idle",
  className,
  lottieClassName,
}: OtpConsentVerifyPanelProps) {
  const resendCooldown = useOtpResendCooldown();
  const expiryTimer = useOtpResendCooldown();
  const canResend = resendCooldown.canResend && !sending;
  const [otpExpired, setOtpExpired] = useState(false);
  const expiryCountdownStartedRef = useRef(false);

  function resetExpiryCountdown() {
    setOtpExpired(false);
    expiryCountdownStartedRef.current = false;
  }

  function startExpiryCountdown(seconds: number) {
    resetExpiryCountdown();
    expiryTimer.startCooldown(seconds);
    expiryCountdownStartedRef.current = true;
  }

  useEffect(() => {
    if (sentResendCooldownSeconds == null || sentResendCooldownSeconds <= 0) return;
    resendCooldown.startCooldown(sentResendCooldownSeconds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentResendCooldownSeconds]);

  useEffect(() => {
    if (otpExpiresInSeconds == null || otpExpiresInSeconds <= 0) return;
    startExpiryCountdown(otpExpiresInSeconds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otpExpiresInSeconds]);

  useEffect(() => {
    if (!otpSent || expiryTimer.secondsLeft > 0 || otpExpiresInSeconds != null) return;
    startExpiryCountdown(appConfig.otpExpiresInSeconds);
    // OTP already sent (e.g. reopen) — assume full validity window if API did not pass expires_in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otpSent, otpExpiresInSeconds]);

  useEffect(() => {
    if (!otpSent) {
      resetExpiryCountdown();
      return;
    }
    if (!expiryCountdownStartedRef.current) return;
    if (expiryTimer.secondsLeft > 0) return;
    setOtpExpired((wasExpired) => {
      if (!wasExpired) onOtpChange("");
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiryTimer.secondsLeft, otpSent]);

  useEffect(() => {
    if (!otpSent || resendCooldown.secondsLeft > 0 || sentResendCooldownSeconds != null) return;
    resendCooldown.startCooldown(appConfig.otpResendCooldownSeconds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otpSent, sentResendCooldownSeconds]);

  async function handleSendOtp() {
    if (!canResend) return;
    const timing = parseOtpSendTiming(await onSendOtp());
    resendCooldown.startCooldown(timing.resendSeconds);
    startExpiryCountdown(timing.expiresSeconds);
    onOtpChange("");
  }

  const portfolioCopy = copy.dashboard.portfolio;
  const expiryDisplaySeconds =
    otpSent || sending
      ? sending
        ? appConfig.otpExpiresInSeconds
        : Math.max(expiryTimer.secondsLeft, 0)
      : appConfig.otpExpiresInSeconds;
  const showResendTimer = otpSent && !sending && !canResend && resendCooldown.secondsLeft > 0;
  const confirmDisabled =
    submitting || otpExpired || otp.trim().length < appConfig.otpLength || !otpSent;
  const showExpiredMessage = otpExpired && !bannerError;

  if (loading) {
    return (
      <OtpConsentVerifySkeleton
        className={cn(className, embedded && "min-h-0 flex-1 justify-between")}
      />
    );
  }

  return (
    <form
      className={cn(
        "flex w-full flex-col",
        embedded ? "gap-0" : "gap-5",
        className,
      )}
      onSubmit={(event) => {
        event.preventDefault();
        if (confirmDisabled) return;
        onConfirm();
      }}
    >
      <div className={cn("flex flex-col", embedded ? "items-center gap-4 pt-1" : "gap-5")}>
        {embedded ? (
          <OtpDeliveryConnector state={deliveryVisualState} />
        ) : (
          <OtpVerificationLottie className={lottieClassName} />
        )}

        <p
          className={cn(
            "text-balance leading-relaxed text-muted-foreground",
            embedded
              ? "max-w-[19rem] text-center font-mono text-caption tracking-tight"
              : "text-center text-caption",
          )}
        >
          {infoMessage}
        </p>

        <div
          className={cn(
            "flex w-full flex-col gap-2.5",
            embedded && "mx-auto max-w-[19rem] items-center",
          )}
        >
          <OtpInput
            id="portfolio-consent-otp"
            variant="square"
            value={otp}
            onChange={onOtpChange}
            error={inputError || otpExpired}
            disabled={otpExpired || sending}
            className={embedded ? "w-full" : undefined}
          />

          <div
            className={cn(
              "flex w-full items-center justify-between gap-3",
              embedded ? "px-0" : "px-0.5",
            )}
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                {portfolioCopy.otpExpiresLabel}
              </span>
              <p
                className={cn(
                  "text-caption tabular-nums",
                  otpExpired
                    ? "text-destructive"
                    : otpSent || sending
                      ? "text-foreground"
                      : "text-muted-foreground",
                )}
                aria-live="polite"
                title={copy.mfa.otpExpiresInHint}
              >
                {formatOtpTimer(expiryDisplaySeconds)}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-0.5">
              {showResendTimer ? (
                <span
                  className="text-[0.6875rem] tabular-nums text-muted-foreground"
                  aria-live="polite"
                >
                  {portfolioCopy.otpResendIn(formatOtpTimer(resendCooldown.secondsLeft))}
                </span>
              ) : null}
              <button
                type="button"
                className="text-caption font-medium text-primary underline-offset-4 hover:underline disabled:text-muted-foreground disabled:no-underline disabled:opacity-60"
                disabled={!canResend}
                onClick={() => void handleSendOtp()}
              >
                {sending
                  ? copy.mfa.verifying
                  : otpSent
                    ? portfolioCopy.redeemConsentResendOtp
                    : portfolioCopy.redeemConsentSendOtp}
              </button>
            </div>
          </div>
        </div>

        {showExpiredMessage || bannerError || (error && !bannerError && !otpExpired) ? (
          <div className="flex flex-col gap-1.5">
            {showExpiredMessage ? (
              <FieldMessage variant="error" message={portfolioCopy.otpExpiredMessage} className="mt-0" />
            ) : null}
            {bannerError ? (
              <FieldMessage variant="error" message={bannerError} className="mt-0" />
            ) : null}
            {error && !bannerError && !otpExpired ? (
              <FieldMessage variant="error" message={error} className="mt-0" />
            ) : null}
          </div>
        ) : null}
      </div>

      <AuthSubmitFooter
        className={cn(
          embedded ? "mt-4 w-full shrink-0 border-t border-border/60 pt-4" : "mt-0 pt-0",
        )}
      >
        <Button
          type="submit"
          className={cn(
            "w-full",
            embedded && "h-9.5 rounded-[var(--radius-control)] shadow-zynd-low",
          )}
          disabled={confirmDisabled}
        >
          {submitting ? copy.mfa.verifying : confirmLabel}
        </Button>
      </AuthSubmitFooter>
    </form>
  );
}

export function OtpConsentSuccessCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-success/25 bg-success/5 px-3.5 py-3 shadow-zynd-low">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
        <Check className="size-4" strokeWidth={2.5} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-compact font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-caption leading-snug text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

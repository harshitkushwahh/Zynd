"use client";

import { useEffect } from "react";
import { Check } from "lucide-react";

import { AuthSubmitFooter, OtpInput } from "@/components/auth/auth-shared";
import { OtpVerificationLottie } from "@/components/otp/otp-verification-lottie";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FieldMessage } from "@/components/ui/ui-message";
import { useOtpResendCooldown } from "@/hooks/use-otp-resend-cooldown";
import { appConfig } from "@/shared/config/app-config";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const DEFAULT_OTP_COOLDOWN_SECONDS = 30;

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
          <Skeleton key={index} className="aspect-square min-w-0 flex-1 rounded-[var(--radius-md)]" />
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
  onSendOtp: () => Promise<number | void> | number | void;
  submitting: boolean;
  onConfirm: () => void;
  error?: string;
  confirmLabel: string;
  infoMessage: string;
  className?: string;
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
  confirmLabel,
  infoMessage,
  className,
}: OtpConsentVerifyPanelProps) {
  const cooldown = useOtpResendCooldown();
  const canResend = cooldown.canResend && !sending;

  useEffect(() => {
    if (!otpSent || cooldown.secondsLeft > 0) return;
    cooldown.startCooldown(DEFAULT_OTP_COOLDOWN_SECONDS);
    // Start a cooldown only when OTP is already sent and the timer is idle (e.g. reopen).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otpSent]);

  async function handleSendOtp() {
    if (!canResend) return;
    const retryAfter = await onSendOtp();
    const seconds =
      typeof retryAfter === "number" && retryAfter > 0 ? retryAfter : DEFAULT_OTP_COOLDOWN_SECONDS;
    cooldown.startCooldown(seconds);
  }

  if (loading) {
    return <OtpConsentVerifySkeleton className={className} />;
  }

  return (
    <form
      className={cn("flex w-full flex-col gap-5", className)}
      onSubmit={(event) => {
        event.preventDefault();
        onConfirm();
      }}
    >
      <OtpVerificationLottie />

      <p className="text-center text-caption leading-relaxed text-balance text-muted-foreground">
        {infoMessage}
      </p>

      <div className="flex w-full flex-col gap-2">
        <OtpInput
          id="portfolio-consent-otp"
          variant="square"
          value={otp}
          onChange={onOtpChange}
          error={Boolean(error)}
        />

        <div className="flex items-center justify-between gap-3">
          <p className="text-caption tabular-nums text-muted-foreground">
            {otpSent && cooldown.secondsLeft > 0 ? formatOtpTimer(cooldown.secondsLeft) : "\u00a0"}
          </p>
          <button
            type="button"
            className="text-caption font-medium text-primary underline-offset-4 hover:underline disabled:text-muted-foreground disabled:no-underline disabled:opacity-60"
            disabled={!canResend}
            onClick={() => void handleSendOtp()}
          >
            {sending
              ? copy.mfa.verifying
              : otpSent
                ? copy.dashboard.portfolio.redeemConsentResendOtp
                : copy.dashboard.portfolio.redeemConsentSendOtp}
          </button>
        </div>
      </div>

      {error ? <FieldMessage variant="error" message={error} className="mt-0" /> : null}

      <AuthSubmitFooter className="mt-0 pt-0">
        <Button
          type="submit"
          className="w-full"
          disabled={submitting || otp.trim().length < appConfig.otpLength}
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

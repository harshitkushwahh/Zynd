"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { OtpDeliveryVisualState } from "@/components/otp/otp-delivery-connector";
import {
  OtpConsentSuccessCard,
  OtpConsentVerifyPanel,
} from "@/components/otp/otp-consent-verify-panel";
import { Button } from "@/components/ui/button";
import { formatMfTransactionConsentOtpMessage } from "@/features/invest/lib/mf-transaction-consent-copy";
import { useResetWhenDialogOpens } from "@/hooks/use-reset-when-dialog-opens";
import { appConfig } from "@/shared/config/app-config";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

export type MfTransactionConsentContext = {
  masked_mobile: string;
  masked_email?: string | null;
  consent_otp_sent?: boolean;
};

export type MfTransactionConsentOtpSectionProps = {
  active: boolean;
  loadConsent: () => Promise<MfTransactionConsentContext>;
  sendOtp: () => Promise<{
    masked_mobile?: string;
    masked_email?: string | null;
    retry_after_seconds?: number;
    expires_in?: number;
  }>;
  confirmOtp: (otp: string) => Promise<void>;
  onConfirmed?: () => void;
  onDismiss?: () => void;
  confirmLabel?: string;
  successTitle?: string;
  successDescription?: string;
  loadFailedMessage?: string;
  /** Prefetched from POST /orders — avoids an extra GET when the consent API is unavailable. */
  initialConsent?: MfTransactionConsentContext;
  embedded?: boolean;
  autoContinueOnConfirm?: boolean;
  /** Invest card: do not GET /consent; use POST create payload + send-otp only. */
  skipInitialLoad?: boolean;
  autoSendOtp?: boolean;
  className?: string;
};

export function MfTransactionConsentOtpSection({
  active,
  loadConsent,
  sendOtp,
  confirmOtp,
  onConfirmed,
  onDismiss,
  confirmLabel,
  successTitle,
  successDescription,
  loadFailedMessage,
  initialConsent,
  embedded = false,
  autoContinueOnConfirm = false,
  skipInitialLoad = false,
  autoSendOtp = false,
  className,
}: MfTransactionConsentOtpSectionProps) {
  const portfolioCopy = copy.dashboard.portfolio;
  const mfCopy = copy.mutualFunds.transactionConsent;
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [maskedMobile, setMaskedMobile] = useState<string | null>(null);
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [done, setDone] = useState(false);
  const [sentResendCooldownSeconds, setSentResendCooldownSeconds] = useState<number | null>(null);
  const [otpExpiresInSeconds, setOtpExpiresInSeconds] = useState<number | null>(null);
  const [deliveryVisualState, setDeliveryVisualState] = useState<OtpDeliveryVisualState>("idle");

  const resetState = useCallback(() => {
    setLoading(true);
    setSending(false);
    setSubmitting(false);
    setOtpSent(false);
    setOtp("");
    setMaskedMobile(null);
    setMaskedEmail(null);
    setError("");
    setLoadError("");
    setDone(false);
    setSentResendCooldownSeconds(null);
    setOtpExpiresInSeconds(null);
    setDeliveryVisualState("idle");
  }, []);

  useResetWhenDialogOpens(active, resetState);

  const loadConsentRef = useRef(loadConsent);
  loadConsentRef.current = loadConsent;

  useEffect(() => {
    if (!active) return;
    if (initialConsent?.masked_mobile) {
      setMaskedMobile(initialConsent.masked_mobile);
      setMaskedEmail(initialConsent.masked_email ?? null);
      setOtpSent(Boolean(initialConsent.consent_otp_sent));
      setLoading(false);
      setLoadError("");
      return;
    }
    if (skipInitialLoad) {
      setLoading(false);
      setLoadError("");
      return;
    }
    setLoading(true);
    setLoadError("");
    void loadConsentRef
      .current()
      .then((consent) => {
        setMaskedMobile(consent.masked_mobile);
        setMaskedEmail(consent.masked_email ?? null);
        setOtpSent(Boolean(consent.consent_otp_sent));
      })
      .catch((err) => {
        setLoadError(
          err instanceof Error ? err.message : loadFailedMessage ?? portfolioCopy.holdingConsentLoadFailed,
        );
      })
      .finally(() => setLoading(false));
  }, [active, initialConsent, loadFailedMessage, portfolioCopy.holdingConsentLoadFailed, skipInitialLoad]);

  useEffect(() => {
    if (!active || !autoSendOtp || otpSent || sending || loading) return;
    if (!maskedMobile && !skipInitialLoad) return;
    void handleSendOtp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, autoSendOtp, loading, maskedMobile, otpSent, skipInitialLoad]);

  async function handleSendOtp() {
    setSending(true);
    setError("");
    try {
      const result = await sendOtp();
      if (result.masked_mobile) setMaskedMobile(result.masked_mobile);
      if (result.masked_email !== undefined) setMaskedEmail(result.masked_email);
      setOtpSent(true);
      const resendSeconds =
        typeof result.retry_after_seconds === "number" && result.retry_after_seconds > 0
          ? result.retry_after_seconds
          : appConfig.otpResendCooldownSeconds;
      const expiresSeconds =
        typeof result.expires_in === "number" && result.expires_in > 0
          ? result.expires_in
          : appConfig.otpExpiresInSeconds;
      setSentResendCooldownSeconds(resendSeconds);
      setOtpExpiresInSeconds(expiresSeconds);
      toast.success(portfolioCopy.redeemConsentOtpSent);
      return { retry_after_seconds: resendSeconds, expires_in: expiresSeconds };
    } catch (err) {
      setError(err instanceof Error ? err.message : portfolioCopy.redeemConsentOtpSendFailed);
    } finally {
      setSending(false);
    }
  }

  async function handleConfirm() {
    if (otp.trim().length < appConfig.otpLength) return;
    setSubmitting(true);
    setError("");
    setDeliveryVisualState("idle");
    try {
      await confirmOtp(otp.trim());
      setDeliveryVisualState("success");
      toast.success(portfolioCopy.holdingConsentConfirmed);
      if (autoContinueOnConfirm) {
        await new Promise((resolve) => setTimeout(resolve, 480));
        onConfirmed?.();
        return;
      }
      setDone(true);
      onConfirmed?.();
    } catch (err) {
      setDeliveryVisualState("error");
      setError(err instanceof Error ? err.message : portfolioCopy.redeemConsentConfirmFailed);
    } finally {
      setSubmitting(false);
    }
  }

  const infoMessage = otpSent
    ? portfolioCopy.redeemConsentEnterOtp
    : formatMfTransactionConsentOtpMessage({
        maskedMobile,
        maskedEmail,
      });

  if (!active) return null;

  if (done) {
    return (
      <div className={cn("flex flex-col gap-4 px-4 pb-7 pt-2", className)}>
        <OtpConsentSuccessCard
          title={successTitle ?? portfolioCopy.holdingConsentDoneTitle}
          description={successDescription ?? portfolioCopy.holdingConsentDoneBody}
        />
        {onDismiss ? (
          <Button className="w-full" onClick={onDismiss}>
            {portfolioCopy.redeemConsentDone}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        embedded ? "flex flex-col px-0 pb-0 pt-0" : "px-4 pb-7 pt-2",
        className,
      )}
    >
      {!embedded ? (
        <p className="mb-4 text-compact font-semibold text-foreground">{mfCopy.sectionTitle}</p>
      ) : null}
      <OtpConsentVerifyPanel
        embedded={embedded}
        loading={loading}
        otpSent={otpSent}
        otp={otp}
        onOtpChange={(value) => {
          setOtp(value);
          if (error) setError("");
          if (deliveryVisualState === "error") setDeliveryVisualState("idle");
        }}
        deliveryVisualState={deliveryVisualState}
        sending={sending}
        onSendOtp={handleSendOtp}
        submitting={submitting}
        onConfirm={() => void handleConfirm()}
        error={error}
        bannerError={loadError}
        inputError={Boolean(error) && !loadError}
        confirmLabel={confirmLabel ?? portfolioCopy.holdingConsentConfirm}
        infoMessage={infoMessage}
        sentResendCooldownSeconds={sentResendCooldownSeconds}
        otpExpiresInSeconds={otpExpiresInSeconds}
        lottieClassName={embedded ? "mx-auto size-[5.5rem]" : undefined}
      />
    </div>
  );
}

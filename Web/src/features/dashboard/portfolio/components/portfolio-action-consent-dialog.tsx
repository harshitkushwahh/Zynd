"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  OtpConsentSuccessCard,
  OtpConsentVerifyPanel,
} from "@/components/otp/otp-consent-verify-panel";
import { BrandDialog } from "@/components/ui/brand-dialog";
import { Button } from "@/components/ui/button";
import {
  confirmMfSwitch,
  confirmMfSystematicPlan,
  fetchMfSwitchConsent,
  fetchMfSystematicPlanConsent,
  sendMfSwitchConsentOtp,
  sendMfSystematicPlanOtp,
} from "@/features/dashboard/portfolio/lib/portfolio-api";
import { useResetWhenDialogOpens } from "@/hooks/use-reset-when-dialog-opens";
import { appConfig } from "@/shared/config/app-config";
import { copy } from "@/shared/config/copy";

export type ActionConsentTarget =
  | { kind: "switch"; id: string }
  | { kind: "swp" | "stp"; id: string };

type PortfolioActionConsentDialogProps = {
  open: boolean;
  target: ActionConsentTarget | null;
  onOpenChange: (open: boolean) => void;
  onConfirmed?: () => void;
};

export function PortfolioActionConsentDialog({
  open,
  target,
  onOpenChange,
  onConfirmed,
}: PortfolioActionConsentDialogProps) {
  const portfolioCopy = copy.dashboard.portfolio;
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [maskedMobile, setMaskedMobile] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const resetState = useCallback(() => {
    setLoading(true);
    setSending(false);
    setSubmitting(false);
    setOtpSent(false);
    setOtp("");
    setMaskedMobile(null);
    setError("");
    setDone(false);
  }, []);

  useResetWhenDialogOpens(open, resetState);

  useEffect(() => {
    if (!open || !target) return;
    const request =
      target.kind === "switch"
        ? fetchMfSwitchConsent(target.id)
        : fetchMfSystematicPlanConsent(target.kind, target.id);
    void request
      .then((consent) => {
        setMaskedMobile(consent.masked_mobile);
        setOtpSent(consent.consent_otp_sent);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : portfolioCopy.holdingConsentLoadFailed);
      })
      .finally(() => setLoading(false));
  }, [open, target, portfolioCopy.holdingConsentLoadFailed]);

  async function handleSendOtp() {
    if (!target) return;
    setSending(true);
    setError("");
    try {
      const result =
        target.kind === "switch"
          ? await sendMfSwitchConsentOtp(target.id)
          : await sendMfSystematicPlanOtp(target.kind, target.id);
      setMaskedMobile(result.masked_mobile);
      setOtpSent(true);
      toast.success(portfolioCopy.redeemConsentOtpSent);
      return result.retry_after_seconds;
    } catch (err) {
      setError(err instanceof Error ? err.message : portfolioCopy.redeemConsentOtpSendFailed);
    } finally {
      setSending(false);
    }
  }

  async function handleConfirm() {
    if (!target || otp.trim().length < appConfig.otpLength) return;
    setSubmitting(true);
    setError("");
    try {
      if (target.kind === "switch") {
        await confirmMfSwitch(target.id, otp.trim());
      } else {
        await confirmMfSystematicPlan(target.kind, target.id, otp.trim());
      }
      toast.success(portfolioCopy.holdingConsentConfirmed);
      setDone(true);
      onConfirmed?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : portfolioCopy.redeemConsentConfirmFailed);
    } finally {
      setSubmitting(false);
    }
  }

  const infoMessage = otpSent
    ? portfolioCopy.redeemConsentEnterOtp
    : portfolioCopy.holdingConsentBody.replace("{mobile}", maskedMobile || "••••");

  const title = done ? portfolioCopy.holdingConsentDoneTitle : portfolioCopy.holdingConsentTitle;

  return (
    <BrandDialog open={open} onOpenChange={onOpenChange} title={title} maxWidth="md">
      <div className="px-5 pb-5 pt-1 sm:px-6">
        {done ? (
          <div className="space-y-4">
            <OtpConsentSuccessCard
              title={portfolioCopy.holdingConsentDoneTitle}
              description={portfolioCopy.holdingConsentDoneBody}
            />
            <Button className="w-full" onClick={() => onOpenChange(false)}>
              {portfolioCopy.redeemConsentDone}
            </Button>
          </div>
        ) : (
          <OtpConsentVerifyPanel
            loading={loading}
            otpSent={otpSent}
            otp={otp}
            onOtpChange={(value) => {
              setOtp(value);
              if (error) setError("");
            }}
            sending={sending}
            onSendOtp={handleSendOtp}
            submitting={submitting}
            onConfirm={() => void handleConfirm()}
            error={error}
            confirmLabel={portfolioCopy.holdingConsentConfirm}
            infoMessage={infoMessage}
          />
        )}
      </div>
    </BrandDialog>
  );
}

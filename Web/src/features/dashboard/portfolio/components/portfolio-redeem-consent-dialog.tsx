"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Mail, Phone, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { AuthSubmitFooter } from "@/components/auth/auth-shared";
import {
  OtpConsentSuccessCard,
  OtpConsentVerifyPanel,
  OtpConsentVerifySkeleton,
} from "@/components/otp/otp-consent-verify-panel";
import { BrandDialog } from "@/components/ui/brand-dialog";
import { Button } from "@/components/ui/button";
import { FieldMessage } from "@/components/ui/ui-message";
import { PortfolioRedeemConsentHeroImage } from "@/features/dashboard/portfolio/components/portfolio-redeem-consent-hero-image";
import {
  confirmMfRedemption,
  fetchMfRedemptionConsent,
  sendMfRedemptionConsentOtp,
  type MfRedemptionOrder,
} from "@/features/dashboard/portfolio/lib/portfolio-api";
import { formatInr } from "@/features/invest/lib/mf-format";
import { useResetWhenDialogOpens } from "@/hooks/use-reset-when-dialog-opens";
import { appConfig } from "@/shared/config/app-config";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type ConsentStep = "review" | "verify" | "done";

const STEPS: { id: Exclude<ConsentStep, "done">; label: string }[] = [
  { id: "review", label: "Review" },
  { id: "verify", label: "Verify OTP" },
];

type PortfolioRedeemConsentDialogProps = {
  open: boolean;
  order: MfRedemptionOrder | null;
  onOpenChange: (open: boolean) => void;
  onConfirmed?: (order: MfRedemptionOrder) => void;
};

function RedeemConsentProgress({ step, compact = false }: { step: ConsentStep; compact?: boolean }) {
  if (step === "done") return null;

  const currentIndex = STEPS.findIndex((item) => item.id === step);

  return (
    <div className={cn("flex gap-1.5", compact ? "mb-1" : "mb-3")}>
      {STEPS.map((item, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <div
            key={item.id}
            className={cn(
              "h-1.5 flex-1 rounded-[var(--radius-full)] transition-all duration-300",
              done && "bg-success",
              active && "bg-primary",
              !done && !active && "bg-border",
            )}
          />
        );
      })}
    </div>
  );
}

export function PortfolioRedeemConsentDialog({
  open,
  order,
  onOpenChange,
  onConfirmed,
}: PortfolioRedeemConsentDialogProps) {
  const router = useRouter();
  const portfolioCopy = copy.dashboard.portfolio;
  const [step, setStep] = useState<ConsentStep>("review");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [maskedMobile, setMaskedMobile] = useState<string | null>(null);
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [confirmedOrder, setConfirmedOrder] = useState<MfRedemptionOrder | null>(null);

  const resetState = useCallback(() => {
    setStep("review");
    setLoading(true);
    setSubmitting(false);
    setSendingOtp(false);
    setOtpSent(false);
    setOtp("");
    setMaskedMobile(null);
    setMaskedEmail(null);
    setError("");
    setConfirmedOrder(null);
  }, []);

  useResetWhenDialogOpens(open, resetState);

  useEffect(() => {
    if (!open || !order) return;

    setLoading(true);
    setError("");
    void fetchMfRedemptionConsent(order.order_id)
      .then((consent) => {
        setMaskedMobile(consent.masked_mobile);
        setMaskedEmail(consent.masked_email);
        setOtpSent(consent.consent_otp_sent);
        if (consent.consent_otp_sent) {
          setStep("verify");
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : portfolioCopy.redeemConsentLoadFailed);
      })
      .finally(() => setLoading(false));
  }, [open, order, portfolioCopy.redeemConsentLoadFailed]);

  const dialogTitle =
    step === "verify"
      ? portfolioCopy.redeemConsentVerifyTitle
      : step === "done"
        ? portfolioCopy.redeemConsentDoneTitle
        : portfolioCopy.redeemConsentTitle;

  async function handleSendOtp() {
    if (!order) return false as const;
    setSendingOtp(true);
    setError("");
    try {
      const result = await sendMfRedemptionConsentOtp(order.order_id);
      setMaskedMobile(result.masked_mobile);
      setOtpSent(true);
      toast.success(portfolioCopy.redeemConsentOtpSent);
      return result.retry_after_seconds || 30;
    } catch (err) {
      setError(err instanceof Error ? err.message : portfolioCopy.redeemConsentOtpSendFailed);
      return false as const;
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleContinueToVerify() {
    if (otpSent) {
      setStep("verify");
      return;
    }
    const sent = await handleSendOtp();
    if (sent !== false) setStep("verify");
  }

  async function handleConfirm() {
    if (!order || otp.trim().length < appConfig.otpLength) return;
    setSubmitting(true);
    setError("");
    try {
      const confirmed = await confirmMfRedemption(order.order_id, otp.trim());
      toast.success(portfolioCopy.redeemConsentConfirmed);
      setConfirmedOrder(confirmed);
      onConfirmed?.(confirmed);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : portfolioCopy.redeemConsentConfirmFailed);
    } finally {
      setSubmitting(false);
    }
  }

  function handleDone() {
    const next = confirmedOrder ?? order;
    onOpenChange(false);
    if (next?.fp_redemption_id) {
      router.push(`/dashboard/portfolio?tab=redeem-units&redemption=${next.fp_redemption_id}`);
      return;
    }
    router.push("/dashboard/portfolio?tab=redeem-units");
  }

  return (
    <BrandDialog open={open} onOpenChange={onOpenChange} title={dialogTitle} maxWidth="lg">
      <div className={cn("px-5 pb-5 sm:px-6", step === "review" || loading ? "pt-4" : "pt-1")}>
        {loading ? (
          <OtpConsentVerifySkeleton />
        ) : (
          <>
            {step === "review" ? <PortfolioRedeemConsentHeroImage className="mb-4" /> : null}

            <RedeemConsentProgress step={step} compact={step !== "review"} />

            {step === "review" ? (
              <div className="space-y-5">
                <ul className="space-y-2.5">
                  <li className="flex items-start gap-2.5 text-compact text-muted-foreground">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <ShieldCheck className="size-3" strokeWidth={2.5} aria-hidden />
                    </span>
                    {portfolioCopy.redeemConsentReviewSebi}
                  </li>
                  <li className="flex items-start gap-2.5 text-compact text-muted-foreground">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Check className="size-3" strokeWidth={2.5} aria-hidden />
                    </span>
                    {portfolioCopy.redeemConsentReviewPayout}
                  </li>
                </ul>

                <div className="rounded-[var(--radius-xl)] border border-border bg-muted/30 p-4 shadow-zynd-low">
                  {order?.product_name || order?.amount_inr ? (
                    <div className="mb-3 border-b border-border pb-3">
                      {order.product_name ? (
                        <p className="text-compact font-semibold text-foreground">{order.product_name}</p>
                      ) : null}
                      {order.amount_inr ? (
                        <p className="mt-1 text-caption text-muted-foreground">
                          {portfolioCopy.redeemConsentEstimatedAmount}{" "}
                          <span className="font-semibold tabular-nums text-foreground">
                            {formatInr(order.amount_inr)}
                          </span>
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <p className="text-caption font-medium text-foreground">
                    {portfolioCopy.redeemConsentFolioContact}
                  </p>
                  <div className="mt-2.5 space-y-2">
                    {maskedMobile ? (
                      <p className="flex items-center gap-2 text-compact font-medium text-foreground">
                        <Phone className="size-3.5 shrink-0 text-primary" strokeWidth={2.25} aria-hidden />
                        {maskedMobile}
                      </p>
                    ) : null}
                    {maskedEmail ? (
                      <p className="flex items-center gap-2 text-compact text-muted-foreground">
                        <Mail className="size-3.5 shrink-0 text-primary" strokeWidth={2.25} aria-hidden />
                        {maskedEmail}
                      </p>
                    ) : null}
                  </div>
                </div>

                {error ? <FieldMessage variant="error" message={error} /> : null}

                <AuthSubmitFooter className="pt-0">
                  <Button
                    type="button"
                    className="w-full"
                    disabled={sendingOtp}
                    onClick={() => void handleContinueToVerify()}
                  >
                    {sendingOtp ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> : null}
                    {otpSent ? copy.mfa.continue : portfolioCopy.redeemConsentSendOtp}
                  </Button>
                </AuthSubmitFooter>
              </div>
            ) : null}

            {step === "verify" ? (
              <OtpConsentVerifyPanel
                className="mt-2"
                otpSent={otpSent}
                otp={otp}
                onOtpChange={(value) => {
                  setOtp(value);
                  if (error) setError("");
                }}
                sending={sendingOtp}
                onSendOtp={handleSendOtp}
                submitting={submitting}
                onConfirm={() => void handleConfirm()}
                error={error}
                confirmLabel={portfolioCopy.redeemConsentConfirm}
                infoMessage={portfolioCopy.redeemConsentEnterOtp}
              />
            ) : null}

            {step === "done" ? (
              <div className="mt-2 space-y-4">
                <OtpConsentSuccessCard
                  title={portfolioCopy.redeemConsentSuccessTitle}
                  description={portfolioCopy.redeemConsentSuccessDescription}
                />
                <AuthSubmitFooter>
                  <Button className="w-full" onClick={handleDone}>
                    {portfolioCopy.redeemConsentDone}
                  </Button>
                </AuthSubmitFooter>
              </div>
            ) : null}
          </>
        )}
      </div>
    </BrandDialog>
  );
}

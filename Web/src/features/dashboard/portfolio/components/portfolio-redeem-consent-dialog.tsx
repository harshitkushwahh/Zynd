"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { OtpInput } from "@/components/auth/auth-shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldMessage } from "@/components/ui/ui-message";
import {
  confirmMfRedemption,
  fetchMfRedemptionConsent,
  sendMfRedemptionConsentOtp,
  type MfRedemptionOrder,
} from "@/features/dashboard/portfolio/lib/portfolio-api";
import { copy } from "@/shared/config/copy";

type PortfolioRedeemConsentDialogProps = {
  open: boolean;
  order: MfRedemptionOrder | null;
  onOpenChange: (open: boolean) => void;
  onConfirmed?: (order: MfRedemptionOrder) => void;
};

export function PortfolioRedeemConsentDialog({
  open,
  order,
  onOpenChange,
  onConfirmed,
}: PortfolioRedeemConsentDialogProps) {
  const router = useRouter();
  const portfolioCopy = copy.dashboard.portfolio;
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [maskedMobile, setMaskedMobile] = useState<string | null>(null);
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !order) return;
    setOtp("");
    setError(null);
    setOtpSent(order.consent_otp_sent);
    setLoading(true);
    void fetchMfRedemptionConsent(order.order_id)
      .then((consent) => {
        setMaskedMobile(consent.masked_mobile);
        setMaskedEmail(consent.masked_email);
        setOtpSent(consent.consent_otp_sent);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : portfolioCopy.redeemConsentLoadFailed);
      })
      .finally(() => setLoading(false));
  }, [open, order, portfolioCopy.redeemConsentLoadFailed]);

  async function handleSendOtp() {
    if (!order) return;
    setSendingOtp(true);
    setError(null);
    try {
      const result = await sendMfRedemptionConsentOtp(order.order_id);
      setMaskedMobile(result.masked_mobile);
      setOtpSent(true);
      toast.success(portfolioCopy.redeemConsentOtpSent);
    } catch (err) {
      setError(err instanceof Error ? err.message : portfolioCopy.redeemConsentOtpSendFailed);
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleConfirm() {
    if (!order || otp.trim().length < 4) return;
    setSubmitting(true);
    setError(null);
    try {
      const confirmed = await confirmMfRedemption(order.order_id, otp.trim());
      toast.success(portfolioCopy.redeemConsentConfirmed);
      onConfirmed?.(confirmed);
      onOpenChange(false);
      if (confirmed.fp_redemption_id) {
        router.push(`/dashboard/portfolio?tab=redeem-units&redemption=${confirmed.fp_redemption_id}`);
      } else {
        router.push("/dashboard/portfolio?tab=redeem-units");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : portfolioCopy.redeemConsentConfirmFailed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{portfolioCopy.redeemConsentTitle}</DialogTitle>
          <DialogDescription>{portfolioCopy.redeemConsentDescription}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex min-h-28 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-[var(--radius-card)] border border-border/70 bg-muted/20 px-3.5 py-3 text-compact text-muted-foreground">
              <p>{portfolioCopy.redeemConsentFolioContact}</p>
              {maskedMobile ? (
                <p className="mt-1 font-medium text-foreground">{maskedMobile}</p>
              ) : null}
              {maskedEmail ? <p className="mt-0.5 text-caption">{maskedEmail}</p> : null}
            </div>

            {!otpSent ? (
              <Button
                type="button"
                className="w-full"
                disabled={sendingOtp}
                onClick={() => void handleSendOtp()}
              >
                {sendingOtp ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                {portfolioCopy.redeemConsentSendOtp}
              </Button>
            ) : (
              <div className="space-y-3">
                <p className="text-compact text-muted-foreground">{portfolioCopy.redeemConsentEnterOtp}</p>
                <OtpInput value={otp} onChange={setOtp} id="portfolio-redeem-consent-otp" />
                <button
                  type="button"
                  className="text-caption text-primary underline-offset-4 hover:underline"
                  disabled={sendingOtp}
                  onClick={() => void handleSendOtp()}
                >
                  {portfolioCopy.redeemConsentResendOtp}
                </button>
              </div>
            )}

            {error ? <FieldMessage variant="error" message={error} /> : null}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!otpSent || otp.trim().length < 4 || submitting}
            onClick={() => void handleConfirm()}
          >
            {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {portfolioCopy.redeemConsentConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

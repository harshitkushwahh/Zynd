"use client";

import { useMemo } from "react";

import { BrandDialog } from "@/components/ui/brand-dialog";
import { MfTransactionConsentOtpSection } from "@/features/invest/components/mf-transaction-consent-otp-section";
import {
  confirmMfSwitch,
  confirmMfSystematicPlan,
  fetchMfSwitchConsent,
  fetchMfSystematicPlanConsent,
  sendMfSwitchConsentOtp,
  sendMfSystematicPlanOtp,
} from "@/features/dashboard/portfolio/lib/portfolio-api";
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

  const handlers = useMemo(() => {
    if (!target) return null;
    if (target.kind === "switch") {
      const orderId = target.id;
      return {
        loadConsent: () => fetchMfSwitchConsent(orderId),
        sendOtp: () => sendMfSwitchConsentOtp(orderId),
        confirmOtp: (otp: string) => confirmMfSwitch(orderId, otp).then(() => undefined),
      };
    }
    const kind = target.kind;
    const planId = target.id;
    return {
      loadConsent: () => fetchMfSystematicPlanConsent(kind, planId),
      sendOtp: () => sendMfSystematicPlanOtp(kind, planId),
      confirmOtp: (otp: string) => confirmMfSystematicPlan(kind, planId, otp).then(() => undefined),
    };
  }, [target]);

  return (
    <BrandDialog open={open} onOpenChange={onOpenChange} title={portfolioCopy.holdingConsentTitle} maxWidth="md">
      <div className="px-1 pb-1 pt-0 sm:px-2">
        {handlers ? (
          <MfTransactionConsentOtpSection
            active={open}
            loadConsent={handlers.loadConsent}
            sendOtp={handlers.sendOtp}
            confirmOtp={handlers.confirmOtp}
            onConfirmed={onConfirmed}
            onDismiss={() => onOpenChange(false)}
            className="px-3 sm:px-4"
          />
        ) : null}
      </div>
    </BrandDialog>
  );
}

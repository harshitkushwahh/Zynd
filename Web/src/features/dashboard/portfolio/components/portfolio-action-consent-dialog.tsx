"use client";

import { useMemo, useRef } from "react";

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
  onAbandon?: (target: ActionConsentTarget) => void;
};

export function PortfolioActionConsentDialog({
  open,
  target,
  onOpenChange,
  onConfirmed,
  onAbandon,
}: PortfolioActionConsentDialogProps) {
  const portfolioCopy = copy.dashboard.portfolio;
  const confirmedRef = useRef(false);

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

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      if (!confirmedRef.current && target && onAbandon) {
        onAbandon(target);
      }
      confirmedRef.current = false;
    }
    onOpenChange(nextOpen);
  }

  return (
    <BrandDialog open={open} onOpenChange={handleOpenChange} title={portfolioCopy.holdingConsentTitle} maxWidth="md">
      <div className="px-1 pb-1 pt-0 sm:px-2">
        {handlers ? (
          <MfTransactionConsentOtpSection
            active={open}
            loadConsent={handlers.loadConsent}
            sendOtp={handlers.sendOtp}
            confirmOtp={handlers.confirmOtp}
            onConfirmed={() => {
              confirmedRef.current = true;
              onConfirmed?.();
            }}
            onDismiss={() => handleOpenChange(false)}
            className="px-3 sm:px-4"
          />
        ) : null}
      </div>
    </BrandDialog>
  );
}

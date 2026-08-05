"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import type { QuickTransactionWizardStepId } from "@/components/quick-transaction/quick-transaction-wizard-types";

/** Minimum panel skeleton time so step switches feel intentional, not flickery. */
export const QUICK_TXN_STEP_SWITCH_MIN_MS = 280;

type UseQuickTransactionStepSwitchOptions = {
  initialStep?: QuickTransactionWizardStepId;
};

export function useQuickTransactionStepSwitch({
  initialStep = "type",
}: UseQuickTransactionStepSwitchOptions = {}) {
  const [step, setStep] = useState<QuickTransactionWizardStepId>(initialStep);
  const [displayStep, setDisplayStep] = useState<QuickTransactionWizardStepId>(initialStep);
  const [showPanelSkeleton, setShowPanelSkeleton] = useState(false);
  const [isPending, startTransition] = useTransition();
  const switchStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!showPanelSkeleton || displayStep !== step) return;

    const started = switchStartedAtRef.current ?? Date.now();
    const elapsed = Date.now() - started;
    const remaining = Math.max(0, QUICK_TXN_STEP_SWITCH_MIN_MS - elapsed);

    const id = window.setTimeout(() => {
      setShowPanelSkeleton(false);
      switchStartedAtRef.current = null;
    }, remaining);

    return () => window.clearTimeout(id);
  }, [showPanelSkeleton, displayStep, step]);

  const goToStep = useCallback(
    (next: QuickTransactionWizardStepId) => {
      if (next === displayStep && !showPanelSkeleton && next === step) return;

      setDisplayStep(next);
      setShowPanelSkeleton(true);
      switchStartedAtRef.current = Date.now();

      startTransition(() => {
        setStep(next);
      });
    },
    [displayStep, showPanelSkeleton, step],
  );

  return {
    step,
    displayStep,
    goToStep,
    isSwitching: showPanelSkeleton || isPending,
    showPanelSkeleton,
  };
}

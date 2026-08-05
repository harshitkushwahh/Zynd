"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import type { AddInvestorStepId } from "@/lib/add-investor/add-investor-journey";

/** Minimum panel skeleton time so step switches feel intentional, not flickery. */
export const ADD_INVESTOR_STEP_SWITCH_MIN_MS = 280;

type UseAddInvestorStepSwitchOptions = {
  initialStep?: AddInvestorStepId;
};

export function useAddInvestorStepSwitch({
  initialStep = "onboarding",
}: UseAddInvestorStepSwitchOptions = {}) {
  const [stepId, setStepId] = useState<AddInvestorStepId>(initialStep);
  const [displayStepId, setDisplayStepId] = useState<AddInvestorStepId>(initialStep);
  const [showPanelSkeleton, setShowPanelSkeleton] = useState(false);
  const [isPending, startTransition] = useTransition();
  const switchStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!showPanelSkeleton || displayStepId !== stepId) return;

    const started = switchStartedAtRef.current ?? Date.now();
    const elapsed = Date.now() - started;
    const remaining = Math.max(0, ADD_INVESTOR_STEP_SWITCH_MIN_MS - elapsed);

    const id = window.setTimeout(() => {
      setShowPanelSkeleton(false);
      switchStartedAtRef.current = null;
    }, remaining);

    return () => window.clearTimeout(id);
  }, [showPanelSkeleton, displayStepId, stepId]);

  const goToStep = useCallback(
    (next: AddInvestorStepId) => {
      if (next === displayStepId && !showPanelSkeleton && next === stepId) return;

      setDisplayStepId(next);
      setShowPanelSkeleton(true);
      switchStartedAtRef.current = Date.now();

      startTransition(() => {
        setStepId(next);
      });
    },
    [displayStepId, showPanelSkeleton, stepId],
  );

  return {
    stepId,
    displayStepId,
    goToStep,
    isSwitching: showPanelSkeleton || isPending,
    showPanelSkeleton,
  };
}

"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { RecommendFundsFullPageShell } from "@/components/dashboard/recommend-funds-full-page-shell";
import { RecommendFundsPageSuccessView } from "@/components/dashboard/recommend-funds-page-success-view";
import {
  RecommendFundsInteractivePanel,
  useRecommendFundsInteractiveState,
} from "@/components/dashboard/recommend-funds-hover-card";
import { RecommendFundsKycRequiredPage } from "@/components/dashboard/recommend-funds-kyc-unlock-overlay";
import { RecommendFundsRiskLockedFullPage } from "@/components/dashboard/recommend-funds-risk-locked-body";
import { useKycOptional } from "@/contexts/kyc-context";
import { FUNDS_FOR_YOU_HREF } from "@/features/recommendations/lib/funds-for-you-navigation";
import { copy } from "@/shared/config/copy";

export function RecommendFundsPageView() {
  const router = useRouter();
  const navbarCopy = copy.navbar.recommendFunds;
  const kyc = useKycOptional();
  const state = useRecommendFundsInteractiveState(true);

  const handleClose = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/dashboard");
  }, [router]);

  const handleCompleteKyc = useCallback(() => {
    kyc?.openDialog();
  }, [kyc]);

  const closeLabel = navbarCopy.kycOverlay.closeLabel;

  if (state.contentState === "loading") {
    return null;
  }

  if (
    state.contentState === "blocked" &&
    state.data?.block_reason === "kyc_required"
  ) {
    return (
      <RecommendFundsKycRequiredPage onClose={handleClose} onCompleteKyc={handleCompleteKyc} />
    );
  }

  if (
    state.contentState === "blocked" &&
    state.data?.block_reason === "risk_profile_required"
  ) {
    return (
      <RecommendFundsRiskLockedFullPage onClose={handleClose} closeLabel={closeLabel} />
    );
  }

  const showCuratedExperience =
    state.contentState === "success" ||
    state.contentState === "error" ||
    state.contentState === "sign_in" ||
    (state.contentState === "blocked" &&
      state.data?.block_reason !== "kyc_required" &&
      state.data?.block_reason !== "risk_profile_required");

  if (!showCuratedExperience) {
    return null;
  }

  if (state.contentState === "success" && state.data) {
    return (
      <RecommendFundsFullPageShell
        onClose={handleClose}
        closeLabel={closeLabel}
        contentClassName="rf-funds-page-content-dashboard"
      >
        <RecommendFundsPageSuccessView data={state.data} />
      </RecommendFundsFullPageShell>
    );
  }

  return (
    <RecommendFundsFullPageShell onClose={handleClose} closeLabel={closeLabel}>
      <div className="recommend-funds-popover-border-glow recommend-funds-popover-border-glow-open w-full overflow-hidden rounded-[1.875rem] bg-[#3B0764]">
        <RecommendFundsInteractivePanel {...state} />
      </div>
    </RecommendFundsFullPageShell>
  );
}

export { FUNDS_FOR_YOU_HREF };

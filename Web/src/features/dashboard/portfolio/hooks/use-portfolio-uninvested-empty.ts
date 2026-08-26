"use client";

import {
  usePortfolioHoldingsQuery,
  usePortfolioSummaryQuery,
} from "@/features/dashboard/portfolio/hooks/use-portfolio-queries";
import { copy } from "@/shared/config/copy";

export function usePortfolioUninvestedEmpty() {
  const portfolioCopy = copy.dashboard.portfolio;
  const {
    holdings,
    hasResolved: holdingsResolved,
    status: holdingsStatus,
    hasPendingOrders,
  } = usePortfolioHoldingsQuery();
  const { summary, hasResolved: summaryResolved } = usePortfolioSummaryQuery();

  const hasResolved = holdingsResolved && summaryResolved;
  const hasInvestments = holdings.length > 0;
  const isProcessing =
    !hasInvestments &&
    Boolean(summary) &&
    (summary.status === "processing" || hasPendingOrders);

  return {
    hasResolved,
    hasInvestments,
    isProcessing,
    showProcessingEmpty: hasResolved && isProcessing,
    showUninvestedEmpty: hasResolved && !hasInvestments && !isProcessing,
    uninvestedTitle: portfolioCopy.overviewEmptyTitle,
    uninvestedDescription:
      holdingsStatus === "no_mfia" || holdingsStatus === "mfia_not_ready"
        ? portfolioCopy.overviewMfiaPendingDescription
        : portfolioCopy.overviewEmptyDescription,
    processingTitle: portfolioCopy.overviewProcessingTitle,
    processingDescription: portfolioCopy.overviewProcessingDescription,
  };
}

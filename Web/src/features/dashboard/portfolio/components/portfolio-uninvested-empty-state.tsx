"use client";

import { Clock } from "lucide-react";

import { PortfolioTabEmptyState } from "@/features/dashboard/portfolio/components/portfolio-tab-empty-state";
import { usePortfolioUninvestedEmpty } from "@/features/dashboard/portfolio/hooks/use-portfolio-uninvested-empty";
import { getPortfolioTabMeta } from "@/features/dashboard/portfolio/lib/portfolio-page-tab-meta";

export function PortfolioUninvestedEmptyState() {
  const overviewTabMeta = getPortfolioTabMeta("overview");
  const {
    showProcessingEmpty,
    showUninvestedEmpty,
    processingTitle,
    processingDescription,
    uninvestedTitle,
    uninvestedDescription,
  } = usePortfolioUninvestedEmpty();

  if (showProcessingEmpty) {
    return (
      <PortfolioTabEmptyState
        icon={Clock}
        title={processingTitle}
        description={processingDescription}
      />
    );
  }

  if (showUninvestedEmpty) {
    return (
      <PortfolioTabEmptyState
        icon={overviewTabMeta.icon}
        title={uninvestedTitle}
        description={uninvestedDescription}
      />
    );
  }

  return null;
}

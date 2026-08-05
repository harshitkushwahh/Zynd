"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { FieldMessage } from "@/components/ui/ui-message";
import { FundEligibilityBanner } from "@/features/account/mfa/components/fund-eligibility-banner";
import {
  type InvestFundSummary,
  type InvestHomeResponse,
} from "@/features/invest/api/invest-api";
import { MfBreadcrumb } from "@/features/invest/components/mf-breadcrumb";
import { MfBrowseCategoryTabs } from "@/features/invest/components/mf-browse-category-tabs";
import { MfCollectionCards } from "@/features/invest/components/mf-collection-cards";
import { MfDashboardSidebar } from "@/features/invest/components/mf-dashboard-sidebar";
import { MutualFundsPageSkeleton } from "@/features/invest/components/mf-mutual-funds-catalog-skeleton";
import { MfPopularFundsSection } from "@/features/invest/components/mf-popular-funds-section";
import { useInvestHomeQuery } from "@/features/invest/hooks/use-invest-home-query";
import { mfFundHref } from "@/features/invest/lib/mf-fund-url";
import { MF_PAGE_SECTION_CLASS } from "@/features/invest/lib/mf-ui";
import { copy } from "@/shared/config/copy";

function BrowseHome({
  data,
  error,
  onSelectFund,
}: {
  data: InvestHomeResponse;
  error: string | null;
  onSelectFund: (fund: InvestFundSummary) => void;
}) {
  return (
    <div className="min-w-0 space-y-10">
      {error ? <FieldMessage variant="error" message={error} /> : null}

      {!error && data.categories.length === 0 ? (
        <div className="flex min-h-[160px] items-center justify-center rounded-[var(--radius-medium)] border border-dashed border-border px-6 text-center">
          <p className="text-compact text-muted-foreground">{copy.mutualFunds.catalogEmpty}</p>
        </div>
      ) : null}

      {data.popular_funds && data.popular_funds.length > 0 ? (
        <MfPopularFundsSection funds={data.popular_funds} onSelectFund={onSelectFund} />
      ) : null}

      {data.collections && data.collections.length > 0 ? (
        <MfCollectionCards collections={data.collections} />
      ) : null}

      {data.categories && data.categories.length > 0 ? (
        <MfBrowseCategoryTabs categories={data.categories} onSelectFund={onSelectFund} />
      ) : null}
    </div>
  );
}

export function MutualFundsCatalogPanel() {
  const router = useRouter();
  const { homeData, showSkeleton, errorMessage } = useInvestHomeQuery();

  const openFund = useCallback(
    (fund: InvestFundSummary) => {
      router.push(mfFundHref(fund));
    },
    [router],
  );

  if (showSkeleton) {
    return (
      <div className={MF_PAGE_SECTION_CLASS}>
        <MutualFundsPageSkeleton />
      </div>
    );
  }

  return (
    <div className={MF_PAGE_SECTION_CLASS}>
      <MfBreadcrumb />
      <FundEligibilityBanner />

      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1">
          {errorMessage && !homeData ? (
            <FieldMessage variant="error" message={errorMessage} />
          ) : homeData ? (
            <BrowseHome data={homeData} error={errorMessage} onSelectFund={openFund} />
          ) : null}
        </div>

        <MfDashboardSidebar />
      </div>
    </div>
  );
}

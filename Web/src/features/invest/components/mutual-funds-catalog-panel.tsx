"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { FieldMessage } from "@/components/ui/ui-message";
import { fetchInvestHome, type InvestHomeResponse } from "@/features/invest/api/invest-api";
import { MfBreadcrumb } from "@/features/invest/components/mf-breadcrumb";
import { MfBrowseCategoryTabs } from "@/features/invest/components/mf-browse-category-tabs";
import { MfCollectionCards } from "@/features/invest/components/mf-collection-cards";
import { MfDashboardSidebar } from "@/features/invest/components/mf-dashboard-sidebar";
import { MfPopularFundsSection } from "@/features/invest/components/mf-popular-funds-section";
import { MF_PAGE_SECTION_CLASS } from "@/features/invest/lib/mf-ui";
import { copy } from "@/shared/config/copy";

function BrowseHome({
  data,
  loading,
  error,
  onSelectFund,
}: {
  data: InvestHomeResponse | null;
  loading: boolean;
  error: string | null;
  onSelectFund: (productId: string) => void;
}) {
  return (
    <div className="min-w-0 space-y-10">
      {error ? <FieldMessage variant="error" message={error} /> : null}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {copy.mutualFunds.loadingCatalog}
        </div>
      ) : null}

      {!loading && !error && data?.categories.length === 0 ? (
        <div className="flex min-h-[160px] items-center justify-center rounded-[var(--radius-medium)] border border-dashed border-border px-6 text-center">
          <p className="text-compact text-muted-foreground">{copy.mutualFunds.catalogEmpty}</p>
        </div>
      ) : null}

      {!loading && data?.popular_funds && data.popular_funds.length > 0 ? (
        <MfPopularFundsSection funds={data.popular_funds} onSelectFund={onSelectFund} />
      ) : null}

      {!loading && data?.collections && data.collections.length > 0 ? (
        <MfCollectionCards collections={data.collections} />
      ) : null}

      {!loading && data?.categories && data.categories.length > 0 ? (
        <MfBrowseCategoryTabs categories={data.categories} onSelectFund={onSelectFund} />
      ) : null}
    </div>
  );
}

export function MutualFundsCatalogPanel() {
  const router = useRouter();
  const [homeData, setHomeData] = useState<InvestHomeResponse | null>(null);
  const [homeLoading, setHomeLoading] = useState(true);
  const [homeError, setHomeError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setHomeLoading(true);
    fetchInvestHome()
      .then((response) => {
        if (!cancelled) setHomeData(response);
      })
      .catch((err: Error) => {
        if (!cancelled) setHomeError(err.message || copy.mutualFunds.catalogLoadError);
      })
      .finally(() => {
        if (!cancelled) setHomeLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const openFund = useCallback(
    (productId: string) => {
      router.push(`/dashboard/mutual-funds/funds/${productId}`);
    },
    [router],
  );

  return (
    <div className={MF_PAGE_SECTION_CLASS}>
      <MfBreadcrumb />

      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1">
          <BrowseHome
            data={homeData}
            loading={homeLoading}
            error={homeError}
            onSelectFund={openFund}
          />
        </div>

        <MfDashboardSidebar />
      </div>
    </div>
  );
}

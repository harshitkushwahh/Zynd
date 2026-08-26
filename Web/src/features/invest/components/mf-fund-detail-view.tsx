"use client";

import { useEffect, useState, type ReactNode } from "react";
import { LineChart } from "lucide-react";
import { useRouter } from "next/navigation";

import { LoadErrorCard } from "@/components/ui/load-error-card";
import { DashboardContentFade } from "@/components/dashboard/dashboard-content-fade";
import { FundEligibilityBanner } from "@/features/account/mfa/components/fund-eligibility-banner";
import { MfFundDetailHeader } from "@/features/invest/components/mf-fund-detail-header";
import { MfFundCalculatorCard } from "@/features/invest/components/mf-fund-calculator-card";
import { MfFundDetailSkeleton } from "@/features/invest/components/mf-fund-detail-skeleton";
import { MfFundPerformanceSection } from "@/features/invest/components/mf-fund-performance-section";
import { MfFundReturnsCard } from "@/features/invest/components/mf-fund-returns-card";
import { MfComplianceDetailsCard } from "@/features/invest/components/mf-compliance-details-card";
import { MfFundDisclaimerNotice } from "@/features/invest/components/mf-fund-disclaimer-notice";
import { MfFundFactsCard, shouldShowFundFacts } from "@/features/invest/components/mf-fund-facts-card";
import { MfInvestmentDetailsCard } from "@/features/invest/components/mf-investment-details-card";
import { MfInvestPaymentCard } from "@/features/invest/components/mf-invest-payment-card";
import { MF_PAGE_SECTION_CLASS, MF_FUND_DETAIL_RADIUS_CLASS, MF_INVEST_SIDEBAR_STICKY_CLASS, MF_INVEST_SIDEBAR_WIDTH_CLASS } from "@/features/invest/lib/mf-ui";
import { mfFundHref, isFundUuid } from "@/features/invest/lib/mf-fund-url";
import type { MfNavRange } from "@/features/invest/lib/mf-nav-history";
import {
  fetchInvestConfig,
  fetchInvestFundDetail,
  fetchInvestFundNavs,
  fetchInvestReturnCalculator,
  type InvestConfig,
  type InvestFundDetail,
  type InvestFundNavHistory,
  type InvestReturnCalculator,
} from "@/features/invest/api/invest-api";
import { useAuth } from "@/contexts/auth-context";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type MfFundDetailViewProps = {
  fundSlug: string;
  renderBreadcrumb?: (fundName: string | null) => ReactNode;
};

const NAV_HISTORY_LIMIT = 2000;

function resolveFundDetailError(message: string | null | undefined) {
  if (!message || message === "Request failed") {
    return copy.mutualFunds.fundDetailLoadError;
  }
  return message;
}

export function MfFundDetailView({ fundSlug, renderBreadcrumb }: MfFundDetailViewProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [fund, setFund] = useState<InvestFundDetail | null>(null);
  const [navHistory, setNavHistory] = useState<InvestFundNavHistory | null>(null);
  const [calculator, setCalculator] = useState<InvestReturnCalculator | null>(null);
  const [config, setConfig] = useState<InvestConfig | null>(null);
  const [chartRange, setChartRange] = useState<MfNavRange>("1y");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setFund(null);
    setNavHistory(null);
    setCalculator(null);

    Promise.all([
      fetchInvestFundDetail(fundSlug),
      fetchInvestFundNavs(fundSlug, NAV_HISTORY_LIMIT),
      fetchInvestReturnCalculator(fundSlug, { amount_inr: 10_000, mode: "lumpsum" }),
      fetchInvestConfig(),
    ])
      .then(([detail, navs, calc, investConfig]) => {
        if (cancelled) return;
        setFund(detail);
        setNavHistory(navs);
        setCalculator(calc);
        setConfig(investConfig);
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message || copy.mutualFunds.fundDetailLoadError);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fundSlug, reloadKey]);

  useEffect(() => {
    if (!fund?.slug) return;
    if (fundSlug === fund.slug) return;
    if (isFundUuid(fundSlug) || decodeURIComponent(fundSlug) !== fund.slug) {
      router.replace(mfFundHref(fund), { scroll: false });
    }
  }, [fund, fundSlug, router]);

  const canInvest = Boolean(user?.fund_movement_eligible && config?.orders_enabled);

  if (loading) {
    return (
      <>
        {renderBreadcrumb?.(null)}
        <MfFundDetailSkeleton showBreadcrumb={false} />
      </>
    );
  }

  if (error || !fund) {
    return (
      <div className={MF_PAGE_SECTION_CLASS}>
        {renderBreadcrumb?.(null)}
        <DashboardContentFade>
          <LoadErrorCard
            icon={LineChart}
            title={copy.mutualFunds.fundDetailLoadFailedTitle}
            description={resolveFundDetailError(error ?? copy.mutualFunds.fundUnavailable)}
            retryLabel={copy.mutualFunds.retry}
            retryLoading={loading}
            onRetry={() => setReloadKey((current) => current + 1)}
          />
        </DashboardContentFade>
      </div>
    );
  }

  const investCard = (
    <MfInvestPaymentCard
      sticky={false}
      showFundName={false}
      fundName={fund.name}
      productId={fund.product_id}
      minLumpsumAmountInr={fund.min_lumpsum_amount_inr}
      minSipAmountInr={fund.min_sip_amount_inr}
      preview={false}
      canInvest={canInvest}
      sipEnabled={(config?.sip_enabled ?? false) && fund.sip_allowed === true}
      className={cn(MF_FUND_DETAIL_RADIUS_CLASS, "w-full")}
    />
  );

  return (
    <DashboardContentFade className="w-full min-w-0 max-w-full space-y-6">
      {renderBreadcrumb?.(fund.name)}

      {user && !user.fund_movement_eligible ? <FundEligibilityBanner /> : null}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-6">
          <MfFundDetailHeader fund={fund} />

          <div className="lg:hidden">{investCard}</div>

          <MfFundPerformanceSection
            fund={fund}
            navHistory={navHistory}
            chartRange={chartRange}
            onChartRangeChange={setChartRange}
          />

          <MfFundCalculatorCard fund={fund} initialCalculator={calculator} />

          <MfFundReturnsCard
            returns={fund.returns}
            selectedRange={chartRange}
            onRangeSelect={setChartRange}
            navPoints={navHistory?.points}
          />

          {fund.investment_details ? (
            <MfInvestmentDetailsCard details={fund.investment_details} />
          ) : null}

          {fund.compliance ? <MfComplianceDetailsCard compliance={fund.compliance} /> : null}

          {shouldShowFundFacts(fund) ? <MfFundFactsCard fund={fund} /> : null}

          <MfFundDisclaimerNotice
            disclaimer={fund.disclaimer ?? config?.disclaimer}
            distributorArn={fund.distributor_arn}
            distributorEuin={fund.distributor_euin}
          />
        </div>

        <aside
          className={cn(
            MF_INVEST_SIDEBAR_WIDTH_CLASS,
            MF_INVEST_SIDEBAR_STICKY_CLASS,
            "hidden lg:block",
          )}
        >
          {investCard}
        </aside>
      </div>
    </DashboardContentFade>
  );
}

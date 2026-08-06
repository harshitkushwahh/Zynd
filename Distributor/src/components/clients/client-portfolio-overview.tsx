"use client";

import {
  Banknote,
  ChartLine,
  Coins,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

import { ClientPortfolioValueChart } from "@/components/clients/client-portfolio-value-chart";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import type { DistributorClientProfile } from "@/lib/distributor-types";
import { formatAum, formatPortfolioMetricAmount } from "@/lib/format";
import { cn } from "@/lib/utils";

type PortfolioTotals = {
  current: number;
  invested: number;
  returns: number;
  redeemable: number;
};

type ClientPortfolioOverviewProps = {
  clientId: string;
  profile: DistributorClientProfile;
  totals: PortfolioTotals;
};

function PortfolioMetricCard({
  icon: Icon,
  label,
  amount,
  hint,
  accent = false,
}: {
  icon: LucideIcon;
  label: string;
  amount: number;
  hint?: string;
  accent?: boolean;
}) {
  const value = formatPortfolioMetricAmount(amount);
  const valueTitle = formatAum(amount);

  return (
    <article
      className={cn(
        "distributor-client-portfolio-overview__metric",
        accent
          ? "distributor-client-portfolio-overview__metric--accent"
          : "distributor-client-portfolio-overview__metric--default",
      )}
    >
      <span
        className={cn(
          "distributor-client-portfolio-overview__metric-icon",
          accent && "distributor-client-portfolio-overview__metric-icon--accent",
        )}
        aria-hidden
      >
        <Icon strokeWidth={2.25} />
      </span>
      <p className="distributor-client-portfolio-overview__metric-label">{label}</p>
      <p
        className="distributor-client-portfolio-overview__metric-value tabular-nums"
        title={valueTitle}
      >
        {value}
      </p>
      {hint ? <p className="distributor-client-portfolio-overview__metric-hint">{hint}</p> : null}
    </article>
  );
}

export function ClientPortfolioOverview({
  clientId,
  profile,
  totals,
}: ClientPortfolioOverviewProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.portfolio;
  const schemeCount = profile.holdings.length;
  const returnsPct =
    totals.invested > 0 ? Math.round((totals.returns / totals.invested) * 100) : 0;
  const returnsHint =
    totals.invested > 0
      ? `${returnsPct >= 0 ? "+" : ""}${returnsPct}% vs cost`
      : "No cost basis yet";

  return (
    <div className="distributor-client-portfolio-overview">
      <div className="distributor-client-portfolio-overview__metrics">
        <PortfolioMetricCard
          accent
          icon={ChartLine}
          label={copy.currentValue}
          amount={totals.current}
          hint={`${copy.invested}: ${formatPortfolioMetricAmount(totals.invested)}`}
        />
        <PortfolioMetricCard
          icon={Coins}
          label={copy.invested}
          amount={totals.invested}
          hint={
            schemeCount === 1
              ? "1 scheme in portfolio"
              : schemeCount > 0
                ? `${schemeCount} schemes in portfolio`
                : "No holdings yet"
          }
        />
        <PortfolioMetricCard
          icon={TrendingUp}
          label={copy.totalReturns}
          amount={totals.returns}
          hint={returnsHint}
        />
        <PortfolioMetricCard
          icon={Banknote}
          label={copy.redeemableValue}
          amount={totals.redeemable}
          hint={
            totals.current > 0
              ? `${Math.round((totals.redeemable / totals.current) * 100)}% of current value`
              : "Redeemable when invested"
          }
        />
      </div>
      <ClientPortfolioValueChart
        clientId={clientId}
        currentValue={totals.current}
        investedAmount={totals.invested}
        className="distributor-client-portfolio-overview__chart"
      />
    </div>
  );
}

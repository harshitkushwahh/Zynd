"use client";

import type { LucideIcon } from "lucide-react";

import { ClientDetailEmptyState } from "@/components/clients/client-detail-empty-state";
import type { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import type { DistributorClientHolding } from "@/lib/dummy/types";
import {
  formatAum,
  formatDistributorDate,
  formatDistributorNav,
  formatDistributorUnits,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { DISTRIBUTOR_LABEL_CAPS_CLASS } from "@/lib/distributor-layout";

type PortfolioCopy = (typeof DISTRIBUTOR_CLIENT_COPY)["portfolio"];

function holdingReturns(holding: DistributorClientHolding) {
  const amount = holding.currentValue - holding.investedAmount;
  const pct =
    holding.investedAmount > 0 ? (amount / holding.investedAmount) * 100 : 0;
  return { amount, pct };
}

function HoldingMetric({
  label,
  value,
  valueClassName,
  subValue,
  subValueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  subValue?: string;
  subValueClassName?: string;
}) {
  return (
    <div className="min-w-0 lg:text-right">
      <p className={cn(DISTRIBUTOR_LABEL_CAPS_CLASS, "lg:sr-only")}>
        {label}
      </p>
      <p
        className={cn(
          "text-compact font-medium tabular-nums text-foreground",
          valueClassName,
        )}
      >
        {value}
      </p>
      {subValue ? (
        <p className={cn("text-caption tabular-nums text-muted-foreground", subValueClassName)}>
          {subValue}
        </p>
      ) : null}
    </div>
  );
}

function HoldingsTableHeader({ copy }: { copy: PortfolioCopy }) {
  const columns = [
    { label: copy.holdingsColumnScheme, align: "left" as const },
    { label: copy.holdingsColumnUnits, align: "right" as const },
    { label: copy.holdingsColumnNav, align: "right" as const },
    { label: copy.holdingsColumnInvested, align: "right" as const },
    { label: copy.holdingsColumnCurrent, align: "right" as const },
    { label: copy.holdingsColumnRedeemable, align: "right" as const },
    { label: copy.holdingsColumnReturns, align: "right" as const },
  ];

  return (
    <div className="hidden border-t border-border bg-muted/30 lg:grid lg:grid-cols-[minmax(0,2fr)_repeat(6,minmax(0,1fr))] lg:gap-3 lg:px-4 lg:py-2.5">
      {columns.map((column) => (
        <p
          key={column.label}
          className={cn(
            DISTRIBUTOR_LABEL_CAPS_CLASS,
            column.align === "right" && "text-right",
          )}
        >
          {column.label}
        </p>
      ))}
    </div>
  );
}

function ClientPortfolioHoldingRow({
  holding,
  copy,
}: {
  holding: DistributorClientHolding;
  copy: PortfolioCopy;
}) {
  const returns = holdingReturns(holding);
  const returnsPositive = returns.amount >= 0;
  const schemeSubtitle = [
    holding.amcName ?? copy.holdingsUnknownAmc,
    holding.folioNumber ? copy.holdingsFolio(holding.folioNumber) : null,
    holding.asOfDate
      ? copy.holdingsAsOf(formatDistributorDate(holding.asOfDate))
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const navDisplay =
    holding.navPerUnit != null && holding.navPerUnit > 0
      ? formatDistributorNav(holding.navPerUnit)
      : "—";

  return (
    <li className="border-t border-border px-4 py-4 first:border-t-0 lg:py-3">
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,2fr)_repeat(6,minmax(0,1fr))] lg:items-center lg:gap-3">
        <div className="min-w-0">
          <p className="text-compact font-medium leading-snug text-foreground">
            {holding.schemeName}
          </p>
          <p className="mt-1 text-caption leading-snug text-muted-foreground">{schemeSubtitle}</p>
          {holding.isin ? (
            <p className="mt-0.5 font-mono text-micro text-muted-foreground">{holding.isin}</p>
          ) : null}
        </div>

        <HoldingMetric
          label={copy.holdingsColumnUnits}
          value={formatDistributorUnits(holding.units)}
        />
        <HoldingMetric label={copy.holdingsColumnNav} value={navDisplay} />
        <HoldingMetric
          label={copy.holdingsColumnInvested}
          value={formatAum(holding.investedAmount)}
        />
        <HoldingMetric
          label={copy.holdingsColumnCurrent}
          value={formatAum(holding.currentValue)}
        />
        <HoldingMetric
          label={copy.holdingsColumnRedeemable}
          value={formatAum(holding.redeemableValue)}
        />
        <HoldingMetric
          label={copy.holdingsColumnReturns}
          value={formatAum(returns.amount)}
          subValue={`${returnsPositive ? "+" : ""}${returns.pct.toFixed(2)}%`}
          valueClassName={returnsPositive ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}
          subValueClassName={returnsPositive ? "text-emerald-600/90 dark:text-emerald-400/90" : "text-destructive/90"}
        />
      </div>
    </li>
  );
}

export function ClientPortfolioHoldingsList({
  holdings,
  copy,
  emptyMessage,
  emptyIcon: EmptyIcon,
}: {
  holdings: DistributorClientHolding[];
  copy: PortfolioCopy;
  emptyMessage?: string;
  emptyIcon?: LucideIcon;
}) {
  if (holdings.length === 0) {
    return (
      <div>
        <HoldingsTableHeader copy={copy} />
        {emptyMessage && EmptyIcon ? (
          <ClientDetailEmptyState message={emptyMessage} icon={EmptyIcon} />
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <HoldingsTableHeader copy={copy} />
      <ul>
        {holdings.map((holding) => (
          <ClientPortfolioHoldingRow key={holding.id} holding={holding} copy={copy} />
        ))}
      </ul>
    </div>
  );
}

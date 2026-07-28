"use client";

import type { InvestFundDetail } from "@/features/invest/api/invest-api";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  MfFundCategoryBadge,
  resolveMfFundCategoryKind,
} from "@/features/invest/components/mf-fund-category-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatDate,
  formatInr,
  formatNav,
  formatSignedReturn,
  healthBadgeLabel,
  resolveInvestAssetUrl,
} from "@/features/invest/lib/mf-format";
import { cn } from "@/lib/utils";
import { copy } from "@/shared/config/copy";

type MfFundDetailHeaderProps = {
  fund: InvestFundDetail;
};

function metricNa(value: string) {
  return value === "—" ? "NA" : value;
}

function MetricItem({
  label,
  value,
  sub,
  valueClassName,
}: {
  label: string;
  value: string;
  sub?: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col justify-center px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-body font-semibold tabular-nums leading-none", valueClassName)}>{value}</p>
      {sub ? <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

export function MfFundDetailHeader({ fund }: MfFundDetailHeaderProps) {
  const logoUrl = resolveInvestAssetUrl(fund.amc_logo_url);
  const dayReturn = formatSignedReturn(fund.returns.return_1d);
  const categoryLabel = fund.content?.risk_label ?? fund.sebi_category;
  const categoryKind = resolveMfFundCategoryKind(categoryLabel);

  return (
    <div className="space-y-3">
      <Card className="overflow-hidden rounded-[var(--radius-medium)] border-0 bg-transparent py-0 shadow-none ring-0">
        <CardHeader className="space-y-3 bg-transparent px-0 py-0">
          <div className="flex min-w-0 items-start gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                className="size-11 shrink-0 rounded-[var(--radius-control)] border border-border bg-background object-contain p-1 sm:size-12"
              />
            ) : (
              <div className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-border bg-muted text-caption font-semibold text-muted-foreground sm:size-12">
                {fund.amc_name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {categoryLabel ? (
                  categoryKind ? (
                    <MfFundCategoryBadge kind={categoryKind} label={categoryLabel} showLabel />
                  ) : (
                    <Badge variant="outline" className="text-[11px]">
                      {categoryLabel}
                    </Badge>
                  )
                ) : null}
                {fund.isin ? (
                  <Badge variant="outline" className="text-[11px] font-normal">
                    ISIN {fund.isin}
                  </Badge>
                ) : null}
                {fund.content?.hero_badge ? (
                  <Badge variant="secondary" className="text-[11px]">
                    {fund.content.hero_badge}
                  </Badge>
                ) : null}
                {fund.health_badges?.map((flag) => (
                  <StatusBadge key={flag} variant="warning" className="text-[11px]">
                    {healthBadgeLabel(flag)}
                  </StatusBadge>
                ))}
              </div>
              <div>
                <CardTitle className="text-h3 leading-snug">{fund.name}</CardTitle>
                <CardDescription className="mt-1 text-caption">
                  {fund.content?.amc_marketing_name ?? fund.amc_name}
                  {fund.amc_aum_rank?.label ? ` · ${fund.amc_aum_rank.label}` : ""}
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card className="overflow-hidden rounded-[var(--radius-medium)] border border-border">
        <CardContent className="p-0">
          <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
            <MetricItem
              label="Latest NAV"
              value={metricNa(formatNav(fund.latest_nav))}
              sub={metricNa(formatDate(fund.latest_nav_date))}
              valueClassName="text-foreground"
            />
            <MetricItem
              label="1 day change"
              value={metricNa(dayReturn.text)}
              sub={fund.returns.return_1d != null ? copy.mutualFunds.fundDayChangeSub : "NA"}
              valueClassName={cn(
                dayReturn.tone === "positive" && "text-success",
                dayReturn.tone === "negative" && "text-destructive",
                dayReturn.tone === "muted" && "text-muted-foreground",
              )}
            />
            <MetricItem
              label="AUM"
              value={metricNa(formatInr(fund.aum_inr, { compact: true }))}
              sub={fund.aum_as_of ? `as of ${formatDate(fund.aum_as_of)}` : "NA"}
            />
            <MetricItem
              label="TER"
              value={fund.ter_percent != null ? `${fund.ter_percent.toFixed(2)}%` : "NA"}
              sub={fund.ter_as_of ? `as of ${formatDate(fund.ter_as_of)}` : "NA"}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

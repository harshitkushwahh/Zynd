"use client";

import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, GitCompare, Loader2, TableProperties } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FieldMessage } from "@/components/ui/ui-message";
import {
  compareMfFunds,
  type InvestFundDetail,
  type InvestFundSummary,
} from "@/features/invest/api/invest-api";
import { MfCalculatorDisclaimer } from "@/features/invest/components/mf-calculator-disclaimer";
import { MfFundPicker } from "@/features/invest/components/mf-fund-picker";
import { MfToolsPageShell } from "@/features/invest/components/mf-tools-page-shell";
import {
  MF_CALC_CARD_CLASS,
  MF_CALC_CARD_CONTENT_CLASS,
  MF_CALC_GAIN_BAR_CLASS,
  MF_CALC_GAIN_TEXT_CLASS,
  MF_CALC_ICON_BADGE_CLASS,
  MF_CALC_PANEL_CLASS,
} from "@/features/invest/lib/mf-calculator-ui";
import {
  formatDate,
  formatInr,
  formatNav,
  formatReturn,
  formatSignedReturn,
  resolveInvestAssetUrl,
} from "@/features/invest/lib/mf-format";
import { mfFundHref } from "@/features/invest/lib/mf-fund-url";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const MAX_SLOTS = 3;

type CompareMetric = {
  key: string;
  label: string;
  section: "overview" | "returns" | "costs" | "fundData";
  highlight?: "max" | "min";
  value: (fund: InvestFundDetail) => string;
  raw?: (fund: InvestFundDetail) => number | null;
  render?: (fund: InvestFundDetail, isBest: boolean) => ReactNode;
};

const COMPARE_SECTIONS: Array<{ id: CompareMetric["section"]; label: string }> = [
  { id: "overview", label: copy.mutualFunds.compareSectionOverview },
  { id: "returns", label: copy.mutualFunds.compareSectionReturns },
  { id: "costs", label: copy.mutualFunds.compareSectionCosts },
  { id: "fundData", label: copy.mutualFunds.compareSectionFundData },
];

const COMPARE_METRICS: CompareMetric[] = [
  {
    key: "amc",
    section: "overview",
    label: copy.mutualFunds.compareMetricAmc,
    value: (f) => f.amc_name,
  },
  {
    key: "category",
    section: "overview",
    label: copy.mutualFunds.compareMetricCategory,
    value: (f) => f.category_name ?? f.sebi_category ?? "—",
  },
  {
    key: "1y",
    section: "returns",
    label: copy.mutualFunds.compareMetricReturn1y,
    highlight: "max",
    raw: (f) => f.returns.return_1y,
    value: (f) => formatReturn(f.returns.return_1y),
    render: (f, isBest) => {
      const formatted = formatSignedReturn(f.returns.return_1y);
      return (
        <ReturnCell formatted={formatted} isBest={isBest} />
      );
    },
  },
  {
    key: "3y",
    section: "returns",
    label: copy.mutualFunds.compareMetricReturn3y,
    highlight: "max",
    raw: (f) => f.returns.return_3y,
    value: (f) => formatReturn(f.returns.return_3y),
    render: (f, isBest) => {
      const formatted = formatSignedReturn(f.returns.return_3y);
      return (
        <ReturnCell formatted={formatted} isBest={isBest} />
      );
    },
  },
  {
    key: "5y",
    section: "returns",
    label: copy.mutualFunds.compareMetricReturn5y,
    highlight: "max",
    raw: (f) => f.returns.return_5y,
    value: (f) => formatReturn(f.returns.return_5y),
    render: (f, isBest) => {
      const formatted = formatSignedReturn(f.returns.return_5y);
      return (
        <ReturnCell formatted={formatted} isBest={isBest} />
      );
    },
  },
  {
    key: "min_sip",
    section: "costs",
    label: copy.mutualFunds.compareMetricMinSip,
    highlight: "min",
    raw: (f) => f.min_sip_amount_inr,
    value: (f) => formatInr(f.min_sip_amount_inr),
  },
  {
    key: "min_lumpsum",
    section: "costs",
    label: copy.mutualFunds.compareMetricMinLumpsum,
    highlight: "min",
    raw: (f) => f.min_lumpsum_amount_inr,
    value: (f) => formatInr(f.min_lumpsum_amount_inr),
  },
  {
    key: "ter",
    section: "costs",
    label: copy.mutualFunds.compareMetricTer,
    highlight: "min",
    raw: (f) => f.ter_percent,
    value: (f) => (f.ter_percent != null ? `${f.ter_percent.toFixed(2)}%` : "—"),
  },
  {
    key: "aum",
    section: "fundData",
    label: copy.mutualFunds.compareMetricAum,
    value: (f) => formatInr(f.aum_inr, { compact: true }),
  },
  {
    key: "nav",
    section: "fundData",
    label: copy.mutualFunds.compareMetricNav,
    value: (f) =>
      f.latest_nav != null
        ? `${formatNav(f.latest_nav)}${f.latest_nav_date ? ` · ${formatDate(f.latest_nav_date)}` : ""}`
        : "—",
  },
];

function ReturnCell({
  formatted,
  isBest,
}: {
  formatted: ReturnType<typeof formatSignedReturn>;
  isBest: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-semibold tabular-nums",
        formatted.tone === "positive" && MF_CALC_GAIN_TEXT_CLASS,
        formatted.tone === "negative" && "text-destructive",
        formatted.tone === "muted" && "text-muted-foreground",
      )}
    >
      {formatted.text}
      {isBest ? <BestBadge /> : null}
    </span>
  );
}

function BestBadge() {
  return (
    <span className="rounded-full bg-[color-mix(in_srgb,var(--success)_14%,transparent)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--success)]">
      {copy.mutualFunds.compareBest}
    </span>
  );
}

function findBestFundIndex(funds: InvestFundDetail[], metric: CompareMetric) {
  if (!metric.highlight || !metric.raw) return -1;

  let bestIndex = -1;
  let bestValue: number | null = null;

  funds.forEach((fund, index) => {
    const value = metric.raw?.(fund);
    if (value == null) return;

    if (bestValue == null) {
      bestValue = value;
      bestIndex = index;
      return;
    }

    if (metric.highlight === "max" && value > bestValue) {
      bestValue = value;
      bestIndex = index;
    }

    if (metric.highlight === "min" && value < bestValue) {
      bestValue = value;
      bestIndex = index;
    }
  });

  return funds.length > 1 ? bestIndex : -1;
}

function CompareSelectedBadge({ count, max = MAX_SLOTS }: { count: number; max?: number }) {
  const isComplete = count === max;
  const hasSelection = count > 0;
  const label = copy.mutualFunds.compareSelectedCount
    .replace("{count}", String(count))
    .replace("{max}", String(max));

  return (
    <div
      className="min-w-[7rem] rounded-[var(--radius-control)] border border-[var(--sip-hero-border)] px-3.5 py-2.5"
      aria-label={label}
    >
      <p className="text-caption font-medium leading-none whitespace-nowrap tabular-nums">
        <span
          className={cn(
            isComplete && MF_CALC_GAIN_TEXT_CLASS,
            hasSelection && !isComplete && "text-primary",
            !hasSelection && "text-foreground",
          )}
        >
          {count}
        </span>
        <span className="text-foreground"> / {max} selected</span>
      </p>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--primary)_12%,var(--muted))]"
        role="progressbar"
        aria-valuenow={count}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300",
            isComplete && MF_CALC_GAIN_BAR_CLASS,
            hasSelection && !isComplete && "bg-primary",
            !hasSelection && "bg-transparent",
          )}
          style={{ width: `${(count / max) * 100}%` }}
        />
      </div>
    </div>
  );
}

type CompareFundSlotProps = {
  index: number;
  fund: InvestFundSummary | null;
  excludeProductIds: string[];
  onChange: (fund: InvestFundSummary | null) => void;
};

function CompareFundSlot({ index, fund, excludeProductIds, onChange }: CompareFundSlotProps) {
  const logoUrl = resolveInvestAssetUrl(fund?.amc_logo_url);
  const return3y = formatSignedReturn(fund?.returns.return_3y);

  return (
    <div
      className={cn(
        MF_CALC_PANEL_CLASS,
        "flex h-full flex-col gap-3",
        fund ? "border-[color-mix(in_srgb,var(--primary)_20%,var(--border))]" : "border-dashed",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
              fund ? "sip-icon-badge" : "bg-muted text-muted-foreground",
            )}
          >
            {index + 1}
          </span>
          <p className="text-caption font-medium text-foreground">
            {copy.mutualFunds.compareSelectFund.replace("{slot}", String(index + 1))}
          </p>
        </div>
        {fund ? (
          <span className="size-2 shrink-0 rounded-full bg-[var(--success)]" aria-hidden />
        ) : null}
      </div>

      <MfFundPicker
        value={fund}
        onChange={onChange}
        excludeProductIds={excludeProductIds}
        className="w-full"
      />

      {fund ? (
        <div className="flex items-start gap-2.5 border-t border-[var(--sip-panel-border)] pt-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="size-9 shrink-0 rounded-full object-contain" />
          ) : (
            <div className="size-9 shrink-0 rounded-full bg-muted" />
          )}
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-caption font-medium leading-snug text-foreground">{fund.name}</p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{fund.amc_name}</p>
          </div>
          <span
            className={cn(
              "shrink-0 text-[11px] font-semibold tabular-nums",
              return3y.tone === "positive" && MF_CALC_GAIN_TEXT_CLASS,
              return3y.tone === "negative" && "text-destructive",
              return3y.tone === "muted" && "text-muted-foreground",
            )}
          >
            3Y {return3y.text}
          </span>
        </div>
      ) : null}
    </div>
  );
}

type CompareResultsTableProps = {
  funds: InvestFundDetail[];
};

const COMPARE_TABLE_BORDER = "border-[var(--sip-panel-border)]";

function CompareResultsTable({ funds }: CompareResultsTableProps) {
  const fundCount = funds.length;

  return (
    <div className={cn(MF_CALC_PANEL_CLASS, "overflow-hidden p-0")}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-compact">
          <thead>
            <tr>
              <th
                className={cn(
                  "sticky left-0 z-20 w-[11rem] border-b-2 border-r bg-muted/30 px-4 py-4 text-left font-semibold text-muted-foreground",
                  COMPARE_TABLE_BORDER,
                )}
              >
                {copy.mutualFunds.compareMetricName}
              </th>
              {funds.map((fund, index) => {
                const logoUrl = resolveInvestAssetUrl(fund.amc_logo_url);
                const isLast = index === fundCount - 1;

                return (
                  <th
                    key={fund.product_id}
                    className={cn(
                      "min-w-[12rem] border-b-2 bg-muted/30 px-4 py-4 text-left align-top",
                      COMPARE_TABLE_BORDER,
                      !isLast && "border-r",
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      {logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={logoUrl}
                          alt=""
                          className="mt-0.5 size-8 shrink-0 rounded-[var(--radius-control)] border border-border bg-background object-contain"
                        />
                      ) : (
                        <div className="mt-0.5 size-8 shrink-0 rounded-[var(--radius-control)] border border-border bg-muted" />
                      )}
                      <div className="min-w-0">
                        <p className="line-clamp-2 font-semibold leading-snug text-foreground">{fund.name}</p>
                        <Button
                          variant="link"
                          size="sm"
                          className="mt-1 h-auto gap-1 p-0 text-caption"
                          nativeButton={false}
                          render={<Link href={mfFundHref(fund)} />}
                        >
                          {copy.mutualFunds.compareViewFund}
                          <ArrowUpRight className="size-3" />
                        </Button>
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {COMPARE_SECTIONS.map((section, sectionIndex) => {
              const sectionMetrics = COMPARE_METRICS.filter((metric) => metric.section === section.id);
              if (sectionMetrics.length === 0) return null;

              return (
                <Fragment key={section.id}>
                  <tr className={cn("bg-muted/15", COMPARE_TABLE_BORDER, sectionIndex > 0 && "border-t-2")}>
                    <td
                      colSpan={fundCount + 1}
                      className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {section.label}
                    </td>
                  </tr>
                  {sectionMetrics.map((metric, metricIndex) => {
                    const bestIndex = findBestFundIndex(funds, metric);
                    const isLastMetric = metricIndex === sectionMetrics.length - 1;
                    const isLastSection = sectionIndex === COMPARE_SECTIONS.length - 1;

                    return (
                      <tr key={metric.key}>
                        <td
                          className={cn(
                            "sticky left-0 z-10 border-r bg-muted/10 px-4 py-3.5 font-medium text-muted-foreground",
                            COMPARE_TABLE_BORDER,
                            !(isLastMetric && isLastSection) && "border-b",
                          )}
                        >
                          {metric.label}
                        </td>
                        {funds.map((fund, index) => {
                          const isBest = index === bestIndex;
                          const isLast = index === fundCount - 1;

                          return (
                            <td
                              key={`${fund.product_id}-${metric.key}`}
                              className={cn(
                                "px-4 py-3.5 tabular-nums text-foreground",
                                COMPARE_TABLE_BORDER,
                                !isLast && "border-r",
                                !(isLastMetric && isLastSection) && "border-b",
                                isBest && "bg-[color-mix(in_srgb,var(--success)_8%,transparent)]",
                              )}
                            >
                              {metric.render ? (
                                metric.render(fund, isBest)
                              ) : (
                                <span className="inline-flex items-center gap-1.5">
                                  {metric.value(fund)}
                                  {isBest ? <BestBadge /> : null}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function MfCompareFundsView() {
  const [slots, setSlots] = useState<Array<InvestFundSummary | null>>([null, null, null]);
  const [funds, setFunds] = useState<InvestFundDetail[]>([]);
  const [disclaimer, setDisclaimer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedIds = useMemo(
    () => slots.filter((slot): slot is InvestFundSummary => slot != null).map((slot) => slot.product_id),
    [slots],
  );

  const selectedCount = selectedIds.length;

  const loadComparison = useCallback(async (productIds: string[]) => {
    if (productIds.length === 0) {
      setFunds([]);
      setDisclaimer("");
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await compareMfFunds(productIds);
      setFunds(response.funds);
      setDisclaimer(response.disclaimer);
    } catch (err) {
      setFunds([]);
      setDisclaimer("");
      setError(err instanceof Error ? err.message : copy.mutualFunds.compareLoadError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadComparison(selectedIds);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [loadComparison, selectedIds]);

  function updateSlot(index: number, fund: InvestFundSummary | null) {
    setSlots((current) => {
      const next = [...current];
      next[index] = fund;
      return next;
    });
  }

  const excludeIds = selectedIds;

  return (
    <MfToolsPageShell
      trail={[{ label: copy.mutualFunds.compareTitle }]}
      title={copy.mutualFunds.compareTitle}
      description={copy.mutualFunds.compareDescription}
    >
      <div className="space-y-6">
        <Card className={MF_CALC_CARD_CLASS}>
          <CardContent className={MF_CALC_CARD_CONTENT_CLASS}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className={MF_CALC_ICON_BADGE_CLASS}>
                  <GitCompare className="size-4" strokeWidth={2.25} />
                </span>
                <div>
                  <p className="text-body font-semibold tracking-tight text-foreground">
                    {copy.mutualFunds.compareSelectTitle}
                  </p>
                </div>
              </div>
              <CompareSelectedBadge count={selectedCount} />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {Array.from({ length: MAX_SLOTS }, (_, index) => (
                <CompareFundSlot
                  key={index}
                  index={index}
                  fund={slots[index]}
                  excludeProductIds={excludeIds.filter((id) => id !== slots[index]?.product_id)}
                  onChange={(fund) => updateSlot(index, fund)}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {error ? <FieldMessage variant="error" message={error} /> : null}

        {!loading && selectedCount === 0 ? (
          <Card className="rounded-[var(--radius-medium)] border border-dashed border-border bg-transparent py-0 shadow-none ring-0 [--card-spacing:0]">
            <CardContent className="flex min-h-[220px] flex-col items-center justify-center gap-3 p-8 text-center">
              <GitCompare className="size-10 text-[var(--sip-empty-icon)]" />
              <div>
                <p className="text-compact font-medium text-foreground">{copy.mutualFunds.compareEmpty}</p>
                <p className="mt-1 max-w-md text-caption text-muted-foreground">
                  {copy.mutualFunds.compareEmptyDescription}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {loading ? (
          <Card className="rounded-[var(--radius-medium)] border border-dashed border-border bg-transparent py-0 shadow-none ring-0 [--card-spacing:0]">
            <CardContent className="flex min-h-[220px] items-center justify-center gap-2 p-8 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {copy.mutualFunds.compareLoading}
            </CardContent>
          </Card>
        ) : null}

        {!loading && funds.length > 0 ? (
          <Card className={MF_CALC_CARD_CLASS}>
            <CardContent className={MF_CALC_CARD_CONTENT_CLASS}>
              <div className="flex items-center gap-2.5">
                <span className={MF_CALC_ICON_BADGE_CLASS}>
                  <TableProperties className="size-4" strokeWidth={2.25} />
                </span>
                <p className="text-body font-semibold tracking-tight text-foreground">
                  {copy.mutualFunds.compareResultsTitle}
                </p>
              </div>

              <CompareResultsTable funds={funds} />

              {disclaimer ? (
                <div className="border-t border-[var(--sip-panel-border)] pt-3">
                  <MfCalculatorDisclaimer disclaimer={disclaimer} />
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </MfToolsPageShell>
  );
}

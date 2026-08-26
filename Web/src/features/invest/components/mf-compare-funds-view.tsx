"use client";

import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, GitCompare, LineChart, TableProperties } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DashboardContentFade } from "@/components/dashboard/dashboard-content-fade";
import { Card, CardContent } from "@/components/ui/card";
import { FieldMessage } from "@/components/ui/ui-message";
import {
  compareMfFunds,
  type InvestFundDetail,
  type InvestFundSummary,
} from "@/features/invest/api/invest-api";
import { MfCalculatorDisclaimer } from "@/features/invest/components/mf-calculator-disclaimer";
import { MfCompareFundsNavChartSection } from "@/features/invest/components/mf-compare-funds-nav-chart";
import { CompareFundSlotSearch, CompareFundsSlotTabList } from "@/features/invest/components/mf-compare-funds-slot-tabs";
import { MfCompareFundsResultsSkeleton } from "@/features/invest/components/mf-tools-page-skeleton";
import { MfToolsPageShell } from "@/features/invest/components/mf-tools-page-shell";
import { MF_TOOL_ICONS } from "@/features/invest/lib/mf-dashboard-sidebar-data";
import { useCompareFundNavQueries } from "@/features/invest/hooks/use-compare-fund-nav-queries";
import type { MfNavRange } from "@/features/invest/lib/mf-nav-history";
import {
  MF_CALC_CARD_CLASS,
  MF_CALC_CARD_CONTENT_CLASS,
  MF_CALC_GAIN_BAR_CLASS,
  MF_CALC_GAIN_TEXT_CLASS,
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
import { ZYND_3XL_RADIUS_CLASS } from "@/shared/config/ui-classes";
import { cn } from "@/lib/utils";

const MAX_SLOTS = 3;

type CompareResultsPanelTab = "performance" | "results";

function CompareResultsPanelTabs({
  value,
  onChange,
}: {
  value: CompareResultsPanelTab;
  onChange: (value: CompareResultsPanelTab) => void;
}) {
  const tabs: Array<{ id: CompareResultsPanelTab; label: string; icon: typeof LineChart }> = [
    { id: "performance", label: copy.mutualFunds.compareResultsTabPerformance, icon: LineChart },
    { id: "results", label: copy.mutualFunds.compareResultsTabTable, icon: TableProperties },
  ];

  return (
    <div
      role="tablist"
      aria-label={copy.mutualFunds.compareTitle}
      className="flex gap-1 rounded-[var(--radius-control)] border border-border/80 bg-muted/20 p-1"
    >
      {tabs.map((tab) => {
        const active = value === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={cn(
              "inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-[var(--radius-control)] px-3 py-2 text-caption font-medium transition-colors",
              active
                ? "bg-foreground text-background shadow-zynd-low"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
            <span className="truncate">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function orderFundsByProductIds(funds: InvestFundDetail[], productIds: string[]) {
  return productIds
    .map((id) => funds.find((fund) => fund.product_id === id))
    .filter((fund): fund is InvestFundDetail => fund != null);
}

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
      className="min-w-[7rem] rounded-2xl border border-[var(--sip-hero-border)] px-3.5 py-2.5"
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
  const [activeSlot, setActiveSlot] = useState(0);
  const [funds, setFunds] = useState<InvestFundDetail[]>([]);
  const [disclaimer, setDisclaimer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartRange, setChartRange] = useState<MfNavRange>("1y");
  const [resultsPanelTab, setResultsPanelTab] = useState<CompareResultsPanelTab>("performance");

  const selectedIds = useMemo(
    () => slots.filter((slot): slot is InvestFundSummary => slot != null).map((slot) => slot.product_id),
    [slots],
  );

  const selectedCount = selectedIds.length;

  const { series: navSeries, isLoading: navLoading } = useCompareFundNavQueries(funds);

  const compareNavSeries = useMemo(
    () => navSeries.map(({ fund, navPoints }) => ({ fund, navPoints })),
    [navSeries],
  );

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
      setFunds(orderFundsByProductIds(response.funds, productIds));
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

  const excludeIds = selectedIds;

  return (
    <DashboardContentFade>
      <MfToolsPageShell
        trail={[{ label: copy.mutualFunds.compareTitle }]}
        title={copy.mutualFunds.compareTitle}
        icon={MF_TOOL_ICONS.compare}
      >
      <div className="space-y-6">
        <div className="space-y-4">
          <Card className={MF_CALC_CARD_CLASS}>
            <CardContent className={MF_CALC_CARD_CONTENT_CLASS}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <GitCompare
                    className="size-5 shrink-0 text-black dark:text-white"
                    strokeWidth={2.25}
                  />
                  <div>
                    <p className="text-body font-semibold tracking-tight text-foreground">
                      {copy.mutualFunds.compareSelectTitle}
                    </p>
                  </div>
                </div>
                <CompareSelectedBadge count={selectedCount} />
              </div>

              <CompareFundsSlotTabList
                slots={slots}
                activeSlot={activeSlot}
                onActiveSlotChange={setActiveSlot}
              />

              <CompareFundSlotSearch
                activeSlot={activeSlot}
                slots={slots}
                onSlotsChange={setSlots}
                excludeProductIds={excludeIds}
              />
            </CardContent>
          </Card>
        </div>

        {error ? <FieldMessage variant="error" message={error} /> : null}

        {!loading && selectedCount === 0 ? (
          <Card className={cn("border border-dashed border-border bg-transparent py-0 shadow-none ring-0 [--card-spacing:0]", ZYND_3XL_RADIUS_CLASS)}>
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

        {loading && selectedCount > 0 ? (
          <MfCompareFundsResultsSkeleton columns={Math.min(selectedCount, MAX_SLOTS)} />
        ) : null}

        {!loading && funds.length > 0 ? (
          <Card className={MF_CALC_CARD_CLASS}>
            <CardContent className={cn(MF_CALC_CARD_CONTENT_CLASS, "gap-4")}>
              <CompareResultsPanelTabs value={resultsPanelTab} onChange={setResultsPanelTab} />

              <div
                role="tabpanel"
                className="min-w-0"
                aria-label={
                  resultsPanelTab === "performance"
                    ? copy.mutualFunds.compareResultsTabPerformance
                    : copy.mutualFunds.compareResultsTabTable
                }
              >
                {resultsPanelTab === "performance" ? (
                  <MfCompareFundsNavChartSection
                    funds={funds}
                    series={compareNavSeries}
                    range={chartRange}
                    onRangeChange={setChartRange}
                    loading={navLoading}
                    showHeader={false}
                  />
                ) : (
                  <div className="space-y-4">
                    <p className="text-caption text-muted-foreground">
                      {copy.mutualFunds.compareResultsTitle}
                    </p>
                    <CompareResultsTable funds={funds} />
                    {disclaimer ? (
                      <div className="border-t border-[var(--sip-panel-border)] pt-3">
                        <MfCalculatorDisclaimer disclaimer={disclaimer} />
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </MfToolsPageShell>
    </DashboardContentFade>
  );
}

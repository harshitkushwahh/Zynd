"use client";

import { notFound, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  Banknote,
  CalendarClock,
  CircleHelp,
  Info,
  LineChart,
  Repeat2,
  Shuffle,
  TrendingUp,
} from "lucide-react";

import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb";
import { DashboardContentFade } from "@/components/dashboard/dashboard-content-fade";
import { LoadErrorCard } from "@/components/ui/load-error-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableCard } from "@/components/core/table";
import { MfInvestPaymentCard } from "@/features/invest/components/mf-invest-payment-card";
import type { MfRedeemProceedPayload } from "@/features/invest/components/mf-invest-payment-card-redeem";
import type { MfPaymentCardVariant } from "@/features/invest/components/mf-invest-payment-card";
import { MF_INVEST_PAYMENT_CARD_CLASS } from "@/features/invest/lib/mf-ui";
import { TabPanel } from "@/shared/ui/tab-panel";
import { PortfolioRedeemConsentDialog } from "@/features/dashboard/portfolio/components/portfolio-redeem-consent-dialog";
import { PortfolioHoldingDetailSkeleton } from "@/features/dashboard/portfolio/components/portfolio-holding-detail-skeleton";
import { PortfolioUpcomingHoldingDetailPage } from "@/features/dashboard/portfolio/components/portfolio-upcoming-holding-detail-page";
import { PortfolioTabEmptyState } from "@/features/dashboard/portfolio/components/portfolio-tab-empty-state";
import { usePortfolioHoldingDetailQuery } from "@/features/dashboard/portfolio/hooks/use-portfolio-queries";
import {
  createMfRedemption,
  type MfRedemptionOrder,
} from "@/features/dashboard/portfolio/lib/portfolio-api";
import { MfFundAmcAvatar } from "@/features/invest/components/mf-fund-search-ui";
import {
  parsePortfolioHoldingRouteParam,
  type PortfolioHoldingDetail,
  type PortfolioHoldingTransaction,
} from "@/features/dashboard/portfolio/lib/portfolio-holding-detail-data";
import {
  formatHoldingSipPoolSummary,
  poolSipsForHolding,
} from "@/features/dashboard/portfolio/lib/portfolio-holding-sip";
import { useMfSipPlansQuery } from "@/features/invest/hooks/use-mf-sip-plans-query";
import {
  MF_INVEST_SIDEBAR_STICKY_CLASS,
  MF_INVEST_SIDEBAR_WIDTH_CLASS,
  MF_PAGE_SECTION_CLASS,
} from "@/features/invest/lib/mf-ui";
import { formatInr, formatSignedReturn } from "@/features/invest/lib/mf-format";
import { ZYND_3XL_RADIUS_CLASS } from "@/shared/config/ui-classes";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type PortfolioHoldingDetailPageProps = {
  holdingId: string;
};

function toneClass(tone: "positive" | "negative" | "muted") {
  return cn(
    tone === "positive" && "text-success",
    tone === "negative" && "text-destructive",
    tone === "muted" && "text-muted-foreground",
  );
}

function formatTxnDate(isoDate: string) {
  return new Date(isoDate).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

function formatTxnType(type: PortfolioHoldingTransaction["type"]) {
  const portfolioCopy = copy.dashboard.portfolio;
  if (type === "invested") return portfolioCopy.holdingTxnInvested;
  if (type === "redeemed") return portfolioCopy.holdingTxnRedeemed;
  return portfolioCopy.holdingTxnDividend;
}

function MetricCell({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "positive" | "negative" | "muted";
}) {
  return (
    <div className="min-w-0">
      <p className="text-caption text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-compact font-semibold tabular-nums text-foreground", tone && toneClass(tone))}>
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-caption tabular-nums text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function HoldingModeBadge({ mode }: { mode: PortfolioHoldingDetail["holdingMode"] }) {
  const portfolioCopy = copy.dashboard.portfolio;
  const label =
    mode === "Demat" ? portfolioCopy.holdingModeDemat : portfolioCopy.holdingModePhysical;
  const tooltip =
    mode === "Demat"
      ? portfolioCopy.holdingModeDematTooltip
      : portfolioCopy.holdingModePhysicalTooltip;

  return (
    <Tooltip>
      <TooltipTrigger
        render={<Badge variant="secondary" className="cursor-help gap-1" />}
      >
        {label}
        <CircleHelp className="size-3 opacity-70" strokeWidth={2.25} aria-hidden />
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs text-pretty">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

function HoldingOverviewCard({
  holding,
  showDayChange,
}: {
  holding: PortfolioHoldingDetail;
  showDayChange: boolean;
}) {
  const overview = copy.dashboard.overview;
  const portfolioCopy = copy.dashboard.portfolio;
  const totalReturn = formatSignedReturn(holding.returnPct);
  const dayChange = formatSignedReturn(holding.dayChangePct ?? 0);
  const investedMonthsLabel =
    holding.investedMonths != null
      ? portfolioCopy.holdingInvestedFor.replace("{months}", String(holding.investedMonths))
      : portfolioCopy.holdingInvestedDurationUnknown;

  return (
    <section
      className={cn(
        ZYND_3XL_RADIUS_CLASS,
        "border border-border/60 bg-card p-4 shadow-zynd-low sm:p-5",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <MfFundAmcAvatar
            amcLogoUrl={holding.amcLogoUrl}
            amcName={holding.amcName}
            size="md"
            className="size-10 shrink-0 rounded-[var(--radius-control)]"
          />
          <div className="min-w-0">
            <h1 className="text-body font-semibold leading-snug text-foreground">{holding.fundName}</h1>
            <p className="mt-1 text-caption text-muted-foreground">{investedMonthsLabel}</p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 text-caption text-muted-foreground">
          <span>
            {portfolioCopy.holdingFolioLabel}: {holding.folioNumber}
          </span>
          <HoldingModeBadge mode={holding.holdingMode} />
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCell label={overview.portfolioCurrentValue} value={formatInr(holding.currentValueInr)} />
        <MetricCell label={overview.portfolioInvested} value={formatInr(holding.investedInr)} />
        <MetricCell label={portfolioCopy.holdingCurrentNav} value={`₹${holding.currentNav.toFixed(2)}`} />
        <MetricCell
          label={portfolioCopy.holdingAvgNav}
          value={holding.avgNav != null ? `₹${holding.avgNav.toFixed(2)}` : "—"}
        />
        <MetricCell
          label={overview.portfolioReturns}
          value={`${formatInr(holding.returnInr)} (${totalReturn.text})`}
          tone={totalReturn.tone}
        />
        <MetricCell
          label={overview.portfolioDayChange}
          value={
            showDayChange && holding.dayChangeInr != null
              ? `${formatInr(holding.dayChangeInr)} (${dayChange.text})`
              : "—"
          }
          tone={showDayChange ? dayChange.tone : "muted"}
        />
        <MetricCell
          label={overview.portfolioXirr}
          value={holding.xirrPct != null ? `${holding.xirrPct.toFixed(2)}%` : overview.portfolioXirrUnavailable}
        />
        <MetricCell
          label={portfolioCopy.holdingRedeemableUnits}
          value={holding.redeemableUnits.toFixed(3)}
        />
      </div>

      <div className="mt-5 grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-2">
        <p className="text-compact text-muted-foreground">
          {portfolioCopy.holdingRedeemTo}{" "}
          <span className="border-b border-dotted border-muted-foreground/60 font-medium text-foreground">
            {holding.redeemBankLabel ?? "—"}
          </span>
        </p>
        <p className="text-compact text-muted-foreground">
          {portfolioCopy.holdingNominee}{" "}
          <span
            className={cn(
              "font-medium",
              holding.nomineeName?.trim() ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {holding.nomineeName?.trim() || portfolioCopy.holdingNomineeEmpty}
          </span>
        </p>
      </div>
    </section>
  );
}

function HoldingSipSummaryCard({ holding }: { holding: PortfolioHoldingDetail }) {
  const { plans } = useMfSipPlansQuery();
  const portfolioCopy = copy.dashboard.portfolio;
  const pool = poolSipsForHolding({ fundName: holding.fundName, isin: holding.isin }, plans);

  if (!pool) return null;

  const { monthly, nextDate } = formatHoldingSipPoolSummary(pool);
  const planCountLabel =
    pool.activePlanCount > 1
      ? portfolioCopy.holdingSipPlanCount.replace("{count}", String(pool.activePlanCount))
      : null;

  return (
    <section
      className={cn(
        ZYND_3XL_RADIUS_CLASS,
        "border border-border/60 bg-card p-4 shadow-zynd-low sm:p-5",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-border bg-muted">
            <CalendarClock className="size-4 text-muted-foreground" strokeWidth={2.25} aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 className="text-compact font-semibold text-foreground">{portfolioCopy.holdingSipSummaryLabel}</h2>
            {planCountLabel ? (
              <p className="mt-1 text-caption text-muted-foreground">{planCountLabel}</p>
            ) : null}
          </div>
        </div>
        <div className="text-right">
          <p className="text-compact font-semibold tabular-nums text-foreground">
            {portfolioCopy.holdingSipMonthlyTotal.replace("{amount}", monthly)}
          </p>
          {nextDate ? (
            <p className="mt-1 text-caption text-muted-foreground">
              {portfolioCopy.holdingSipNextDebit.replace("{date}", nextDate)}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function PortfolioHoldingPaymentCard({
  holding,
  paymentMode,
  onRedeemProceed,
  onSwitchToInvest,
}: {
  holding: PortfolioHoldingDetail;
  paymentMode: MfPaymentCardVariant;
  onRedeemProceed: (payload: MfRedeemProceedPayload) => void | Promise<void>;
  onSwitchToInvest: () => void;
}) {
  const previewBankLabel = holding.redeemBankLabel ?? undefined;
  const panelClassName =
    "h-full min-h-[34rem] w-full border-0 bg-transparent shadow-none rounded-none";
  const shellClassName = cn(
    MF_INVEST_PAYMENT_CARD_CLASS,
    ZYND_3XL_RADIUS_CLASS,
    "relative w-full min-h-[34rem] overflow-hidden",
  );
  const redeemableValueInr =
    holding.redeemableUnits > 0 && holding.currentNav > 0
      ? Math.round(holding.redeemableUnits * holding.currentNav * 100) / 100
      : holding.currentValueInr;

  return (
    <div className={shellClassName}>
      <TabPanel
        active={paymentMode === "invest"}
        fade
        keepMounted
        className="duration-150 ease-in-out"
      >
        <MfInvestPaymentCard
          variant="invest"
          sticky={false}
          showFundName={false}
          fundName={holding.fundName}
          previewBankLabel={previewBankLabel}
          previewBankName={holding.redeemBankName}
          previewBankIfsc={holding.redeemBankIfsc}
          defaultMode="sip"
          preview
          sipEnabled
          relaxedAmountSpacing
          className={panelClassName}
        />
      </TabPanel>

      <TabPanel
        active={paymentMode === "redeem"}
        fade
        keepMounted
        className="duration-150 ease-in-out"
      >
        <MfInvestPaymentCard
          variant="redeem"
          sticky={false}
          fundName={holding.fundName}
          previewBankLabel={previewBankLabel}
          previewBankName={holding.redeemBankName}
          previewBankIfsc={holding.redeemBankIfsc}
          redeemableValueInr={redeemableValueInr}
          redeemableUnits={holding.redeemableUnits}
          currentNav={holding.currentNav}
          preview={false}
          canRedeem={holding.redeemableUnits > 0}
          onRedeemProceed={onRedeemProceed}
          onRedeemBack={onSwitchToInvest}
          className={panelClassName}
        />
      </TabPanel>
    </div>
  );
}

function HoldingQuickActions({
  paymentMode,
  onInvest,
  onRedeem,
}: {
  paymentMode: MfPaymentCardVariant;
  onInvest: () => void;
  onRedeem: () => void;
}) {
  const portfolioCopy = copy.dashboard.portfolio;
  const actions = [
    { id: "invest" as const, label: portfolioCopy.holdingActionInvest, icon: TrendingUp, enabled: true },
    { id: "switch" as const, label: portfolioCopy.holdingActionSwitch, icon: Shuffle, enabled: false },
    { id: "stp" as const, label: portfolioCopy.holdingActionStp, icon: Repeat2, enabled: false },
    { id: "swp" as const, label: portfolioCopy.holdingActionSwp, icon: CalendarClock, enabled: false },
    { id: "redeem" as const, label: portfolioCopy.holdingActionRedeem, icon: Banknote, enabled: true },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {actions.map((action) => {
        const Icon = action.icon;
        const isActive =
          action.enabled &&
          ((action.id === "invest" && paymentMode === "invest") ||
            (action.id === "redeem" && paymentMode === "redeem"));

        return (
          <Button
            key={action.id}
            type="button"
            variant="muted"
            disabled={!action.enabled}
            onClick={() => {
              if (action.id === "invest") onInvest();
              if (action.id === "redeem") onRedeem();
            }}
            className={cn(
              ZYND_3XL_RADIUS_CLASS,
              "group/button h-auto min-h-[3.25rem] w-full justify-between gap-3 border border-border/60 bg-card px-4 py-3 shadow-zynd-low",
              action.enabled &&
                "transition-colors hover:border-primary/25 hover:bg-muted/25 dark:hover:bg-muted/20 [&_[data-icon=inline-end]]:transition-all [&_[data-icon=inline-end]]:duration-200 hover:[&_[data-icon=inline-end]]:translate-x-0.5 hover:[&_[data-icon=inline-end]]:text-foreground",
              isActive && "border-primary/35 bg-primary/[0.04] ring-1 ring-primary/15",
            )}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <Icon className="size-4 shrink-0 text-foreground" strokeWidth={2.25} />
              <span className="truncate text-compact font-medium text-foreground">{action.label}</span>
            </span>
          </Button>
        );
      })}
    </div>
  );
}

function HoldingTransactionsTable({ transactions }: { transactions: PortfolioHoldingTransaction[] }) {
  const portfolioCopy = copy.dashboard.portfolio;

  if (transactions.length === 0) {
    return (
      <PortfolioTabEmptyState
        icon={LineChart}
        title={portfolioCopy.holdingTxnEmptyTitle}
        description={portfolioCopy.holdingTxnEmptyDescription}
      />
    );
  }

  const TABLE_LAYOUT_CLASS = "w-full table-fixed border-collapse border-spacing-0";
  const COL_DATE = "w-[22%]";
  const COL_TYPE = "w-[18%]";
  const COL_UNITS = "w-[18%]";
  const COL_NAV = "w-[18%]";
  const COL_VALUE = "w-[24%]";
  const HEADER_ROW_CLASS =
    "sticky top-0 z-10 !h-auto !bg-transparent [&>tr>th]:after:!hidden [&>tr]:border-b [&>tr]:border-border";
  const HEADER_CELL_CLASS = "px-4 py-3.5 md:px-5";
  const BODY_CELL_CLASS = "px-4 md:px-5";
  const HEADER_SURFACE_CLASS = "bg-muted/30";
  const HEADER_LABEL_CLASS =
    "[&>div>span]:text-compact [&>div>span]:font-semibold [&>div>span]:tracking-wide [&>div>span]:text-muted-foreground";
  const RIGHT_HEAD_CLASS = "text-right [&>div]:ml-auto [&>div]:justify-end";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 px-0.5">
        <h2 className="text-compact font-semibold text-foreground">{portfolioCopy.holdingTxnTitle}</h2>
        <Tooltip>
          <TooltipTrigger
            type="button"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            aria-label={portfolioCopy.holdingTxnTooltip}
          >
            <Info className="size-4" strokeWidth={2.25} aria-hidden />
          </TooltipTrigger>
          <TooltipContent side="top" align="end" className="max-w-[16rem] text-pretty">
            {portfolioCopy.holdingTxnTooltip}
          </TooltipContent>
        </Tooltip>
      </div>

      <TableCard.Root
        size="sm"
        className={cn(
          ZYND_3XL_RADIUS_CLASS,
          "overflow-hidden border-border/60 shadow-zynd-low",
        )}
      >
        <div className="overflow-x-auto overscroll-x-contain">
          <Table
            aria-label={portfolioCopy.holdingTxnTitle}
            size="sm"
            className={TABLE_LAYOUT_CLASS}
          >
            <Table.Header bordered={false} className={HEADER_ROW_CLASS}>
              <Table.Head
                id="date"
                isRowHeader
                className={cn(COL_DATE, HEADER_CELL_CLASS, HEADER_SURFACE_CLASS, HEADER_LABEL_CLASS)}
              >
                {portfolioCopy.holdingTxnDate}
              </Table.Head>
              <Table.Head
                id="type"
                className={cn(COL_TYPE, HEADER_CELL_CLASS, HEADER_SURFACE_CLASS, HEADER_LABEL_CLASS)}
              >
                {portfolioCopy.holdingTxnType}
              </Table.Head>
              <Table.Head
                id="units"
                className={cn(
                  COL_UNITS,
                  HEADER_CELL_CLASS,
                  HEADER_SURFACE_CLASS,
                  HEADER_LABEL_CLASS,
                  RIGHT_HEAD_CLASS,
                )}
              >
                {portfolioCopy.holdingTxnUnits}
              </Table.Head>
              <Table.Head
                id="nav"
                className={cn(
                  COL_NAV,
                  HEADER_CELL_CLASS,
                  HEADER_SURFACE_CLASS,
                  HEADER_LABEL_CLASS,
                  RIGHT_HEAD_CLASS,
                )}
              >
                {portfolioCopy.holdingTxnNav}
              </Table.Head>
              <Table.Head
                id="value"
                className={cn(
                  COL_VALUE,
                  HEADER_CELL_CLASS,
                  HEADER_SURFACE_CLASS,
                  HEADER_LABEL_CLASS,
                  RIGHT_HEAD_CLASS,
                )}
              >
                {portfolioCopy.holdingTxnValue}
              </Table.Head>
            </Table.Header>

            <Table.Body className="[&>tr:first-child>td]:border-t-0" items={transactions}>
              {(txn) => (
                <Table.Row id={txn.id}>
                  <Table.Cell className={cn(COL_DATE, BODY_CELL_CLASS)}>
                    {formatTxnDate(txn.date)}
                  </Table.Cell>
                  <Table.Cell className={cn(COL_TYPE, BODY_CELL_CLASS)}>
                    {formatTxnType(txn.type)}
                  </Table.Cell>
                  <Table.Cell className={cn(COL_UNITS, BODY_CELL_CLASS, "text-right tabular-nums")}>
                    {txn.units > 0 ? txn.units.toFixed(3) : "—"}
                  </Table.Cell>
                  <Table.Cell className={cn(COL_NAV, BODY_CELL_CLASS, "text-right tabular-nums")}>
                    {txn.nav > 0 ? txn.nav.toFixed(2) : "—"}
                  </Table.Cell>
                  <Table.Cell
                    className={cn(
                      COL_VALUE,
                      BODY_CELL_CLASS,
                      "text-right font-medium tabular-nums text-success",
                    )}
                  >
                    +{formatInr(txn.valueInr)}
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        </div>
      </TableCard.Root>
    </div>
  );
}

export function PortfolioHoldingDetailPage({ holdingId }: PortfolioHoldingDetailPageProps) {
  const route = parsePortfolioHoldingRouteParam(holdingId);
  if (route.kind === "upcoming") {
    return <PortfolioUpcomingHoldingDetailPage slug={route.slug} />;
  }

  return <PortfolioHoldingDetailPageContent holdingId={route.holdingId} />;
}

function PortfolioHoldingDetailPageContent({ holdingId }: { holdingId: string }) {
  const searchParams = useSearchParams();
  const decodedHoldingId = holdingId;
  const {
    holding,
    showDayChange,
    showSkeleton,
    errorMessage,
    status,
    refetch,
    isFetching,
  } = usePortfolioHoldingDetailQuery(decodedHoldingId);
  const portfolioCopy = copy.dashboard.portfolio;
  const initialPaymentMode = searchParams.get("mode") === "redeem" ? "redeem" : "invest";
  const [paymentMode, setPaymentMode] = useState<MfPaymentCardVariant>(initialPaymentMode);
  const [consentOpen, setConsentOpen] = useState(false);
  const [pendingRedemption, setPendingRedemption] = useState<MfRedemptionOrder | null>(null);

  async function handleRedeemProceed(payload: MfRedeemProceedPayload) {
    if (!holding) return;
    const redeemMode = payload.redeemAll
      ? "all"
      : payload.mode === "amount"
        ? "amount"
        : "units";
    const order = await createMfRedemption({
      holding_id: holding.id,
      idempotency_key: crypto.randomUUID(),
      redeem_mode: redeemMode,
      amount_inr: redeemMode === "amount" ? payload.amount : undefined,
      units: redeemMode === "units" ? payload.units : undefined,
    });
    setPendingRedemption(order);
    setConsentOpen(true);
  }

  if (showSkeleton) {
    return <PortfolioHoldingDetailSkeleton />;
  }

  if (errorMessage) {
    return (
      <div className={cn(MF_PAGE_SECTION_CLASS, "pb-8")}>
        <DashboardContentFade>
          <LoadErrorCard
            icon={LineChart}
            title={portfolioCopy.holdingDetailLoadFailed}
            description={errorMessage}
            retryLabel={portfolioCopy.retry}
            retryLoading={isFetching}
            onRetry={() => void refetch()}
          />
        </DashboardContentFade>
      </div>
    );
  }

  if (!holding) {
    notFound();
  }
  if (status === "not_found" || status === "invalid_holding_id") {
    notFound();
  }

  const paymentCard = (
    <PortfolioHoldingPaymentCard
      holding={holding}
      paymentMode={paymentMode}
      onRedeemProceed={handleRedeemProceed}
      onSwitchToInvest={() => setPaymentMode("invest")}
    />
  );

  return (
    <DashboardContentFade className={cn(MF_PAGE_SECTION_CLASS, "pb-8")}>
      <DashboardBreadcrumb
        items={[
          { label: portfolioCopy.pageTitle, href: "/dashboard/portfolio" },
          { label: holding.fundName },
        ]}
      />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-4">
          <HoldingOverviewCard holding={holding} showDayChange={showDayChange} />
          <HoldingSipSummaryCard holding={holding} />
          <div className="lg:hidden">{paymentCard}</div>
          <HoldingQuickActions
            paymentMode={paymentMode}
            onInvest={() => setPaymentMode("invest")}
            onRedeem={() => setPaymentMode("redeem")}
          />
          <HoldingTransactionsTable transactions={holding.transactions} />
        </div>

        <aside className={cn(MF_INVEST_SIDEBAR_WIDTH_CLASS, MF_INVEST_SIDEBAR_STICKY_CLASS, "hidden lg:block")}>
          {paymentCard}
        </aside>
      </div>

      <PortfolioRedeemConsentDialog
        open={consentOpen}
        order={pendingRedemption}
        onOpenChange={setConsentOpen}
      />
    </DashboardContentFade>
  );
}

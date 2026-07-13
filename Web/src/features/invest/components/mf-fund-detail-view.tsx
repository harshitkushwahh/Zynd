"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FieldMessage } from "@/components/ui/ui-message";
import { FundEligibilityBanner } from "@/features/account/mfa/components/fund-eligibility-banner";
import {
  createMfOrder,
  fetchInvestConfig,
  fetchInvestFundDetail,
  fetchInvestFundNavs,
  fetchInvestReturnCalculator,
  type InvestConfig,
  type InvestFundDetail,
  type InvestFundNavHistory,
  type InvestReturnCalculator,
} from "@/features/invest/api/invest-api";
import { MfInvestmentDetailsCard } from "@/features/invest/components/mf-investment-details-card";
import { MfNavChart } from "@/features/invest/components/mf-nav-chart";
import {
  formatDate,
  formatInr,
  formatNav,
  formatReturn,
  healthBadgeLabel,
  resolveInvestAssetUrl,
} from "@/features/invest/lib/mf-format";
import { useAuth } from "@/contexts/auth-context";
import { copy } from "@/shared/config/copy";

type MfFundDetailViewProps = {
  productId: string;
  renderBreadcrumb?: (fundName: string | null) => ReactNode;
  onOrderPlaced: () => void;
};

const returnRows: Array<{ key: keyof InvestFundDetail["returns"]; label: string }> = [
  { key: "return_1d", label: "1D" },
  { key: "return_1w", label: "1W" },
  { key: "return_1m", label: "1M" },
  { key: "return_3m", label: "3M" },
  { key: "return_6m", label: "6M" },
  { key: "return_1y", label: "1Y" },
  { key: "return_3y", label: "3Y" },
  { key: "return_5y", label: "5Y" },
];

export function MfFundDetailView({ productId, renderBreadcrumb, onOrderPlaced }: MfFundDetailViewProps) {
  const { user } = useAuth();
  const [fund, setFund] = useState<InvestFundDetail | null>(null);
  const [navHistory, setNavHistory] = useState<InvestFundNavHistory | null>(null);
  const [calculator, setCalculator] = useState<InvestReturnCalculator | null>(null);
  const [config, setConfig] = useState<InvestConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setFund(null);
    setNavHistory(null);
    setCalculator(null);

    Promise.all([
      fetchInvestFundDetail(productId),
      fetchInvestFundNavs(productId),
      fetchInvestReturnCalculator(productId, { amount_inr: 1000, mode: "lumpsum" }),
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
          setError(err.message || copy.mutualFunds.fundUnavailable);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [productId]);

  const canInvest = Boolean(user?.fund_movement_eligible && config?.orders_enabled);

  async function handlePlaceOrder() {
    if (!fund) return;
    setOrderError(null);
    setOrderSuccess(null);

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setOrderError(copy.mutualFunds.invalidAmount);
      return;
    }
    if (fund.min_lumpsum_amount_inr != null && parsedAmount < fund.min_lumpsum_amount_inr) {
      setOrderError(
        copy.mutualFunds.minLumpsumError.replace(
          "{amount}",
          formatInr(fund.min_lumpsum_amount_inr),
        ),
      );
      return;
    }

    setSubmitting(true);
    try {
      const order = await createMfOrder({
        product_id: fund.product_id,
        amount_inr: parsedAmount,
        idempotency_key: crypto.randomUUID(),
      });
      setOrderSuccess(
        copy.mutualFunds.orderSuccess.replace("{status}", order.status.replaceAll("_", " ")),
      );
      setAmount("");
      onOrderPlaced();
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : copy.mutualFunds.orderFailed);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <>
        {renderBreadcrumb?.(null)}
        <div className="flex min-h-[320px] items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 size-5 animate-spin" />
          {copy.mutualFunds.loadingFund}
        </div>
      </>
    );
  }

  if (error || !fund) {
    return (
      <>
        {renderBreadcrumb?.(null)}
        <Card className="rounded-[var(--radius-medium)]">
          <CardContent className="space-y-4 p-6">
            <FieldMessage variant="error" message={error ?? copy.mutualFunds.fundUnavailable} />
          </CardContent>
        </Card>
      </>
    );
  }

  const logoUrl = resolveInvestAssetUrl(fund.amc_logo_url);

  return (
    <div className="space-y-6">
      {renderBreadcrumb?.(fund.name)}

      <FundEligibilityBanner />

      <Card className="rounded-[var(--radius-medium)]">
        <CardHeader className="gap-4">
          <div className="flex items-start gap-4">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                className="size-14 shrink-0 rounded-[var(--radius-control)] border border-border bg-background object-contain p-1.5"
              />
            ) : (
              <div className="flex size-14 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-border bg-muted text-compact font-semibold text-muted-foreground">
                {fund.amc_name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap gap-2">
                {(fund.content?.risk_label ?? fund.sebi_category) ? (
                  <Badge variant="outline">{fund.content?.risk_label ?? fund.sebi_category}</Badge>
                ) : null}
                {fund.content?.hero_badge ? (
                  <Badge variant="secondary">{fund.content.hero_badge}</Badge>
                ) : null}
                {fund.category_name ? <Badge variant="secondary">{fund.category_name}</Badge> : null}
                {fund.health_badges?.map((flag) => (
                  <Badge key={flag} variant="warning">
                    {healthBadgeLabel(flag)}
                  </Badge>
                ))}
              </div>
              <div>
                <CardTitle className="text-h3">{fund.name}</CardTitle>
                <CardDescription className="mt-1">
                  {fund.content?.amc_marketing_name ?? fund.amc_name}
                  {fund.amc_aum_rank?.label ? ` · ${fund.amc_aum_rank.label}` : ""}
                </CardDescription>
                {fund.content?.tagline ? (
                  <p className="mt-2 text-compact text-muted-foreground">{fund.content.tagline}</p>
                ) : null}
                {fund.isin ? (
                  <p className="mt-1 text-caption text-muted-foreground">ISIN {fund.isin}</p>
                ) : null}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 border-t border-border pt-6 sm:grid-cols-3">
          <div>
            <p className="text-caption text-muted-foreground">Latest NAV</p>
            <p className="text-h3 font-semibold">{formatNav(fund.latest_nav)}</p>
            <p className="text-caption text-muted-foreground">as of {formatDate(fund.latest_nav_date)}</p>
          </div>
          <div>
            <p className="text-caption text-muted-foreground">AUM</p>
            <p className="font-semibold">{formatInr(fund.aum_inr, { compact: true })}</p>
            <p className="text-caption text-muted-foreground">as of {formatDate(fund.aum_as_of)}</p>
          </div>
          <div>
            <p className="text-caption text-muted-foreground">TER</p>
            <p className="font-semibold">
              {fund.ter_percent != null ? `${fund.ter_percent.toFixed(2)}%` : "—"}
            </p>
            <p className="text-caption text-muted-foreground">as of {formatDate(fund.ter_as_of)}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {calculator && calculator.scenarios.length > 0 ? (
            <Card className="rounded-[var(--radius-medium)]">
              <CardHeader>
                <CardTitle>Return calculator</CardTitle>
                <CardDescription>
                  Illustrative lumpsum of {formatInr(calculator.amount_inr)} based on historical NAV
                  {calculator.as_of_date ? ` (as of ${formatDate(calculator.as_of_date)})` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {calculator.scenarios.map((scenario) => (
                    <div
                      key={scenario.horizon}
                      className="rounded-[var(--radius-card)] border border-border px-3 py-2"
                    >
                      <p className="text-caption text-muted-foreground uppercase">{scenario.horizon}</p>
                      <p className="font-medium">{formatInr(scenario.value_inr)}</p>
                      <p className="text-caption text-muted-foreground">
                        {formatReturn(scenario.return_pct)}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {fund.investment_details ? (
            <MfInvestmentDetailsCard details={fund.investment_details} />
          ) : null}

          {fund.compliance ? (
            <Card className="rounded-[var(--radius-medium)]">
              <CardHeader>
                <CardTitle>Exit load, stamp duty & tax</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-compact">
                {fund.compliance.exit_load?.text ? (
                  <div>
                    <p className="text-caption text-muted-foreground">Exit load</p>
                    <p>{fund.compliance.exit_load.text}</p>
                  </div>
                ) : null}
                {fund.compliance.stamp_duty_pct != null ? (
                  <div>
                    <p className="text-caption text-muted-foreground">Stamp duty</p>
                    <p>{fund.compliance.tax_implication?.stamp_duty_note ?? `${fund.compliance.stamp_duty_pct}% on investment`}</p>
                  </div>
                ) : null}
                {fund.compliance.tax_implication?.sections?.map((section) => (
                  <div key={section.title}>
                    <p className="text-caption text-muted-foreground">{section.title}</p>
                    <p className="text-muted-foreground">{section.body}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {fund.fund_house?.name ? (
            <Card className="rounded-[var(--radius-medium)]">
              <CardHeader>
                <CardTitle>Fund house</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 text-compact">
                <div>
                  <p className="text-caption text-muted-foreground">AMC</p>
                  <p className="font-medium">{fund.fund_house.name}</p>
                </div>
                {fund.fund_house.rta?.name ? (
                  <div>
                    <p className="text-caption text-muted-foreground">Registrar</p>
                    <p className="font-medium">{fund.fund_house.rta.name}</p>
                  </div>
                ) : null}
                {fund.fund_house.address ? (
                  <div className="sm:col-span-2">
                    <p className="text-caption text-muted-foreground">Address</p>
                    <p className="text-muted-foreground">{fund.fund_house.address}</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {fund.content?.benchmark_name || fund.content?.fund_manager_name ? (
            <Card className="rounded-[var(--radius-medium)]">
              <CardHeader>
                <CardTitle>{copy.mutualFunds.fundFactsTitle}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 text-compact">
                {fund.content.benchmark_name ? (
                  <div>
                    <p className="text-caption text-muted-foreground">{copy.mutualFunds.benchmarkLabel}</p>
                    <p className="font-medium">{fund.content.benchmark_name}</p>
                  </div>
                ) : null}
                {fund.content.fund_manager_name ? (
                  <div>
                    <p className="text-caption text-muted-foreground">{copy.mutualFunds.fundManagerLabel}</p>
                    <p className="font-medium">{fund.content.fund_manager_name}</p>
                  </div>
                ) : null}
                {fund.content.amc_description ? (
                  <div className="sm:col-span-2">
                    <p className="text-caption text-muted-foreground">{copy.mutualFunds.amcDescriptionLabel}</p>
                    <p className="text-compact text-muted-foreground">{fund.content.amc_description}</p>
                  </div>
                ) : null}
                {fund.content.amc_website_url ? (
                  <div className="sm:col-span-2">
                    <a
                      href={fund.content.amc_website_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-compact text-primary underline-offset-4 hover:underline"
                    >
                      {copy.mutualFunds.amcWebsiteLabel}
                    </a>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card className="rounded-[var(--radius-medium)]">
            <CardHeader>
              <CardTitle>{copy.mutualFunds.navChartTitle}</CardTitle>
              <CardDescription>{copy.mutualFunds.navChartDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              {navHistory ? <MfNavChart points={navHistory.points} /> : null}
            </CardContent>
          </Card>

          <Card className="rounded-[var(--radius-medium)]">
            <CardHeader>
              <CardTitle>{copy.mutualFunds.returnsTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {returnRows.map(({ key, label }) => (
                  <div
                    key={key}
                    className="rounded-[var(--radius-card)] border border-border px-3 py-2"
                  >
                    <p className="text-caption text-muted-foreground">{label}</p>
                    <p className="font-medium">{formatReturn(fund.returns[key])}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[var(--radius-medium)]">
            <CardHeader>
              <CardTitle>{copy.mutualFunds.disclaimerTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-caption text-muted-foreground">
              <p>{fund.disclaimer ?? config?.disclaimer}</p>
              {fund.distributor_arn ? (
                <p>
                  {copy.mutualFunds.distributorArn}: {fund.distributor_arn}
                </p>
              ) : null}
              {fund.distributor_euin ? (
                <p>
                  {copy.mutualFunds.distributorEuin}: {fund.distributor_euin}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit rounded-[var(--radius-medium)] lg:sticky lg:top-6">
          <CardHeader>
            <CardTitle>{copy.mutualFunds.investTitle}</CardTitle>
            <CardDescription>{copy.mutualFunds.investDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1 text-compact">
              <p>
                <span className="text-muted-foreground">{copy.mutualFunds.minLumpsum}: </span>
                {formatInr(fund.min_lumpsum_amount_inr)}
              </p>
              <p>
                <span className="text-muted-foreground">{copy.mutualFunds.minSip}: </span>
                {formatInr(fund.min_sip_amount_inr)}
              </p>
            </div>

            {!config?.orders_enabled ? (
              <FieldMessage variant="warning" message={copy.mutualFunds.ordersDisabled} />
            ) : null}

            {canInvest ? (
              <>
                <div className="space-y-2">
                  <label htmlFor="mf-order-amount" className="text-compact font-medium">
                    {copy.mutualFunds.amountLabel}
                  </label>
                  <Input
                    id="mf-order-amount"
                    type="number"
                    min={fund.min_lumpsum_amount_inr ?? 1}
                    step="1"
                    placeholder={copy.mutualFunds.amountPlaceholder}
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                  />
                </div>
                {orderError ? <FieldMessage variant="error" message={orderError} /> : null}
                {orderSuccess ? <FieldMessage variant="success" message={orderSuccess} /> : null}
                <Button className="w-full" disabled={submitting} onClick={() => void handlePlaceOrder()}>
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {copy.mutualFunds.placingOrder}
                    </>
                  ) : (
                    copy.mutualFunds.placeOrder
                  )}
                </Button>
              </>
            ) : (
              <FieldMessage variant="info" message={copy.mutualFunds.investGated} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

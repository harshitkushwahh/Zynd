"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { copy } from "@/shared/config/copy";
import type { InvestFundDetail, InvestInvestmentDetails } from "@/features/invest/api/invest-api";
import { formatInr } from "@/features/invest/lib/mf-format";

type AmountBlock = {
  min_inr?: number | null;
  max_inr?: number | null;
  multiples_inr?: number | null;
};

function formatAmount(value: number | null | undefined) {
  if (value == null) return "—";
  return formatInr(value);
}

function formatUnits(value: number | null | undefined) {
  if (value == null) return "—";
  return value.toLocaleString("en-IN", { maximumFractionDigits: 4 });
}

function formatFrequency(frequency: string) {
  return frequency.charAt(0).toUpperCase() + frequency.slice(1);
}

function ConstraintGrid({ rows }: { rows: Array<{ label: string; value: string }> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {rows.map((row) => (
        <div key={row.label}>
          <p className="text-caption text-muted-foreground">{row.label}</p>
          <p className="font-medium">{row.value}</p>
        </div>
      ))}
    </div>
  );
}

function AmountSection({
  title,
  block,
}: {
  title: string;
  block: AmountBlock | null | undefined;
}) {
  if (!block) return null;
  const rows = [
    { label: copy.mutualFunds.investmentMin, value: formatAmount(block.min_inr) },
    { label: copy.mutualFunds.investmentMax, value: formatAmount(block.max_inr) },
    { label: copy.mutualFunds.investmentMultiples, value: formatAmount(block.multiples_inr) },
  ];
  if (!rows.some((row) => row.value !== "—")) return null;
  return (
    <div className="space-y-2">
      <p className="text-compact font-medium">{title}</p>
      <ConstraintGrid rows={rows} />
    </div>
  );
}

function transactionLabel(type: string) {
  const labels: Record<string, string> = {
    purchase: copy.mutualFunds.transactionPurchase,
    sip: copy.mutualFunds.transactionSip,
    redemption: copy.mutualFunds.transactionRedemption,
    switch: copy.mutualFunds.transactionSwitch,
    swp: copy.mutualFunds.transactionSwp,
    stp: copy.mutualFunds.transactionStp,
  };
  return labels[type] ?? type.toUpperCase();
}

type MfInvestmentDetailsCardProps = {
  details: InvestInvestmentDetails;
};

export function MfInvestmentDetailsCard({ details }: MfInvestmentDetailsCardProps) {
  const hasRedemption =
    details.redemption &&
    (details.redemption.min_inr != null ||
      details.redemption.max_inr != null ||
      details.redemption.min_units != null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.mutualFunds.investmentDetailsTitle}</CardTitle>
        <CardDescription>{copy.mutualFunds.investmentDetailsDescription}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 text-compact">
        <AmountSection title={copy.mutualFunds.oneTimeInvestmentTitle} block={details.lumpsum} />
        <AmountSection title={copy.mutualFunds.additionalInvestmentTitle} block={details.additional} />

        {hasRedemption ? (
          <div className="space-y-2">
            <p className="text-compact font-medium">{copy.mutualFunds.redemptionTitle}</p>
            <ConstraintGrid
              rows={[
                { label: copy.mutualFunds.investmentMin, value: formatAmount(details.redemption?.min_inr) },
                { label: copy.mutualFunds.investmentMax, value: formatAmount(details.redemption?.max_inr) },
                { label: copy.mutualFunds.investmentMultiples, value: formatAmount(details.redemption?.multiples_inr) },
                { label: copy.mutualFunds.redemptionMinUnits, value: formatUnits(details.redemption?.min_units) },
                {
                  label: copy.mutualFunds.redemptionUnitMultiples,
                  value: formatUnits(details.redemption?.unit_multiples),
                },
              ]}
            />
          </div>
        ) : null}

        {details.sip_options.length > 0 ? (
          <div className="space-y-2">
            <p className="text-compact font-medium">{copy.mutualFunds.sipOptionsTitle}</p>
            <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border">
              <table className="w-full min-w-[320px] text-left text-compact">
                <thead className="border-b border-border bg-muted/40">
                  <tr>
                    <th className="px-3 py-2 font-medium">{copy.mutualFunds.sipFrequency}</th>
                    <th className="px-3 py-2 font-medium">{copy.mutualFunds.investmentMin}</th>
                    <th className="px-3 py-2 font-medium">{copy.mutualFunds.sipMinInstallments}</th>
                  </tr>
                </thead>
                <tbody>
                  {details.sip_options.map((option) => (
                    <tr key={option.frequency} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">{formatFrequency(option.frequency)}</td>
                      <td className="px-3 py-2">{formatAmount(option.min_inr)}</td>
                      <td className="px-3 py-2">{option.min_installments ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {details.transaction_types.length > 0 ? (
          <div className="space-y-2">
            <p className="text-caption text-muted-foreground">{copy.mutualFunds.transactionTypesTitle}</p>
            <div className="flex flex-wrap gap-2">
              {details.transaction_types.map((type) => (
                <Badge key={type} variant="secondary">
                  {transactionLabel(type)}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function shouldShowInvestmentDetails(fund: InvestFundDetail) {
  return Boolean(fund.investment_details);
}

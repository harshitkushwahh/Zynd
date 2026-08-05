"use client";

import { useMemo, type ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  CalendarClock,
  CirclePlus,
  ClipboardList,
  IndianRupee,
  Layers,
  Repeat,
  ShoppingBag,
  Shuffle,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { copy } from "@/shared/config/copy";
import type { InvestFundDetail, InvestInvestmentDetails } from "@/features/invest/api/invest-api";
import { formatInr } from "@/features/invest/lib/mf-format";
import { MF_FUND_DETAIL_RADIUS_CLASS } from "@/features/invest/lib/mf-ui";
import { cn } from "@/lib/utils";

type AmountBlock = {
  min_inr?: number | null;
  max_inr?: number | null;
  multiples_inr?: number | null;
};

type DetailSection = {
  value: string;
  title: string;
  summary: string;
  icon: ReactNode;
  content: ReactNode;
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

function hasAmountBlock(block: AmountBlock | null | undefined) {
  if (!block) return false;
  return block.min_inr != null || block.max_inr != null || block.multiples_inr != null;
}

function amountBlockSummary(block: AmountBlock) {
  const parts = [
    block.min_inr != null ? `${copy.mutualFunds.investmentMin} ${formatAmount(block.min_inr)}` : null,
    block.max_inr != null ? `${copy.mutualFunds.investmentMax} ${formatAmount(block.max_inr)}` : null,
  ].filter(Boolean);
  return parts.join(" · ") || "—";
}

function ConstraintStatGrid({ rows }: { rows: Array<{ label: string; value: string }> }) {
  const visibleRows = rows.filter((row) => row.value !== "—");
  if (visibleRows.length === 0) return null;

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {visibleRows.map((row) => (
        <div
          key={row.label}
          className="rounded-[var(--radius-control)] border border-border/70 bg-muted/15 px-3 py-2.5"
        >
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {row.label}
          </p>
          <p className="mt-1 font-semibold tabular-nums text-foreground">{row.value}</p>
        </div>
      ))}
    </div>
  );
}

function AmountSectionContent({ block }: { block: AmountBlock }) {
  return (
    <ConstraintStatGrid
      rows={[
        { label: copy.mutualFunds.investmentMin, value: formatAmount(block.min_inr) },
        { label: copy.mutualFunds.investmentMax, value: formatAmount(block.max_inr) },
        { label: copy.mutualFunds.investmentMultiples, value: formatAmount(block.multiples_inr) },
      ]}
    />
  );
}

function SectionIcon({ children }: { children: ReactNode }) {
  return (
    <div className="sip-icon-badge flex size-9 shrink-0 items-center justify-center rounded-full">
      {children}
    </div>
  );
}

function AccordionSectionLabel({ title, summary }: { title: string; summary: string }) {
  return (
    <div className="min-w-0 flex-1 text-left">
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-0.5 truncate text-caption text-muted-foreground group-data-[panel-open]:hidden">
        {summary}
      </p>
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

function TransactionTypeIcon({ type }: { type: string }) {
  const className = "size-3.5 shrink-0";
  switch (type) {
    case "purchase":
      return <ShoppingBag className={className} strokeWidth={2.25} />;
    case "sip":
      return <CalendarClock className={className} strokeWidth={2.25} />;
    case "redemption":
      return <ArrowDownToLine className={className} strokeWidth={2.25} />;
    case "switch":
      return <ArrowLeftRight className={className} strokeWidth={2.25} />;
    case "swp":
      return <Repeat className={className} strokeWidth={2.25} />;
    case "stp":
      return <Shuffle className={className} strokeWidth={2.25} />;
    default:
      return <Layers className={className} strokeWidth={2.25} />;
  }
}

function buildInvestmentDetailSections(details: InvestInvestmentDetails): DetailSection[] {
  const sections: DetailSection[] = [];

  if (hasAmountBlock(details.lumpsum)) {
    sections.push({
      value: "lumpsum",
      title: copy.mutualFunds.oneTimeInvestmentTitle,
      summary: amountBlockSummary(details.lumpsum!),
      icon: (
        <SectionIcon>
          <IndianRupee className="size-4" strokeWidth={2.25} />
        </SectionIcon>
      ),
      content: <AmountSectionContent block={details.lumpsum!} />,
    });
  }

  if (hasAmountBlock(details.additional)) {
    sections.push({
      value: "additional",
      title: copy.mutualFunds.additionalInvestmentTitle,
      summary: amountBlockSummary(details.additional!),
      icon: (
        <SectionIcon>
          <CirclePlus className="size-4" strokeWidth={2.25} />
        </SectionIcon>
      ),
      content: <AmountSectionContent block={details.additional!} />,
    });
  }

  const hasRedemption =
    details.redemption &&
    (details.redemption.min_inr != null ||
      details.redemption.max_inr != null ||
      details.redemption.min_units != null ||
      details.redemption.unit_multiples != null);

  if (hasRedemption) {
    const redemption = details.redemption!;
    sections.push({
      value: "redemption",
      title: copy.mutualFunds.redemptionTitle,
      summary: [
        redemption.min_inr != null
          ? `${copy.mutualFunds.investmentMin} ${formatAmount(redemption.min_inr)}`
          : null,
        redemption.min_units != null
          ? `${copy.mutualFunds.redemptionMinUnits} ${formatUnits(redemption.min_units)}`
          : null,
      ]
        .filter(Boolean)
        .join(" · "),
      icon: (
        <SectionIcon>
          <ArrowDownToLine className="size-4" strokeWidth={2.25} />
        </SectionIcon>
      ),
      content: (
        <ConstraintStatGrid
          rows={[
            { label: copy.mutualFunds.investmentMin, value: formatAmount(redemption.min_inr) },
            { label: copy.mutualFunds.investmentMax, value: formatAmount(redemption.max_inr) },
            {
              label: copy.mutualFunds.investmentMultiples,
              value: formatAmount(redemption.multiples_inr),
            },
            { label: copy.mutualFunds.redemptionMinUnits, value: formatUnits(redemption.min_units) },
            {
              label: copy.mutualFunds.redemptionUnitMultiples,
              value: formatUnits(redemption.unit_multiples),
            },
          ]}
        />
      ),
    });
  }

  if (details.sip_options.length > 0) {
    const lowestMin = details.sip_options.reduce<number | null>((best, option) => {
      if (option.min_inr == null) return best;
      if (best == null || option.min_inr < best) return option.min_inr;
      return best;
    }, null);

    sections.push({
      value: "sip-options",
      title: copy.mutualFunds.sipOptionsTitle,
      summary:
        lowestMin != null
          ? `${details.sip_options.length} frequencies · ${copy.mutualFunds.investmentMin} ${formatAmount(lowestMin)}`
          : `${details.sip_options.length} frequencies`,
      icon: (
        <SectionIcon>
          <CalendarClock className="size-4" strokeWidth={2.25} />
        </SectionIcon>
      ),
      content: (
        <div className="overflow-hidden rounded-[var(--radius-control)] border border-border/70">
          <table className="w-full min-w-[320px] text-left text-compact">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                <th className="px-3 py-2.5 font-medium text-muted-foreground">
                  {copy.mutualFunds.sipFrequency}
                </th>
                <th className="px-3 py-2.5 font-medium text-muted-foreground">
                  {copy.mutualFunds.investmentMin}
                </th>
                <th className="px-3 py-2.5 font-medium text-muted-foreground">
                  {copy.mutualFunds.sipMinInstallments}
                </th>
              </tr>
            </thead>
            <tbody>
              {details.sip_options.map((option) => (
                <tr key={option.frequency} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2.5 font-medium">{formatFrequency(option.frequency)}</td>
                  <td className="px-3 py-2.5 tabular-nums">{formatAmount(option.min_inr)}</td>
                  <td className="px-3 py-2.5 tabular-nums">{option.min_installments ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ),
    });
  }

  if (details.transaction_types.length > 0) {
    sections.push({
      value: "transactions",
      title: copy.mutualFunds.transactionTypesTitle,
      summary: details.transaction_types.map(transactionLabel).join(", "),
      icon: (
        <SectionIcon>
          <Layers className="size-4" strokeWidth={2.25} />
        </SectionIcon>
      ),
      content: (
        <div className="flex flex-wrap gap-2">
          {details.transaction_types.map((type) => (
            <Badge
              key={type}
              variant="secondary"
              className="gap-1.5 px-2.5 py-1.5 text-caption font-medium"
            >
              <TransactionTypeIcon type={type} />
              {transactionLabel(type)}
            </Badge>
          ))}
        </div>
      ),
    });
  }

  return sections;
}

type MfInvestmentDetailsCardProps = {
  details: InvestInvestmentDetails;
};

export function MfInvestmentDetailsCard({ details }: MfInvestmentDetailsCardProps) {
  const sections = useMemo(() => buildInvestmentDetailSections(details), [details]);
  const defaultOpen = useMemo(
    () => (sections[0] ? [sections[0].value] : []),
    [sections],
  );

  if (sections.length === 0) return null;

  return (
    <Card className={cn("overflow-hidden border border-border", MF_FUND_DETAIL_RADIUS_CLASS)}>
      <CardHeader className="border-b border-border/60 bg-muted/10">
        <div className="flex items-start gap-3">
          <div className="sip-icon-badge mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full">
            <ClipboardList className="size-4" strokeWidth={2.25} />
          </div>
          <div className="min-w-0">
            <CardTitle>{copy.mutualFunds.investmentDetailsTitle}</CardTitle>
            <CardDescription>{copy.mutualFunds.investmentDetailsDescription}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-1">
        <Accordion multiple defaultValue={defaultOpen} className="w-full">
          {sections.map((section) => (
            <AccordionItem key={section.value} value={section.value}>
              <AccordionTrigger className="px-1">
                {section.icon}
                <AccordionSectionLabel title={section.title} summary={section.summary} />
              </AccordionTrigger>
              <AccordionContent className="px-1 pl-[2.75rem]">{section.content}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}

export function shouldShowInvestmentDetails(fund: InvestFundDetail) {
  return Boolean(fund.investment_details);
}

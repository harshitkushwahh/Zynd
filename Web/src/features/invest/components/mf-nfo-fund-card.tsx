"use client";

import { Megaphone } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { InvestFundSummary } from "@/features/invest/api/invest-api";
import { AmcLogo } from "@/features/invest/components/mf-amc-logo";
import { formatInr } from "@/features/invest/lib/mf-format";
import { formatNfoSubscriptionPeriod } from "@/features/invest/lib/mf-nfo";
import {
  MF_FUND_CARD_HOVER_CLASS,
  MF_FUND_CARD_RADIUS_CLASS,
} from "@/features/invest/lib/mf-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type MfNfoFundCardProps = {
  fund: InvestFundSummary;
  onSelect: (fund: InvestFundSummary) => void;
  className?: string;
};

function Metric({ label, value, align = "left" }: { label: string; value: string; align?: "left" | "right" }) {
  return (
    <div className={cn("min-w-0", align === "right" && "text-right")}>
      <p className="text-caption text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-compact font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

export function MfNfoFundCard({ fund, onSelect, className }: MfNfoFundCardProps) {
  const minInvestment = fund.min_lumpsum_amount_inr ?? fund.min_sip_amount_inr;
  const period = formatNfoSubscriptionPeriod(
    fund.nfo?.subscription_open_date,
    fund.nfo?.subscription_close_date,
  );

  return (
    <button
      type="button"
      onClick={() => onSelect(fund)}
      className={cn("group min-w-0 max-w-full text-left", className)}
    >
      <Card
        className={cn(
          MF_FUND_CARD_RADIUS_CLASS,
          "h-full min-w-0 overflow-hidden border border-zinc-200 bg-card ring-0 shadow-none transition-colors duration-200 dark:border-zinc-600/80",
          MF_FUND_CARD_HOVER_CLASS,
          "hover:border-zinc-300 dark:hover:border-zinc-500",
        )}
      >
        <CardContent className="relative flex h-full min-w-0 flex-col p-4">
          <div className="flex min-w-0 items-start gap-3">
            <AmcLogo fund={fund} className="shrink-0" />
            <div className="min-w-0 flex-1 pr-14">
              <p className="line-clamp-2 break-words font-semibold uppercase leading-snug text-foreground">
                {fund.name}
              </p>
              <p className="mt-1 line-clamp-1 truncate text-caption text-muted-foreground">{fund.amc_name}</p>
            </div>
            <span className="absolute right-4 top-4 inline-flex items-center gap-1 text-caption font-semibold uppercase tracking-wide text-destructive">
              <Megaphone className="size-3.5" strokeWidth={2.25} aria-hidden />
              {copy.mutualFunds.nfoBadge}
            </span>
          </div>

          <div className="relative mt-4 grid min-w-0 grid-cols-2 gap-3 border-t border-border/70 pt-3">
            <Metric label={copy.mutualFunds.nfoSubscriptionPeriodLabel} value={period} />
            <Metric
              label={copy.mutualFunds.nfoMinInvestmentLabel}
              value={formatInr(minInvestment)}
              align="right"
            />
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

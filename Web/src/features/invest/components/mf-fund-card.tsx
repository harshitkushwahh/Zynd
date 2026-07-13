"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { InvestFundSummary } from "@/features/invest/api/invest-api";
import {
  formatInr,
  formatReturn,
  healthBadgeLabel,
} from "@/features/invest/lib/mf-format";
import { cn } from "@/lib/utils";

type MfFundCardProps = {
  fund: InvestFundSummary;
  onSelect: (productId: string) => void;
  className?: string;
};

function AmcLogo({ fund }: { fund: InvestFundSummary }) {
  if (fund.amc_logo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={fund.amc_logo_url}
        alt=""
        className="size-10 rounded-[var(--radius-control)] border border-border bg-background object-contain p-1"
      />
    );
  }

  return (
    <div className="flex size-10 items-center justify-center rounded-[var(--radius-control)] border border-border bg-muted text-caption font-semibold text-muted-foreground">
      {fund.amc_name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function displayRiskLabel(fund: InvestFundSummary) {
  return fund.display?.risk_label ?? fund.sebi_category;
}

export function MfFundCard({ fund, onSelect, className }: MfFundCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(fund.product_id)}
      className={cn("w-full text-left", className)}
    >
      <Card className="h-full transition-colors hover:border-primary/40 hover:bg-card/90">
        <CardContent className="flex h-full flex-col gap-4 p-4">
          <div className="flex items-start gap-3">
            <AmcLogo fund={fund} />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 font-medium text-foreground">{fund.name}</p>
              {fund.display?.tagline ? (
                <p className="mt-1 line-clamp-2 text-caption text-muted-foreground">{fund.display.tagline}</p>
              ) : (
                <p className="mt-1 text-caption text-muted-foreground">{fund.amc_name}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {displayRiskLabel(fund) ? (
              <Badge variant="outline">{displayRiskLabel(fund)}</Badge>
            ) : null}
            {fund.display?.hero_badge ? <Badge variant="secondary">{fund.display.hero_badge}</Badge> : null}
            {fund.is_featured ? <Badge variant="secondary">Featured</Badge> : null}
            {fund.health_badges?.map((flag) => (
              <Badge key={flag} variant="warning">
                {healthBadgeLabel(flag)}
              </Badge>
            ))}
          </div>

          <div className="mt-auto grid grid-cols-2 gap-3 border-t border-border pt-3">
            <div>
              <p className="text-caption text-muted-foreground">3Y return</p>
              <p className="font-medium text-foreground">{formatReturn(fund.returns.return_3y)}</p>
            </div>
            <div className="text-right">
              <p className="text-caption text-muted-foreground">Min SIP</p>
              <p className="font-medium text-foreground">{formatInr(fund.min_sip_amount_inr)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

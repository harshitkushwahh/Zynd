"use client";

import { Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { InvestFundSummary } from "@/features/invest/api/invest-api";
import {
  formatInr,
  formatSignedReturn,
  healthBadgeLabel,
  resolveInvestAssetUrl,
} from "@/features/invest/lib/mf-format";
import {
  MF_CARD_RADIUS_CLASS,
  MF_FUND_CARD_HOVER_CLASS,
} from "@/features/invest/lib/mf-ui";
import { cn } from "@/lib/utils";

type MfFundCardProps = {
  fund: InvestFundSummary;
  onSelect: (productId: string) => void;
  className?: string;
};

function AmcLogo({ fund, className }: { fund: InvestFundSummary; className?: string }) {
  const logoUrl = resolveInvestAssetUrl(fund.amc_logo_url);
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        className={cn(
          "size-11 rounded-[var(--radius-control)] border border-border/60 bg-background object-contain p-1.5",
          className,
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex size-11 items-center justify-center rounded-[var(--radius-control)] border border-border/60 bg-muted/40 text-caption font-semibold text-muted-foreground",
        className,
      )}
    >
      {fund.amc_name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function displayRiskLabel(fund: InvestFundSummary) {
  return fund.display?.risk_label ?? fund.sebi_category;
}

function FundMetric({
  label,
  value,
  tone,
  align = "left",
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "muted";
  align?: "left" | "right";
}) {
  return (
    <div className={cn("min-w-0", align === "right" && "text-right")}>
      <p className="text-caption text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 truncate text-compact font-semibold tabular-nums",
          tone === "positive" && "text-success",
          tone === "negative" && "text-destructive",
          tone === "muted" && "text-muted-foreground",
          !tone && "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function MfFundCard({ fund, onSelect, className }: MfFundCardProps) {
  const return3y = formatSignedReturn(fund.returns.return_3y);
  const categoryLabel = displayRiskLabel(fund);

  const secondaryBadges = [
    fund.display?.hero_badge
      ? { key: "hero", label: fund.display.hero_badge, variant: "secondary" as const }
      : null,
    fund.is_featured ? { key: "featured", label: "Featured", variant: "secondary" as const } : null,
    ...(fund.health_badges ?? []).map((flag) => ({
      key: flag,
      label: healthBadgeLabel(flag),
      variant: "warning" as const,
    })),
  ].filter(Boolean);

  return (
    <button
      type="button"
      onClick={() => onSelect(fund.product_id)}
      className={cn("group min-w-0 max-w-full text-left", className)}
    >
      <Card
        className={cn(
          MF_CARD_RADIUS_CLASS,
          "h-full min-w-0 overflow-hidden border border-border/50 bg-card ring-0 shadow-none transition-colors duration-200",
          MF_FUND_CARD_HOVER_CLASS,
          "hover:border-border/80",
        )}
      >
        <CardContent className="flex h-full min-w-0 flex-col gap-3 p-4">
          <div className="flex min-w-0 items-start gap-3">
            <AmcLogo fund={fund} className="shrink-0" />

            <div className="relative min-w-0 flex-1 overflow-hidden">
              {categoryLabel ? (
                <Badge
                  variant="outline"
                  className="absolute top-0 right-0 max-w-[5.5rem] truncate uppercase"
                >
                  {categoryLabel}
                </Badge>
              ) : null}

              <div className={cn("min-w-0", categoryLabel && "pr-[4.5rem]")}>
                <p className="line-clamp-2 break-words font-semibold leading-snug text-foreground">
                  {fund.name}
                </p>
                <p className="mt-1 line-clamp-1 truncate text-caption text-muted-foreground">
                  {fund.amc_name}
                </p>
              </div>
            </div>
          </div>

          {secondaryBadges.length > 0 ? (
            <div className="flex min-w-0 flex-wrap gap-1.5">
              {secondaryBadges.slice(0, 2).map((badge) =>
                badge ? (
                  <Badge key={badge.key} variant={badge.variant} className="max-w-full truncate">
                    {badge.variant === "secondary" && badge.key === "featured" ? (
                      <span className="inline-flex items-center gap-1">
                        <Star className="size-3 fill-current" />
                        {badge.label}
                      </span>
                    ) : (
                      badge.label
                    )}
                  </Badge>
                ) : null,
              )}
            </div>
          ) : null}

          <div className="mt-auto min-w-0">
            <div className="grid min-w-0 grid-cols-2 gap-3 rounded-[var(--radius-card)] border border-border/50 bg-muted/10 px-3 py-3">
              <FundMetric label="3Y return" value={return3y.text} tone={return3y.tone} />
              <FundMetric
                label="Min SIP"
                value={formatInr(fund.min_sip_amount_inr)}
                align="right"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

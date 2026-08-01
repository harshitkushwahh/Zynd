import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { DistributorMetricTileFittedValue } from "@/components/dashboard/distributor-metric-tile-fitted-value";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type DistributorMetricCardProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  href?: string;
  className?: string;
  variant?: "default" | "tile";
  /** Dark green gradient tile (dashboard “Open orders” style) */
  tileTone?: "default" | "accent";
  /** Show top-right arrow control on tile cards */
  showTileAction?: boolean;
  /** Show leading icon on tile cards */
  showTileIcon?: boolean;
  /** Shrink tile value text to fit the card width */
  fitTileValue?: boolean;
  /** Full value shown on hover when display value is compact */
  valueTitle?: string;
};

export function DistributorMetricCard({
  icon: Icon,
  label,
  value,
  hint,
  href,
  className,
  variant = "default",
  tileTone = "default",
  showTileAction = true,
  showTileIcon = true,
  fitTileValue = false,
  valueTitle,
}: DistributorMetricCardProps) {
  const isTile = variant === "tile";
  const isAccent = tileTone === "accent";
  const showTileHeader = showTileIcon || showTileAction;

  const content = isTile ? (
    <CardContent className="distributor-metric-card__body distributor-metric-card__body--tile">
      {showTileHeader ? (
        <div className="distributor-metric-card__tile-header">
          {showTileIcon ? (
            <span
              className={cn(
                "distributor-metric-card__tile-icon",
                isAccent && "distributor-metric-card__tile-icon--accent",
              )}
              aria-hidden
            >
              <Icon strokeWidth={2.25} />
            </span>
          ) : (
            <span aria-hidden />
          )}
          {showTileAction ? (
            <span
              className={cn(
                "distributor-metric-card__tile-action",
                isAccent && "distributor-metric-card__tile-action--accent",
              )}
              aria-hidden={!href}
            >
              <ArrowUpRight strokeWidth={2.25} />
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="distributor-metric-card__tile-main">
        {fitTileValue ? (
          <DistributorMetricTileFittedValue
            value={value}
            title={valueTitle}
            className="distributor-metric-card__value distributor-metric-card__value--tile tabular-nums"
          />
        ) : (
          <span
            className="distributor-metric-card__value distributor-metric-card__value--tile tabular-nums"
            title={valueTitle}
          >
            {value}
          </span>
        )}
        <span className="distributor-metric-card__tile-label">{label}</span>
        {hint ? (
          <span className="distributor-metric-card__hint distributor-metric-card__hint--tile">{hint}</span>
        ) : null}
      </div>
    </CardContent>
  ) : (
    <CardContent className="distributor-metric-card__body">
      <span className="distributor-page-icon distributor-page-icon--sm" aria-hidden>
        <Icon strokeWidth={2.25} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-caption font-medium text-muted-foreground">{label}</span>
        <span className="distributor-metric-card__value">{value}</span>
        {hint ? <span className="distributor-metric-card__hint">{hint}</span> : null}
      </span>
    </CardContent>
  );

  const cardClass = cn(
    isTile && "distributor-metric-card--tile h-full w-full ring-0 rounded-4xl overflow-hidden",
    isTile && isAccent && "distributor-metric-card--tile-accent",
    !isTile && "h-full shadow-sm",
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          "distributor-metric-card__link block h-full min-h-0 min-w-0 w-full cursor-pointer no-underline",
          className,
        )}
      >
        <Card className={cn(cardClass, "h-full w-full")}>{content}</Card>
      </Link>
    );
  }

  return <Card className={cn(cardClass, className)}>{content}</Card>;
}

"use client";

import { useCallback, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Check, Copy } from "lucide-react";

import { DistributorMetricTileFittedValue } from "@/components/dashboard/distributor-metric-tile-fitted-value";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type DistributorCopyMetricTileProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  className?: string;
  tileTone?: "default" | "accent";
  fitTileValue?: boolean;
  valueTitle?: string;
};

export function DistributorCopyMetricTile({
  icon: Icon,
  label,
  value,
  hint = "Tap to copy",
  className,
  tileTone = "default",
  fitTileValue = false,
  valueTitle,
}: DistributorCopyMetricTileProps) {
  const [copied, setCopied] = useState(false);
  const isAccent = tileTone === "accent";

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [value]);

  return (
    <button
      type="button"
      className={cn(
        "distributor-copy-metric-tile block h-full min-h-0 min-w-0 w-full cursor-pointer text-left",
        className,
      )}
      onClick={() => void onCopy()}
      aria-label={copied ? `${label} copied` : `Copy ${label} ${value}`}
    >
      <Card
        className={cn(
          "distributor-metric-card--tile distributor-copy-metric-tile__card h-full w-full overflow-hidden rounded-4xl ring-0",
          isAccent && "distributor-metric-card--tile-accent",
          copied && "distributor-copy-metric-tile__card--copied",
        )}
      >
        <CardContent className="distributor-metric-card__body distributor-metric-card__body--tile">
          <div className="distributor-metric-card__tile-header">
            <span
              className={cn(
                "distributor-metric-card__tile-icon",
                isAccent && "distributor-metric-card__tile-icon--accent",
              )}
              aria-hidden
            >
              <Icon strokeWidth={2.25} />
            </span>
            <span
              className={cn(
                "distributor-metric-card__tile-action distributor-copy-metric-tile__action",
                isAccent && "distributor-metric-card__tile-action--accent",
              )}
              aria-hidden
            >
              {copied ? (
                <Check strokeWidth={2.5} className="text-success" />
              ) : (
                <Copy strokeWidth={2.25} />
              )}
            </span>
          </div>
          <div className="distributor-metric-card__tile-main">
            {fitTileValue ? (
              <DistributorMetricTileFittedValue
                value={value}
                title={valueTitle ?? value}
                className="distributor-metric-card__value distributor-metric-card__value--tile distributor-copy-metric-tile__value font-mono tabular-nums"
              />
            ) : (
              <span
                className="distributor-metric-card__value distributor-metric-card__value--tile distributor-copy-metric-tile__value font-mono tabular-nums"
                title={valueTitle ?? value}
              >
                {value}
              </span>
            )}
            <span className="distributor-metric-card__tile-label">{label}</span>
            {hint ? (
              <span className="distributor-metric-card__hint distributor-metric-card__hint--tile">
                {copied ? "Copied" : hint}
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

export type { DistributorCopyMetricTileProps };

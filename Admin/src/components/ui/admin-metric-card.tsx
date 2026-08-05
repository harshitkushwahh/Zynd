"use client";

import { Info, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type AdminMetricCardTone = "default" | "success" | "warning" | "info" | "muted";

type AdminMetricCardProps = {
  label: string;
  value: React.ReactNode;
  hint?: string;
  infoDescription?: string;
  infoDetails?: string[];
  icon: LucideIcon;
  tone?: AdminMetricCardTone;
  /** @deprecated Overview is the default. Use `variant="compact"` for the legacy layout. */
  variant?: "overview" | "compact";
  /** Force brand accent styling (first card in AdminMetricCardsGrid is accented automatically). */
  accent?: boolean;
  loading?: boolean;
  className?: string;
};

function iconToneClass(tone: AdminMetricCardTone, accent: boolean) {
  if (accent) return "admin-metric-card__icon--accent";
  if (tone === "success") return "admin-metric-card__icon--success";
  if (tone === "warning") return "admin-metric-card__icon--warning";
  if (tone === "info") return "admin-metric-card__icon--info";
  if (tone === "muted") return "admin-metric-card__icon--muted";
  return "admin-metric-card__icon--default";
}

function MetricInfoTooltip({
  label,
  description,
  details,
  accent = false,
}: {
  label: string;
  description: string;
  details?: string[];
  accent?: boolean;
}) {
  const detailLines = details?.filter(Boolean) ?? [];

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "size-6 shrink-0 text-muted-foreground hover:text-foreground",
              accent && "text-white/80 hover:text-white hover:bg-white/10",
            )}
            aria-label={`About ${label}`}
          >
            <Info className="size-3.5" />
          </Button>
        }
      />
      <TooltipContent side="top" className="max-w-64 text-pretty leading-relaxed">
        <span className="block">{description}</span>
        {detailLines.map((detail) => (
          <span key={detail} className="mt-1 block opacity-90">
            {detail}
          </span>
        ))}
      </TooltipContent>
    </Tooltip>
  );
}

export function AdminMetricCard({
  label,
  value,
  hint,
  infoDescription,
  infoDetails,
  icon: Icon,
  tone = "default",
  variant = "overview",
  accent = false,
  loading = false,
  className,
}: AdminMetricCardProps) {
  if (variant === "overview") {
    return (
      <div className={cn("admin-metric-card-outer", className)}>
        <Card
          className={cn(
            "admin-metric-card admin-metric-card--overview h-full ring-0",
            accent && "admin-metric-card--overview-accent",
          )}
        >
          <CardContent className="admin-metric-card__body admin-metric-card__body--overview">
            <div className={cn("admin-metric-card__icon", iconToneClass(tone, accent))}>
              <Icon className="size-4" strokeWidth={2.25} />
            </div>
            <div className="admin-metric-card__overview-main">
              {loading ? (
                <Skeleton
                  className={cn(
                    "admin-metric-card__overview-value-skeleton",
                    accent && "admin-metric-card__overview-value-skeleton--accent",
                  )}
                />
              ) : (
                <div className="admin-metric-card__overview-value tabular-nums">{value}</div>
              )}
              <div className="flex items-center gap-1">
                <p className="admin-metric-card__overview-label">{label}</p>
                {infoDescription ? (
                  <MetricInfoTooltip
                    label={label}
                    description={infoDescription}
                    details={infoDetails}
                    accent={accent}
                  />
                ) : null}
              </div>
              {hint ? <p className="admin-metric-card__overview-hint">{hint}</p> : null}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Card className={cn("h-full", className)}>
      <CardContent className="flex gap-3 p-4">
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-md",
            accent ? "admin-metric-card__icon--accent" : "",
            !accent && tone === "success" && "bg-success/10 text-success",
            !accent && tone === "warning" && "bg-warning/10 text-warning",
            !accent && tone === "info" && "bg-primary/10 text-primary",
            !accent && tone === "muted" && "bg-muted/40 text-muted-foreground",
            !accent && tone === "default" && "bg-muted/50 text-muted-foreground",
          )}
        >
          <Icon className="size-4" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <p className="text-caption text-muted-foreground">{label}</p>
            {infoDescription ? (
              <MetricInfoTooltip
                label={label}
                description={infoDescription}
                details={infoDetails}
              />
            ) : null}
          </div>
          {loading ? (
            <Skeleton className="mt-1 h-8 w-16" />
          ) : (
            <p className="mt-1 font-sans text-h4 font-semibold tabular-nums text-foreground">{value}</p>
          )}
          {hint ? (
            <p className="mt-1 text-caption leading-relaxed text-muted-foreground">{hint}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { useId, useState } from "react";
import { Info, RefreshCw, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type AdminMetricCardTone = "default" | "success" | "warning" | "info" | "muted";

export type AdminMetricCardFace = {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: LucideIcon;
};

type AdminMetricCardProps = {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  infoDescription?: string;
  infoDetails?: string[];
  icon: LucideIcon;
  tone?: AdminMetricCardTone;
  /**
   * `overview` — hero/primary KPI cards.
   * `secondary` — smaller supporting KPI cards.
   * `compact` — legacy alias of `secondary`.
   * `flip` — secondary card that flips to `back` on click.
   */
  variant?: "overview" | "secondary" | "compact" | "flip";
  back?: AdminMetricCardFace;
  defaultFlipped?: boolean;
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

function MetricIconInfoTooltip({
  label,
  description,
  details,
  icon: Icon,
  tone,
}: {
  label: string;
  description: string;
  details?: string[];
  icon: LucideIcon;
  tone: AdminMetricCardTone;
}) {
  const detailLines = details?.filter(Boolean) ?? [];

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className="admin-metric-card__secondary-icon-trigger"
            aria-label={`About ${label}`}
          >
            <span className={cn("admin-metric-card__icon admin-metric-card__icon--secondary", iconToneClass(tone, false))}>
              <Icon className="size-3.5" strokeWidth={2} />
            </span>
          </button>
        }
      />
      <TooltipContent
        side="top"
        align="start"
        className="max-w-64 text-pretty leading-relaxed"
      >
        <span className="block font-medium">{label}</span>
        <span className="mt-1 block opacity-90">{description}</span>
        {detailLines.map((detail) => (
          <span key={detail} className="mt-1 block opacity-90">
            {detail}
          </span>
        ))}
      </TooltipContent>
    </Tooltip>
  );
}

function AdminMetricCardFlipFace({
  face,
  side,
  loading = false,
}: {
  face: AdminMetricCardFace;
  side: "front" | "back";
  loading?: boolean;
}) {
  const Icon = face.icon;

  return (
    <div
      className={cn(
        "admin-flip-metric-card__face",
        side === "front"
          ? "admin-flip-metric-card__face--front"
          : "admin-flip-metric-card__face--back",
      )}
    >
      <span className="admin-metric-card__icon admin-metric-card__icon--secondary admin-metric-card__icon--muted">
        <Icon className="size-3.5" strokeWidth={2} />
      </span>
      <div className="admin-flip-metric-card__content">
        <p className="admin-metric-card__secondary-label">{face.label}</p>
        {loading ? (
          <Skeleton className="admin-metric-card__secondary-value-skeleton" />
        ) : (
          <p className="admin-metric-card__secondary-value tabular-nums">{face.value}</p>
        )}
        {face.hint ? <p className="admin-metric-card__secondary-hint">{face.hint}</p> : null}
      </div>
      <span className="admin-flip-metric-card__flip-btn" aria-hidden>
        <RefreshCw className="size-3.5" strokeWidth={2.25} />
      </span>
    </div>
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
  back,
  defaultFlipped = false,
  accent = false,
  loading = false,
  className,
}: AdminMetricCardProps) {
  const [flipped, setFlipped] = useState(defaultFlipped);
  const labelId = useId();

  if (variant === "flip") {
    if (!back) {
      throw new Error("AdminMetricCard variant=\"flip\" requires a back face.");
    }

    const front: AdminMetricCardFace = { label, value, hint, icon: Icon };

    return (
      <div className={cn("admin-metric-card-outer", className)}>
        <button
          type="button"
          className={cn("admin-flip-metric-card", flipped && "admin-flip-metric-card--flipped")}
          aria-pressed={flipped}
          aria-labelledby={labelId}
          onClick={() => setFlipped((current) => !current)}
        >
          <span id={labelId} className="sr-only">
            {flipped ? back.label : front.label}. Activate to flip card.
          </span>
          <span className="admin-flip-metric-card__inner">
            <AdminMetricCardFlipFace face={front} side="front" loading={loading} />
            <AdminMetricCardFlipFace face={back} side="back" loading={loading} />
          </span>
        </button>
      </div>
    );
  }

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

  const secondaryTooltipDescription =
    infoDescription ||
    (typeof hint === "string" ? hint : null) ||
    `${label} summary`;

  return (
    <div className={cn("admin-metric-card-outer", className)}>
      <Card className="admin-metric-card admin-metric-card--secondary h-full ring-0">
        <CardContent className="admin-metric-card__body admin-metric-card__body--secondary">
          <MetricIconInfoTooltip
            label={label}
            description={secondaryTooltipDescription}
            details={infoDetails}
            icon={Icon}
            tone={tone}
          />
          <div className="admin-metric-card__secondary-content">
            <p className="admin-metric-card__secondary-label">{label}</p>
            {loading ? (
              <Skeleton className="admin-metric-card__secondary-value-skeleton" />
            ) : (
              <p className="admin-metric-card__secondary-value tabular-nums">{value}</p>
            )}
            {hint ? <p className="admin-metric-card__secondary-hint">{hint}</p> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

type AdminSecondaryMetricCardProps = Omit<AdminMetricCardProps, "variant" | "accent">;

/** Smaller supporting KPI card — use under hero/overview metric rows. */
export function AdminSecondaryMetricCard(props: AdminSecondaryMetricCardProps) {
  return <AdminMetricCard {...props} variant="secondary" />;
}

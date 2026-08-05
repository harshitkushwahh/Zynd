"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, ShieldAlert, ShieldCheck, type LucideIcon } from "lucide-react";

import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/status-badge";
import type { SecurityConfigItem } from "@/lib/admin-api";
import {
  formatSecurityConfigDisplayValue,
  formatSecurityConfigValue,
} from "@/lib/admin-security-config-meta";
import { cn } from "@/lib/utils";

function findConfigItem(items: SecurityConfigItem[], key: string) {
  return items.find((item) => item.key === key) ?? null;
}

export function getRiskEnforcementLadderData(items: SecurityConfigItem[]) {
  const mediumScore = findConfigItem(items, "risk.medium_score");
  const highScore = findConfigItem(items, "risk.high_score");
  const mediumAction = findConfigItem(items, "risk.medium_action");
  const highAction = findConfigItem(items, "risk.high_action");

  return {
    mediumValue: Number(formatSecurityConfigValue(mediumScore?.value)),
    highValue: Number(formatSecurityConfigValue(highScore?.value)),
    mediumActionLabel: mediumAction
      ? formatSecurityConfigDisplayValue("risk.medium_action", mediumAction.value)
      : "Step-up enforcement",
    highActionLabel: highAction
      ? formatSecurityConfigDisplayValue("risk.high_action", highAction.value)
      : "Block sign-in",
  };
}

type LadderSlide = {
  id: string;
  label: string;
  range: string;
  action: string;
  icon: LucideIcon;
  toneClass: string;
  iconClass: string;
  badgeVariant: StatusBadgeVariant;
};

function buildLadderSlides({
  mediumValue,
  highValue,
  mediumActionLabel,
  highActionLabel,
}: ReturnType<typeof getRiskEnforcementLadderData>): LadderSlide[] {
  const lowMax = Number.isFinite(mediumValue) ? Math.max(mediumValue - 1, 0) : null;
  const mediumMin = Number.isFinite(mediumValue) ? mediumValue : null;
  const mediumMax = Number.isFinite(highValue) ? Math.max(highValue - 1, mediumValue) : null;
  const highMin = Number.isFinite(highValue) ? highValue : null;

  return [
    {
      id: "low",
      label: "Low risk",
      range: lowMax !== null ? `0 – ${lowMax}` : "—",
      action: "Allow sign-in",
      icon: CheckCircle2,
      toneClass: "border-success/20 bg-success/[0.07]",
      iconClass: "bg-success/15 text-success",
      badgeVariant: "success",
    },
    {
      id: "medium",
      label: "Medium risk",
      range:
        mediumMin !== null && mediumMax !== null ? `${mediumMin} – ${mediumMax}` : "—",
      action: mediumActionLabel,
      icon: ShieldCheck,
      toneClass: "border-primary/20 bg-primary/[0.07]",
      iconClass: "bg-primary/12 text-primary",
      badgeVariant: "info",
    },
    {
      id: "high",
      label: "High risk",
      range: highMin !== null ? `${highMin}+` : "—",
      action: highActionLabel,
      icon: ShieldAlert,
      toneClass: "border-destructive/20 bg-destructive/[0.07]",
      iconClass: "bg-destructive/12 text-destructive",
      badgeVariant: "destructive",
    },
  ];
}

export function RiskEnforcementLadderCard({
  items,
  className,
}: {
  items: SecurityConfigItem[];
  className?: string;
}) {
  const ladder = useMemo(() => getRiskEnforcementLadderData(items), [items]);
  const slides = useMemo(() => buildLadderSlides(ladder), [ladder]);
  const [activeIndex, setActiveIndex] = useState(1);
  const safeIndex = Math.min(Math.max(activeIndex, 0), slides.length - 1);
  const activeSlide = slides[safeIndex];
  const Icon = activeSlide.icon;

  return (
    <article
      className={cn(
        "flex h-full min-h-[8.75rem] flex-col overflow-hidden rounded-[var(--radius-5xl)] border border-border bg-card",
        className,
      )}
    >
      <div className="flex h-full flex-1 flex-col gap-3 px-4 py-4">
        <div className="flex items-start gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted/70 text-muted-foreground">
            <ShieldAlert className="size-4" strokeWidth={2.25} />
          </div>
          <div className="min-w-0 space-y-0.5">
            <h3 className="text-compact font-semibold text-foreground">Enforcement ladder</h3>
            <p className="text-caption leading-snug text-muted-foreground">
              How risk scores map to sign-in enforcement.
            </p>
          </div>
        </div>

        <div
          className={cn(
            "flex flex-1 flex-col justify-center rounded-[var(--radius-control)] border px-3.5 py-3",
            activeSlide.toneClass,
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full",
                activeSlide.iconClass,
              )}
            >
              <Icon className="size-4" strokeWidth={2.25} />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <p className="text-micro font-semibold uppercase tracking-wide text-muted-foreground">
                  {activeSlide.label}
                </p>
                <StatusBadge
                  variant={activeSlide.badgeVariant}
                  showIcon={false}
                  className="normal-case"
                >
                  {activeSlide.action}
                </StatusBadge>
              </div>
              <p className="font-sans text-h4 font-semibold tabular-nums tracking-tight text-foreground">
                {activeSlide.range}
              </p>
            </div>
          </div>
        </div>

        <div
          className="admin-user-kyc-carousel-dots !mt-0"
          role="tablist"
          aria-label="Enforcement ladder levels"
        >
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              role="tab"
              aria-selected={index === safeIndex}
              aria-label={`${slide.label}: ${slide.range}`}
              className={
                index === safeIndex
                  ? "admin-user-kyc-carousel-dots__dot admin-user-kyc-carousel-dots__dot--active"
                  : "admin-user-kyc-carousel-dots__dot"
              }
              onClick={() => setActiveIndex(index)}
            />
          ))}
        </div>
      </div>
    </article>
  );
}

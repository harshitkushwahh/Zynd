"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo } from "react";

import { useRiskProfileOptional } from "@/contexts/risk-profile-context";
import {
  RISK_GAUGE_SUB_ARCS,
  resolveDisplayScore,
  resolveRiskTierVisual,
} from "@/features/risk-profile/lib/risk-tier-ui";
import { cn } from "@/lib/utils";

let gaugeModulePreload: Promise<typeof import("react-gauge-component")> | null = null;

export function preloadRiskProfileGauge() {
  gaugeModulePreload ??= import("react-gauge-component");
  return gaugeModulePreload;
}

const GaugeComponent = dynamic(() => preloadRiskProfileGauge(), { ssr: false });

export type RiskProfileGaugeSize = "navbar" | "overview" | "mini" | "search" | "card" | "full";

type RiskProfileGaugeProps = {
  score: number;
  tier: string;
  displayScore?: number | null;
  className?: string;
  compact?: boolean;
  /** Hide tier label and score under the arc (e.g. detail dialog). */
  showCaption?: boolean;
  /** @deprecated Prefer `size="mini"`. */
  mini?: boolean;
  size?: RiskProfileGaugeSize;
};

type GaugeSizeConfig = {
  containerClass: string;
  marginInPercent: number;
  arcWidth: number;
  pointerWidth: number;
  animationDuration: number;
};

const SIZE_CONFIG: Record<RiskProfileGaugeSize, GaugeSizeConfig> = {
  navbar: {
    containerClass:
      "risk-profile-gauge h-5 w-9 shrink-0 overflow-hidden [&_.gauge-component]:!h-full [&_.gauge-component]:!w-full",
    marginInPercent: 0.02,
    arcWidth: 0.24,
    pointerWidth: 7,
    animationDuration: 450,
  },
  overview: {
    containerClass:
      "risk-profile-gauge h-8 w-[3.25rem] shrink-0 overflow-hidden [&_.gauge-component]:!h-full [&_.gauge-component]:!w-full",
    marginInPercent: 0.03,
    arcWidth: 0.22,
    pointerWidth: 9,
    animationDuration: 900,
  },
  mini: {
    containerClass:
      "risk-profile-gauge h-14 w-[4.75rem] shrink-0 overflow-hidden [&_.gauge-component]:!h-full [&_.gauge-component]:!w-full",
    marginInPercent: 0.04,
    arcWidth: 0.22,
    pointerWidth: 11,
    animationDuration: 900,
  },
  search: {
    containerClass:
      "risk-profile-gauge h-10 w-[5rem] shrink-0 overflow-hidden [&_.gauge-component]:!h-full [&_.gauge-component]:!w-full",
    marginInPercent: 0.035,
    arcWidth: 0.22,
    pointerWidth: 10,
    animationDuration: 900,
  },
  card: {
    containerClass:
      "risk-profile-gauge h-[5.75rem] w-[7.5rem] shrink-0 overflow-hidden [&_.gauge-component]:!h-full [&_.gauge-component]:!w-full sm:h-[6.25rem] sm:w-[8rem]",
    marginInPercent: 0.04,
    arcWidth: 0.2,
    pointerWidth: 14,
    animationDuration: 900,
  },
  full: {
    containerClass:
      "relative w-full aspect-[2/1] overflow-hidden [&_.gauge-component]:!absolute [&_.gauge-component]:!inset-0 [&_.gauge-component]:!size-full",
    marginInPercent: 0.05,
    arcWidth: 0.18,
    pointerWidth: 16,
    animationDuration: 900,
  },
};

function resolveGaugeSize(mini: boolean, size?: RiskProfileGaugeSize): RiskProfileGaugeSize {
  if (size) return size;
  if (mini) return "mini";
  return "full";
}

export function RiskProfileGauge({
  score,
  tier,
  displayScore,
  className,
  compact = false,
  showCaption = true,
  mini = false,
  size,
}: RiskProfileGaugeProps) {
  const riskProfile = useRiskProfileOptional();
  const tierVisual = resolveRiskTierVisual(tier);
  const resolvedDisplayScore = resolveDisplayScore(score, displayScore);
  const resolvedSize = resolveGaugeSize(mini, size);
  const sizeConfig = SIZE_CONFIG[resolvedSize];
  const arcOnly =
    resolvedSize === "navbar" ||
    resolvedSize === "mini" ||
    resolvedSize === "search" ||
    resolvedSize === "card" ||
    resolvedSize === "overview";
  const subArcs = riskProfile?.gaugeSubArcs ?? RISK_GAUGE_SUB_ARCS;
  const enableGaugeFadeIn = resolvedSize === "mini";

  useEffect(() => {
    if (resolvedSize === "full") {
      void preloadRiskProfileGauge();
    }
  }, [resolvedSize]);

  const gauge = useMemo(
    () => (
      <GaugeComponent
        type="semicircle"
        value={resolvedDisplayScore}
        minValue={0}
        maxValue={100}
        marginInPercent={sizeConfig.marginInPercent}
        fadeInAnimation={enableGaugeFadeIn}
        arc={{
          width: sizeConfig.arcWidth,
          padding: 0.004,
          cornerRadius: 2,
          subArcs,
        }}
        labels={{
          valueLabel: { hide: true },
          tickLabels: { hideMinMax: true, ticks: [] },
        }}
        pointer={{
          type: "needle",
          color: tierVisual.gaugeColor,
          baseColor: tierVisual.gaugeColor,
          animate: true,
          animationDuration: sizeConfig.animationDuration,
          animationDelay: resolvedSize === "navbar" || resolvedSize === "full" ? 0 : 80,
          width: sizeConfig.pointerWidth,
        }}
      />
    ),
    [
      resolvedDisplayScore,
      resolvedSize,
      sizeConfig.animationDuration,
      sizeConfig.arcWidth,
      sizeConfig.marginInPercent,
      sizeConfig.pointerWidth,
      subArcs,
      tierVisual.gaugeColor,
      enableGaugeFadeIn,
    ],
  );

  if (arcOnly) {
    return <div className={cn(sizeConfig.containerClass, className)}>{gauge}</div>;
  }

  return (
    <div className={cn("mx-auto w-full max-w-[240px]", className)}>
      <div className={sizeConfig.containerClass}>{gauge}</div>

      {showCaption ? (
        <div className="mt-1 text-center">
          <p
            className={cn(
              "font-semibold tracking-tight",
              tierVisual.textClass,
              compact ? "text-body" : "text-h3",
            )}
          >
            {tierVisual.label} Risk Profile
          </p>
          <p className={cn("mt-1 text-caption tabular-nums", tierVisual.textClass)}>
            {resolvedDisplayScore}/100
          </p>
        </div>
      ) : null}

      {!compact && showCaption ? (
        <div className="mt-3 flex justify-between px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          <span>Secure</span>
          <span>Moderate</span>
          <span>Growth</span>
          <span>Aggressive</span>
        </div>
      ) : null}
    </div>
  );
}

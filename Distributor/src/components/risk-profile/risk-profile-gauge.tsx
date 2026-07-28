"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo } from "react";

import {
  RISK_GAUGE_SUB_ARCS,
  resolveDisplayScore,
  resolveRiskTierVisual,
} from "@/lib/risk-profile/risk-tier-ui";
import { cn } from "@/lib/utils";
import { DISTRIBUTOR_GAUGE_SCALE_LABELS_CLASS, DISTRIBUTOR_LABEL_CAPS_CLASS } from "@/lib/distributor-layout";

let gaugeModulePreload: Promise<typeof import("react-gauge-component")> | null = null;

function preloadRiskProfileGauge() {
  gaugeModulePreload ??= import("react-gauge-component");
  return gaugeModulePreload;
}

const GaugeComponent = dynamic(() => preloadRiskProfileGauge(), { ssr: false });

export type RiskProfileGaugeSize = "mini" | "compact" | "full";

type RiskProfileGaugeProps = {
  score: number;
  tier: string;
  displayScore?: number | null;
  className?: string;
  showCaption?: boolean;
  /** Show Secure / Moderate / Growth / Aggressive scale under the gauge. */
  showTierScale?: boolean;
  size?: RiskProfileGaugeSize;
};

const SIZE_CONFIG = {
  mini: {
    containerClass:
      "h-14 w-[4.75rem] shrink-0 overflow-hidden [&_.gauge-component]:!h-full [&_.gauge-component]:!w-full",
    marginInPercent: 0.04,
    arcWidth: 0.22,
    pointerWidth: 11,
    animationDuration: 900,
    maxWidthClass: "",
  },
  compact: {
    containerClass:
      "relative mx-auto w-full max-w-[140px] aspect-[2/1] overflow-hidden [&_.gauge-component]:!absolute [&_.gauge-component]:!inset-0 [&_.gauge-component]:!size-full",
    marginInPercent: 0.06,
    arcWidth: 0.2,
    pointerWidth: 12,
    animationDuration: 700,
    maxWidthClass: "max-w-[140px]",
  },
  full: {
    containerClass:
      "relative w-full aspect-[2/1] overflow-hidden [&_.gauge-component]:!absolute [&_.gauge-component]:!inset-0 [&_.gauge-component]:!size-full",
    marginInPercent: 0.05,
    arcWidth: 0.18,
    pointerWidth: 16,
    animationDuration: 900,
    maxWidthClass: "max-w-[240px]",
  },
} as const;

export function RiskProfileGauge({
  score,
  tier,
  displayScore,
  className,
  showCaption = true,
  showTierScale = true,
  size = "full",
}: RiskProfileGaugeProps) {
  const tierVisual = resolveRiskTierVisual(tier);
  const resolvedDisplayScore = resolveDisplayScore(score, displayScore);
  const sizeConfig = SIZE_CONFIG[size];
  const arcOnly = size === "mini";

  useEffect(() => {
    if (size === "full" || size === "compact") {
      void preloadRiskProfileGauge();
    }
  }, [size]);

  const gauge = useMemo(
    () => (
      <GaugeComponent
        type="semicircle"
        value={resolvedDisplayScore}
        minValue={0}
        maxValue={100}
        marginInPercent={sizeConfig.marginInPercent}
        fadeInAnimation={size === "mini"}
        arc={{
          width: sizeConfig.arcWidth,
          padding: 0.004,
          cornerRadius: 2,
          subArcs: RISK_GAUGE_SUB_ARCS,
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
          animationDelay: size === "full" ? 0 : 80,
          width: sizeConfig.pointerWidth,
        }}
      />
    ),
    [
      resolvedDisplayScore,
      size,
      sizeConfig.animationDuration,
      sizeConfig.arcWidth,
      sizeConfig.marginInPercent,
      sizeConfig.pointerWidth,
      tierVisual.gaugeColor,
    ],
  );

  if (arcOnly) {
    return <div className={cn(sizeConfig.containerClass, className)}>{gauge}</div>;
  }

  return (
    <div className={cn("mx-auto w-full", sizeConfig.maxWidthClass, className)}>
      <div className={sizeConfig.containerClass}>{gauge}</div>
      {showCaption ? (
        <div className="mt-0.5 text-center">
          <p
            className={cn(
              "font-semibold tracking-tight",
              tierVisual.textClass,
              size === "compact" ? "text-compact" : "text-h3",
            )}
          >
            {tierVisual.label} Risk Profile
          </p>
          <p className={cn("mt-0.5 text-caption tabular-nums", tierVisual.textClass)}>
            {resolvedDisplayScore}/100
          </p>
        </div>
      ) : null}
      {showCaption && showTierScale && size === "full" ? (
        <div className={cn(DISTRIBUTOR_GAUGE_SCALE_LABELS_CLASS, DISTRIBUTOR_LABEL_CAPS_CLASS)}>
          <span>Secure</span>
          <span>Moderate</span>
          <span>Growth</span>
          <span>Aggressive</span>
        </div>
      ) : null}
    </div>
  );
}

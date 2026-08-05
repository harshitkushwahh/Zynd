"use client";

import {
  RISK_GAUGE_SEGMENT_COLORS,
  resolveDisplayScore,
  resolveRiskTierVisual,
} from "@/lib/risk-profile-gauge-ui";
import { cn } from "@/lib/utils";

type RiskProfileGaugeProps = {
  score: number;
  tier: string;
  displayScore?: number | null;
  className?: string;
  size?: "compact" | "mini" | "hero";
};

const GAUGE = {
  cx: 50,
  cy: 50,
  radius: 38,
  strokeWidth: 7,
} as const;

function needlePoint(value: number) {
  const clamped = Math.max(0, Math.min(100, value));
  const angle = Math.PI - (clamped / 100) * Math.PI;
  return {
    x: GAUGE.cx + GAUGE.radius * Math.cos(angle),
    y: GAUGE.cy - GAUGE.radius * Math.sin(angle),
  };
}

function segmentArc(startValue: number, endValue: number) {
  const start = needlePoint(startValue);
  const end = needlePoint(endValue);
  const largeArc = endValue - startValue > 50 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${GAUGE.radius} ${GAUGE.radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

export function RiskProfileGauge({
  score,
  tier,
  displayScore,
  className,
  size = "compact",
}: RiskProfileGaugeProps) {
  const tierVisual = resolveRiskTierVisual(tier);
  const resolvedDisplayScore = resolveDisplayScore(score, displayScore);
  const needle = needlePoint(resolvedDisplayScore);
  const mini = size === "mini";
  const hero = size === "hero";

  return (
    <div
      className={cn(
        mini && "h-14 w-[4.75rem]",
        !mini && !hero && "aspect-[2/1] w-full max-w-[7rem]",
        hero && "aspect-[2/1] w-full max-w-[11rem]",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 100 56" className="size-full overflow-visible">
        {RISK_GAUGE_SEGMENT_COLORS.map((color, index) => {
          const startValue = index * 20;
          const endValue = (index + 1) * 20;
          return (
            <path
              key={color}
              d={segmentArc(startValue, endValue)}
              fill="none"
              stroke={color}
              strokeWidth={hero ? 9 : GAUGE.strokeWidth}
              strokeLinecap="butt"
            />
          );
        })}
        <line
          x1={GAUGE.cx}
          y1={GAUGE.cy}
          x2={needle.x}
          y2={needle.y}
          stroke={tierVisual.gaugeColor}
          strokeWidth={mini ? 2.25 : hero ? 3.25 : 2.75}
          strokeLinecap="round"
        />
        <circle
          cx={GAUGE.cx}
          cy={GAUGE.cy}
          r={mini ? 3 : hero ? 4.25 : 3.5}
          fill={tierVisual.gaugeColor}
        />
      </svg>
    </div>
  );
}

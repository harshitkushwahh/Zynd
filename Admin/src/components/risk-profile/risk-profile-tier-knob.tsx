"use client";

import { useCallback, useId, useRef } from "react";

import { RiskProfileTierDialDot } from "@/components/risk-profile/risk-profile-tier-dial-dot";
import { RECOMMENDATION_RISK_TIERS, type RiskTierId } from "@/lib/recommendations-admin-api";
import { resolveRiskTierVisual } from "@/lib/risk-profile-gauge-ui";
import { cn } from "@/lib/utils";

const DIAL_ROTATIONS = [-90, -45, 0, 45, 90] as const;

function tierIndex(tier: RiskTierId) {
  const index = RECOMMENDATION_RISK_TIERS.findIndex((item) => item.id === tier);
  return index >= 0 ? index : 2;
}

const TIER_POINTER_VALUES = [10, 30, 50, 70, 90] as const;

function nearestTierFromPointer(rect: DOMRect, clientX: number, clientY: number): RiskTierId {
  const cx = rect.left + rect.width / 2;
  const cy = rect.bottom;
  const angle = Math.atan2(cy - clientY, clientX - cx);
  const normalized = Math.max(0, Math.min(Math.PI, angle));
  const value = ((Math.PI - normalized) / Math.PI) * 100;

  let closestIndex = 0;
  let closestDistance = Number.POSITIVE_INFINITY;
  TIER_POINTER_VALUES.forEach((tierValue, index) => {
    const distance = Math.abs(tierValue - value);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  });

  return RECOMMENDATION_RISK_TIERS[closestIndex]?.id ?? "moderate";
}

type RiskProfileTierKnobProps = {
  value: RiskTierId;
  onValueChange: (tier: RiskTierId) => void;
  className?: string;
  "aria-label"?: string;
};

export function RiskProfileTierKnob({
  value,
  onValueChange,
  className,
  "aria-label": ariaLabel = "Risk tier",
}: RiskProfileTierKnobProps) {
  const groupId = useId();
  const faceRef = useRef<HTMLDivElement>(null);
  const activeIndex = tierIndex(value);
  const activeVisual = resolveRiskTierVisual(value);

  const selectFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const face = faceRef.current;
      if (!face) return;
      onValueChange(nearestTierFromPointer(face.getBoundingClientRect(), clientX, clientY));
    },
    [onValueChange],
  );

  return (
    <div
      className={cn("admin-risk-tier-clock", className)}
      data-active-index={activeIndex}
      style={{ "--tier-accent": activeVisual.gaugeColor } as React.CSSProperties}
    >
      <div className="admin-risk-tier-clock__controls">
        {RECOMMENDATION_RISK_TIERS.map((tier) => {
          const inputId = `${groupId}-${tier.id}`;
          return (
            <input
              key={tier.id}
              id={inputId}
              type="radio"
              name={groupId}
              className="admin-risk-tier-clock__input"
              checked={value === tier.id}
              onChange={() => onValueChange(tier.id)}
              aria-label={tier.label}
            />
          );
        })}

        <div
          ref={faceRef}
          className="admin-risk-tier-clock__face"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            selectFromPointer(event.clientX, event.clientY);
          }}
          onPointerMove={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
            selectFromPointer(event.clientX, event.clientY);
          }}
        >
          <div className="admin-risk-tier-clock__ring" aria-hidden />
          <div className="admin-risk-tier-clock__notches" aria-hidden>
            {RECOMMENDATION_RISK_TIERS.map((tier, index) => (
              <div
                key={tier.id}
                className="admin-risk-tier-clock__notch"
                style={
                  {
                    "--notch-index": index,
                    "--notch-color": resolveRiskTierVisual(tier.id).gaugeColor,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
          <div className="admin-risk-tier-clock__hub" aria-hidden />
          <div
            className="admin-risk-tier-clock__dial"
            style={{ transform: `rotate(${DIAL_ROTATIONS[activeIndex]}deg)` }}
            aria-hidden
          />
        </div>

        <p className="admin-risk-tier-clock__selection">{activeVisual.label}</p>
      </div>

      <div className="admin-risk-tier-clock__chips" role="radiogroup" aria-label={ariaLabel}>
        {RECOMMENDATION_RISK_TIERS.map((tier) => {
          const isActive = tier.id === value;
          const tierVisual = resolveRiskTierVisual(tier.id);
          const inputId = `${groupId}-${tier.id}`;
          return (
            <label
              key={tier.id}
              htmlFor={inputId}
              className={cn(
                "admin-risk-tier-clock__chip",
                isActive && "admin-risk-tier-clock__chip--active",
              )}
              style={
                isActive
                  ? {
                      borderColor: `color-mix(in srgb, ${tierVisual.gaugeColor} 50%, var(--border))`,
                      backgroundColor: `color-mix(in srgb, ${tierVisual.gaugeColor} 10%, var(--card))`,
                    }
                  : undefined
              }
            >
              <RiskProfileTierDialDot tier={tier.id} active={isActive} size="sm" />
              <span>{tier.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function tierKnobLabel(tier: RiskTierId) {
  return RECOMMENDATION_RISK_TIERS.find((item) => item.id === tier)?.label ?? tier;
}

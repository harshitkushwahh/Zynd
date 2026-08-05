"use client";

import { useState, type CSSProperties } from "react";

import { AdminUserGoalContributionDonut } from "@/components/users/admin-user-goal-contribution-donut";
import type { AdminGoalHoldingContribution } from "@/lib/admin-goal-holding-contributions";
import { cn } from "@/lib/utils";

type AdminUserGoalHoldingsContributionPanelProps = {
  progressPct: number;
  contributions?: AdminGoalHoldingContribution[];
  className?: string;
};

function AdminUserGoalHoldingLegend({
  contributions,
  selectedId,
  onSelect,
}: {
  contributions: AdminGoalHoldingContribution[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (contributions.length === 0) {
    return (
      <div className="admin-user-goal-holdings-panel__legend-scroll">
        <p className="admin-user-goal-holdings-panel__legend-empty">
          No holdings linked to this goal yet.
        </p>
      </div>
    );
  }

  return (
    <div className="admin-user-goal-holdings-panel__legend-scroll">
      <ul className="admin-user-goal-holdings-panel__legend">
        {contributions.map((contribution) => {
          const isSelected = selectedId === contribution.id;

          return (
            <li key={contribution.id}>
              <button
                type="button"
                className={cn(
                  "admin-user-goal-holdings-panel__legend-item",
                  isSelected && "admin-user-goal-holdings-panel__legend-item--selected",
                )}
                style={
                  { "--admin-user-goal-holding-color": contribution.color } as CSSProperties
                }
                aria-pressed={isSelected}
                onClick={() => onSelect(contribution.id)}
              >
                <span className="admin-user-goal-holdings-panel__legend-dot" aria-hidden />
                <span className="admin-user-goal-holdings-panel__legend-label truncate">
                  {contribution.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AdminUserGoalHoldingsContributionPanel({
  progressPct,
  contributions = [],
  className,
}: AdminUserGoalHoldingsContributionPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function handleSelect(id: string) {
    setSelectedId((current) => (current === id ? null : id));
  }

  return (
    <div className={cn("admin-user-goal-holdings-panel", className)}>
      <AdminUserGoalContributionDonut
        progressPct={progressPct}
        contributions={contributions}
        selectedId={selectedId}
      />
      <AdminUserGoalHoldingLegend
        contributions={contributions}
        selectedId={selectedId}
        onSelect={handleSelect}
      />
    </div>
  );
}

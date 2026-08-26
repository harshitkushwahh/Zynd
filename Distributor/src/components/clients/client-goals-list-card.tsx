"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { ClientGoalDetailDialog } from "@/components/clients/client-goal-detail-dialog";
import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  isGoalInvested,
  resolveGoalCategoryIcon,
  resolveGoalCategoryLabel,
} from "@/lib/client-goal-ui";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import type { DistributorClientGoal } from "@/lib/distributor-types";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ClientGoalsListCardProps = {
  goals: DistributorClientGoal[];
  className?: string;
};

export function ClientGoalsListCard({ goals, className }: ClientGoalsListCardProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.goals;
  const [createHintOpen, setCreateHintOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<DistributorClientGoal | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const openGoalDetail = (goal: DistributorClientGoal) => {
    setSelectedGoal(goal);
    setDetailOpen(true);
  };

  return (
    <>
      <article className={cn("distributor-client-goals-list-card", className)}>
        <header className="distributor-client-goals-list-card__header">
          <h2 className="distributor-client-goals-list-card__title">{copy.allGoalsTitle}</h2>
          <DistributorActionButton variant="primary" className="gap-1.5" onClick={() => setCreateHintOpen(true)}>
            <Plus className="size-4 shrink-0" strokeWidth={2.25} aria-hidden />
            {copy.createAction}
          </DistributorActionButton>
        </header>

        <ul className="distributor-client-goals-list-card__grid" aria-label={copy.allGoalsTitle}>
          {goals.map((goal) => {
            const Icon = resolveGoalCategoryIcon(goal);
            const categoryLabel = resolveGoalCategoryLabel(goal);
            const scopeLabel =
              goal.scope === "family" && goal.familyGroupName
                ? `${categoryLabel} · ${goal.familyGroupName}`
                : categoryLabel;
            const invested = isGoalInvested(goal);
            const progressPct = Math.min(100, Math.max(0, goal.progressPct));

            return (
              <li key={goal.id}>
                <button
                  type="button"
                  className="distributor-client-goals-tile"
                  onClick={() => openGoalDetail(goal)}
                  aria-label={`${goal.title}, ${categoryLabel}, ${progressPct}% ${copy.progress.toLowerCase()}`}
                >
                  <div className="distributor-client-goals-tile__head">
                    <span className="distributor-client-goals-tile__icon" aria-hidden>
                      <Icon className="size-4" strokeWidth={2.25} />
                    </span>
                    <span className="distributor-client-goals-tile__title">{goal.title}</span>
                  </div>

                  <div className="distributor-client-goals-tile__progress-row">
                    <div
                      className="distributor-client-goals-tile__progress-track"
                      aria-hidden
                    >
                      <div
                        className="distributor-client-goals-tile__progress-fill"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <span className="distributor-client-goals-tile__progress-pct tabular-nums">{progressPct}%</span>
                  </div>

                  <div className="distributor-client-goals-tile__badges">
                    <StatusBadge variant="neutral">
                      {scopeLabel}
                    </StatusBadge>
                    <StatusBadge
                      variant={invested ? "success" : "neutral"}
                    >
                      {invested ? copy.investedBadge : copy.notInvestedBadge}
                    </StatusBadge>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </article>

      <ClientGoalDetailDialog
        open={detailOpen}
        onOpenChange={(next) => {
          setDetailOpen(next);
          if (!next) setSelectedGoal(null);
        }}
        goal={selectedGoal}
      />

      <Dialog open={createHintOpen} onOpenChange={setCreateHintOpen}>
        <DialogHeader className="sr-only">
          <DialogTitle>{copy.createAction}</DialogTitle>
          <DialogDescription>{copy.createDisabledHint}</DialogDescription>
        </DialogHeader>
        <DialogContent className="max-w-sm">
          <DialogTitle>{copy.createAction}</DialogTitle>
          <DialogDescription>{copy.createDisabledHint}</DialogDescription>
        </DialogContent>
      </Dialog>
    </>
  );
}

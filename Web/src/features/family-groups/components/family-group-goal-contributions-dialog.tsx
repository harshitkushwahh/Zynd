"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { BrandDialog, BrandDialogFooter } from "@/components/ui/brand-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldMessage } from "@/components/ui/ui-message";
import {
  addFamilyGoalContribution,
  fetchFamilyGoalContributions,
  type FamilyGoal,
  type FamilyGoalContributions,
} from "@/features/family-groups/api/family-groups-api";
import { resolveFamilyGroupApiError } from "@/features/family-groups/lib/family-group-api-errors";
import { invalidateFamilyQueries } from "@/features/family-groups/lib/invalidate-family-queries";
import { invalidateGoalsQueries } from "@/features/goals/lib/invalidate-goals-queries";
import { formatInr } from "@/features/invest/lib/mf-format";
import { copy } from "@/shared/config/copy";

type FamilyGroupGoalContributionsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  goal: FamilyGoal | null;
  canContribute: boolean;
  onUpdated: () => void;
};

export function FamilyGroupGoalContributionsDialog({
  open,
  onOpenChange,
  groupId,
  goal,
  canContribute,
  onUpdated,
}: FamilyGroupGoalContributionsDialogProps) {
  const queryClient = useQueryClient();
  const dashboard = copy.familyGroups.dashboard;
  const [contributions, setContributions] = useState<FamilyGoalContributions | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [amount, setAmount] = useState("5000");

  useEffect(() => {
    if (!open || !goal) {
      setContributions(null);
      return;
    }
    setLoading(true);
    setError("");
    void fetchFamilyGoalContributions(groupId, goal.id)
      .then(setContributions)
      .catch((loadError) => {
        setContributions(null);
        setError(resolveFamilyGroupApiError(loadError, dashboard.goalsLoadFailed));
      })
      .finally(() => setLoading(false));
  }, [dashboard.goalsLoadFailed, goal, groupId, open]);

  async function handleContribute(event: React.FormEvent) {
    event.preventDefault();
    if (!goal) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await addFamilyGoalContribution(groupId, goal.id, {
        amount_inr: Number(amount),
      });
      setContributions(response);
      await invalidateFamilyQueries(queryClient, groupId);
      await invalidateGoalsQueries(queryClient);
      onUpdated();
    } catch (submitError) {
      setError(resolveFamilyGroupApiError(submitError, dashboard.goalContributionFailed));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BrandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={goal?.title ?? dashboard.goalsTitle}
      maxWidth="md"
    >
      <div className="px-6 py-5">
      {loading ? (
        <div className="flex items-center gap-2 py-8 text-compact text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {dashboard.goalsLoading}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-[var(--radius-card)] border border-border/70 bg-muted/10 p-4">
            <p className="text-caption text-muted-foreground">{dashboard.goalContributionsTotalLabel}</p>
            <p className="mt-1 text-body font-semibold tabular-nums text-foreground">
              {formatInr(contributions?.total_contributed_inr ?? 0)}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-caption font-medium text-muted-foreground">{dashboard.goalMemberTotalsLabel}</p>
            <ul className="space-y-2">
              {(contributions?.member_totals ?? []).map((member) => (
                <li
                  key={member.user_id}
                  className="flex items-center justify-between rounded-[var(--radius-control)] border border-border/70 px-3 py-2 text-compact"
                >
                  <span>{member.display_name}</span>
                  <span className="font-medium tabular-nums">{formatInr(member.total_inr)}</span>
                </li>
              ))}
              {(contributions?.member_totals.length ?? 0) === 0 ? (
                <li className="text-compact text-muted-foreground">{dashboard.goalContributionsEmpty}</li>
              ) : null}
            </ul>
          </div>

          {canContribute ? (
            <form onSubmit={(event) => void handleContribute(event)} className="space-y-3 border-t border-border pt-4">
              <div className="space-y-2">
                <Label htmlFor="family-goal-contribution">{dashboard.goalContributionAmountLabel}</Label>
                <Input
                  id="family-goal-contribution"
                  type="number"
                  min={1}
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  required
                />
              </div>
              {error ? <FieldMessage message={error} className="mt-0" /> : null}
              <BrandDialogFooter>
                <Button type="submit" disabled={submitting}>
                  {dashboard.goalContributionAction}
                </Button>
              </BrandDialogFooter>
            </form>
          ) : null}
        </div>
      )}
      </div>
    </BrandDialog>
  );
}

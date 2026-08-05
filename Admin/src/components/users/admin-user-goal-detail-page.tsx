"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Link2, UsersRound } from "lucide-react";

import {
  AdminSectionBreadcrumb,
  userManagementBreadcrumbSegments,
} from "@/components/dashboard/admin-section-breadcrumb";
import { AdminUserGoalDetailTabs } from "@/components/users/admin-user-goal-detail-tabs";
import { AdminUserGoalFundingMetrics } from "@/components/users/admin-user-goal-funding-metrics";
import { AdminUserGoalSummaryCard } from "@/components/users/admin-user-goal-summary-card";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminProfilePageSkeleton } from "@/components/ui/admin-skeletons";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  fetchAdminUserGoal,
  fetchAdminUserGoalInvestments,
  fetchAdminUserSummary,
  type AdminGoalInvestments,
  type AdminUserGoal,
} from "@/lib/admin-api";
import { userGoalsTabHref } from "@/lib/admin-user-goal-navigation";
import { userFamilyGroupDetailHref } from "@/lib/admin-user-family-group-navigation";
import { fetchAdminFamilyGroupDetail, type AdminFamilyGroupDetail } from "@/lib/family-groups-admin-api";
import { mapGoalHoldingsToContributions } from "@/lib/admin-goal-holding-contributions";
import { getErrorMessage } from "@/lib/errors";

type AdminUserGoalDetailPageProps = {
  profilePath: string;
  clientId: string;
  goalId: string;
};

function summarizeGoalFunding(goal: AdminUserGoal) {
  const current = goal.effective_current_amount_inr ?? goal.current_amount_inr;
  const declared = goal.existing_savings_inr ?? 0;
  const holdings = goal.holdings_value_inr ?? 0;
  const orders = goal.invested_via_orders_inr ?? 0;
  const contributed = Math.max(0, current - declared);
  const remaining = Math.max(0, goal.target_amount_inr - current);
  const progress = Math.max(0, Math.min(100, goal.effective_progress_pct ?? goal.progress_pct));

  return { current, declared, contributed, holdings, orders, remaining, progress };
}

export function AdminUserGoalDetailPage({
  profilePath,
  clientId,
  goalId,
}: AdminUserGoalDetailPageProps) {
  const [goal, setGoal] = useState<AdminUserGoal | null>(null);
  const [investments, setInvestments] = useState<AdminGoalInvestments | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [familyGroup, setFamilyGroup] = useState<AdminFamilyGroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [investmentsLoading, setInvestmentsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadGoal = useCallback(async () => {
    setLoading(true);
    setInvestmentsLoading(true);
    setError("");
    try {
      const [goalResult, summaryResult, investmentsResult] = await Promise.all([
        fetchAdminUserGoal(clientId, goalId),
        fetchAdminUserSummary(clientId),
        fetchAdminUserGoalInvestments(clientId, goalId),
      ]);
      setGoal(goalResult);
      setInvestments(investmentsResult);
      setUserName(summaryResult.display_name);

      if (goalResult.family_group_id) {
        try {
          const group = await fetchAdminFamilyGroupDetail(goalResult.family_group_id);
          setFamilyGroup(group);
        } catch {
          setFamilyGroup(null);
        }
      } else {
        setFamilyGroup(null);
      }
    } catch (err) {
      setGoal(null);
      setInvestments(null);
      setFamilyGroup(null);
      setError(getErrorMessage(err, "Could not load goal details."));
    } finally {
      setLoading(false);
      setInvestmentsLoading(false);
    }
  }, [clientId, goalId]);

  useEffect(() => {
    void loadGoal();
  }, [loadGoal]);

  const funding = useMemo(() => (goal ? summarizeGoalFunding(goal) : null), [goal]);

  const holdingsContributions = useMemo(
    () => mapGoalHoldingsToContributions(investments?.holdings ?? []),
    [investments?.holdings],
  );

  const goalActivity = useMemo(() => {
    if (!goal || !familyGroup) return [];
    return familyGroup.activity.filter((entry) => {
      if (!entry.event_type.includes("goal")) return false;
      return entry.message.toLowerCase().includes(goal.title.toLowerCase());
    });
  }, [familyGroup, goal]);

  const goalsTabHref = userGoalsTabHref(profilePath);
  const profileHref = `/dashboard/users/${encodeURIComponent(profilePath)}`;

  if (loading) {
    return <AdminProfilePageSkeleton />;
  }

  if (error || !goal || !funding) {
    return (
      <div className="space-y-4">
        <AdminSectionBreadcrumb
          segments={userManagementBreadcrumbSegments([
            { label: userName || clientId, href: profileHref },
            { label: "Goals", href: goalsTabHref },
            { label: "Goal detail" },
          ])}
        />
        <AdminFeedbackMessage variant="destructive">{error || "Goal not found."}</AdminFeedbackMessage>
        <Button variant="outline" render={<Link href={goalsTabHref} />}>
          Back to goals
        </Button>
      </div>
    );
  }

  return (
    <div className="admin-user-goal-detail space-y-6">
      <AdminSectionBreadcrumb
        segments={userManagementBreadcrumbSegments([
          { label: userName || clientId, href: profileHref },
          { label: "Goals", href: goalsTabHref },
          { label: goal.title },
        ])}
      />

      <div className="admin-user-goal-detail__hero">
        <AdminUserGoalSummaryCard
          goal={goal}
          progressPct={funding.progress}
          holdingsContributions={holdingsContributions}
          sipMonthlyInr={
            investments?.summary.linked_sip_monthly_inr ?? goal.linked_sip_monthly_inr ?? 0
          }
          oneTimeOrdersInr={
            investments?.summary.invested_via_orders_inr ?? goal.invested_via_orders_inr ?? 0
          }
          familyGroupTitle={familyGroup?.title ?? null}
          familyGroupHref={
            goal.family_group_id
              ? userFamilyGroupDetailHref(profilePath, goal.family_group_id)
              : null
          }
          className="admin-user-goal-detail__hero-summary"
        />

        <AdminUserGoalFundingMetrics
          targetAmountInr={goal.target_amount_inr}
          declaredInr={funding.declared}
          contributedInr={funding.contributed}
          remainingInr={funding.remaining}
          className="admin-user-goal-detail__hero-metrics"
        />
      </div>

      {goal.family_group_id ? (
        <section className="space-y-3">
          <h2 className="admin-user-family-group-detail__section-title">Family group</h2>
          <Card className="ring-0 border-border bg-muted/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="admin-user-goal-detail__inline-icon" aria-hidden>
                  <UsersRound className="size-4" />
                </span>
                <div>
                  <p className="text-compact font-semibold text-foreground">
                    {familyGroup?.title ?? "Linked family group"}
                  </p>
                  <p className="mt-0.5 text-caption text-muted-foreground">
                    This goal is shared with the family group portfolio.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                render={
                  <Link href={userFamilyGroupDetailHref(profilePath, goal.family_group_id)} />
                }
              >
                <Link2 className="size-4" />
                View group
              </Button>
            </div>
          </Card>
        </section>
      ) : null}

      <AdminUserGoalDetailTabs
        goal={goal}
        investments={investments}
        investmentsLoading={investmentsLoading}
        goalActivity={goalActivity}
        funding={funding}
        isFamilyGoal={Boolean(goal.family_group_id)}
      />
    </div>
  );
}

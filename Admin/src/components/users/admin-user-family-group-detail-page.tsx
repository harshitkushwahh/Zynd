"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Target,
  TrendingUp,
  UsersRound,
  Wallet,
} from "lucide-react";

import {
  AdminSectionBreadcrumb,
  userManagementBreadcrumbSegments,
} from "@/components/dashboard/admin-section-breadcrumb";
import { AdminFamilyGroupGoalCard } from "@/components/users/admin-family-group-goal-card";
import { AdminUserFamilyGroupChartsSection } from "@/components/users/admin-user-family-group-charts-section";
import { AdminUserFamilyGroupMembersSection } from "@/components/users/admin-user-family-group-members-section";
import { AdminFamilyGroupProgressRing } from "@/components/users/admin-family-group-progress-ring";
import { AdminFamilyGroupRoleBadge } from "@/components/users/admin-family-group-role-badge";
import { AdminConfirmDialog } from "@/components/ui/admin-dialog-presets";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminMetricCard } from "@/components/ui/admin-metric-card";
import { AdminMetricCardsGrid } from "@/components/ui/admin-metric-cards-grid";
import { AdminProfilePageSkeleton } from "@/components/ui/admin-skeletons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  userFamilyGroupsTabHref,
} from "@/lib/admin-user-family-group-navigation";
import {
  adminArchiveFamilyGroup,
  adminRemoveFamilyGroupMember,
  fetchAdminFamilyGroupAnalytics,
  type AdminFamilyGroupAnalytics,
} from "@/lib/family-groups-admin-api";
import { formatCompactInr, formatInr } from "@/lib/format-inr";
import { formatPortfolioGoalFundingHint, formatGoalFundingBreakdown, goalContributionsInr, goalDeclaredSavingsInr } from "@/lib/format-goal-funding";
import { getErrorMessage } from "@/lib/errors";

type AdminUserFamilyGroupDetailPageProps = {
  profilePath: string;
  clientId: string;
  groupId: string;
  canManageFamilyGroups: boolean;
};

function groupInitials(title: string) {
  return title
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function AdminUserFamilyGroupDetailPage({
  profilePath,
  clientId,
  groupId,
  canManageFamilyGroups,
}: AdminUserFamilyGroupDetailPageProps) {
  const [payload, setPayload] = useState<AdminFamilyGroupAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [focusedMemberId, setFocusedMemberId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{ userId: string; name: string } | null>(null);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchAdminFamilyGroupAnalytics(groupId);
      setPayload(result);
    } catch (err) {
      setPayload(null);
      setError(getErrorMessage(err, "Could not load family group analytics."));
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const goalFundingHint = useMemo(() => {
    if (!payload) return "";
    const { portfolio, goals } = payload;
    if (
      portfolio.goal_declared_savings_inr != null ||
      portfolio.goal_contributions_inr != null
    ) {
      return formatPortfolioGoalFundingHint(portfolio);
    }
    const declared = goals.reduce((sum, goal) => sum + goalDeclaredSavingsInr(goal), 0);
    const contributed = goals.reduce((sum, goal) => sum + goalContributionsInr(goal), 0);
    return formatGoalFundingBreakdown(declared, contributed);
  }, [payload]);

  async function handleArchive() {
    setActionLoading("archive");
    try {
      await adminArchiveFamilyGroup(groupId);
      setArchiveConfirmOpen(false);
      await loadAnalytics();
    } catch (err) {
      setError(getErrorMessage(err, "Could not archive this group."));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRemoveMember() {
    if (!removeTarget) return;
    setActionLoading(`remove:${removeTarget.userId}`);
    try {
      await adminRemoveFamilyGroupMember(groupId, removeTarget.userId);
      setRemoveTarget(null);
      await loadAnalytics();
    } catch (err) {
      setError(getErrorMessage(err, "Could not remove this member."));
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return <AdminProfilePageSkeleton />;
  }

  if (error && !payload) {
    return <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage>;
  }

  if (!payload) {
    return null;
  }

  const portfolio = payload.portfolio;
  const backHref = userFamilyGroupsTabHref(profilePath);

  return (
    <div className="admin-user-family-group-detail space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-3">
          <AdminSectionBreadcrumb
            segments={[
              ...userManagementBreadcrumbSegments([{ label: "Users" }]),
              { label: clientId, href: `/dashboard/users/${encodeURIComponent(profilePath)}` },
              { label: "Family groups", href: backHref },
              { label: payload.title },
            ]}
          />
        </div>

        {canManageFamilyGroups && payload.status === "active" ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={actionLoading === "archive"}
            onClick={() => setArchiveConfirmOpen(true)}
          >
            <Archive className="size-4" />
            Force archive
          </Button>
        ) : null}
      </div>

      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}

      <Card className="admin-user-family-group-detail__hero ring-0 bg-card p-4 shadow-sm sm:p-5">
        <div className="admin-user-family-group-detail__hero-main">
          <Avatar className="admin-user-family-group-detail__hero-avatar size-14 shrink-0">
            {payload.avatar_url ? <AvatarImage src={payload.avatar_url} alt="" /> : null}
            <AvatarFallback className="text-compact font-semibold">{groupInitials(payload.title)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-h3 font-semibold tracking-tight text-foreground">{payload.title}</h1>
              <AdminFamilyGroupRoleBadge label={payload.status} kind="status" />
            </div>
            <p className="mt-1 text-caption text-muted-foreground">
              {payload.description?.trim() || `${payload.member_count} members in this family group`}
            </p>
            <p className="mt-2 text-caption text-muted-foreground">
              Head:{" "}
              <span className="font-medium text-foreground">
                {payload.head_display_name ?? "—"}
              </span>
              {payload.head_email_masked ? ` · ${payload.head_email_masked}` : ""}
            </p>
          </div>
          <AdminFamilyGroupProgressRing
            progressPct={payload.progress_pct}
            goalsCount={portfolio.active_goals_count}
            className="shrink-0"
          />
        </div>
      </Card>

      <AdminMetricCardsGrid className="admin-user-family-group-detail__metrics">
        <AdminMetricCard
          icon={Wallet}
          label="Invested amount"
          value={formatCompactInr(portfolio.total_invested_inr)}
          hint={formatInr(portfolio.total_invested_inr)}
          accent
        />
        <AdminMetricCard
          icon={TrendingUp}
          label="Current value"
          value={formatCompactInr(portfolio.total_current_value_inr)}
          hint={`Returns ${formatCompactInr(portfolio.total_returns_inr)}`}
        />
        <AdminMetricCard
          icon={UsersRound}
          label="Members"
          value={String(payload.member_count)}
          hint={`${portfolio.active_sips_count} active SIPs`}
        />
        <AdminMetricCard
          icon={Target}
          label="Family goals"
          value={String(portfolio.active_goals_count)}
          hint={goalFundingHint}
        />
      </AdminMetricCardsGrid>

      <AdminUserFamilyGroupChartsSection
        portfolio={portfolio}
        contributionChart={payload.contribution_chart ?? []}
        progressChart={payload.progress_chart ?? []}
        sipAddons={payload.sip_addons ?? []}
        oneTimePayments={payload.one_time_payments ?? []}
        members={payload.members}
        focusedMemberId={focusedMemberId}
        onFocusedMemberChange={setFocusedMemberId}
      />

      {payload.goals.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-compact font-semibold uppercase tracking-wide text-muted-foreground">
            Linked goals
          </h2>
          <div className="admin-user-family-group-detail__goals-grid">
            {payload.goals.map((goal) => (
              <AdminFamilyGroupGoalCard key={goal.id} goal={goal} />
            ))}
          </div>
        </section>
      ) : null}

      <AdminUserFamilyGroupMembersSection
        members={payload.members}
        mfHoldings={payload.mf_holdings ?? []}
        activity={payload.activity ?? []}
        groupStatus={payload.status}
        canManageFamilyGroups={canManageFamilyGroups}
        focusedMemberId={focusedMemberId}
        actionLoading={actionLoading}
        onRemoveMember={(userId, name) => setRemoveTarget({ userId, name })}
      />

      <AdminConfirmDialog
        open={archiveConfirmOpen}
        onOpenChange={setArchiveConfirmOpen}
        confirmVariant="destructive"
        title="Force archive this group?"
        description="Members will lose access immediately. This action is intended for support moderation."
        confirmLabel="Archive group"
        loading={actionLoading === "archive"}
        onConfirm={() => void handleArchive()}
      />

      <AdminConfirmDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
        confirmVariant="destructive"
        title="Remove member?"
        description={
          removeTarget
            ? `${removeTarget.name} will be removed from this family group immediately.`
            : "This member will be removed from the family group immediately."
        }
        confirmLabel="Remove member"
        loading={Boolean(removeTarget && actionLoading === `remove:${removeTarget.userId}`)}
        onConfirm={() => void handleRemoveMember()}
      />
    </div>
  );
}

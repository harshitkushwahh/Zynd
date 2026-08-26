"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LoadErrorCard } from "@/components/ui/load-error-card";
import { leaveFamilyGroup } from "@/features/family-groups/api/family-groups-api";
import type { FamilyGroupSummary } from "@/features/family-groups/api/family-groups-api";
import { FamilyGroupActivityStrip } from "@/features/family-groups/components/family-group-activity-strip";
import { FamilyGroupHeroSection } from "@/features/family-groups/components/family-group-hero-section";
import { FamilyGroupStatsCard } from "@/features/family-groups/components/family-group-stats-card";
import { FamilyGroupInviteDialog } from "@/features/family-groups/components/family-group-invite-dialog";
import { FamilyGroupMembersStrip } from "@/features/family-groups/components/family-group-members-strip";
import { FamilyGroupHowItWorksCard } from "@/features/family-groups/components/family-group-how-it-works-card";
import { FamilyGroupGoalsPanel } from "@/features/family-groups/components/family-group-goals-panel";
import { FamilyGroupPortfolioPanel } from "@/features/family-groups/components/family-group-portfolio-panel";
import { FamilyGroupDashboardContentSkeleton } from "@/features/family-groups/components/family-group-dashboard-skeleton";
import { useFamilyGroupQuery } from "@/features/family-groups/hooks/use-family-group-query";
import {
  canLeaveGroup,
} from "@/features/family-groups/lib/family-permissions";
import { useAuth } from "@/contexts/auth-context";
import { invalidateFamilyQueries } from "@/features/family-groups/lib/invalidate-family-queries";
import { copy } from "@/shared/config/copy";

type FamilyGroupDashboardProps = {
  groupId: string;
  group: FamilyGroupSummary;
  groups: FamilyGroupSummary[];
  onLoadingChange?: (loading: boolean) => void;
  onMembershipChanged: () => void;
  inviteOpen: boolean;
  onInviteOpenChange: (open: boolean) => void;
};

export function FamilyGroupDashboard({
  groupId,
  group: selectedGroupSummary,
  groups,
  onLoadingChange,
  onMembershipChanged,
  inviteOpen,
  onInviteOpenChange,
}: FamilyGroupDashboardProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { group, showSkeleton, errorMessage, isFetching, refetch } = useFamilyGroupQuery(groupId);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    onLoadingChange?.(showSkeleton);
  }, [showSkeleton, onLoadingChange]);

  const refreshGroup = async () => {
    await invalidateFamilyQueries(queryClient, groupId);
    await refetch();
  };

  const isHead = group?.my_role === "head";
  const memberLimit = group?.member_limit ?? 12;
  const reservedSlots = (group?.member_count ?? 0) + (group?.pending_invite_count ?? 0);
  const canLeave = canLeaveGroup(group?.my_role, group?.member_count ?? 0);

  async function handleLeave() {
    if (!group) return;
    setLeaving(true);
    try {
      await leaveFamilyGroup(group.id);
      setLeaveOpen(false);
      onMembershipChanged();
    } catch {
      setLeaveOpen(false);
    } finally {
      setLeaving(false);
    }
  }

  if (showSkeleton && !group) {
    return <FamilyGroupDashboardContentSkeleton />;
  }

  if (errorMessage && !group) {
    return (
      <LoadErrorCard
        title={copy.familyGroups.errors.pageLoadFailedTitle}
        description={errorMessage}
        retryLabel={copy.familyGroups.errors.retry}
        retryLoading={isFetching}
        onRetry={() => void refetch()}
      />
    );
  }

  if (!group || group.id !== groupId) {
    return <FamilyGroupDashboardContentSkeleton />;
  }

  return (
    <>
      <div className="space-y-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-stretch">
            <FamilyGroupHeroSection
              members={group.members}
              currentUserId={user?.id}
              canInvite={isHead}
              onInviteMember={() => onInviteOpenChange(true)}
              className="min-h-[24rem] min-w-0 flex-1 sm:min-h-[26rem]"
            />
            <FamilyGroupStatsCard
              memberCount={group.member_count}
              pendingInvites={group.pending_invite_count}
              activeGoalsCount={group.active_goals_count ?? 0}
              activeSipsCount={group.active_sips_count ?? 0}
              totalInvestedInr={group.total_invested_inr ?? 0}
              totalCurrentValueInr={group.total_current_value_inr ?? 0}
              className="min-h-[24rem] w-full sm:min-h-[26rem] xl:w-[20rem] xl:shrink-0"
            />
          </div>

          <FamilyGroupMembersStrip
            group={selectedGroupSummary}
            groups={groups}
            members={group.members}
            currentUserId={user?.id}
            canInvite={isHead}
            inviteDisabled={reservedSlots >= memberLimit}
            memberCount={group.member_count}
            pendingInvites={group.pending_invite_count ?? 0}
            memberLimit={memberLimit}
            onInvite={() => onInviteOpenChange(true)}
            canLeave={canLeave}
            onLeave={() => setLeaveOpen(true)}
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FamilyGroupPortfolioPanel groupId={group.id} className="min-w-0" />
            <FamilyGroupGoalsPanel groupId={group.id} myRole={group.my_role ?? "viewer"} className="min-w-0" />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-start">
            <FamilyGroupActivityStrip group={selectedGroupSummary} groups={groups} layout="vertical" className="min-w-0" />
            <FamilyGroupHowItWorksCard />
          </div>
        </div>

      <FamilyGroupInviteDialog
        open={inviteOpen}
        onOpenChange={onInviteOpenChange}
        groupId={groupId}
        groupTitle={group.title}
        memberCount={group.member_count}
        pendingInviteCount={group.pending_invite_count ?? 0}
        memberLimit={memberLimit}
        onInviteCreated={() => {
          void refreshGroup();
          onMembershipChanged();
        }}
      />

      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        variant="destructive"
        title={copy.familyGroups.detail.leaveConfirmTitle}
        description={
          isHead && group.member_count <= 1
            ? copy.familyGroups.detail.leaveSoloHeadDescription
            : copy.familyGroups.detail.leaveConfirmDescription
        }
        confirmLabel={copy.familyGroups.detail.leaveAction}
        loading={leaving}
        onConfirm={() => void handleLeave()}
      />
    </>
  );
}

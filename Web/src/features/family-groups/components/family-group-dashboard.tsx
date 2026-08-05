"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LoadErrorCard } from "@/components/ui/load-error-card";
import { leaveFamilyGroup } from "@/features/family-groups/api/family-groups-api";
import { FamilyGroupActivityStrip } from "@/features/family-groups/components/family-group-activity-strip";
import { FamilyGroupHeroSection } from "@/features/family-groups/components/family-group-hero-section";
import { FamilyGroupStatsCard } from "@/features/family-groups/components/family-group-stats-card";
import { FamilyGroupInviteDialog } from "@/features/family-groups/components/family-group-invite-dialog";
import { FamilyGroupManageMembersDialog } from "@/features/family-groups/components/family-group-manage-members-dialog";
import { FamilyGroupMembersStrip } from "@/features/family-groups/components/family-group-members-strip";
import { FamilyGroupHowItWorksCard } from "@/features/family-groups/components/family-group-how-it-works-card";
import { FamilyGroupGoalsPanel } from "@/features/family-groups/components/family-group-goals-panel";
import { FamilyGroupPortfolioPanel } from "@/features/family-groups/components/family-group-portfolio-panel";
import { FamilyGroupDashboardContentSkeleton } from "@/features/family-groups/components/family-group-dashboard-skeleton";
import { useFamilyGroupQuery } from "@/features/family-groups/hooks/use-family-group-query";
import {
  canLeaveGroup,
  leaveGroupBlockedReason,
} from "@/features/family-groups/lib/family-permissions";
import { useAuth } from "@/contexts/auth-context";
import { resolveFamilyGroupApiError } from "@/features/family-groups/lib/family-group-api-errors";
import { invalidateFamilyQueries } from "@/features/family-groups/lib/invalidate-family-queries";
import { copy } from "@/shared/config/copy";

type FamilyGroupDashboardProps = {
  groupId: string;
  onLoadingChange?: (loading: boolean) => void;
  onMembershipChanged: () => void;
  inviteOpen: boolean;
  onInviteOpenChange: (open: boolean) => void;
};

export function FamilyGroupDashboard({
  groupId,
  onLoadingChange,
  onMembershipChanged,
  inviteOpen,
  onInviteOpenChange,
}: FamilyGroupDashboardProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { group, showSkeleton, errorMessage, isFetching, refetch } = useFamilyGroupQuery(groupId);
  const [saveError, setSaveError] = useState("");
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [membersDialogMode, setMembersDialogMode] = useState<"view" | "manage">("view");

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
  const leaveBlocked = leaveGroupBlockedReason(group?.my_role, group?.member_count ?? 0);

  async function handleLeave() {
    if (!group) return;
    setLeaving(true);
    try {
      await leaveFamilyGroup(group.id);
      setLeaveOpen(false);
      onMembershipChanged();
    } catch (leaveError) {
      setSaveError(resolveFamilyGroupApiError(leaveError, copy.familyGroups.governance.errors.leaveFailed));
      setLeaveOpen(false);
    } finally {
      setLeaving(false);
    }
  }

  if (showSkeleton) {
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

  if (!group) return null;

  const contentReady = group.id === groupId;

  return (
    <>
      {contentReady ? (
        <div key={groupId} className="animate-in fade-in duration-200 space-y-5">
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
            members={group.members}
            currentUserId={user?.id}
            canInvite={isHead}
            inviteDisabled={reservedSlots >= memberLimit}
            memberCount={group.member_count}
            pendingInvites={group.pending_invite_count ?? 0}
            memberLimit={memberLimit}
            onInvite={() => onInviteOpenChange(true)}
            onViewGroup={() => {
              setMembersDialogMode("view");
              setMembersDialogOpen(true);
            }}
            onManageMembers={() => {
              setMembersDialogMode("manage");
              setMembersDialogOpen(true);
            }}
            isHead={isHead}
            canLeave={canLeave}
            onLeave={() => setLeaveOpen(true)}
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FamilyGroupPortfolioPanel groupId={group.id} className="min-w-0" />
            <FamilyGroupGoalsPanel groupId={group.id} myRole={group.my_role ?? "viewer"} className="min-w-0" />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-start">
            <FamilyGroupActivityStrip groupId={group.id} layout="vertical" className="min-w-0" />
            <FamilyGroupHowItWorksCard />
          </div>
        </div>
      ) : (
        <FamilyGroupDashboardContentSkeleton />
      )}

      <FamilyGroupManageMembersDialog
        open={membersDialogOpen}
        onOpenChange={setMembersDialogOpen}
        group={group}
        currentUserId={user?.id}
        reservedSlots={reservedSlots}
        memberLimit={memberLimit}
        leaveBlocked={leaveBlocked ? copy.familyGroups.detail.leaveBlockedTransferFirst : null}
        saveError={saveError}
        onMemberUpdated={() => {
          void refreshGroup();
          onMembershipChanged();
        }}
        onMemberError={setSaveError}
        isHead={isHead}
        mode={membersDialogMode}
      />

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

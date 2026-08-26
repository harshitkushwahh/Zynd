"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { UsersRound } from "lucide-react";

import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb";
import { Badge } from "@/components/ui/badge";
import { LoadErrorCard } from "@/components/ui/load-error-card";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { FamilyGroupMembersPanel } from "@/features/family-groups/components/family-group-members-panel";
import { FamilyGroupContentFade } from "@/features/family-groups/components/family-group-content-fade";
import { useFamilyGroupQuery } from "@/features/family-groups/hooks/use-family-group-query";
import { useFamilyGroupsQuery } from "@/features/family-groups/hooks/use-family-groups-query";
import {
  buildFamilyGroupHrefFromList,
} from "@/features/family-groups/lib/family-group-navigation";
import { resolveFamilyGroupFromRef, familyGroupSlugForList } from "@/features/family-groups/lib/family-group-slug";
import { leaveGroupBlockedReason } from "@/features/family-groups/lib/family-permissions";
import { invalidateFamilyQueries } from "@/features/family-groups/lib/invalidate-family-queries";
import { FAMILY_GROUP_DASHBOARD_PANEL_CLASS } from "@/features/family-groups/lib/family-group-ui";
import { DASHBOARD_ROUTES } from "@/features/dashboard/navigation/dashboard-routes";
import { useAuth } from "@/contexts/auth-context";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const familyRoute = DASHBOARD_ROUTES.find((route) => route.id === "family-groups")!;

function FamilyGroupDetailPageSkeleton() {
  return (
    <div className={cn(FAMILY_GROUP_DASHBOARD_PANEL_CLASS, "space-y-3 p-4 sm:p-5")}>
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-24 w-full rounded-[var(--radius-card)]" />
      ))}
    </div>
  );
}

export function FamilyGroupDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const requestedGroupRef = searchParams.get("group");
  const { data: groupsData } = useFamilyGroupsQuery();
  const resolvedGroup = useMemo(
    () => resolveFamilyGroupFromRef(groupsData?.items ?? [], requestedGroupRef),
    [groupsData?.items, requestedGroupRef],
  );
  const groupId = resolvedGroup?.id ?? null;
  const { group, showSkeleton, errorMessage, isFetching, refetch } = useFamilyGroupQuery(groupId);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!requestedGroupRef) {
      router.replace("/dashboard/family");
      return;
    }
    if (!groupsData?.items.length || !resolvedGroup) return;
    const canonicalRef = familyGroupSlugForList(resolvedGroup, groupsData.items);
    if (requestedGroupRef !== canonicalRef) {
      router.replace(`/dashboard/family/group?group=${encodeURIComponent(canonicalRef)}`, { scroll: false });
    }
  }, [groupsData?.items, requestedGroupRef, resolvedGroup, router]);

  const groupReady = Boolean(group && groupId && group.id === groupId && !showSkeleton);
  const isHead = group?.my_role === "head";
  const memberLimit = group?.member_limit ?? 12;
  const reservedSlots = (group?.member_count ?? 0) + (group?.pending_invite_count ?? 0);
  const leaveBlocked = leaveGroupBlockedReason(group?.my_role, group?.member_count ?? 0);

  const pageDescription = useMemo(() => {
    if (!groupReady || !group) {
      return copy.familyGroups.dashboard.manageSectionDescriptionMember("");
    }
    return isHead
      ? copy.familyGroups.dashboard.manageSectionDescriptionHead(group.title)
      : copy.familyGroups.dashboard.manageSectionDescriptionMember(group.title);
  }, [group, groupReady, isHead]);

  const refreshGroup = async () => {
    if (!groupId) return;
    await invalidateFamilyQueries(queryClient, groupId);
    await refetch();
  };

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
      <DashboardBreadcrumb
        items={[
          { label: familyRoute.label, href: "/dashboard/family" },
          ...(groupReady && group?.title
            ? [{ label: group.title, href: buildFamilyGroupHrefFromList(group, groupsData?.items ?? [group]) }]
            : []),
          { label: copy.familyGroups.dashboard.viewGroupAction },
        ]}
      />

      <div className="min-h-0 flex-1 overflow-y-auto pb-8 [scrollbar-width:thin]">
        <div className="mb-6 space-y-4">
          <PageHeader
            icon={UsersRound}
            title={copy.familyGroups.dashboard.viewGroupAction}
            description={pageDescription}
            action={
              groupReady ? (
                <Badge variant="secondary" className="font-normal tabular-nums">
                  {reservedSlots}/{memberLimit}
                </Badge>
              ) : null
            }
          />
        </div>

        {showSkeleton ? (
          <FamilyGroupDetailPageSkeleton />
        ) : errorMessage && !group ? (
          <LoadErrorCard
            title={copy.familyGroups.errors.pageLoadFailedTitle}
            description={errorMessage}
            retryLabel={copy.familyGroups.errors.retry}
            retryLoading={isFetching}
            onRetry={() => void refetch()}
          />
        ) : groupReady && group ? (
          <FamilyGroupContentFade>
            <div className={cn(FAMILY_GROUP_DASHBOARD_PANEL_CLASS, "p-4 sm:p-5")}>
              <FamilyGroupMembersPanel
              group={group}
              currentUserId={user?.id}
              reservedSlots={reservedSlots}
              memberLimit={memberLimit}
              leaveBlocked={
                leaveBlocked ? copy.familyGroups.detail.leaveBlockedTransferFirst : null
              }
              saveError={saveError}
              onMemberUpdated={() => {
                void refreshGroup();
              }}
              onMemberError={setSaveError}
              isHead={isHead}
            />
            </div>
          </FamilyGroupContentFade>
        ) : null}
      </div>
    </div>
  );
}

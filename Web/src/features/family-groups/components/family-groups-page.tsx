"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Plus, UserPlus, UsersRound } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb";
import { LoadErrorCard } from "@/components/ui/load-error-card";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createFamilyGroup,
  type FamilyGroupListResponse,
} from "@/features/family-groups/api/family-groups-api";
import { FamilyGroupArchivedDialog } from "@/features/family-groups/components/family-group-archived-dialog";
import { FamilyGroupCreateDialog } from "@/features/family-groups/components/family-group-create-dialog";
import { FamilyGroupDashboard } from "@/features/family-groups/components/family-group-dashboard";
import {
  FamilyGroupDashboardContentSkeleton,
} from "@/features/family-groups/components/family-group-dashboard-skeleton";
import { FamilyGroupEditDialog } from "@/features/family-groups/components/family-group-edit-dialog";
import { FamilyGroupTabs } from "@/features/family-groups/components/family-group-tabs";
import { useFamilyGroupPinned } from "@/features/family-groups/hooks/use-family-group-pinned";
import { useFamilyGroupsQuery } from "@/features/family-groups/hooks/use-family-groups-query";
import { buildFamilyGroupHref } from "@/features/family-groups/lib/family-group-navigation";
import { FAMILY_GROUP_CARD_RADIUS_CLASS } from "@/features/family-groups/lib/family-group-ui";
import { DASHBOARD_ROUTES } from "@/features/dashboard/navigation/dashboard-routes";
import { useAuth } from "@/contexts/auth-context";
import { resolveFamilyGroupApiError } from "@/features/family-groups/lib/family-group-api-errors";
import { invalidateFamilyQueries } from "@/features/family-groups/lib/invalidate-family-queries";
import { queryKeys } from "@/lib/query-keys";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const familyRoute = DASHBOARD_ROUTES.find((route) => route.id === "family-groups")!;
const FamilyRouteIcon = familyRoute.icon;

export function FamilyGroupsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const requestedGroupId = searchParams.get("group");
  const { pinnedGroupId, togglePin } = useFamilyGroupPinned(user?.id);
  const { data, showSkeleton, errorMessage, isFetching, refetch } = useFamilyGroupsQuery();

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editGroupId, setEditGroupId] = useState<string | null>(null);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [switchingGroupId, setSwitchingGroupId] = useState<string | null>(null);

  async function refreshGroups() {
    const result = await refetch();
    return result.data ?? null;
  }

  const selectedGroupId = useMemo(() => {
    if (!data?.items.length) return null;
    if (requestedGroupId && data.items.some((group) => group.id === requestedGroupId)) {
      return requestedGroupId;
    }
    if (pinnedGroupId && data.items.some((group) => group.id === pinnedGroupId)) {
      return pinnedGroupId;
    }
    return data.items[0]?.id ?? null;
  }, [data, pinnedGroupId, requestedGroupId]);

  const selectedGroup = useMemo(
    () => data?.items.find((group) => group.id === selectedGroupId) ?? null,
    [data, selectedGroupId],
  );

  const editGroup = useMemo(
    () => data?.items.find((group) => group.id === (editGroupId ?? selectedGroupId)) ?? null,
    [data, editGroupId, selectedGroupId],
  );

  const inviteDisabled = selectedGroup
    ? selectedGroup.member_count + (selectedGroup.pending_invite_count ?? 0) >=
      (selectedGroup.member_limit ?? 12)
    : true;

  useEffect(() => {
    if (!data?.items.length || !selectedGroupId) return;
    if (requestedGroupId !== selectedGroupId) {
      router.replace(buildFamilyGroupHref(selectedGroupId), { scroll: false });
    }
  }, [data?.items.length, requestedGroupId, router, selectedGroupId]);

  const atLimit = Boolean(data && data.active_count >= data.limit);

  function handleSelectGroup(groupId: string) {
    if (groupId === selectedGroupId) {
      return;
    }
    setSwitchingGroupId(groupId);
    router.replace(buildFamilyGroupHref(groupId), { scroll: false });
  }

  function handleEditGroup(groupId: string) {
    const group = data?.items.find((item) => item.id === groupId);
    if (!group || group.my_role !== "head") return;
    if (groupId !== selectedGroupId) {
      handleSelectGroup(groupId);
    }
    setEditGroupId(groupId);
    setEditOpen(true);
  }

  async function handleMembershipChanged() {
    const response = await refreshGroups();
    if (!response) return;

    const stillExists = selectedGroupId
      ? response.items.some((group) => group.id === selectedGroupId)
      : false;

    if (!stillExists) {
      const nextGroupId = response.items[0]?.id ?? null;
      router.replace(buildFamilyGroupHref(nextGroupId), { scroll: false });
    }

    if (selectedGroupId) {
      await invalidateFamilyQueries(queryClient, selectedGroupId);
    }
  }

  async function handleCreate(input: { title: string; description?: string; tag?: string }) {
    setCreating(true);
    setCreateError("");
    try {
      const created = await createFamilyGroup(input);
      setCreateOpen(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.family.list() });
      queryClient.setQueryData<FamilyGroupListResponse>(queryKeys.family.list(), (current) => {
        if (!current) {
          return {
            items: [created],
            limit: 5,
            active_count: 1,
          };
        }
        return {
          ...current,
          items: [created, ...current.items.filter((item) => item.id !== created.id)],
          active_count: current.active_count + 1,
        };
      });
      router.replace(buildFamilyGroupHref(created.id), { scroll: false });
    } catch (submitError) {
      setCreateError(resolveFamilyGroupApiError(submitError, copy.familyGroups.errors.createFailed));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
      <DashboardBreadcrumb items={[{ label: familyRoute.label }]} />

      <div className="min-h-0 flex-1 overflow-y-auto pb-8 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
        <div className="mb-6 space-y-4">
          <PageHeader
            icon={FamilyRouteIcon}
            title={copy.familyGroups.dashboard.heroTitle}
            loading={showSkeleton}
            action={
              !showSkeleton && data && data.items.length === 0 ? (
                <Button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  disabled={atLimit}
                  className="shrink-0"
                >
                  <Plus className="size-4" strokeWidth={2} />
                  {copy.familyGroups.createAction}
                </Button>
              ) : !showSkeleton && selectedGroup?.my_role === "head" ? (
                <Button
                  type="button"
                  onClick={() => setInviteOpen(true)}
                  disabled={inviteDisabled}
                  className="shrink-0"
                >
                  <UserPlus className="size-4" strokeWidth={2} />
                  {copy.familyGroups.dashboard.inviteAction}
                </Button>
              ) : null
            }
          />

          {showSkeleton ? (
            <div className="flex gap-2 overflow-hidden pb-1" aria-hidden="true">
              <Skeleton className="h-10 w-[10rem] shrink-0 rounded-full" />
              <Skeleton className="h-10 w-[9rem] shrink-0 rounded-full" />
            </div>
          ) : data ? (
            <FamilyGroupTabs
              groups={data.items}
              selectedGroupId={selectedGroupId}
              pinnedGroupId={pinnedGroupId}
              loadingGroupId={switchingGroupId}
              onSelect={handleSelectGroup}
              onTogglePin={togglePin}
              onEditGroup={handleEditGroup}
              onViewArchived={() => setArchivedOpen(true)}
              onCreate={() => setCreateOpen(true)}
              canCreate={!atLimit}
            />
          ) : null}
        </div>

        {showSkeleton ? (
          <FamilyGroupDashboardContentSkeleton />
        ) : errorMessage && !data ? (
          <LoadErrorCard
            title={copy.familyGroups.errors.pageLoadFailedTitle}
            description={errorMessage}
            retryLabel={copy.familyGroups.errors.retry}
            retryLoading={isFetching}
            onRetry={() => void refetch()}
          />
        ) : data && data.items.length > 0 && selectedGroupId ? (
          <FamilyGroupDashboard
            groupId={selectedGroupId}
            onLoadingChange={(dashboardLoading) => {
              setSwitchingGroupId((current) => {
                if (dashboardLoading) {
                  return selectedGroupId ?? current;
                }
                return current === selectedGroupId ? null : current;
              });
            }}
            onMembershipChanged={() => void handleMembershipChanged()}
            inviteOpen={inviteOpen}
            onInviteOpenChange={setInviteOpen}
          />
        ) : (
          <div className="space-y-6">
            {atLimit ? (
              <div className={cn("border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-compact text-amber-900 dark:text-amber-100", FAMILY_GROUP_CARD_RADIUS_CLASS)}>
                <p className="font-medium">{copy.familyGroups.limitReachedTitle}</p>
                <p className="mt-1 text-muted-foreground">
                  {copy.familyGroups.limitReachedDescription(data?.limit ?? 5)}
                </p>
              </div>
            ) : null}

            <div className={cn("flex flex-col items-center justify-center border border-dashed border-border/80 bg-muted/10 px-6 py-16 text-center", FAMILY_GROUP_CARD_RADIUS_CLASS)}>
              <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UsersRound className="size-6" strokeWidth={2} />
              </div>
              <h2 className="mt-4 text-body font-semibold text-foreground">{copy.familyGroups.emptyTitle}</h2>
              <p className="mt-2 max-w-md text-compact text-muted-foreground">
                {copy.familyGroups.emptyDescription}
              </p>
              <Button type="button" className="mt-6" onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" strokeWidth={2} />
                {copy.familyGroups.createAction}
              </Button>
            </div>
          </div>
        )}
      </div>

      <FamilyGroupCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
        submitting={creating}
        error={createError}
      />

      <FamilyGroupEditDialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditGroupId(null);
        }}
        group={editGroup}
        onUpdated={() => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.family.list() });
          if (editGroupId ?? selectedGroupId) {
            void queryClient.invalidateQueries({
              queryKey: queryKeys.family.detail(editGroupId ?? selectedGroupId!),
            });
          }
        }}
        onArchived={() => void handleMembershipChanged()}
      />

      <FamilyGroupArchivedDialog open={archivedOpen} onOpenChange={setArchivedOpen} />
    </div>
  );
}

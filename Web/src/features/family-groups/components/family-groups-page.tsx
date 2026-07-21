"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, UserPlus, UsersRound } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { LoadErrorCard } from "@/components/ui/load-error-card";
import { PageTitle } from "@/components/ui/page-title";
import {
  createFamilyGroup,
  fetchFamilyGroups,
  type FamilyGroupListResponse,
} from "@/features/family-groups/api/family-groups-api";
import { FamilyGroupCreateDialog } from "@/features/family-groups/components/family-group-create-dialog";
import { FamilyGroupDashboard } from "@/features/family-groups/components/family-group-dashboard";
import { FamilyGroupsPageSkeleton } from "@/features/family-groups/components/family-groups-page-skeleton";
import { buildFamilyGroupHref } from "@/features/family-groups/lib/family-group-navigation";
import { DASHBOARD_ROUTES } from "@/features/dashboard/navigation/dashboard-routes";
import { parseApiError } from "@/lib/api-client";
import { copy } from "@/shared/config/copy";

const familyRoute = DASHBOARD_ROUTES.find((route) => route.id === "family-groups")!;
const FamilyRouteIcon = familyRoute.icon;

export function FamilyGroupsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedGroupId = searchParams.get("group");

  const [data, setData] = useState<FamilyGroupListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetchFamilyGroups();
      setData(response);
      return response;
    } catch (loadError) {
      setError(parseApiError(loadError).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  const selectedGroupId = useMemo(() => {
    if (!data?.items.length) return null;
    if (requestedGroupId && data.items.some((group) => group.id === requestedGroupId)) {
      return requestedGroupId;
    }
    return data.items[0]?.id ?? null;
  }, [data, requestedGroupId]);

  const selectedGroup = useMemo(
    () => data?.items.find((group) => group.id === selectedGroupId) ?? null,
    [data, selectedGroupId],
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
    router.replace(buildFamilyGroupHref(groupId), { scroll: false });
  }

  async function handleMembershipChanged() {
    const response = await loadGroups();
    if (!response) return;

    const stillExists = selectedGroupId
      ? response.items.some((group) => group.id === selectedGroupId)
      : false;

    if (!stillExists) {
      const nextGroupId = response.items[0]?.id ?? null;
      router.replace(buildFamilyGroupHref(nextGroupId), { scroll: false });
    }
  }

  async function handleCreate(input: { title: string; description?: string; tag?: string }) {
    setCreating(true);
    setCreateError("");
    try {
      const created = await createFamilyGroup(input);
      setCreateOpen(false);
      const response = await loadGroups();
      if (response) {
        setData(response);
      } else {
        setData((current) => {
          if (!current) {
            return {
              items: [created],
              limit: 5,
              active_count: 1,
            };
          }
          return {
            ...current,
            items: [created, ...current.items],
            active_count: current.active_count + 1,
          };
        });
      }
      router.replace(buildFamilyGroupHref(created.id), { scroll: false });
    } catch (submitError) {
      setCreateError(parseApiError(submitError).message || copy.familyGroups.errors.createFailed);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
      <Breadcrumb className="mb-6 shrink-0">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/dashboard" />}>Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{familyRoute.label}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="min-h-0 flex-1 overflow-y-auto pb-8 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-primary/10 text-primary">
              <FamilyRouteIcon className="size-4" strokeWidth={2.25} />
            </div>
            <div className="min-w-0">
              <PageTitle>{copy.familyGroups.dashboard.heroTitle}</PageTitle>
              <p className="mt-2 max-w-2xl text-compact text-muted-foreground">
                {copy.familyGroups.dashboard.heroSubtitle}
              </p>
            </div>
          </div>

          {!loading && data && data.items.length === 0 ? (
            <Button
              type="button"
              onClick={() => setCreateOpen(true)}
              disabled={atLimit}
              className="shrink-0"
            >
              <Plus className="size-4" strokeWidth={2} />
              {copy.familyGroups.createAction}
            </Button>
          ) : selectedGroup?.my_role === "head" ? (
            <Button
              type="button"
              onClick={() => setInviteOpen(true)}
              disabled={inviteDisabled}
              className="shrink-0"
            >
              <UserPlus className="size-4" strokeWidth={2} />
              {copy.familyGroups.dashboard.inviteAction}
            </Button>
          ) : null}
        </div>

        {loading && !data ? (
          <FamilyGroupsPageSkeleton />
        ) : error && !data ? (
          <LoadErrorCard
            title={copy.familyGroups.errors.pageLoadFailedTitle}
            description={error}
            retryLabel={copy.familyGroups.errors.retry}
            onRetry={() => void loadGroups()}
          />
        ) : data && data.items.length > 0 && selectedGroupId ? (
          <FamilyGroupDashboard
            key={selectedGroupId}
            groupId={selectedGroupId}
            groups={data.items}
            onSelectGroup={handleSelectGroup}
            onCreateGroup={() => setCreateOpen(true)}
            canCreateGroup={!atLimit}
            onMembershipChanged={() => void handleMembershipChanged()}
            inviteOpen={inviteOpen}
            onInviteOpenChange={setInviteOpen}
          />
        ) : (
          <div className="space-y-6">
            {atLimit ? (
              <div className="rounded-[var(--radius-card)] border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-compact text-amber-900 dark:text-amber-100">
                <p className="font-medium">{copy.familyGroups.limitReachedTitle}</p>
                <p className="mt-1 text-muted-foreground">
                  {copy.familyGroups.limitReachedDescription(data?.limit ?? 5)}
                </p>
              </div>
            ) : null}

            <div className="flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-border/80 bg-muted/10 px-6 py-16 text-center">
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
    </div>
  );
}

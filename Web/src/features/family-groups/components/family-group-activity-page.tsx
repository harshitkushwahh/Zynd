"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock3 } from "lucide-react";

import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LoadErrorCard } from "@/components/ui/load-error-card";
import { FieldMessage } from "@/components/ui/ui-message";
import { PageTitle } from "@/components/ui/page-title";
import {
  fetchFamilyGroup,
  revokeFamilyGroupInvite,
  type FamilyGroupDetail,
  type FamilyGroupInvite,
} from "@/features/family-groups/api/family-groups-api";
import { FamilyGroupActivityTable } from "@/features/family-groups/components/family-group-activity-table";
import { FamilyGroupActivityPageSkeleton } from "@/features/family-groups/components/family-group-activity-page-skeleton";
import { FamilyGroupSentInvitesTable } from "@/features/family-groups/components/family-group-sent-invites-table";
import { buildFamilyGroupHref } from "@/features/family-groups/lib/family-group-navigation";
import { canViewSentInvites } from "@/features/family-groups/lib/family-permissions";
import { DASHBOARD_ROUTES } from "@/features/dashboard/navigation/dashboard-routes";
import { useAuth } from "@/contexts/auth-context";
import { resolveFamilyGroupApiError } from "@/features/family-groups/lib/family-group-api-errors";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const familyRoute = DASHBOARD_ROUTES.find((route) => route.id === "family-groups")!;

type ActivityPageTab = "activity" | "invites";

function ActivityPageTabToggle({
  tab,
  onChange,
  sentInviteCount,
}: {
  tab: ActivityPageTab;
  onChange: (tab: ActivityPageTab) => void;
  sentInviteCount: number;
}) {
  const options: Array<{ id: ActivityPageTab; label: string; count?: number }> = [
    { id: "activity", label: copy.familyGroups.activity.tab },
    {
      id: "invites",
      label: copy.familyGroups.invite.sentTitle,
      count: sentInviteCount,
    },
  ];

  return (
    <div
      role="tablist"
      aria-label={copy.familyGroups.activity.pageTitle}
      className="grid max-w-xl grid-cols-2 gap-1 rounded-full border border-border/80 bg-muted/20 p-1"
    >
      {options.map((option) => {
        const isActive = tab === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.id)}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-full px-3 py-2.5 text-compact font-medium transition-colors",
              isActive
                ? "bg-foreground text-background shadow-zynd-low"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span>{option.label}</span>
            {option.count !== undefined ? (
              <span
                className={cn(
                  "flex min-h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
                  isActive ? "bg-background/15 text-background" : "bg-muted text-muted-foreground",
                )}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function FamilyGroupActivityPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const groupId = searchParams.get("group");
  const [group, setGroup] = useState<FamilyGroupDetail | null>(null);
  const [tab, setTab] = useState<ActivityPageTab>("activity");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [revokeInviteTarget, setRevokeInviteTarget] = useState<FamilyGroupInvite | null>(null);
  const [revokingInvite, setRevokingInvite] = useState(false);

  const groupReady = Boolean(group && groupId && group.id === groupId && !loading);

  const viewerRole = useMemo(() => {
    if (!groupReady || !group) return null;
    if (user?.id) {
      const membership = group.members.find((member) => member.user_id === user.id);
      if (membership) return membership.role;
    }
    return group.my_role ?? null;
  }, [group, groupReady, user?.id]);

  const canViewInvites = canViewSentInvites(viewerRole);
  const sentInviteCount = canViewInvites ? (group?.invites?.length ?? 0) : 0;

  const loadGroup = useCallback(async () => {
    if (!groupId) {
      router.replace("/dashboard/family");
      return;
    }

    setLoading(true);
    setError("");
    setGroup(null);
    try {
      const response = await fetchFamilyGroup(groupId);
      setGroup(response);
    } catch (loadError) {
      setError(resolveFamilyGroupApiError(loadError, copy.familyGroups.activity.loadFailedTitle));
      setGroup(null);
    } finally {
      setLoading(false);
    }
  }, [groupId, router]);

  useEffect(() => {
    setTab("activity");
  }, [groupId]);

  useEffect(() => {
    void loadGroup();
  }, [loadGroup]);

  useEffect(() => {
    if (!canViewInvites && tab === "invites") {
      setTab("activity");
    }
  }, [canViewInvites, tab]);

  async function handleRevokeInvite(invite: FamilyGroupInvite) {
    if (!group) return;
    setRevokingInvite(true);
    setSaveError("");
    try {
      await revokeFamilyGroupInvite(group.id, invite.id);
      setRevokeInviteTarget(null);
      await loadGroup();
    } catch (revokeError) {
      setSaveError(resolveFamilyGroupApiError(revokeError, copy.familyGroups.invite.errors.revokeFailed));
      setRevokeInviteTarget(null);
    } finally {
      setRevokingInvite(false);
    }
  }

  const pageDescription = useMemo(() => {
    if (!groupReady) {
      return copy.familyGroups.activity.pageDescriptionMember;
    }
    return canViewInvites
      ? copy.familyGroups.activity.pageDescriptionHead
      : copy.familyGroups.activity.pageDescriptionMember;
  }, [canViewInvites, groupReady]);

  return (
    <>
      <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
        <DashboardBreadcrumb
          items={[
            { label: familyRoute.label, href: "/dashboard/family" },
            ...(groupReady && group?.title
              ? [{ label: group.title, href: buildFamilyGroupHref(groupId!) }]
              : []),
            { label: copy.familyGroups.activity.pageTitle },
          ]}
        />

        <div className="min-h-0 flex-1 overflow-y-auto pb-8 [scrollbar-width:thin]">
          <div className="mb-6 space-y-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-primary/10 text-primary">
                <Clock3 className="size-4" strokeWidth={2.25} />
              </div>
              <div className="min-w-0">
                <PageTitle>{copy.familyGroups.activity.pageTitle}</PageTitle>
                <p className="mt-2 max-w-2xl text-compact text-muted-foreground">{pageDescription}</p>
              </div>
            </div>
            {groupReady && canViewInvites ? (
              <ActivityPageTabToggle
                tab={tab}
                onChange={setTab}
                sentInviteCount={sentInviteCount}
              />
            ) : null}
          </div>

          {loading ? (
            <FamilyGroupActivityPageSkeleton />
          ) : error ? (
            <LoadErrorCard
              title={copy.familyGroups.errors.pageLoadFailedTitle}
              description={error}
              retryLabel={copy.familyGroups.errors.retry}
              onRetry={() => void loadGroup()}
            />
          ) : groupReady && groupId && group ? (
            <div role="tabpanel">
              {tab === "activity" || !canViewInvites ? <FamilyGroupActivityTable groupId={groupId} /> : null}
              {tab === "invites" && canViewInvites ? (
                <div className="space-y-4">
                  <FamilyGroupSentInvitesTable
                    invites={group.invites ?? []}
                    onRevokeInvite={setRevokeInviteTarget}
                  />
                  {saveError ? <FieldMessage message={saveError} className="mt-0" /> : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(revokeInviteTarget)}
        onOpenChange={(open) => {
          if (!open) setRevokeInviteTarget(null);
        }}
        variant="destructive"
        title={copy.familyGroups.invite.revokeConfirmTitle}
        description={
          revokeInviteTarget
            ? copy.familyGroups.invite.revokeConfirmDescription(
                revokeInviteTarget.invitee_email ?? copy.familyGroups.invite.linkRecipient,
              )
            : ""
        }
        confirmLabel={copy.familyGroups.invite.withdraw}
        loading={revokingInvite}
        onConfirm={() => {
          if (revokeInviteTarget) void handleRevokeInvite(revokeInviteTarget);
        }}
      />
    </>
  );
}

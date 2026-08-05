"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getErrorMessage } from "@/lib/errors";
import { Shield, UserX } from "lucide-react";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminProfilePageSkeleton } from "@/components/ui/admin-skeletons";
import { Button } from "@/components/ui/button";
import { UserProfileHeroSection } from "@/components/users/user-profile-hero-section";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { AdminTabList, AdminTabTrigger } from "@/components/ui/admin-tab-bar";
import { UserActivityTable } from "@/components/users/user-activity-table";
import {
  AdminSectionBreadcrumb,
  userManagementBreadcrumbSegments,
} from "@/components/dashboard/admin-section-breadcrumb";
import { UserInvestmentsDetailSection } from "@/components/users/user-investments-detail-section";
import { UserAccountActionsDialog, SUSPEND_REASONS } from "@/components/users/user-account-actions-dialog";
import { UserTeamRolesDialog } from "@/components/users/user-team-roles-dialog";
import { UserRiskDetailSection } from "@/components/users/user-risk-detail-section";
import { UserFamilyGroupsDetailSection } from "@/components/users/user-family-groups-detail-section";
import { UserGoalsDetailSection } from "@/components/users/user-goals-detail-section";
import { UserKycDetailSection } from "@/components/users/user-kyc-detail-section";
import { clientIdToProfilePath } from "@/lib/admin-user-ref";
import {
  resolveUserProfileTab,
  userProfileTabHref,
  USER_PROFILE_TABS,
  type UserProfileTabKey,
} from "@/lib/admin-user-profile-navigation";
import { useMountedTabs } from "@/hooks/use-mounted-tabs";
import {
  adminUserProfileQueryKey,
  useAdminUserProfileQuery,
} from "@/hooks/use-admin-user-profile-query";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import {
  assignAdminUserRole,
  revokeAdminUserRole,
  suspendAdminUser,
  unsuspendAdminUser,
} from "@/lib/admin-api";

export function UserProfileView({
  clientId,
  profileTabSlug,
}: {
  clientId: string;
  profileTabSlug?: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = useAdminAuth();
  const canReadUsers = hasPermission("users.read");
  const canSuspend = hasPermission("users.suspend");
  const canManageRbac = hasPermission("rbac.manage");
  const canReadKyc = hasPermission("documents.read");
  const canDownloadDocs = hasPermission("documents.download");
  const canVerifyDocs = hasPermission("documents.verify");
  const canReadMf = hasPermission("mf.transactions.read");
  const canReadRiskProfile = hasPermission("risk_profile.users.read");
  const canReadFamilyGroups = hasPermission("family_groups.read");
  const canManageFamilyGroups = hasPermission("family_groups.manage");
  const canReadAudit = hasPermission("audit.read");

  const profileQueryParams = useMemo(
    () => ({
      clientId,
      canReadUsers,
      canManageRbac,
    }),
    [canManageRbac, canReadUsers, clientId],
  );

  const {
    data: profileData,
    isPending: profilePending,
    error: profileQueryError,
  } = useAdminUserProfileQuery(profileQueryParams);
  const summary = profileData?.summary ?? null;
  const profileDetail = profileData?.profileDetail ?? null;
  const roles = profileData?.roles ?? [];
  const assignedRoles = profileData?.assignedRoles ?? [];
  const showPageSkeleton = profilePending && !profileData;
  const profileError = profileQueryError
    ? getErrorMessage(profileQueryError, "Could not load user profile.")
    : "";

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [suspendReason, setSuspendReason] = useState<string>("suspicious_activity");
  const [suspendNotes, setSuspendNotes] = useState("");
  const [roleToAssign, setRoleToAssign] = useState("");
  const [teamRolesDialogOpen, setTeamRolesDialogOpen] = useState(false);
  const [teamRolesSearchQuery, setTeamRolesSearchQuery] = useState("");
  const [accountActionsDialogOpen, setAccountActionsDialogOpen] = useState(false);

  const loadDetails = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: adminUserProfileQueryKey(clientId, canManageRbac),
    });
  }, [canManageRbac, clientId, queryClient]);

  useEffect(() => {
    if (profileQueryError) {
      setError(getErrorMessage(profileQueryError, "Could not load user profile."));
    }
  }, [profileQueryError]);

  const roleNameByKey = new Map(roles.map((role) => [role.key, role.name]));
  const availableRoles = roles.filter((role) => !assignedRoles.includes(role.key));

  const profilePath = clientIdToProfilePath(clientId);

  const showPortfolioWithoutInvestments = canManageRbac || canSuspend;

  const visibleProfileTabs = useMemo(
    () =>
      USER_PROFILE_TABS.filter((tab) => {
        if (tab.key === "kyc" && !profileDetail?.kyc) return false;
        if (tab.key === "portfolio") {
          const hasInvestments = Boolean(profileDetail?.investments);
          if (!hasInvestments && !showPortfolioWithoutInvestments) return false;
          if (!hasInvestments && showPortfolioWithoutInvestments) return true;
        }
        if (!tab.permissions?.length) return true;
        if (tab.match === "all") {
          return tab.permissions.every((permission) => hasPermission(permission));
        }
        return tab.permissions.some((permission) => hasPermission(permission));
      }),
    [hasPermission, profileDetail?.investments, profileDetail?.kyc, showPortfolioWithoutInvestments],
  );

  const activeProfileTab = resolveUserProfileTab(profileTabSlug, hasPermission, {
    kyc: Boolean(profileDetail?.kyc),
    investments: Boolean(profileDetail?.investments) || showPortfolioWithoutInvestments,
  });

  const { activeTab: activeTabKey, selectTab, keepMounted } = useMountedTabs<UserProfileTabKey>(
    activeProfileTab?.key ?? visibleProfileTabs[0]?.key ?? "portfolio",
    activeProfileTab?.key,
  );

  useEffect(() => {
    if (showPageSkeleton || visibleProfileTabs.length === 0) return;

    const urlTab = profileTabSlug
      ? visibleProfileTabs.find((tab) => tab.slug === profileTabSlug)
      : undefined;

    if (!profileTabSlug || !urlTab) {
      const tab =
        visibleProfileTabs.find((item) => item.key === activeTabKey) ?? visibleProfileTabs[0];
      router.replace(userProfileTabHref(profilePath, tab), { scroll: false });
    }
  }, [
    activeTabKey,
    profilePath,
    profileTabSlug,
    router,
    showPageSkeleton,
    visibleProfileTabs,
  ]);

  const handleProfileTabChange = (value: string) => {
    const tab = visibleProfileTabs.find((item) => item.key === value);
    if (!tab) return;
    selectTab(tab.key);
    router.push(userProfileTabHref(profilePath, tab), { scroll: false });
  };

  const handleSuspend = async () => {
    if (!canSuspend || !summary) return;
    setActionLoading("suspend");
    setError("");
    try {
      const result = await suspendAdminUser(clientId, {
        reason_code: suspendReason as (typeof SUSPEND_REASONS)[number]["value"],
        notes: suspendNotes || undefined,
      });
      setMessage(result.message);
      setAccountActionsDialogOpen(false);
      await loadDetails();
    } catch (err) {
      setError(getErrorMessage(err, "Could not suspend user."));
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnsuspend = async () => {
    if (!canSuspend || !summary) return;
    setActionLoading("unsuspend");
    setError("");
    try {
      const result = await unsuspendAdminUser(clientId);
      setMessage(result.message);
      setAccountActionsDialogOpen(false);
      await loadDetails();
    } catch (err) {
      setError(getErrorMessage(err, "Could not unsuspend user."));
    } finally {
      setActionLoading(null);
    }
  };

  const handleAssignRole = async () => {
    if (!canManageRbac || !roleToAssign || summary?.role !== "admin") return;
    setActionLoading(`assign-${roleToAssign}`);
    setError("");
    try {
      const result = await assignAdminUserRole(clientId, roleToAssign);
      queryClient.setQueryData(adminUserProfileQueryKey(clientId, canManageRbac), (current) =>
        current ? { ...current, assignedRoles: result.roles } : current,
      );
      setRoleToAssign("");
      setMessage(`Added ${roleNameByKey.get(roleToAssign) ?? roleToAssign}.`);
    } catch (err) {
      setError(getErrorMessage(err, "Could not assign role."));
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevokeRole = async (roleKey: string) => {
    if (!canManageRbac) return;
    setActionLoading(`revoke-${roleKey}`);
    setError("");
    try {
      const result = await revokeAdminUserRole(clientId, roleKey);
      queryClient.setQueryData(adminUserProfileQueryKey(clientId, canManageRbac), (current) =>
        current ? { ...current, assignedRoles: result.roles } : current,
      );
      setMessage(`Removed ${roleNameByKey.get(roleKey) ?? roleKey}.`);
    } catch (err) {
      setError(getErrorMessage(err, "Could not revoke role."));
    } finally {
      setActionLoading(null);
    }
  };

  if (!canReadUsers) {
    return (
      <p className="text-compact text-muted-foreground">You do not have permission to view user profiles.</p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <AdminSectionBreadcrumb
          segments={userManagementBreadcrumbSegments([
            {
              label: showPageSkeleton ? "Loading..." : (summary?.display_name ?? clientId),
            },
          ])}
        />

        {!showPageSkeleton && summary && (canManageRbac || canSuspend) ? (
          <div className="flex flex-wrap items-center gap-2">
            {canSuspend ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAccountActionsDialogOpen(true)}
              >
                <UserX className="size-4" />
                Account actions
              </Button>
            ) : null}
            {canManageRbac ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setTeamRolesDialogOpen(true)}
              >
                <Shield className="size-4" />
                View team roles
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {error || profileError ? (
        <AdminFeedbackMessage variant="destructive">{error || profileError}</AdminFeedbackMessage>
      ) : null}
      {message ? <AdminFeedbackMessage variant="success">{message}</AdminFeedbackMessage> : null}

      {showPageSkeleton ? (
        <AdminProfilePageSkeleton />
      ) : summary ? (
        <>
          {canSuspend ? (
            <UserAccountActionsDialog
              open={accountActionsDialogOpen}
              onOpenChange={setAccountActionsDialogOpen}
              summary={summary}
              suspendReason={suspendReason}
              suspendNotes={suspendNotes}
              actionLoading={actionLoading}
              onSuspendReasonChange={setSuspendReason}
              onSuspendNotesChange={setSuspendNotes}
              onSuspend={() => void handleSuspend()}
              onUnsuspend={() => void handleUnsuspend()}
            />
          ) : null}
          {canManageRbac ? (
            <UserTeamRolesDialog
              open={teamRolesDialogOpen}
              onOpenChange={setTeamRolesDialogOpen}
              summary={summary}
              roles={roles}
              assignedRoles={assignedRoles}
              roleNameByKey={roleNameByKey}
              availableRoles={availableRoles}
              roleToAssign={roleToAssign}
              actionLoading={actionLoading}
              searchQuery={teamRolesSearchQuery}
              onSearchQueryChange={setTeamRolesSearchQuery}
              onRoleToAssignChange={setRoleToAssign}
              onAssignRole={() => void handleAssignRole()}
              onRevokeRole={(roleKey) => void handleRevokeRole(roleKey)}
            />
          ) : null}

          <UserProfileHeroSection
            summary={summary}
            profileDetail={profileDetail}
            canReadMf={canReadMf}
            canReadKyc={canReadKyc}
            canReadRiskProfile={canReadRiskProfile}
            onOpenPortfolioTab={
              visibleProfileTabs.some((tab) => tab.key === "portfolio")
                ? () => handleProfileTabChange("portfolio")
                : undefined
            }
            onOpenRiskTab={
              visibleProfileTabs.some((tab) => tab.key === "risk")
                ? () => handleProfileTabChange("risk")
                : undefined
            }
          />

          <Tabs value={activeTabKey} onValueChange={handleProfileTabChange} className="gap-6">
            <AdminTabList variant="primary">
              {visibleProfileTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <AdminTabTrigger key={tab.key} value={tab.key} className="gap-2">
                    <Icon className="size-4 shrink-0" />
                    {tab.label}
                  </AdminTabTrigger>
                );
              })}
            </AdminTabList>

            {(canReadMf && profileDetail?.investments) || showPortfolioWithoutInvestments ? (
              <TabsContent
                value="portfolio"
                keepMounted={keepMounted("portfolio")}
                className="mt-0 space-y-4"
              >
                {canReadMf && profileDetail?.investments ? (
                  <UserInvestmentsDetailSection investments={profileDetail.investments} />
                ) : null}
              </TabsContent>
            ) : null}

            {canReadFamilyGroups ? (
              <TabsContent
                value="family"
                keepMounted={keepMounted("family")}
                className="mt-0"
              >
                <UserFamilyGroupsDetailSection userId={summary.user_id} profilePath={profilePath} />
              </TabsContent>
            ) : null}

            {canReadUsers ? (
              <TabsContent
                value="goals"
                keepMounted={keepMounted("goals")}
                className="mt-0"
              >
                <UserGoalsDetailSection userRef={clientId} />
              </TabsContent>
            ) : null}

            {canReadKyc && profileDetail?.kyc ? (
              <TabsContent value="kyc" keepMounted={keepMounted("kyc")} className="mt-0">
                <UserKycDetailSection
                  kyc={profileDetail.kyc}
                  hasDownload={canDownloadDocs}
                />
              </TabsContent>
            ) : null}

            {canReadRiskProfile ? (
              <TabsContent value="risk" keepMounted={keepMounted("risk")} className="mt-0">
                <UserRiskDetailSection userId={summary.user_id} />
              </TabsContent>
            ) : null}

            {canReadAudit ? (
              <TabsContent value="activity" keepMounted={keepMounted("activity")} className="mt-0">
                <UserActivityTable userId={summary.user_id} />
              </TabsContent>
            ) : null}
          </Tabs>
        </>
      ) : null}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { getErrorMessage } from "@/lib/errors";
import {
  AlertTriangle,
  CalendarDays,
  Plus,
  Shield,
  ShieldCheck,
  ShieldOff,
  TrendingUp,
  UserCheck,
  UserRound,
  UserX,
  UsersRound,
  X,
} from "lucide-react";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminProfilePageSkeleton } from "@/components/ui/admin-skeletons";
import {
  InvestmentStatusBadge,
  kycOverallStatusVariant,
  MfaStatusBadge,
  PlatformRoleBadge,
  UserStatusBadge,
} from "@/components/users/user-status-badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserActivityTable } from "@/components/users/user-activity-table";
import {
  AdminSectionBreadcrumb,
  userManagementBreadcrumbSegments,
} from "@/components/dashboard/admin-section-breadcrumb";
import { UserInvestmentsDetailSection } from "@/components/users/user-investments-detail-section";
import { UserRiskDetailSection } from "@/components/users/user-risk-detail-section";
import { UserFamilyGroupsDetailSection } from "@/components/users/user-family-groups-detail-section";
import { UserKycDetailSection } from "@/components/users/user-kyc-detail-section";
import { userInitials } from "@/lib/admin-capabilities";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import {
  assignAdminUserRole,
  fetchAdminRoles,
  fetchAdminUserProfileDetail,
  fetchAdminUserRoles,
  fetchAdminUserSummary,
  revokeAdminUserRole,
  suspendAdminUser,
  unsuspendAdminUser,
  type AdminRole,
  type AdminUserProfileDetail,
  type AdminUserSummary,
} from "@/lib/admin-api";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { PROFILE_SECTION_TITLE_CLASS } from "@/components/users/user-profile-typography";

const SUSPEND_REASONS = [
  { value: "suspicious_activity", label: "Suspicious activity" },
  { value: "kyc_mismatch", label: "KYC mismatch" },
  { value: "user_requested", label: "User requested" },
  { value: "compliance_hold", label: "Compliance hold" },
  { value: "repeated_auth_failures", label: "Repeated auth failures" },
  { value: "chargeback_dispute", label: "Chargeback dispute" },
] as const;


type ProfileTab = "overview" | "kyc" | "investments" | "risk" | "activity";

function suspendReasonLabel(value: string) {
  return SUSPEND_REASONS.find((reason) => reason.value === value)?.label ?? value.replaceAll("_", " ");
}

function ProfilePanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[var(--radius-card)] border border-border bg-background",
        className,
      )}
    >
      {children}
    </div>
  );
}

function AccountActionsPanel({
  summary,
  suspendReason,
  suspendNotes,
  actionLoading,
  onSuspendReasonChange,
  onSuspendNotesChange,
  onSuspend,
  onUnsuspend,
}: {
  summary: AdminUserSummary;
  suspendReason: string;
  suspendNotes: string;
  actionLoading: string | null;
  onSuspendReasonChange: (value: string) => void;
  onSuspendNotesChange: (value: string) => void;
  onSuspend: () => void;
  onUnsuspend: () => void;
}) {
  const isSuspended = summary.status === "suspended";

  return (
    <ProfilePanel>
      {isSuspended ? (
        <div className="space-y-4 p-5">
          <AdminFeedbackMessage variant="warning" title="Account suspended" className="px-4 py-3">
            {summary.suspended_at ? (
              <>
                This user cannot sign in or transact until the account is reactivated. Suspended on{" "}
                {new Date(summary.suspended_at).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
                {summary.suspension_reason_code
                  ? ` · ${suspendReasonLabel(summary.suspension_reason_code)}`
                  : ""}
              </>
            ) : (
              "This user cannot sign in or transact until the account is reactivated."
            )}
          </AdminFeedbackMessage>
          <div className="flex justify-end border-t border-border pt-4">
            <Button disabled={actionLoading === "unsuspend"} onClick={onUnsuspend}>
              <UserCheck className="size-4" />
              {actionLoading === "unsuspend" ? "Submitting..." : "Reactivate account"}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-3 border-b border-border bg-destructive/5 px-5 py-4">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div>
              <p className="text-compact font-medium text-foreground">High-impact action</p>
              <p className="mt-1 text-caption text-muted-foreground">
                Suspending blocks sign-in, investments, and withdrawals. Changes may require
                compliance approval.
              </p>
            </div>
          </div>
          <div className="space-y-5 p-5">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="suspend-reason">Suspension reason</Label>
                <Select
                  value={suspendReason}
                  onValueChange={(value) =>
                    onSuspendReasonChange(value ?? "suspicious_activity")
                  }
                >
                  <SelectTrigger id="suspend-reason" className="w-full">
                    <SelectValue placeholder="Select a reason">
                      {suspendReasonLabel(suspendReason)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {SUSPEND_REASONS.map((reason) => (
                      <SelectItem key={reason.value} value={reason.value}>
                        {reason.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="suspend-notes">Internal notes</Label>
                <textarea
                  id="suspend-notes"
                  rows={4}
                  placeholder="Optional context for the compliance team"
                  value={suspendNotes}
                  onChange={(event) => onSuspendNotesChange(event.target.value)}
                  className="flex min-h-24 w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-compact text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </div>
            </div>
            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-caption text-muted-foreground">
                Selected reason:{" "}
                <span className="font-medium text-foreground">
                  {suspendReasonLabel(suspendReason)}
                </span>
              </p>
              <Button
                variant="destructive"
                disabled={actionLoading === "suspend"}
                onClick={onSuspend}
              >
                <UserX className="size-4" />
                {actionLoading === "suspend" ? "Submitting..." : "Suspend account"}
              </Button>
            </div>
          </div>
        </>
      )}
    </ProfilePanel>
  );
}

function TeamRolesPanel({
  summary,
  roles,
  assignedRoles,
  roleNameByKey,
  availableRoles,
  roleToAssign,
  actionLoading,
  onRoleToAssignChange,
  onAssignRole,
  onRevokeRole,
}: {
  summary: AdminUserSummary;
  roles: AdminRole[];
  assignedRoles: string[];
  roleNameByKey: Map<string, string>;
  availableRoles: AdminRole[];
  roleToAssign: string;
  actionLoading: string | null;
  onRoleToAssignChange: (value: string) => void;
  onAssignRole: () => void;
  onRevokeRole: (roleKey: string) => void;
}) {
  const isAdmin = summary.role === "admin";
  const assignedRoleDetails = assignedRoles
    .map((roleKey) => roles.find((role) => role.key === roleKey))
    .filter((role): role is AdminRole => Boolean(role));

  if (!isAdmin) {
    return (
      <ProfilePanel>
        <div className="flex flex-col items-center px-6 py-empty-state-sm text-center">
          <div className="rounded-full bg-muted/40 p-3 text-muted-foreground">
            <Shield className="size-6" />
          </div>
          <p className={cn("mt-3", PROFILE_SECTION_TITLE_CLASS)}>Admin accounts only</p>
          <p className="mt-1 max-w-md text-caption text-muted-foreground">
            Team roles control console access for admin users. This customer account does not use
            RBAC roles.
          </p>
        </div>
      </ProfilePanel>
    );
  }

  return (
    <ProfilePanel>
      <div className="border-b border-border px-5 py-4">
        <p className="text-caption text-muted-foreground">
          {assignedRoleDetails.length === 0
            ? "No team roles assigned yet."
            : `${assignedRoleDetails.length} role${assignedRoleDetails.length === 1 ? "" : "s"} assigned`}
        </p>
      </div>

      {assignedRoleDetails.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-empty-state-sm text-center">
          <div className="rounded-full bg-muted/40 p-3 text-muted-foreground">
            <Shield className="size-6" />
          </div>
          <p className={cn("mt-3", PROFILE_SECTION_TITLE_CLASS)}>No roles assigned</p>
          <p className="mt-1 max-w-md text-caption text-muted-foreground">
            Add a team role below to grant this admin access to console capabilities.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {assignedRoleDetails.map((role) => (
            <li
              key={role.key}
              className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-muted/15"
            >
              <div className="rounded-[var(--radius-control)] bg-primary/10 p-2 text-primary ring-1 ring-primary/15">
                <Shield className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-compact font-semibold text-foreground">
                    {roleNameByKey.get(role.key) ?? role.name}
                  </p>
                  {role.is_system ? (
                    <StatusBadge variant="neutral" showIcon={false}>
                      Built-in
                    </StatusBadge>
                  ) : null}
                  <StatusBadge variant="info" showIcon={false}>
                    {role.permissions.length} permission
                    {role.permissions.length === 1 ? "" : "s"}
                  </StatusBadge>
                </div>
                {role.description ? (
                  <p className="mt-1 text-caption text-muted-foreground">{role.description}</p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                disabled={actionLoading === `revoke-${role.key}`}
                onClick={() => onRevokeRole(role.key)}
              >
                <X className="size-4" />
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      {availableRoles.length > 0 ? (
        <div className="border-t border-dashed border-border bg-muted/10 px-5 py-4">
          <p className="mb-3 text-caption font-medium text-muted-foreground">Assign role</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select
              value={roleToAssign}
              onValueChange={(value) => onRoleToAssignChange(value ?? "")}
            >
              <SelectTrigger className="w-full sm:flex-1">
                <SelectValue placeholder="Choose a team role">
                  {roleToAssign
                    ? (roleNameByKey.get(roleToAssign) ??
                      availableRoles.find((role) => role.key === roleToAssign)?.name)
                    : "Choose a team role"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {availableRoles.map((role) => (
                  <SelectItem key={role.key} value={role.key}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              disabled={!roleToAssign || actionLoading?.startsWith("assign-")}
              onClick={onAssignRole}
            >
              <Plus className="size-4" />
              Add role
            </Button>
          </div>
        </div>
      ) : assignedRoleDetails.length > 0 ? (
        <div className="border-t border-border px-5 py-3">
          <p className="text-caption text-muted-foreground">All available roles are assigned.</p>
        </div>
      ) : null}
    </ProfilePanel>
  );
}

function ProfileSection({
  title,
  description,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[var(--radius-card)] border border-border bg-muted/20 p-5",
        className,
      )}
    >
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-[var(--radius-control)] bg-background p-2 text-primary ring-1 ring-border">
          <Icon className="size-4" />
        </div>
        <div>
          <h3 className={PROFILE_SECTION_TITLE_CLASS}>{title}</h3>
          {description ? (
            <p className="mt-0.5 text-caption text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

type OverviewMetricTone = "default" | "success" | "warning" | "muted" | "info";

function OverviewMetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: OverviewMetricTone;
}) {
  const cardTone =
    tone === "success"
      ? "border-success/20 bg-success/5"
      : tone === "warning"
        ? "border-warning/20 bg-warning/5"
        : tone === "info"
          ? "border-primary/20 bg-primary/5"
          : tone === "muted"
            ? "border-border bg-muted/15"
            : "border-border bg-background";

  const iconTone =
    tone === "success"
      ? "bg-success/10 text-success ring-success/20"
      : tone === "warning"
        ? "bg-warning/10 text-warning ring-warning/20"
        : tone === "info"
          ? "bg-primary/10 text-primary ring-primary/20"
          : "bg-muted/50 text-muted-foreground ring-border";

  return (
    <div
      className={cn(
        "flex h-full gap-3.5 rounded-[var(--radius-card)] border p-4 transition-colors",
        cardTone,
      )}
    >
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] ring-1",
          iconTone,
        )}
      >
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-caption font-medium text-muted-foreground">{label}</p>
        <div className="mt-1.5 text-compact font-semibold leading-snug text-foreground">{value}</div>
        {hint ? <p className="mt-1 text-caption text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}

export function UserProfileView({ clientId }: { clientId: string }) {
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
  const canReadAudit = hasPermission("audit.read");

  const [summary, setSummary] = useState<AdminUserSummary | null>(null);
  const [profileDetail, setProfileDetail] = useState<AdminUserProfileDetail | null>(null);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [assignedRoles, setAssignedRoles] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<ProfileTab>("overview");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [suspendReason, setSuspendReason] = useState<string>("suspicious_activity");
  const [suspendNotes, setSuspendNotes] = useState("");
  const [roleToAssign, setRoleToAssign] = useState("");

  const loadDetails = useCallback(async () => {
    if (!canReadUsers) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const [summaryResult, detailResult] = await Promise.all([
        fetchAdminUserSummary(clientId),
        fetchAdminUserProfileDetail(clientId),
      ]);
      setSummary(summaryResult);
      setProfileDetail(detailResult);

      const tasks: Promise<unknown>[] = [];
      if (canManageRbac) {
        tasks.push(fetchAdminRoles().then(setRoles));
        if (summaryResult.role === "admin") {
          tasks.push(
            fetchAdminUserRoles(clientId).then((result) => setAssignedRoles(result.roles)),
          );
        } else {
          setAssignedRoles([]);
        }
      }
      await Promise.all(tasks);
    } catch (err) {
      setSummary(null);
      setProfileDetail(null);
      setError(getErrorMessage(err, "Could not load user profile."));
    } finally {
      setLoading(false);
    }
  }, [canManageRbac, canReadUsers, clientId]);

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  const roleNameByKey = new Map(roles.map((role) => [role.key, role.name]));
  const availableRoles = roles.filter((role) => !assignedRoles.includes(role.key));

  const kycSummary = profileDetail?.kyc
    ? profileDetail.kyc.overall_status === "completed"
      ? "Complete"
      : profileDetail.kyc.incomplete_steps.length > 0
        ? `${profileDetail.kyc.incomplete_steps.length} step${profileDetail.kyc.incomplete_steps.length === 1 ? "" : "s"} pending`
        : profileDetail.kyc.overall_status.replaceAll("_", " ")
    : null;

  const kycMetricTone: OverviewMetricTone = profileDetail?.kyc
    ? profileDetail.kyc.overall_status === "completed"
      ? "success"
      : profileDetail.kyc.incomplete_steps.length > 0
        ? "warning"
        : "muted"
    : "muted";

  const visibleTabs: ProfileTab[] = ["overview"];
  if (canReadKyc && profileDetail?.kyc) visibleTabs.push("kyc");
  if (canReadMf && profileDetail?.investments) visibleTabs.push("investments");
  if (canReadRiskProfile) visibleTabs.push("risk");
  if (canReadAudit) visibleTabs.push("activity");

  useEffect(() => {
    if (!visibleTabs.includes(activeTab)) {
      setActiveTab(visibleTabs[0] ?? "overview");
    }
  }, [activeTab, visibleTabs]);

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
      setAssignedRoles(result.roles);
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
      setAssignedRoles(result.roles);
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
      <AdminSectionBreadcrumb
        segments={userManagementBreadcrumbSegments([
          {
            label: loading ? "Loading..." : (summary?.display_name ?? clientId),
          },
        ])}
      />

      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}
      {message ? <AdminFeedbackMessage variant="success">{message}</AdminFeedbackMessage> : null}

      {loading ? (
        <AdminProfilePageSkeleton />
      ) : summary ? (
        <>
          <div className="rounded-[var(--radius-card)] border border-border bg-muted/30 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <Avatar className="size-16">
                <AvatarFallback className="bg-primary/15 text-xl font-semibold text-primary">
                  {userInitials(summary.email)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <h1 className="font-heading text-h3 font-semibold text-foreground">
                  {summary.display_name}
                </h1>
                <p className="mt-1 text-compact text-muted-foreground">{summary.email}</p>
                <p className="mt-1 text-caption text-muted-foreground">Zynd ID: {summary.client_id}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <PlatformRoleBadge role={summary.role} />
                  <UserStatusBadge status={summary.status} />
                  <MfaStatusBadge enabled={summary.mfa_enrolled} />
                </div>
              </div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ProfileTab)} className="gap-6">
            <TabsList variant="line" className="w-fit justify-start border-b border-border">
              <TabsTrigger value="overview" className="px-4 py-2">
                Overview
              </TabsTrigger>
              {canReadKyc && profileDetail?.kyc ? (
                <TabsTrigger value="kyc" className="px-4 py-2">
                  KYC & identity
                </TabsTrigger>
              ) : null}
              {canReadMf && profileDetail?.investments ? (
                <TabsTrigger value="investments" className="px-4 py-2">
                  Investments
                </TabsTrigger>
              ) : null}
              {canReadRiskProfile ? (
                <TabsTrigger value="risk" className="px-4 py-2">
                  Risk profile
                </TabsTrigger>
              ) : null}
              {canReadAudit ? (
                <TabsTrigger value="activity" className="px-4 py-2">
                  Activity
                </TabsTrigger>
              ) : null}
            </TabsList>

            <TabsContent value="overview" className="mt-0 space-y-4">
              <ProfileSection
                title="Account snapshot"
                description="Key account signals at a glance."
                icon={UserRound}
              >
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <OverviewMetricCard
                    label="Member since"
                    icon={CalendarDays}
                    tone="info"
                    value={new Date(summary.created_at).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                    hint="Joined Zynd"
                  />
                  <OverviewMetricCard
                    label="Investment"
                    icon={TrendingUp}
                    tone={summary.has_invested ? "success" : "muted"}
                    value={<InvestmentStatusBadge hasInvested={summary.has_invested} />}
                    hint={summary.has_invested ? "Has mutual fund activity" : "No purchases yet"}
                  />
                  {kycSummary && profileDetail?.kyc ? (
                    <OverviewMetricCard
                      label="KYC status"
                      icon={ShieldCheck}
                      tone={kycMetricTone}
                      value={
                        <StatusBadge
                          variant={
                            profileDetail.kyc.overall_status === "completed"
                              ? "success"
                              : profileDetail.kyc.incomplete_steps.length > 0
                                ? "warning"
                                : kycOverallStatusVariant(profileDetail.kyc.overall_status)
                          }
                          showIcon={profileDetail.kyc.overall_status === "completed"}
                        >
                          {kycSummary}
                        </StatusBadge>
                      }
                      hint={
                        profileDetail.kyc.incomplete_steps.length > 0
                          ? "Open KYC & identity for details"
                          : undefined
                      }
                    />
                  ) : null}
                  <OverviewMetricCard
                    label="Multi-factor auth"
                    icon={summary.mfa_enrolled ? ShieldCheck : ShieldOff}
                    tone={summary.mfa_enrolled ? "success" : "warning"}
                    value={
                      summary.mfa_enrolled ? (
                        <StatusBadge variant="success">Enabled</StatusBadge>
                      ) : (
                        <StatusBadge variant="warning" showIcon={false}>
                          Not enabled
                        </StatusBadge>
                      )
                    }
                    hint={summary.mfa_enrolled ? "Extra sign-in protection on" : "Recommend enabling MFA"}
                  />
                  {summary.suspended_at ? (
                    <OverviewMetricCard
                      label="Suspended on"
                      icon={UserX}
                      tone="warning"
                      value={new Date(summary.suspended_at).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      hint={
                        summary.suspension_reason_code
                          ? summary.suspension_reason_code.replaceAll("_", " ")
                          : "Account suspended"
                      }
                    />
                  ) : null}
                </div>
              </ProfileSection>

              {canReadFamilyGroups ? (
                <ProfileSection
                  title="Family groups"
                  description="Groups this user created and memberships they belong to."
                  icon={UsersRound}
                >
                  <UserFamilyGroupsDetailSection userId={summary.user_id} />
                </ProfileSection>
              ) : null}

              {canSuspend ? (
                <ProfileSection
                  title="Account actions"
                  description="Suspend or reactivate this account."
                  icon={UserX}
                  className={summary.status === "suspended" ? undefined : "border-warning/20"}
                >
                  <AccountActionsPanel
                    summary={summary}
                    suspendReason={suspendReason}
                    suspendNotes={suspendNotes}
                    actionLoading={actionLoading}
                    onSuspendReasonChange={setSuspendReason}
                    onSuspendNotesChange={setSuspendNotes}
                    onSuspend={() => void handleSuspend()}
                    onUnsuspend={() => void handleUnsuspend()}
                  />
                </ProfileSection>
              ) : null}

              {canManageRbac ? (
                <ProfileSection
                  title="Team roles"
                  description={
                    summary.role === "admin"
                      ? "Control what this admin can access in the console."
                      : "Console access roles for admin accounts."
                  }
                  icon={Shield}
                >
                  <TeamRolesPanel
                    summary={summary}
                    roles={roles}
                    assignedRoles={assignedRoles}
                    roleNameByKey={roleNameByKey}
                    availableRoles={availableRoles}
                    roleToAssign={roleToAssign}
                    actionLoading={actionLoading}
                    onRoleToAssignChange={setRoleToAssign}
                    onAssignRole={() => void handleAssignRole()}
                    onRevokeRole={(roleKey) => void handleRevokeRole(roleKey)}
                  />
                </ProfileSection>
              ) : null}
            </TabsContent>

            {canReadKyc && profileDetail?.kyc ? (
              <TabsContent value="kyc" className="mt-0">
                <UserKycDetailSection
                  kyc={profileDetail.kyc}
                  userId={clientId}
                  hasDownload={canDownloadDocs}
                  hasVerify={canVerifyDocs}
                  onChanged={() => void loadDetails()}
                />
              </TabsContent>
            ) : null}

            {canReadMf && profileDetail?.investments ? (
              <TabsContent value="investments" className="mt-0">
                <UserInvestmentsDetailSection investments={profileDetail.investments} />
              </TabsContent>
            ) : null}

            {canReadRiskProfile ? (
              <TabsContent value="risk" className="mt-0">
                <UserRiskDetailSection userId={summary.user_id} />
              </TabsContent>
            ) : null}

            {canReadAudit ? (
              <TabsContent value="activity" className="mt-0">
                <UserActivityTable userId={summary.user_id} />
              </TabsContent>
            ) : null}
          </Tabs>
        </>
      ) : null}
    </div>
  );
}

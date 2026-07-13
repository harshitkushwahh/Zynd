"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, KeyRound, Shield, Trash2, TrendingUp, UserX } from "lucide-react";

import { AdminShell } from "@/components/admin-shell";
import { AdminKycReviewPanel } from "@/components/admin-kyc-review-panel";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import {
  approveAdminAction,
  fetchAdminActions,
  fetchAdminUserSummary,
  fetchPendingDeletions,
  fetchRetentionSchedule,
  fetchSecurityReviews,
  rejectAdminAction,
  resolveSecurityReview,
  runDeletionExecutor,
  suspendAdminUser,
  unsuspendAdminUser,
  type AdminActionItem,
  type AdminUserSummary,
  type PendingDeletionItem,
  type SecurityReviewItem,
} from "@/lib/admin-api";
import { ApiError } from "@/lib/api-client";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, displayName, permissions, signOut, hasPermission } = useAdminAuth();
  const [reviews, setReviews] = useState<SecurityReviewItem[]>([]);
  const [deletions, setDeletions] = useState<PendingDeletionItem[]>([]);
  const [retentionCount, setRetentionCount] = useState(0);
  const [loadingData, setLoadingData] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [lookupUserId, setLookupUserId] = useState("");
  const [userSummary, setUserSummary] = useState<AdminUserSummary | null>(null);
  const [pendingActions, setPendingActions] = useState<AdminActionItem[]>([]);
  const [suspendReason, setSuspendReason] = useState("suspicious_activity");
  const [suspendNotes, setSuspendNotes] = useState("");

  const loadConsoleData = useCallback(async () => {
    setLoadingData(true);
    setError("");
    try {
      const tasks: Promise<unknown>[] = [];
      if (hasPermission("security_reviews.read")) {
        tasks.push(fetchSecurityReviews("open").then(setReviews));
      } else {
        setReviews([]);
      }
      if (hasPermission("deletion.execute")) {
        tasks.push(fetchPendingDeletions().then(setDeletions));
      } else {
        setDeletions([]);
      }
      if (hasPermission("retention.read")) {
        tasks.push(fetchRetentionSchedule().then((items) => setRetentionCount(items.length)));
      } else {
        setRetentionCount(0);
      }
      if (hasPermission("admin_actions.approve")) {
        tasks.push(fetchAdminActions("pending").then(setPendingActions));
      } else {
        setPendingActions([]);
      }
      await Promise.all(tasks);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load admin console data."));
    } finally {
      setLoadingData(false);
    }
  }, [hasPermission]);

  useEffect(() => {
    void loadConsoleData();
  }, [loadConsoleData]);

  const handleResolveReview = async (itemId: string, status: "reviewed" | "dismissed") => {
    if (!hasPermission("security_reviews.resolve")) return;
    setActionLoading(`review-${itemId}`);
    setMessage("");
    try {
      await resolveSecurityReview(itemId, { status });
      setMessage("Security review updated.");
      await loadConsoleData();
    } catch (err) {
      setError(getErrorMessage(err, "Could not resolve review."));
    } finally {
      setActionLoading(null);
    }
  };

  const handleRunDeletionExecutor = async () => {
    if (!hasPermission("deletion.execute")) return;
    setActionLoading("deletion-executor");
    setMessage("");
    try {
      const result = await runDeletionExecutor();
      setMessage(result.message);
      await loadConsoleData();
    } catch (err) {
      setError(getErrorMessage(err, "Could not run deletion executor."));
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveAction = async (actionId: string) => {
    if (!hasPermission("admin_actions.approve")) return;
    setActionLoading(`approve-${actionId}`);
    setMessage("");
    try {
      await approveAdminAction(actionId);
      setMessage("Admin action approved.");
      await loadConsoleData();
    } catch (err) {
      setError(getErrorMessage(err, "Could not approve action."));
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectAction = async (actionId: string) => {
    if (!hasPermission("admin_actions.approve")) return;
    setActionLoading(`reject-${actionId}`);
    setMessage("");
    try {
      await rejectAdminAction(actionId);
      setMessage("Admin action rejected.");
      await loadConsoleData();
    } catch (err) {
      setError(getErrorMessage(err, "Could not reject action."));
    } finally {
      setActionLoading(null);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const handleLookupUser = async () => {
    if (!hasPermission("users.suspend") || !lookupUserId.trim()) return;
    setActionLoading("user-lookup");
    setMessage("");
    setError("");
    try {
      const summary = await fetchAdminUserSummary(lookupUserId.trim());
      setUserSummary(summary);
      setMessage("User loaded.");
    } catch (err) {
      setUserSummary(null);
      setError(getErrorMessage(err, "Could not load user."));
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuspendUser = async () => {
    if (!hasPermission("users.suspend") || !userSummary) return;
    setActionLoading("user-suspend");
    setMessage("");
    try {
      const result = await suspendAdminUser(userSummary.user_id, {
        reason_code: suspendReason as
          | "suspicious_activity"
          | "kyc_mismatch"
          | "user_requested"
          | "compliance_hold"
          | "repeated_auth_failures"
          | "chargeback_dispute",
        notes: suspendNotes || undefined,
      });
      setMessage(result.message);
      await loadConsoleData();
    } catch (err) {
      setError(getErrorMessage(err, "Could not suspend user."));
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnsuspendUser = async () => {
    if (!hasPermission("users.suspend") || !userSummary) return;
    setActionLoading("user-unsuspend");
    setMessage("");
    try {
      const result = await unsuspendAdminUser(userSummary.user_id);
      setMessage(result.message);
      await loadConsoleData();
    } catch (err) {
      setError(getErrorMessage(err, "Could not unsuspend user."));
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <AdminShell>
      <div className="flex min-h-full flex-1 flex-col">
        <header className="border-b border-border bg-card shadow-zynd-low">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
            <div className="flex items-center gap-3">
              <span className="font-heading text-h4 font-bold tracking-tight text-foreground">
                ZYND
              </span>
              <span className="rounded-[var(--radius-control)] border border-primary/20 bg-primary/10 px-2 py-0.5 text-caption font-medium text-primary">
                Admin
              </span>
            </div>
            <Button variant="outline" onClick={() => void handleSignOut()}>
              Sign out
            </Button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
          {hasPermission("mf.catalog.read") ||
          hasPermission("mf.jobs.read") ||
          hasPermission("mf.amcs.read") ? (
            <div className="mb-8">
              <Link
                href="/dashboard/mutual-funds"
                className="inline-flex items-center gap-2 rounded-[var(--radius-card)] border border-primary/20 bg-primary/5 px-4 py-3 text-compact font-medium text-primary hover:bg-primary/10"
              >
                <TrendingUp className="size-4" />
                Open mutual fund catalog console
              </Link>
            </div>
          ) : null}
          <div className="mb-8">
            <p className="text-compact font-medium text-primary">Platform Console</p>
            <h1 className="mt-1 font-heading text-h2 font-bold text-foreground">
              Welcome, {displayName}
            </h1>
            <p className="mt-2 text-compact text-muted-foreground">
              Signed in as {user?.email} · {permissions.length} permission
              {permissions.length === 1 ? "" : "s"}
            </p>
          </div>

          {error ? (
            <div className="mb-6 rounded-[var(--radius-card)] border border-destructive/30 bg-destructive/5 px-4 py-3 text-compact text-destructive">
              {error}
            </div>
          ) : null}
          {message ? (
            <div className="mb-6 rounded-[var(--radius-card)] border border-success/30 bg-success/5 px-4 py-3 text-compact text-foreground">
              {message}
            </div>
          ) : null}

          <div className="mb-8 grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="size-4 text-primary" />
                  Open reviews
                </CardTitle>
                <CardDescription>Flagged logins and device anomalies</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-h3 font-bold text-foreground">{reviews.length}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trash2 className="size-4 text-primary" />
                  Pending deletions
                </CardTitle>
                <CardDescription>Accounts in deletion grace period</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-h3 font-bold text-foreground">{deletions.length}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <KeyRound className="size-4 text-primary" />
                  Retention policies
                </CardTitle>
                <CardDescription>Regulatory data classes</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-h3 font-bold text-foreground">{retentionCount}</p>
              </CardContent>
            </Card>
          </div>

          <div className="mb-8">
            <h2 className="font-heading text-h4 font-semibold text-foreground">Permissions</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {permissions.length ? (
                permissions.map((permission) => (
                  <span
                    key={permission}
                    className="rounded-[var(--radius-control)] bg-muted px-2.5 py-1 text-caption text-foreground"
                  >
                    {permission}
                  </span>
                ))
              ) : (
                <span className="text-compact text-muted-foreground">No permissions assigned.</span>
              )}
            </div>
          </div>

          {hasPermission("security_reviews.read") ? (
            <section className="mb-10">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-heading text-h4 font-semibold text-foreground">
                    Security review queue
                  </h2>
                  <p className="text-compact text-muted-foreground">
                    Investigate flagged login activity.
                  </p>
                </div>
                <Button variant="outline" disabled={loadingData} onClick={() => void loadConsoleData()}>
                  Refresh
                </Button>
              </div>

              <div className="space-y-3">
                {loadingData ? (
                  <p className="text-compact text-muted-foreground">Loading reviews...</p>
                ) : reviews.length === 0 ? (
                  <Card>
                    <CardContent className="py-6 text-compact text-muted-foreground">
                      No open security reviews.
                    </CardContent>
                  </Card>
                ) : (
                  reviews.map((item) => (
                    <Card key={item.id}>
                      <CardContent className="flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-medium text-foreground">{item.user_email}</p>
                          <p className="text-caption text-muted-foreground">
                            {item.reason} · {new Date(item.created_at).toLocaleString()}
                          </p>
                        </div>
                        {hasPermission("security_reviews.resolve") ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              disabled={actionLoading === `review-${item.id}`}
                              onClick={() => void handleResolveReview(item.id, "reviewed")}
                            >
                              Mark reviewed
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={actionLoading === `review-${item.id}`}
                              onClick={() => void handleResolveReview(item.id, "dismissed")}
                            >
                              Dismiss
                            </Button>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </section>
          ) : null}

          {hasPermission("deletion.execute") ? (
            <section>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-heading text-h4 font-semibold text-foreground">
                    Account deletions
                  </h2>
                  <p className="text-compact text-muted-foreground">
                    Pending deletion requests and executor controls.
                  </p>
                </div>
                <Button
                  disabled={actionLoading === "deletion-executor"}
                  onClick={() => void handleRunDeletionExecutor()}
                >
                  {actionLoading === "deletion-executor" ? "Running..." : "Run deletion executor"}
                </Button>
              </div>

              <div className="space-y-3">
                {loadingData ? (
                  <p className="text-compact text-muted-foreground">Loading deletions...</p>
                ) : deletions.length === 0 ? (
                  <Card>
                    <CardContent className="py-6 text-compact text-muted-foreground">
                      No accounts are pending deletion.
                    </CardContent>
                  </Card>
                ) : (
                  deletions.map((item) => (
                    <Card key={item.user_id}>
                      <CardContent className="flex items-center justify-between gap-4 py-5">
                        <div>
                          <p className="font-medium text-foreground">{item.email}</p>
                          <p className="text-caption text-muted-foreground">
                            Scheduled:{" "}
                            {item.deletion_scheduled_at
                              ? new Date(item.deletion_scheduled_at).toLocaleString()
                              : "unknown"}
                          </p>
                        </div>
                        {item.is_due ? (
                          <span className="inline-flex items-center gap-1 rounded-[var(--radius-control)] border border-warning/30 bg-warning/10 px-2 py-1 text-caption text-warning">
                            <AlertTriangle className="size-3.5" />
                            Due
                          </span>
                        ) : (
                          <span className="text-caption text-muted-foreground">Grace period</span>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </section>
          ) : null}

          {hasPermission("admin_actions.approve") ? (
            <section className="mb-10">
              <div className="mb-4">
                <h2 className="font-heading text-h4 font-semibold text-foreground">
                  Pending admin actions
                </h2>
                <p className="text-compact text-muted-foreground">
                  Maker-checker approvals for high-impact operations.
                </p>
              </div>
              <div className="space-y-3">
                {loadingData ? (
                  <p className="text-compact text-muted-foreground">Loading actions...</p>
                ) : pendingActions.length === 0 ? (
                  <Card>
                    <CardContent className="py-6 text-compact text-muted-foreground">
                      No pending admin actions.
                    </CardContent>
                  </Card>
                ) : (
                  pendingActions.map((item) => (
                    <Card key={item.id}>
                      <CardContent className="flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-medium text-foreground">
                            {item.action_type.replaceAll("_", " ")}
                          </p>
                          <p className="text-caption text-muted-foreground">
                            {item.target_email ?? "Platform action"} · requested by{" "}
                            {item.requested_by_email ?? "unknown"} ·{" "}
                            {new Date(item.created_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            disabled={actionLoading === `approve-${item.id}`}
                            onClick={() => void handleApproveAction(item.id)}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={actionLoading === `reject-${item.id}`}
                            onClick={() => void handleRejectAction(item.id)}
                          >
                            Reject
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </section>
          ) : null}

          {hasPermission("documents.read") ? (
            <section className="mb-10">
              <AdminKycReviewPanel
                hasDownload={hasPermission("documents.download")}
                hasVerify={hasPermission("documents.verify")}
              />
            </section>
          ) : null}

          {hasPermission("users.suspend") ? (
            <section className="mt-10">
              <div className="mb-4">
                <h2 className="font-heading text-h4 font-semibold text-foreground">
                  Account suspension
                </h2>
                <p className="text-compact text-muted-foreground">
                  Look up a user by ID to suspend or reactivate their account.
                </p>
              </div>

              <Card>
                <CardContent className="space-y-4 py-5">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Input
                      placeholder="User UUID"
                      value={lookupUserId}
                      onChange={(event) => setLookupUserId(event.target.value)}
                    />
                    <Button
                      variant="outline"
                      disabled={actionLoading === "user-lookup" || !lookupUserId.trim()}
                      onClick={() => void handleLookupUser()}
                    >
                      {actionLoading === "user-lookup" ? "Loading..." : "Look up"}
                    </Button>
                  </div>

                  {userSummary ? (
                    <div className="space-y-4 border-t border-border pt-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">{userSummary.email}</p>
                        <span className="rounded-[var(--radius-control)] bg-muted px-2 py-0.5 text-caption text-foreground">
                          {userSummary.status}
                        </span>
                        {userSummary.mfa_enrolled ? (
                          <span className="rounded-[var(--radius-control)] border border-success/30 bg-success/10 px-2 py-0.5 text-caption text-success">
                            MFA enrolled
                          </span>
                        ) : null}
                      </div>
                      <p className="text-caption text-muted-foreground">
                        Role: {userSummary.role} · Created{" "}
                        {new Date(userSummary.created_at).toLocaleString()}
                      </p>
                      {userSummary.suspended_at ? (
                        <p className="text-caption text-muted-foreground">
                          Suspended {new Date(userSummary.suspended_at).toLocaleString()}
                          {userSummary.suspension_reason_code
                            ? ` · ${userSummary.suspension_reason_code}`
                            : ""}
                        </p>
                      ) : null}

                      {userSummary.status !== "suspended" ? (
                        <div className="space-y-3">
                          <select
                            className="h-8 w-full rounded-[var(--radius-control)] border border-input bg-transparent px-2.5 text-compact"
                            value={suspendReason}
                            onChange={(event) => setSuspendReason(event.target.value)}
                          >
                            <option value="suspicious_activity">Suspicious activity</option>
                            <option value="kyc_mismatch">KYC mismatch</option>
                            <option value="user_requested">User requested</option>
                            <option value="compliance_hold">Compliance hold</option>
                            <option value="repeated_auth_failures">Repeated auth failures</option>
                            <option value="chargeback_dispute">Chargeback dispute</option>
                          </select>
                          <Input
                            placeholder="Internal notes (optional)"
                            value={suspendNotes}
                            onChange={(event) => setSuspendNotes(event.target.value)}
                          />
                          <Button
                            variant="destructive"
                            disabled={actionLoading === "user-suspend"}
                            onClick={() => void handleSuspendUser()}
                          >
                            <UserX className="size-3.5" />
                            {actionLoading === "user-suspend" ? "Suspending..." : "Suspend account"}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          disabled={actionLoading === "user-unsuspend"}
                          onClick={() => void handleUnsuspendUser()}
                        >
                          {actionLoading === "user-unsuspend" ? "Reactivating..." : "Reactivate account"}
                        </Button>
                      )}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </section>
          ) : null}
        </main>
      </div>
    </AdminShell>
  );
}

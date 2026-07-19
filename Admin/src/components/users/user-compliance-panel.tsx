"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getErrorMessage } from "@/lib/errors";
import {
  AlertTriangle,
  ClipboardList,
  ExternalLink,
  RefreshCw,
  Shield,
  Trash2,
  type LucideIcon,
} from "lucide-react";

import { AdminTableSkeletonRows } from "@/components/ui/admin-skeletons";

import { AdminSectionTitle } from "@/components/dashboard/admin-section-title";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminSearchInput } from "@/components/ui/admin-search-input";
import {
  ADMIN_TABLE_PAGE_SIZE,
  AdminDataTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHeadCell,
  AdminTableHeader,
  AdminTablePagination,
  AdminTableRow,
  AdminTableStateRow,
  paginateItems,
} from "@/components/ui/admin-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  approveAdminAction,
  fetchAdminActions,
  fetchPendingDeletions,
  fetchSecurityReviews,
  rejectAdminAction,
  resolveSecurityReview,
  runDeletionExecutor,
  type AdminActionItem,
  type PendingDeletionItem,
  type SecurityReviewItem,
} from "@/lib/admin-api";
import { clientIdToProfilePath } from "@/lib/admin-user-ref";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";


function formatLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function userProfileHref(userRef: string) {
  return `/dashboard/users/${encodeURIComponent(clientIdToProfilePath(userRef))}`;
}

function matchesSearchQuery(query: string, ...values: Array<string | null | undefined>) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return values.some((value) => (value ?? "").toLowerCase().includes(normalized));
}

type ComplianceTab = "reviews" | "deletions" | "actions";

type UserCompliancePanelProps = {
  canReadReviews: boolean;
  canResolveReviews: boolean;
  canExecuteDeletions: boolean;
  canApproveActions: boolean;
};

function TabCount({ count, active }: { count: number; active?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-micro font-semibold tabular-nums",
        count > 0
          ? active
            ? "bg-primary text-primary-foreground"
            : "bg-warning/15 text-warning"
          : "bg-muted text-muted-foreground",
      )}
    >
      {count}
    </span>
  );
}

function ComplianceEmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-empty-state-lg text-center">
      <div className="rounded-full bg-muted/40 p-3 text-muted-foreground">
        <Icon className="size-6" strokeWidth={2} />
      </div>
      <p className="mt-4 font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-sm text-caption leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

export function UserCompliancePanel({
  canReadReviews,
  canResolveReviews,
  canExecuteDeletions,
  canApproveActions,
}: UserCompliancePanelProps) {
  const [reviews, setReviews] = useState<SecurityReviewItem[]>([]);
  const [deletions, setDeletions] = useState<PendingDeletionItem[]>([]);
  const [pendingActions, setPendingActions] = useState<AdminActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<ComplianceTab>("reviews");
  const [reviewQuery, setReviewQuery] = useState("");
  const [deletionQuery, setDeletionQuery] = useState("");
  const [actionQuery, setActionQuery] = useState("");
  const [reviewPage, setReviewPage] = useState(0);
  const [deletionPage, setDeletionPage] = useState(0);
  const [actionPage, setActionPage] = useState(0);

  const visibleTabs = useMemo(() => {
    const tabs: Array<{ key: ComplianceTab; label: string; icon: LucideIcon; count: number }> = [];
    if (canReadReviews) {
      tabs.push({ key: "reviews", label: "Security reviews", icon: Shield, count: reviews.length });
    }
    if (canExecuteDeletions) {
      tabs.push({ key: "deletions", label: "Account deletions", icon: Trash2, count: deletions.length });
    }
    if (canApproveActions) {
      tabs.push({
        key: "actions",
        label: "Admin actions",
        icon: ClipboardList,
        count: pendingActions.length,
      });
    }
    return tabs;
  }, [
    canApproveActions,
    canExecuteDeletions,
    canReadReviews,
    deletions.length,
    pendingActions.length,
    reviews.length,
  ]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const tasks: Promise<unknown>[] = [];
      if (canReadReviews) {
        tasks.push(fetchSecurityReviews("open").then(setReviews));
      } else {
        setReviews([]);
      }
      if (canExecuteDeletions) {
        tasks.push(fetchPendingDeletions().then(setDeletions));
      } else {
        setDeletions([]);
      }
      if (canApproveActions) {
        tasks.push(fetchAdminActions("pending").then(setPendingActions));
      } else {
        setPendingActions([]);
      }
      await Promise.all(tasks);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load compliance data."));
    } finally {
      setLoading(false);
    }
  }, [canApproveActions, canExecuteDeletions, canReadReviews]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.key === activeTab)) {
      setActiveTab(visibleTabs[0]?.key ?? "reviews");
    }
  }, [activeTab, visibleTabs]);

  useEffect(() => {
    setReviewPage(0);
  }, [reviews.length, reviewQuery]);

  useEffect(() => {
    setDeletionPage(0);
  }, [deletions.length, deletionQuery]);

  useEffect(() => {
    setActionPage(0);
  }, [pendingActions.length, actionQuery]);

  const filteredReviews = useMemo(
    () =>
      reviews.filter((item) =>
        matchesSearchQuery(
          reviewQuery,
          item.user_email,
          item.reason,
          item.status,
          item.user_id,
        ),
      ),
    [reviewQuery, reviews],
  );

  const filteredDeletions = useMemo(
    () =>
      deletions.filter((item) =>
        matchesSearchQuery(deletionQuery, item.email, item.user_id),
      ),
    [deletionQuery, deletions],
  );

  const filteredActions = useMemo(
    () =>
      pendingActions.filter((item) =>
        matchesSearchQuery(
          actionQuery,
          item.action_type,
          item.target_email,
          item.target_id,
          item.target_type,
          item.requested_by_email,
          item.reason,
        ),
      ),
    [actionQuery, pendingActions],
  );

  const reviewPagination = useMemo(
    () => paginateItems(filteredReviews, reviewPage, ADMIN_TABLE_PAGE_SIZE),
    [filteredReviews, reviewPage],
  );
  const deletionPagination = useMemo(
    () => paginateItems(filteredDeletions, deletionPage, ADMIN_TABLE_PAGE_SIZE),
    [deletionPage, filteredDeletions],
  );
  const actionPagination = useMemo(
    () => paginateItems(filteredActions, actionPage, ADMIN_TABLE_PAGE_SIZE),
    [actionPage, filteredActions],
  );

  const handleResolveReview = async (itemId: string, status: "reviewed" | "dismissed") => {
    if (!canResolveReviews) return;
    setActionLoading(`review-${itemId}`);
    setMessage("");
    try {
      await resolveSecurityReview(itemId, { status });
      setMessage("Security review updated.");
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, "Could not resolve review."));
    } finally {
      setActionLoading(null);
    }
  };

  const handleRunDeletionExecutor = async () => {
    if (!canExecuteDeletions) return;
    setActionLoading("deletion-executor");
    setMessage("");
    try {
      const result = await runDeletionExecutor();
      setMessage(result.message);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, "Could not run deletion executor."));
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveAction = async (actionId: string) => {
    if (!canApproveActions) return;
    setActionLoading(`approve-${actionId}`);
    setMessage("");
    try {
      await approveAdminAction(actionId);
      setMessage("Admin action approved.");
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, "Could not approve action."));
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectAction = async (actionId: string) => {
    if (!canApproveActions) return;
    setActionLoading(`reject-${actionId}`);
    setMessage("");
    try {
      await rejectAdminAction(actionId);
      setMessage("Admin action rejected.");
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, "Could not reject action."));
    } finally {
      setActionLoading(null);
    }
  };

  if (visibleTabs.length === 0) {
    return (
      <AdminFeedbackMessage variant="warning">
        You do not have compliance queue permissions.
      </AdminFeedbackMessage>
    );
  }

  return (
    <div className="space-y-4">
      {error ? <AdminFeedbackMessage variant="destructive">{error}</AdminFeedbackMessage> : null}
      {message ? <AdminFeedbackMessage variant="success">{message}</AdminFeedbackMessage> : null}

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as ComplianceTab)}
        className="gap-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList variant="line" className="h-auto w-fit justify-start border-b border-border">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.key}
                  value={tab.key}
                  className="gap-2 px-4 py-2.5"
                >
                  <Icon className="size-4 shrink-0" />
                  {tab.label}
                  <TabCount count={tab.count} active={activeTab === tab.key} />
                </TabsTrigger>
              );
            })}
          </TabsList>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => void loadData()}
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>

        {canReadReviews ? (
          <TabsContent value="reviews" className="mt-0 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <AdminSectionTitle variant="section">
                Security review queue
              </AdminSectionTitle>
              <AdminSearchInput
                containerClassName="max-w-sm sm:w-56"
                placeholder="Search reviews"
                value={reviewQuery}
                onChange={(event) => setReviewQuery(event.target.value)}
              />
            </div>

            <AdminDataTable minWidth="lg">
              <AdminTableHeader>
                <tr>
                  <AdminTableHeadCell>User</AdminTableHeadCell>
                  <AdminTableHeadCell>Reason</AdminTableHeadCell>
                  <AdminTableHeadCell>Flagged</AdminTableHeadCell>
                  <AdminTableHeadCell>Status</AdminTableHeadCell>
                  {canResolveReviews ? (
                    <AdminTableHeadCell className="text-right">Actions</AdminTableHeadCell>
                  ) : null}
                </tr>
              </AdminTableHeader>
              <AdminTableBody>
                {loading ? (
                  <AdminTableSkeletonRows columns={canResolveReviews ? 5 : 4} />
                ) : reviews.length === 0 ? (
                  <AdminTableStateRow colSpan={canResolveReviews ? 5 : 4}>
                    <ComplianceEmptyState
                      icon={Shield}
                      title="No open security reviews"
                      description="Flagged logins and device anomalies will appear here when they need investigation."
                    />
                  </AdminTableStateRow>
                ) : filteredReviews.length === 0 ? (
                  <AdminTableStateRow colSpan={canResolveReviews ? 5 : 4}>
                    No security reviews match your search.
                  </AdminTableStateRow>
                ) : (
                  reviewPagination.items.map((item) => (
                    <AdminTableRow key={item.id}>
                      <AdminTableCell>
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{item.user_email}</p>
                          <Link
                            href={userProfileHref(item.user_id)}
                            className="inline-flex items-center gap-1 text-caption text-primary hover:underline"
                          >
                            View profile
                            <ExternalLink className="size-3" />
                          </Link>
                        </div>
                      </AdminTableCell>
                      <AdminTableCell className="text-muted-foreground">
                        {formatLabel(item.reason)}
                      </AdminTableCell>
                      <AdminTableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDateTime(item.created_at)}
                      </AdminTableCell>
                      <AdminTableCell>
                        <StatusBadge variant="warning">{formatLabel(item.status)}</StatusBadge>
                      </AdminTableCell>
                      {canResolveReviews ? (
                        <AdminTableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              disabled={actionLoading === `review-${item.id}`}
                              onClick={() => void handleResolveReview(item.id, "reviewed")}
                            >
                              Reviewed
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
                        </AdminTableCell>
                      ) : null}
                    </AdminTableRow>
                  ))
                )}
              </AdminTableBody>
            </AdminDataTable>

            {!loading && filteredReviews.length > 0 ? (
              <AdminTablePagination
                page={reviewPagination.page}
                totalPages={reviewPagination.totalPages}
                hasPrevious={reviewPagination.hasPrevious}
                hasNext={reviewPagination.hasNext}
                onPrevious={() => setReviewPage((page) => Math.max(0, page - 1))}
                onNext={() => setReviewPage((page) => page + 1)}
              />
            ) : null}
          </TabsContent>
        ) : null}

        {canExecuteDeletions ? (
          <TabsContent value="deletions" className="mt-0 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <AdminSectionTitle variant="section">
                Account deletions
              </AdminSectionTitle>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  size="sm"
                  disabled={actionLoading === "deletion-executor"}
                  onClick={() => void handleRunDeletionExecutor()}
                >
                  {actionLoading === "deletion-executor" ? "Running..." : "Run deletion executor"}
                </Button>
                <AdminSearchInput
                  containerClassName="max-w-sm sm:w-56"
                  placeholder="Search deletions"
                  value={deletionQuery}
                  onChange={(event) => setDeletionQuery(event.target.value)}
                />
              </div>
            </div>

            <AdminDataTable minWidth="md">
              <AdminTableHeader>
                <tr>
                  <AdminTableHeadCell>Account</AdminTableHeadCell>
                  <AdminTableHeadCell>Requested</AdminTableHeadCell>
                  <AdminTableHeadCell>Scheduled</AdminTableHeadCell>
                  <AdminTableHeadCell>Status</AdminTableHeadCell>
                </tr>
              </AdminTableHeader>
              <AdminTableBody>
                {loading ? (
                  <AdminTableSkeletonRows columns={4} />
                ) : deletions.length === 0 ? (
                  <AdminTableStateRow colSpan={4}>
                    <ComplianceEmptyState
                      icon={Trash2}
                      title="No accounts pending deletion"
                      description="Users in the deletion grace period will appear here before the executor runs."
                    />
                  </AdminTableStateRow>
                ) : filteredDeletions.length === 0 ? (
                  <AdminTableStateRow colSpan={4}>
                    No deletion requests match your search.
                  </AdminTableStateRow>
                ) : (
                  deletionPagination.items.map((item) => (
                    <AdminTableRow key={item.user_id}>
                      <AdminTableCell>
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{item.email}</p>
                          <Link
                            href={userProfileHref(item.user_id)}
                            className="inline-flex items-center gap-1 text-caption text-primary hover:underline"
                          >
                            View profile
                            <ExternalLink className="size-3" />
                          </Link>
                        </div>
                      </AdminTableCell>
                      <AdminTableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDateTime(item.deletion_requested_at)}
                      </AdminTableCell>
                      <AdminTableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDateTime(item.deletion_scheduled_at)}
                      </AdminTableCell>
                      <AdminTableCell>
                        {item.is_due ? (
                          <StatusBadge variant="warning" icon={AlertTriangle}>
                            Due now
                          </StatusBadge>
                        ) : (
                          <StatusBadge variant="neutral">Grace period</StatusBadge>
                        )}
                      </AdminTableCell>
                    </AdminTableRow>
                  ))
                )}
              </AdminTableBody>
            </AdminDataTable>

            {!loading && filteredDeletions.length > 0 ? (
              <AdminTablePagination
                page={deletionPagination.page}
                totalPages={deletionPagination.totalPages}
                hasPrevious={deletionPagination.hasPrevious}
                hasNext={deletionPagination.hasNext}
                onPrevious={() => setDeletionPage((page) => Math.max(0, page - 1))}
                onNext={() => setDeletionPage((page) => page + 1)}
              />
            ) : null}
          </TabsContent>
        ) : null}

        {canApproveActions ? (
          <TabsContent value="actions" className="mt-0 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <AdminSectionTitle variant="section">
                Pending admin actions
              </AdminSectionTitle>
              <AdminSearchInput
                containerClassName="max-w-sm sm:w-56"
                placeholder="Search actions"
                value={actionQuery}
                onChange={(event) => setActionQuery(event.target.value)}
              />
            </div>

            <AdminDataTable minWidth="xl">
              <AdminTableHeader>
                <tr>
                  <AdminTableHeadCell>Action</AdminTableHeadCell>
                  <AdminTableHeadCell>Target</AdminTableHeadCell>
                  <AdminTableHeadCell>Requested by</AdminTableHeadCell>
                  <AdminTableHeadCell>Requested</AdminTableHeadCell>
                  <AdminTableHeadCell className="text-right">Decision</AdminTableHeadCell>
                </tr>
              </AdminTableHeader>
              <AdminTableBody>
                {loading ? (
                  <AdminTableSkeletonRows columns={5} />
                ) : pendingActions.length === 0 ? (
                  <AdminTableStateRow colSpan={5}>
                    <ComplianceEmptyState
                      icon={ClipboardList}
                      title="No pending admin actions"
                      description="Maker-checker requests for high-impact operations will queue here for approval."
                    />
                  </AdminTableStateRow>
                ) : filteredActions.length === 0 ? (
                  <AdminTableStateRow colSpan={5}>
                    No admin actions match your search.
                  </AdminTableStateRow>
                ) : (
                  actionPagination.items.map((item) => (
                    <AdminTableRow key={item.id}>
                      <AdminTableCell>
                        <p className="font-medium text-foreground">
                          {formatLabel(item.action_type)}
                        </p>
                        {item.reason ? (
                          <p className="mt-1 text-caption text-muted-foreground">{item.reason}</p>
                        ) : null}
                      </AdminTableCell>
                      <AdminTableCell>
                        <p className="text-foreground">
                          {item.target_email ?? formatLabel(item.target_type ?? "Platform")}
                        </p>
                        {item.target_id ? (
                          <p className="mt-1 font-mono text-caption text-muted-foreground">
                            {item.target_id}
                          </p>
                        ) : null}
                      </AdminTableCell>
                      <AdminTableCell className="text-muted-foreground">
                        {item.requested_by_email ?? "Unknown"}
                      </AdminTableCell>
                      <AdminTableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDateTime(item.created_at)}
                      </AdminTableCell>
                      <AdminTableCell className="text-right">
                        <div className="flex justify-end gap-2">
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
                      </AdminTableCell>
                    </AdminTableRow>
                  ))
                )}
              </AdminTableBody>
            </AdminDataTable>

            {!loading && filteredActions.length > 0 ? (
              <AdminTablePagination
                page={actionPagination.page}
                totalPages={actionPagination.totalPages}
                hasPrevious={actionPagination.hasPrevious}
                hasNext={actionPagination.hasNext}
                onPrevious={() => setActionPage((page) => Math.max(0, page - 1))}
                onNext={() => setActionPage((page) => page + 1)}
              />
            ) : null}
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { getErrorMessage } from "@/lib/errors";
import {
  AlertTriangle,
  ClipboardList,
  ExternalLink,
  MoreHorizontal,
  RefreshCw,
  Shield,
  Trash2,
  type LucideIcon,
} from "lucide-react";

import { AdminTableSkeletonRows } from "@/components/ui/admin-skeletons";

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { AdminTabList, AdminTabTrigger } from "@/components/ui/admin-tab-bar";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import {
  approveAdminAction,
  rejectAdminAction,
  withdrawAdminAction,
  resolveSecurityReview,
  runDeletionExecutor,
} from "@/lib/admin-api";
import { pickUserRef, userDashboardProfileHref } from "@/lib/admin-user-ref";
import { cn } from "@/lib/utils";
import {
  adminComplianceQueryKey,
  useAdminComplianceQuery,
} from "@/hooks/use-admin-compliance-query";
import { useMountedTabs } from "@/hooks/use-mounted-tabs";


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
  return userDashboardProfileHref(userRef, "portfolio");
}

function matchesSearchQuery(query: string, ...values: Array<string | null | undefined>) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return values.some((value) => (value ?? "").toLowerCase().includes(normalized));
}

type ComplianceTab = "reviews" | "deletions" | "actions";

export type CompliancePanelTab = ComplianceTab;

type UserCompliancePanelProps = {
  canReadReviews: boolean;
  canResolveReviews: boolean;
  canExecuteDeletions: boolean;
  canApproveActions: boolean;
  activeTab?: CompliancePanelTab;
  showTabBar?: boolean;
};

export function ComplianceTabCount({ count, active }: { count: number; active?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-micro font-semibold tabular-nums",
        count > 0
          ? active
            ? "bg-white/20 text-white"
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
  activeTab: controlledActiveTab,
  showTabBar = true,
}: UserCompliancePanelProps) {
  const queryClient = useQueryClient();
  const { user: currentUser, soleSuperAdmin } = useAdminAuth();
  const complianceParams = useMemo(
    () => ({
      canReadReviews,
      canExecuteDeletions,
      canApproveActions,
      canReadDocuments: false,
    }),
    [canApproveActions, canExecuteDeletions, canReadReviews],
  );
  const { data, isPending, isFetching, error: queryError, refetch } =
    useAdminComplianceQuery(complianceParams);

  const reviews = data?.reviews ?? [];
  const deletions = data?.deletions ?? [];
  const pendingActions = data?.pendingActions ?? [];
  const loading = isPending && !data;

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const defaultTab = controlledActiveTab ?? "reviews";
  const { activeTab, selectTab, keepMounted } = useMountedTabs<ComplianceTab>(
    defaultTab,
    controlledActiveTab,
  );
  const [reviewQuery, setReviewQuery] = useState("");
  const [deletionQuery, setDeletionQuery] = useState("");
  const [actionQuery, setActionQuery] = useState("");
  const [reviewPage, setReviewPage] = useState(0);
  const [reviewPageSize, setReviewPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);
  const [deletionPage, setDeletionPage] = useState(0);
  const [deletionPageSize, setDeletionPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);
  const [actionPage, setActionPage] = useState(0);
  const [actionPageSize, setActionPageSize] = useState(ADMIN_TABLE_PAGE_SIZE);

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

  const loadData = async () => {
    await queryClient.invalidateQueries({ queryKey: adminComplianceQueryKey(complianceParams) });
  };

  useEffect(() => {
    if (queryError) {
      setError(getErrorMessage(queryError, "Could not load compliance data."));
    }
  }, [queryError]);

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.key === activeTab)) {
      selectTab(visibleTabs[0]?.key ?? "reviews");
    }
  }, [activeTab, selectTab, visibleTabs]);

  useEffect(() => {
    setReviewPage(0);
  }, [reviews.length, reviewQuery, reviewPageSize]);

  useEffect(() => {
    setDeletionPage(0);
  }, [deletions.length, deletionQuery, deletionPageSize]);

  useEffect(() => {
    setActionPage(0);
  }, [pendingActions.length, actionQuery, actionPageSize]);

  const filteredReviews = useMemo(
    () =>
      reviews.filter((item) =>
        matchesSearchQuery(
          reviewQuery,
          item.user_email,
          item.reason,
          item.status,
          item.client_id,
          item.user_id,
        ),
      ),
    [reviewQuery, reviews],
  );

  const filteredDeletions = useMemo(
    () =>
      deletions.filter((item) =>
        matchesSearchQuery(deletionQuery, item.email, item.client_id, item.user_id),
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
          item.target_client_id,
          item.target_id,
          item.target_type,
          item.requested_by_email,
          item.requested_by_client_id,
          item.reason,
        ),
      ),
    [actionQuery, pendingActions],
  );

  const reviewPagination = useMemo(
    () => paginateItems(filteredReviews, reviewPage, reviewPageSize),
    [filteredReviews, reviewPage, reviewPageSize],
  );
  const deletionPagination = useMemo(
    () => paginateItems(filteredDeletions, deletionPage, deletionPageSize),
    [deletionPage, deletionPageSize, filteredDeletions],
  );
  const actionPagination = useMemo(
    () => paginateItems(filteredActions, actionPage, actionPageSize),
    [actionPage, actionPageSize, filteredActions],
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

  const handleWithdrawAction = async (actionId: string) => {
    setActionLoading(`withdraw-${actionId}`);
    setMessage("");
    setError("");
    try {
      await withdrawAdminAction(actionId);
      setMessage("Pending action withdrawn.");
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, "Could not withdraw action."));
    } finally {
      setActionLoading(null);
    }
  };

  if (visibleTabs.length === 0) {
    return (
      <AdminFeedbackMessage variant="warning" dismissible={false}>
        You do not have compliance queue permissions.
      </AdminFeedbackMessage>
    );
  }

  return (
    <div className="space-y-4">
      {error ? <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>{error}</AdminFeedbackMessage> : null}
      {message ? <AdminFeedbackMessage variant="success" onDismiss={() => setMessage("")}>{message}</AdminFeedbackMessage> : null}

      <Tabs
        value={activeTab}
        onValueChange={(value) => selectTab(value as ComplianceTab)}
        className="gap-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AdminSearchInput
            containerClassName="w-full max-w-sm sm:w-auto sm:min-w-[14rem]"
            placeholder={
              activeTab === "reviews"
                ? "Search reviews"
                : activeTab === "deletions"
                  ? "Search deletions"
                  : "Search actions"
            }
            value={
              activeTab === "reviews"
                ? reviewQuery
                : activeTab === "deletions"
                  ? deletionQuery
                  : actionQuery
            }
            onChange={(event) => {
              const nextValue = event.target.value;
              if (activeTab === "reviews") {
                setReviewQuery(nextValue);
                return;
              }
              if (activeTab === "deletions") {
                setDeletionQuery(nextValue);
                return;
              }
              setActionQuery(nextValue);
            }}
          />

          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            {showTabBar ? (
              <AdminTabList variant="secondary">
                {visibleTabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <AdminTabTrigger key={tab.key} value={tab.key} className="gap-2">
                      <Icon className="size-4 shrink-0" />
                      {tab.label}
                      <ComplianceTabCount count={tab.count} active={activeTab === tab.key} />
                    </AdminTabTrigger>
                  );
                })}
              </AdminTabList>
            ) : null}

            {canExecuteDeletions && activeTab === "deletions" ? (
              <Button
                size="sm"
                disabled={actionLoading === "deletion-executor"}
                onClick={() => void handleRunDeletionExecutor()}
              >
                {actionLoading === "deletion-executor" ? "Running..." : "Run deletion executor"}
              </Button>
            ) : null}

            <Button
              variant="outline"
              size="icon"
              disabled={isFetching}
              onClick={() => void refetch()}
              aria-label="Refresh"
            >
              <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} />
            </Button>
          </div>
        </div>

        {canReadReviews ? (
          <TabsContent value="reviews" className="mt-0 space-y-4" keepMounted={keepMounted("reviews")}>
            <AdminDataTable
              minWidth="lg"
              footer={
                <AdminTablePagination
                  page={reviewPagination.page}
                  totalPages={reviewPagination.totalPages}
                  hasPrevious={reviewPagination.hasPrevious}
                  hasNext={reviewPagination.hasNext}
                  disabled={loading}
                  totalCount={filteredReviews.length}
                  currentPageCount={reviewPagination.items.length}
                  pageSize={reviewPageSize}
                  onPageSizeChange={(next) => {
                    setReviewPageSize(next);
                    setReviewPage(0);
                  }}
                  onPrevious={() => setReviewPage((page) => Math.max(0, page - 1))}
                  onNext={() => setReviewPage((page) => page + 1)}
                />
              }
            >
              <AdminTableHeader>
                <tr>
                  {canResolveReviews ? (
                    <AdminTableHeadCell className="w-[3.25rem]">
                      <span className="sr-only">Actions</span>
                    </AdminTableHeadCell>
                  ) : null}
                  <AdminTableHeadCell>User</AdminTableHeadCell>
                  <AdminTableHeadCell>Reason</AdminTableHeadCell>
                  <AdminTableHeadCell>Flagged</AdminTableHeadCell>
                  <AdminTableHeadCell>Status</AdminTableHeadCell>
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
                      {canResolveReviews ? (
                        <AdminTableCell className="w-[3.25rem] text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8"
                                  aria-label={`Actions for ${item.user_email}`}
                                  disabled={actionLoading === `review-${item.id}`}
                                >
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              }
                            />
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                disabled={actionLoading === `review-${item.id}`}
                                onClick={() => void handleResolveReview(item.id, "reviewed")}
                              >
                                Mark reviewed
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={actionLoading === `review-${item.id}`}
                                onClick={() => void handleResolveReview(item.id, "dismissed")}
                              >
                                Dismiss
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </AdminTableCell>
                      ) : null}
                      <AdminTableCell>
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{item.user_email}</p>
                          <Link
                            href={userProfileHref(pickUserRef(item))}
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
                    </AdminTableRow>
                  ))
                )}
              </AdminTableBody>
            </AdminDataTable>
          </TabsContent>
        ) : null}

        {canExecuteDeletions ? (
          <TabsContent value="deletions" className="mt-0 space-y-4" keepMounted={keepMounted("deletions")}>
            <AdminDataTable
              minWidth="md"
              footer={
                <AdminTablePagination
                  page={deletionPagination.page}
                  totalPages={deletionPagination.totalPages}
                  hasPrevious={deletionPagination.hasPrevious}
                  hasNext={deletionPagination.hasNext}
                  disabled={loading}
                  totalCount={filteredDeletions.length}
                  currentPageCount={deletionPagination.items.length}
                  pageSize={deletionPageSize}
                  onPageSizeChange={(next) => {
                    setDeletionPageSize(next);
                    setDeletionPage(0);
                  }}
                  onPrevious={() => setDeletionPage((page) => Math.max(0, page - 1))}
                  onNext={() => setDeletionPage((page) => page + 1)}
                />
              }
            >
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
                    <AdminTableRow key={item.client_id || item.user_id}>
                      <AdminTableCell>
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{item.email}</p>
                          <Link
                            href={userProfileHref(pickUserRef(item))}
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
          </TabsContent>
        ) : null}

        {canApproveActions ? (
          <TabsContent value="actions" className="mt-0 space-y-4" keepMounted={keepMounted("actions")}>
            <AdminDataTable
              minWidth="xl"
              footer={
                <AdminTablePagination
                  page={actionPagination.page}
                  totalPages={actionPagination.totalPages}
                  hasPrevious={actionPagination.hasPrevious}
                  hasNext={actionPagination.hasNext}
                  disabled={loading}
                  totalCount={filteredActions.length}
                  currentPageCount={actionPagination.items.length}
                  pageSize={actionPageSize}
                  onPageSizeChange={(next) => {
                    setActionPageSize(next);
                    setActionPage(0);
                  }}
                  onPrevious={() => setActionPage((page) => Math.max(0, page - 1))}
                  onNext={() => setActionPage((page) => page + 1)}
                />
              }
            >
              <AdminTableHeader>
                <tr>
                  <AdminTableHeadCell className="w-[3.25rem]">
                    <span className="sr-only">Decision</span>
                  </AdminTableHeadCell>
                  <AdminTableHeadCell>Action</AdminTableHeadCell>
                  <AdminTableHeadCell>Target</AdminTableHeadCell>
                  <AdminTableHeadCell>Requested by</AdminTableHeadCell>
                  <AdminTableHeadCell>Requested</AdminTableHeadCell>
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
                      description={
                        soleSuperAdmin
                          ? "As the sole Super Admin, new requests run immediately. Approve or withdraw any older queued items here."
                          : "Maker-checker requests for high-impact operations will queue here for approval."
                      }
                    />
                  </AdminTableStateRow>
                ) : filteredActions.length === 0 ? (
                  <AdminTableStateRow colSpan={5}>
                    No admin actions match your search.
                  </AdminTableStateRow>
                ) : (
                  actionPagination.items.map((item) => {
                    const isOwnRequest = Boolean(
                      currentUser?.id && item.requested_by === currentUser.id,
                    );
                    const canSelfApprove = isOwnRequest && soleSuperAdmin;

                    return (
                    <AdminTableRow key={item.id}>
                      <AdminTableCell className="w-[3.25rem] text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                aria-label={`Decision for ${formatLabel(item.action_type)}`}
                                disabled={
                                  actionLoading === `approve-${item.id}` ||
                                  actionLoading === `reject-${item.id}` ||
                                  actionLoading === `withdraw-${item.id}`
                                }
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            }
                          />
                          <DropdownMenuContent align="end">
                            {isOwnRequest && !canSelfApprove ? (
                              <DropdownMenuItem
                                disabled={actionLoading === `withdraw-${item.id}`}
                                onClick={() => void handleWithdrawAction(item.id)}
                              >
                                Withdraw
                              </DropdownMenuItem>
                            ) : (
                              <>
                                <DropdownMenuItem
                                  disabled={actionLoading === `approve-${item.id}`}
                                  onClick={() => void handleApproveAction(item.id)}
                                >
                                  Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={actionLoading === `reject-${item.id}`}
                                  onClick={() => void handleRejectAction(item.id)}
                                >
                                  Reject
                                </DropdownMenuItem>
                                {canSelfApprove ? (
                                  <DropdownMenuItem
                                    disabled={actionLoading === `withdraw-${item.id}`}
                                    onClick={() => void handleWithdrawAction(item.id)}
                                  >
                                    Withdraw
                                  </DropdownMenuItem>
                                ) : null}
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </AdminTableCell>
                      <AdminTableCell>
                        <p className="font-medium text-foreground">
                          {formatLabel(item.action_type)}
                        </p>
                        {item.reason ? (
                          <p className="mt-1 text-caption text-muted-foreground">{item.reason}</p>
                        ) : null}
                        {isOwnRequest ? (
                          <p className="mt-1 text-caption text-warning">
                            {canSelfApprove
                              ? "You submitted this request. As the sole Super Admin, you can approve or withdraw it yourself."
                              : "You submitted this request. Another admin must approve it, or withdraw it to clear the queue."}
                          </p>
                        ) : null}
                      </AdminTableCell>
                      <AdminTableCell>
                        <p className="text-foreground">
                          {item.target_email ?? formatLabel(item.target_type ?? "Platform")}
                        </p>
                        {item.target_client_id ? (
                          <Link
                            href={userProfileHref(item.target_client_id)}
                            className="mt-1 inline-flex items-center gap-1 font-mono text-caption text-muted-foreground hover:text-primary"
                          >
                            {item.target_client_id}
                            <ExternalLink className="size-3" />
                          </Link>
                        ) : item.target_id ? (
                          <p className="mt-1 font-mono text-caption text-muted-foreground">
                            {item.target_id}
                          </p>
                        ) : null}
                      </AdminTableCell>
                      <AdminTableCell className="text-muted-foreground">
                        <p>{item.requested_by_email ?? "Unknown"}</p>
                        {item.requested_by_client_id ? (
                          <p className="mt-0.5 font-mono text-caption text-muted-foreground">
                            {item.requested_by_client_id}
                          </p>
                        ) : null}
                      </AdminTableCell>
                      <AdminTableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDateTime(item.created_at)}
                      </AdminTableCell>
                    </AdminTableRow>
                    );
                  })
                )}
              </AdminTableBody>
            </AdminDataTable>
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}

import type { QueryClient } from "@tanstack/react-query";

import { ADMIN_TABLE_PAGE_SIZE } from "@/components/ui/admin-table";
import { adminAdminAccountsQueryKey } from "@/hooks/use-admin-admin-accounts-query";
import {
  adminComplianceQueryKey,
  type AdminComplianceData,
} from "@/hooks/use-admin-compliance-query";
import {
  adminUserManagementMetricsQueryKey,
  type AdminUserManagementMetrics,
} from "@/hooks/use-admin-user-management-metrics-query";
import {
  adminUsersDirectoryQueryKey,
} from "@/hooks/use-admin-users-directory-query";
import { platformAdminUsersQueryKey } from "@/hooks/use-platform-admin-users-query";
import {
  platformAuditLogsQueryKey,
} from "@/hooks/use-platform-audit-logs-query";
import {
  fetchAdminAccounts,
  fetchAdminActions,
  fetchAdminUserDirectoryMetrics,
  fetchAdminUsers,
  fetchAuditLogs,
  fetchPendingDeletions,
  fetchPendingKycReviewCount,
  fetchSecurityReviews,
  type AuditLogItem,
} from "@/lib/admin-api";
import { SUPER_ADMIN_ROLE_KEY } from "@/lib/admin-role-display";

type PrefetchAuth = {
  hasPermission: (key: string) => boolean;
  hasRole: (roleKey: string) => boolean;
};

const prefetchedRouteIds = new Set<string>();

function shouldPrefetchRoute(routeId: string) {
  if (prefetchedRouteIds.has(routeId)) return false;
  prefetchedRouteIds.add(routeId);
  return true;
}

export function resetAdminNavPrefetchCache() {
  prefetchedRouteIds.clear();
}

export async function prefetchAdminNavRoute(
  queryClient: QueryClient,
  routeId: string,
  auth: PrefetchAuth,
) {
  if (!shouldPrefetchRoute(routeId)) return;

  switch (routeId) {
    case "users":
      await prefetchUsersRoute(queryClient, auth);
      return;
    case "compliance":
      await prefetchComplianceRoute(queryClient, auth);
      return;
    case "zynd-logs":
      await prefetchZyndLogsRoute(queryClient, auth);
      return;
    default:
      return;
  }
}

export async function prefetchVisibleAdminNavRoutes(
  queryClient: QueryClient,
  routeIds: string[],
  auth: PrefetchAuth,
) {
  await Promise.all(
    routeIds.map((routeId) => prefetchAdminNavRoute(queryClient, routeId, auth)),
  );
}

async function prefetchUsersRoute(queryClient: QueryClient, auth: PrefetchAuth) {
  const canReadUsers = auth.hasPermission("users.read");
  if (!canReadUsers) return;

  const metricsParams = { canReadUsers: true as const };
  await queryClient.prefetchQuery({
    queryKey: adminUserManagementMetricsQueryKey(metricsParams),
    queryFn: async (): Promise<AdminUserManagementMetrics> => {
      const metrics = await fetchAdminUserDirectoryMetrics();
      return {
        registeredUsers: metrics.registered_users,
        kycCompliant: metrics.kyc_compliant,
        suspendedAccounts: metrics.suspended_accounts,
        activeInvestors: metrics.active_investors,
      };
    },
  });

  const directoryParams = {
    emailFilter: "",
    statusFilter: "all",
    roleFilter: "all",
    investmentFilter: "all",
    offset: 0,
    pageSize: ADMIN_TABLE_PAGE_SIZE,
  };

  await queryClient.prefetchQuery({
    queryKey: adminUsersDirectoryQueryKey(directoryParams),
    queryFn: async () => {
      const items = await fetchAdminUsers({
        limit: directoryParams.pageSize,
        offset: directoryParams.offset,
      });
      return {
        users: items,
        hasMore: items.length === directoryParams.pageSize,
      };
    },
  });
}

async function prefetchComplianceRoute(queryClient: QueryClient, auth: PrefetchAuth) {
  const canReadReviews = auth.hasPermission("security_reviews.read");
  const canExecuteDeletions = auth.hasPermission("deletion.execute");
  const canApproveActions = auth.hasPermission("admin_actions.approve");
  const canReadDocuments = auth.hasPermission("documents.read");
  const canManageAdminAccounts =
    auth.hasRole(SUPER_ADMIN_ROLE_KEY) && auth.hasPermission("admin.accounts.manage");

  const complianceParams = {
    canReadReviews,
    canExecuteDeletions,
    canApproveActions,
    canReadDocuments,
  };

  const enabled =
    canReadReviews ||
    canExecuteDeletions ||
    canApproveActions ||
    canReadDocuments;

  if (enabled) {
    await queryClient.prefetchQuery({
      queryKey: adminComplianceQueryKey(complianceParams),
      queryFn: async (): Promise<AdminComplianceData> => {
        const tasks: Promise<unknown>[] = [];
        let reviews: AdminComplianceData["reviews"] = [];
        let deletions: AdminComplianceData["deletions"] = [];
        let pendingActions: AdminComplianceData["pendingActions"] = [];
        let pendingKycReviews = 0;

        if (canReadReviews) {
          tasks.push(fetchSecurityReviews("open").then((items) => {
            reviews = items;
          }));
        }
        if (canExecuteDeletions) {
          tasks.push(fetchPendingDeletions().then((items) => {
            deletions = items;
          }));
        }
        if (canApproveActions) {
          tasks.push(fetchAdminActions("pending").then((items) => {
            pendingActions = items;
          }));
        }
        if (canReadDocuments) {
          tasks.push(fetchPendingKycReviewCount().then((payload) => {
            pendingKycReviews = payload.count;
          }));
        }

        await Promise.all(tasks);
        return { reviews, deletions, pendingActions, pendingKycReviews };
      },
    });
  }

  if (canManageAdminAccounts) {
    await queryClient.prefetchQuery({
      queryKey: adminAdminAccountsQueryKey(true),
      queryFn: () => fetchAdminAccounts(),
    });
  }
}

async function prefetchZyndLogsRoute(queryClient: QueryClient, auth: PrefetchAuth) {
  if (!auth.hasPermission("audit.read")) return;

  const auditParams = {
    eventFilter: "all",
    offset: 0,
    pageSize: ADMIN_TABLE_PAGE_SIZE,
  };

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: platformAuditLogsQueryKey(auditParams),
      queryFn: async (): Promise<{ items: AuditLogItem[]; hasMore: boolean }> => {
        const items = await fetchAuditLogs({
          limit: auditParams.pageSize,
          offset: auditParams.offset,
        });
        return {
          items,
          hasMore: items.length === auditParams.pageSize,
        };
      },
    }),
    queryClient.prefetchQuery({
      queryKey: platformAdminUsersQueryKey(),
      queryFn: () => fetchAdminUsers({ role: "admin", limit: 200 }),
    }),
  ]);
}

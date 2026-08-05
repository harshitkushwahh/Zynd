"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { fetchAdminUsers, type AdminUserListItem } from "@/lib/admin-api";

export type AdminUsersDirectoryQueryParams = {
  emailFilter: string;
  statusFilter: string;
  roleFilter: string;
  investmentFilter: string;
  offset: number;
  pageSize: number;
};

const ALL = "all";

function filterUsers(
  items: AdminUserListItem[],
  roleFilter: string,
  investmentFilter: string,
) {
  return items.filter((item) => {
    if (roleFilter !== ALL && item.role !== roleFilter) return false;
    if (investmentFilter === "invested" && !item.has_invested) return false;
    if (investmentFilter === "not_invested" && item.has_invested) return false;
    return true;
  });
}

export function adminUsersDirectoryQueryKey(params: AdminUsersDirectoryQueryParams) {
  return [
    "admin-users-directory",
    {
      email: params.emailFilter.trim() || null,
      status: params.statusFilter === ALL ? null : params.statusFilter,
      role: params.roleFilter === ALL ? null : params.roleFilter,
      investment: params.investmentFilter === ALL ? null : params.investmentFilter,
      offset: params.offset,
      pageSize: params.pageSize,
    },
  ] as const;
}

export function useAdminUsersDirectoryQuery(params: AdminUsersDirectoryQueryParams) {
  return useQuery({
    queryKey: adminUsersDirectoryQueryKey(params),
    queryFn: async () => {
      const items = await fetchAdminUsers({
        email: params.emailFilter.trim() || undefined,
        status: params.statusFilter === ALL ? undefined : params.statusFilter,
        limit: params.pageSize,
        offset: params.offset,
      });
      return {
        users: filterUsers(items, params.roleFilter, params.investmentFilter),
        hasMore: items.length === params.pageSize,
      };
    },
    placeholderData: keepPreviousData,
  });
}

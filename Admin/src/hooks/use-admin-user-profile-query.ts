"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import {
  fetchAdminRoles,
  fetchAdminUserProfileDetail,
  fetchAdminUserRoles,
  fetchAdminUserSummary,
  type AdminRole,
  type AdminUserProfileDetail,
  type AdminUserSummary,
} from "@/lib/admin-api";

export type AdminUserProfileQueryParams = {
  clientId: string;
  canReadUsers: boolean;
  canManageRbac: boolean;
};

export type AdminUserProfileData = {
  summary: AdminUserSummary;
  profileDetail: AdminUserProfileDetail;
  roles: AdminRole[];
  assignedRoles: string[];
};

export function adminUserProfileQueryKey(clientId: string, canManageRbac: boolean) {
  return ["admin-user-profile", clientId, { rbac: canManageRbac }] as const;
}

export function useAdminUserProfileQuery(params: AdminUserProfileQueryParams) {
  return useQuery({
    queryKey: adminUserProfileQueryKey(params.clientId, params.canManageRbac),
    queryFn: async (): Promise<AdminUserProfileData> => {
      const [summary, profileDetail] = await Promise.all([
        fetchAdminUserSummary(params.clientId),
        fetchAdminUserProfileDetail(params.clientId),
      ]);

      let roles: AdminRole[] = [];
      let assignedRoles: string[] = [];

      if (params.canManageRbac) {
        roles = await fetchAdminRoles();
        if (summary.role === "admin") {
          assignedRoles = (await fetchAdminUserRoles(params.clientId)).roles;
        }
      }

      return { summary, profileDetail, roles, assignedRoles };
    },
    enabled: params.canReadUsers && Boolean(params.clientId),
    placeholderData: keepPreviousData,
  });
}

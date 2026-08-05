"use client";

import { useQuery } from "@tanstack/react-query";

import {
  fetchAdminPermissions,
  fetchAdminRoles,
  type AdminPermission,
  type AdminRole,
} from "@/lib/admin-api";

export const ADMIN_ROLES_QUERY_KEY = ["admin-roles"] as const;
export const ADMIN_PERMISSIONS_QUERY_KEY = ["admin-permissions"] as const;

export function useAdminRolesQuery() {
  return useQuery({
    queryKey: ADMIN_ROLES_QUERY_KEY,
    queryFn: fetchAdminRoles,
  });
}

export function useAdminPermissionsQuery() {
  return useQuery({
    queryKey: ADMIN_PERMISSIONS_QUERY_KEY,
    queryFn: fetchAdminPermissions,
  });
}

export function useAdminRbacQuery(): {
  roles: AdminRole[];
  permissionCatalog: AdminPermission[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const rolesQuery = useAdminRolesQuery();
  const permissionsQuery = useAdminPermissionsQuery();

  const isLoading =
    (rolesQuery.isLoading && !rolesQuery.data) ||
    (permissionsQuery.isLoading && !permissionsQuery.data);

  return {
    roles: rolesQuery.data ?? [],
    permissionCatalog: permissionsQuery.data ?? [],
    isLoading,
    isFetching: rolesQuery.isFetching || permissionsQuery.isFetching,
    error: rolesQuery.error ?? permissionsQuery.error ?? null,
    refetch: async () => {
      await Promise.all([rolesQuery.refetch(), permissionsQuery.refetch()]);
    },
  };
}

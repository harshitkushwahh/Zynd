"use client";

import { use } from "react";

import { AdminUserFamilyGroupDetailPage } from "@/components/users/admin-user-family-group-detail-page";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import { profilePathToClientId } from "@/lib/admin-user-ref";

type UserFamilyGroupDetailRoutePageProps = {
  params: Promise<{ profilePath: string; groupId: string }>;
};

export default function UserFamilyGroupDetailRoutePage({ params }: UserFamilyGroupDetailRoutePageProps) {
  const { profilePath, groupId } = use(params);
  const { hasPermission } = useAdminAuth();
  const clientId = profilePathToClientId(profilePath);
  const canManageFamilyGroups = hasPermission("family_groups.manage");

  return (
    <AdminUserFamilyGroupDetailPage
      profilePath={profilePath}
      clientId={clientId}
      groupId={groupId}
      canManageFamilyGroups={canManageFamilyGroups}
    />
  );
}

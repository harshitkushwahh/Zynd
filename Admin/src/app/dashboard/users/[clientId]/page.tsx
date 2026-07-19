"use client";

import { use } from "react";

import { UserManagementPage } from "@/components/users/user-management-page";
import { UserProfileView } from "@/components/users/user-profile-view";
import { USER_MANAGEMENT_TAB_SLUGS } from "@/lib/admin-user-management-navigation";
import { profilePathToClientId } from "@/lib/admin-user-ref";

type UserRoutePageProps = {
  params: Promise<{ clientId: string }>;
};

export default function UserRoutePage({ params }: UserRoutePageProps) {
  const { clientId } = use(params);

  if (USER_MANAGEMENT_TAB_SLUGS.has(clientId)) {
    return <UserManagementPage tabSlug={clientId} />;
  }

  return <UserProfileView clientId={profilePathToClientId(clientId)} />;
}

"use client";

import { use } from "react";

import { UserManagementPage } from "@/components/users/user-management-page";
import { UserProfileView } from "@/components/users/user-profile-view";
import { USER_MANAGEMENT_TAB_SLUGS } from "@/lib/admin-user-management-navigation";
import { USER_PROFILE_TAB_SLUGS } from "@/lib/admin-user-profile-navigation";
import { profilePathToClientId } from "@/lib/admin-user-ref";

type UsersRoutePageProps = {
  params: Promise<{ tab?: string[] }>;
};

export default function UsersRoutePage({ params }: UsersRoutePageProps) {
  const { tab } = use(params);
  const segment = tab?.[0];

  if (!segment) {
    return <UserManagementPage />;
  }

  if (USER_MANAGEMENT_TAB_SLUGS.has(segment)) {
    return <UserManagementPage tabSlug={segment} />;
  }

  const clientId = profilePathToClientId(segment);
  const profileTabSlug =
    tab?.[1] && USER_PROFILE_TAB_SLUGS.has(tab[1]) ? tab[1] : undefined;

  return <UserProfileView clientId={clientId} profileTabSlug={profileTabSlug} />;
}

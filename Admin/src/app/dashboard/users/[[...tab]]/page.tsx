"use client";

import { useRouter } from "next/navigation";
import { use, useEffect } from "react";

import { UserManagementPage } from "@/components/users/user-management-page";
import { UserProfileView } from "@/components/users/user-profile-view";
import {
  resolveTeamWorkspaceSubTab,
  TEAM_WORKSPACE_SUB_TAB_SLUGS,
  USER_MANAGEMENT_TAB_SLUGS,
} from "@/lib/admin-user-management-navigation";
import { USER_PROFILE_TAB_SLUGS, PLATFORM_ADMIN_PROFILE_TAB_SLUGS } from "@/lib/admin-user-profile-navigation";
import { profilePathToClientId } from "@/lib/admin-user-ref";

type UsersRoutePageProps = {
  params: Promise<{ tab?: string[] }>;
};

export default function UsersRoutePage({ params }: UsersRoutePageProps) {
  const router = useRouter();
  const { tab } = use(params);
  const segment = tab?.[0];
  const subSegment = tab?.[1];

  useEffect(() => {
    if (segment === "invitations") {
      router.replace("/dashboard/users/team/invitations");
      return;
    }
    if (segment === "compliance") {
      router.replace("/dashboard/compliance/security-reviews");
      return;
    }
    if (segment === "kyc") {
      router.replace("/dashboard/compliance/kyc-review");
      return;
    }
    if (segment === "team" && subSegment && !TEAM_WORKSPACE_SUB_TAB_SLUGS.has(subSegment)) {
      router.replace("/dashboard/users/team");
    }
  }, [router, segment, subSegment]);

  if (segment === "invitations" || segment === "compliance" || segment === "kyc") {
    return null;
  }

  if (!segment || USER_MANAGEMENT_TAB_SLUGS.has(segment)) {
    const teamSubTab = segment === "team" ? resolveTeamWorkspaceSubTab(subSegment) : undefined;
    return <UserManagementPage tabSlug={segment} teamSubTab={teamSubTab} />;
  }

  const clientId = profilePathToClientId(segment);
  const profileTabSlug =
    tab?.[1] &&
    (USER_PROFILE_TAB_SLUGS.has(tab[1]) || PLATFORM_ADMIN_PROFILE_TAB_SLUGS.has(tab[1]))
      ? tab[1]
      : undefined;

  return <UserProfileView clientId={clientId} profileTabSlug={profileTabSlug} />;
}

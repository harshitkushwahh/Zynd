import {
  ClipboardList,
  Eye,
  KeyRound,
  Shield,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";

export type UserManagementTabKey =
  | "people"
  | "team"
  | "roles"
  | "permissions"
  | "action-types"
  | "access-overview";

export type TeamWorkspaceSubTabKey = "members" | "invitations";

export type UserManagementTab = {
  key: UserManagementTabKey;
  slug?: string;
  label: string;
  icon: LucideIcon;
  permissions?: string[];
  match?: "any" | "all";
};

export const USER_MANAGEMENT_TABS: UserManagementTab[] = [
  {
    key: "people",
    label: "Users",
    icon: Users,
    permissions: ["users.read"],
  },
  {
    key: "team",
    slug: "team",
    label: "Manage team",
    icon: UserCog,
    permissions: ["rbac.manage"],
  },
  {
    key: "roles",
    slug: "roles",
    label: "Team roles",
    icon: Shield,
    permissions: ["rbac.manage"],
  },
  {
    key: "permissions",
    slug: "permissions",
    label: "Permissions",
    icon: KeyRound,
    permissions: ["rbac.manage"],
  },
  {
    key: "action-types",
    slug: "action-types",
    label: "Action types",
    icon: ClipboardList,
    permissions: ["rbac.manage"],
  },
  {
    key: "access-overview",
    slug: "access-overview",
    label: "Access overview",
    icon: Eye,
    permissions: ["rbac.manage"],
  },
];

export const TEAM_WORKSPACE_SUB_TABS: Array<{
  key: TeamWorkspaceSubTabKey;
  slug?: string;
  label: string;
}> = [
  { key: "members", label: "Team members" },
  { key: "invitations", slug: "invitations", label: "Invitations" },
];

export const TEAM_WORKSPACE_SUB_TAB_SLUGS = new Set(
  TEAM_WORKSPACE_SUB_TABS.map((tab) => tab.slug).filter((slug): slug is string => Boolean(slug)),
);

export function teamWorkspaceSubTabHref(subTab: TeamWorkspaceSubTabKey) {
  const match = TEAM_WORKSPACE_SUB_TABS.find((tab) => tab.key === subTab);
  return match?.slug ? `/dashboard/users/team/${match.slug}` : "/dashboard/users/team";
}

export function resolveTeamWorkspaceSubTab(subTabSlug?: string): TeamWorkspaceSubTabKey {
  if (subTabSlug === "invitations") return "invitations";
  return "members";
}

export const USER_MANAGEMENT_TAB_SLUGS = new Set(
  USER_MANAGEMENT_TABS.map((tab) => tab.slug).filter((slug): slug is string => Boolean(slug)),
);

export function userManagementTabHref(tab: UserManagementTab) {
  return tab.slug ? `/dashboard/users/${tab.slug}` : "/dashboard/users";
}

export function resolveUserManagementTab(
  tabSlug: string | undefined,
  hasPermission: (key: string) => boolean,
): UserManagementTab | null {
  const visible = USER_MANAGEMENT_TABS.filter((tab) => {
    if (!tab.permissions?.length) return true;
    if (tab.match === "all") {
      return tab.permissions.every((permission) => hasPermission(permission));
    }
    return tab.permissions.some((permission) => hasPermission(permission));
  });
  if (!visible.length) return null;
  if (!tabSlug) return visible[0];
  return visible.find((tab) => tab.slug === tabSlug) ?? visible[0];
}

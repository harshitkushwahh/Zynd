import {
  ClipboardList,
  Eye,
  FileCheck2,
  KeyRound,
  Shield,
  ShieldAlert,
  Users,
  type LucideIcon,
} from "lucide-react";

export type UserManagementTabKey =
  | "people"
  | "compliance"
  | "kyc"
  | "roles"
  | "permissions"
  | "action-types"
  | "access-overview";

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
    key: "compliance",
    slug: "compliance",
    label: "Compliance",
    icon: ShieldAlert,
    permissions: ["security_reviews.read", "deletion.execute", "admin_actions.approve"],
  },
  {
    key: "kyc",
    slug: "kyc",
    label: "KYC review",
    icon: FileCheck2,
    permissions: ["documents.read"],
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

import {
  ClipboardList,
  FileCheck2,
  Shield,
  ShieldCheck,
  Trash2,
  type LucideIcon,
} from "lucide-react";

import { SUPER_ADMIN_ROLE_KEY } from "@/lib/admin-role-display";

export type ComplianceTabKey =
  | "security-reviews"
  | "account-deletions"
  | "admin-actions"
  | "kyc-review"
  | "admin-accounts";

export type ComplianceTab = {
  key: ComplianceTabKey;
  slug?: string;
  label: string;
  icon: LucideIcon;
  permissions?: string[];
  superAdminOnly?: boolean;
  showCount?: boolean;
};

export const COMPLIANCE_TABS: ComplianceTab[] = [
  {
    key: "security-reviews",
    slug: "security-reviews",
    label: "Security reviews",
    icon: Shield,
    permissions: ["security_reviews.read"],
    showCount: true,
  },
  {
    key: "account-deletions",
    slug: "account-deletions",
    label: "Account deletions",
    icon: Trash2,
    permissions: ["deletion.execute"],
    showCount: true,
  },
  {
    key: "admin-actions",
    slug: "admin-actions",
    label: "Admin actions",
    icon: ClipboardList,
    permissions: ["admin_actions.approve"],
  },
  {
    key: "kyc-review",
    slug: "kyc-review",
    label: "KYC review",
    icon: FileCheck2,
    permissions: ["documents.read"],
  },
  {
    key: "admin-accounts",
    slug: "admin-accounts",
    label: "Admin accounts",
    icon: ShieldCheck,
    permissions: ["admin.accounts.manage"],
    superAdminOnly: true,
    showCount: true,
  },
];

export const COMPLIANCE_TAB_SLUGS = new Set(
  COMPLIANCE_TABS.map((tab) => tab.slug).filter((slug): slug is string => Boolean(slug)),
);

export function complianceTabHref(tab: ComplianceTab) {
  return tab.slug ? `/dashboard/compliance/${tab.slug}` : "/dashboard/compliance";
}

export function resolveComplianceTab(
  tabSlug: string | undefined,
  hasPermission: (key: string) => boolean,
  hasRole: (roleKey: string) => boolean = () => false,
): ComplianceTab | null {
  const visible = COMPLIANCE_TABS.filter((tab) => {
    if (tab.superAdminOnly && !hasRole(SUPER_ADMIN_ROLE_KEY)) return false;
    if (!tab.permissions?.length) return true;
    return tab.permissions.some((permission) => hasPermission(permission));
  });
  if (!visible.length) return null;
  if (!tabSlug) return visible[0];
  return visible.find((tab) => tab.slug === tabSlug) ?? visible[0];
}

export function compliancePanelTabForRoute(
  tabKey: ComplianceTabKey,
): "reviews" | "deletions" | "actions" | null {
  if (tabKey === "security-reviews") return "reviews";
  if (tabKey === "account-deletions") return "deletions";
  if (tabKey === "admin-actions") return "actions";
  return null;
}

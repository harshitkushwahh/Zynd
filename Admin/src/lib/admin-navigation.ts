import {
  Crown,
  Gauge,
  Gift,
  Globe,
  Handshake,
  Layers,
  LayoutDashboard,
  Plug,
  ScrollText,
  Settings,
  Shield,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

import {
  ADMIN_SETTINGS_NAV,
} from "@/lib/admin-settings-navigation";
import { FAMILY_GROUPS_TABS } from "@/lib/admin-family-groups-navigation";
import { RECOMMENDATIONS_TABS } from "@/lib/admin-recommendations-navigation";
import { RISK_PROFILE_TABS } from "@/lib/admin-risk-profile-navigation";
import {
  USER_MANAGEMENT_TABS,
} from "@/lib/admin-user-management-navigation";
import { USER_PROFILE_TABS } from "@/lib/admin-user-profile-navigation";
import {
  ADMIN_TRANSACTION_SECTIONS,
  isSectionTabEnabled,
  sectionTabHref,
  type AdminSectionTab,
} from "@/lib/admin-transaction-sections";
import {
  mitraHierarchyDocumentTitle,
  resolveMitraConsoleTitle,
  resolveMitraNavDescription,
} from "@/lib/admin-mitra-roles";
import { MITRA_HIERARCHY_COPY } from "@/lib/mitra-hierarchy-copy";
import {
  getDistributorHeadDistributor,
  getDistributorHeadManager,
} from "@/lib/distributor-head-queries";
import { env } from "@/lib/env";

export type AdminNavRoute = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  description?: string;
  /** Any one of these permissions grants access. */
  permissions?: string[];
  comingSoon?: boolean;
  /** Opens in a new browser tab when set. */
  external?: boolean;
  /** Shows a trailing arrow in the sidebar (product / external destinations). */
  showTrailingArrow?: boolean;
};

export const ADMIN_NAV_ROUTES: AdminNavRoute[] = [
  {
    id: "overview",
    label: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "At-a-glance access and quick links to platform areas",
  },
  {
    id: "users",
    label: "Users",
    href: "/dashboard/users",
    icon: Users,
    description: "People, roles, permissions, and access overview",
    permissions: ["users.read", "rbac.manage"],
  },
  {
    id: "compliance",
    label: "Compliance",
    href: "/dashboard/compliance",
    icon: ShieldCheck,
    description: "Security reviews, account deletions, admin actions, and KYC review",
    permissions: [
      "security_reviews.read",
      "deletion.execute",
      "admin_actions.approve",
      "documents.read",
      "admin.accounts.manage",
    ],
  },
  {
    id: "mutual-funds",
    label: "Mutual Funds",
    href: "/dashboard/mutual-funds",
    icon: TrendingUp,
    description: "Catalog, content, AMCs, and ingestion jobs",
    permissions: [
      "mf.catalog.read",
      "mf.amcs.read",
      "mf.jobs.read",
      "mf.content.manage",
      "mf.rules.manage",
    ],
  },
  {
    id: "bulk-order",
    label: "Bulk Order",
    href: "/dashboard/bulk-order",
    icon: Layers,
    description: "Cart checkouts with multiple lumpsum funds or SIP batches",
    permissions: ["mf.transactions.read"],
  },
  {
    id: "risk-profile",
    label: "Risk Profile",
    href: "/dashboard/risk-profile",
    icon: Gauge,
    description: "Questionnaire categories, bulk import, templates, and user risk profiles",
    permissions: [
      "risk_profile.read",
      "risk_profile.categories.manage",
      "risk_profile.questions.manage",
      "risk_profile.templates.manage",
      "risk_profile.tiers.manage",
      "risk_profile.users.read",
    ],
  },
  {
    id: "recommendations",
    label: "Funds For You",
    href: "/dashboard/recommendations",
    icon: Sparkles,
    description: "Recommendation baskets, publish config, preview, and engine ops",
    permissions: ["recommendations.read", "recommendations.manage", "recommendations.publish"],
  },
  {
    id: "family-groups",
    label: "Family Groups",
    href: "/dashboard/family-groups",
    icon: Users,
    description: "Family group directory, invites, and moderation",
    permissions: ["family_groups.read", "family_groups.manage"],
  },
  {
    id: "referrals",
    label: "Referrals",
    href: "/dashboard/referrals",
    icon: Gift,
    description: "Referral attributions, reward scheme, and leaderboard",
    permissions: ["referrals.read", "referrals.manage"],
  },
  {
    id: "goals",
    label: "Goals",
    href: "/dashboard/goals",
    icon: Target,
    description: "Predefined goal templates for personal and family savings",
    permissions: ["goals.templates.read", "goals.templates.manage"],
  },
  {
    id: "security-config",
    label: "Security",
    href: "/dashboard/security-config",
    icon: Shield,
    description: "Platform security settings (maker-checker updates)",
    permissions: ["security.manage"],
  },
  {
    id: "mitra-console",
    label: "Mitra console",
    href: env.distributorUrl || "/dashboard/distributor-accounts",
    icon: Handshake,
    description: "Branch manager and Zynd Mitra field console",
    external: true,
    showTrailingArrow: true,
    comingSoon: !env.distributorUrl,
  },
  {
    id: "distributor-head",
    label: MITRA_HIERARCHY_COPY.superHead,
    href: "/dashboard/distributor-head",
    icon: Crown,
    description: MITRA_HIERARCHY_COPY.navDescription,
    permissions: [
      "admin.distributor_partners.list",
      "admin.distributor_hierarchy.read",
    ],
  },
  {
    id: "zynd-web",
    label: "Zynd Web",
    href: env.zyndWebUrl || "/dashboard/zynd-web",
    icon: Globe,
    description: "Investor web app and public Zynd web experience",
    external: Boolean(env.zyndWebUrl),
    showTrailingArrow: true,
    comingSoon: !env.zyndWebUrl,
  },
  {
    id: "zynd-mobile",
    label: "Zynd Mobile",
    href: "/dashboard/zynd-mobile",
    icon: Smartphone,
    description: "Android and iOS app store listings with download QR codes",
    showTrailingArrow: true,
    comingSoon: false,
  },
  {
    id: "mf-integrations",
    label: "Zynd Integrations",
    href: "/dashboard/mf-integrations",
    icon: Plug,
    description: "Provider connections, test/live switching, and integration health",
    permissions: ["mf.integrations.read"],
  },
  {
    id: "settings",
    label: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    description: "Account, workspace admin, and console preferences",
  },
  {
    id: "zynd-logs",
    label: "Zynd Logs",
    href: "/dashboard/zynd-logs",
    icon: ScrollText,
    description: "Platform audit logs plus Cybrilla, Fintech Primitive, and KYC Kart integration logs",
    permissions: ["audit.read"],
  },
];

export function isAdminRouteActive(pathname: string, route: AdminNavRoute) {
  if (route.href === "/dashboard") {
    return pathname === "/dashboard";
  }
  return pathname === route.href || pathname.startsWith(`${route.href}/`);
}

export function resolveAdminNavRouteLabel(route: AdminNavRoute, roleKeys: string[] = []) {
  if (route.id === "distributor-head") {
    return resolveMitraConsoleTitle(roleKeys);
  }
  return route.label;
}

export function resolveAdminNavRouteDescription(route: AdminNavRoute, roleKeys: string[] = []) {
  if (route.id === "distributor-head") {
    return resolveMitraNavDescription(roleKeys);
  }
  return route.description;
}

export function canAccessAdminRoute(
  route: AdminNavRoute,
  hasPermission: (key: string) => boolean,
) {
  if (!route.permissions?.length) return true;
  if (route.permissions.some((permission) => hasPermission(permission))) {
    return true;
  }
  // Funds For You is tier-based; show the nav entry to risk-profile operators too.
  if (route.id === "recommendations") {
    return (
      hasPermission("risk_profile.read") ||
      hasPermission("risk_profile.users.read") ||
      hasPermission("risk_profile.templates.manage")
    );
  }
  return false;
}

export function getVisibleAdminRoutes(hasPermission: (key: string) => boolean) {
  return ADMIN_NAV_ROUTES.filter((route) => canAccessAdminRoute(route, hasPermission));
}

const ADMIN_PLATFORM_LEADING_ROUTE_IDS = ["users", "compliance", "mutual-funds"] as const;

const ADMIN_PLATFORM_TRAILING_ROUTE_IDS = [
  "bulk-order",
  "risk-profile",
  "family-groups",
  "referrals",
  "distributor-head",
  "security-config",
] as const;

const ADMIN_RECOMMENDATION_ENGINE_ROUTE_IDS = ["recommendations"] as const;

const ADMIN_PLATFORM_DROPDOWN_IDS = ["orders", "systematic-plans", "txn-requests"] as const;

const ADMIN_ADMINISTRATOR_ROUTE_IDS = [
  "mf-integrations",
  "settings",
  "zynd-logs",
] as const;

const ADMIN_PRODUCT_ROUTE_IDS = [
  "mitra-console",
  "zynd-web",
  "zynd-mobile",
] as const;

export type AdminNavChildItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  disabled?: boolean;
};

export type AdminNavDropdown = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  permissions: string[];
  children: AdminNavChildItem[];
};

export type AdminNavGroup = {
  label: string;
  routes: AdminNavRoute[];
  dropdowns?: AdminNavDropdown[];
  trailingRoutes?: AdminNavRoute[];
};

function canAccessNavPermissions(
  permissions: string[],
  hasPermission: (key: string) => boolean,
) {
  if (!permissions.length) return true;
  return permissions.some((permission) => hasPermission(permission));
}

function buildPlatformDropdowns(hasPermission: (key: string) => boolean): AdminNavDropdown[] {
  return ADMIN_PLATFORM_DROPDOWN_IDS.map((sectionId) => {
    const section = ADMIN_TRANSACTION_SECTIONS[sectionId];
    if (!section) return null;
    if (!canAccessNavPermissions(section.permissions, hasPermission)) return null;

    const children: AdminNavChildItem[] = section.tabs.map((tab: AdminSectionTab) => ({
      id: `${sectionId}-${tab.slug}`,
      label: tab.label,
      href: sectionTabHref(section, tab),
      icon: tab.icon,
      disabled: !isSectionTabEnabled(tab),
    }));
    const firstEnabledChild = children.find((child) => !child.disabled);

    return {
      id: section.id,
      label: section.label,
      href: firstEnabledChild?.href ?? section.href,
      icon: section.icon,
      permissions: section.permissions,
      children,
    };
  }).filter((dropdown): dropdown is AdminNavDropdown => dropdown != null);
}

export function isAdminDropdownActive(pathname: string, dropdown: AdminNavDropdown) {
  return dropdown.children.some(
    (child) =>
      !child.disabled &&
      (pathname === child.href || pathname.startsWith(`${child.href}/`)),
  );
}

export function isAdminChildNavActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getAdminSidebarNav(hasPermission: (key: string) => boolean) {
  const routes = getVisibleAdminRoutes(hasPermission);
  const overview = routes.find((route) => route.id === "overview") ?? null;
  const platformLeadingRoutes = routes.filter((route) =>
    ADMIN_PLATFORM_LEADING_ROUTE_IDS.includes(
      route.id as (typeof ADMIN_PLATFORM_LEADING_ROUTE_IDS)[number],
    ),
  );
  const platformTrailingRoutes = routes.filter((route) =>
    ADMIN_PLATFORM_TRAILING_ROUTE_IDS.includes(
      route.id as (typeof ADMIN_PLATFORM_TRAILING_ROUTE_IDS)[number],
    ),
  );
  const recommendationEngineRoutes = routes.filter((route) =>
    ADMIN_RECOMMENDATION_ENGINE_ROUTE_IDS.includes(
      route.id as (typeof ADMIN_RECOMMENDATION_ENGINE_ROUTE_IDS)[number],
    ),
  );
  const platformDropdowns = buildPlatformDropdowns(hasPermission);
  const administratorRoutes = routes.filter((route) =>
    ADMIN_ADMINISTRATOR_ROUTE_IDS.includes(route.id as (typeof ADMIN_ADMINISTRATOR_ROUTE_IDS)[number]),
  );
  const productRoutes = routes.filter((route) =>
    ADMIN_PRODUCT_ROUTE_IDS.includes(route.id as (typeof ADMIN_PRODUCT_ROUTE_IDS)[number]),
  );

  const groups: AdminNavGroup[] = [];
  if (
    platformLeadingRoutes.length > 0 ||
    platformTrailingRoutes.length > 0 ||
    platformDropdowns.length > 0
  ) {
    groups.push({
      label: "Platform",
      routes: platformLeadingRoutes,
      dropdowns: platformDropdowns.length > 0 ? platformDropdowns : undefined,
      trailingRoutes: platformTrailingRoutes.length > 0 ? platformTrailingRoutes : undefined,
    });
  }
  if (recommendationEngineRoutes.length > 0) {
    groups.push({
      label: "Recommendation engine",
      routes: recommendationEngineRoutes,
    });
  }
  if (productRoutes.length > 0) {
    groups.push({ label: "Product", routes: productRoutes });
  }
  if (administratorRoutes.length > 0) {
    groups.push({ label: "Administrator", routes: administratorRoutes });
  }

  return { overview, groups };
}

export function getAdminPageTitle(pathname: string, roleKeys: string[] = []) {
  for (const section of Object.values(ADMIN_TRANSACTION_SECTIONS)) {
    if (pathname === section.href || pathname.startsWith(`${section.href}/`)) {
      const slug = pathname.slice(section.href.length).replace(/^\//, "").split("/")[0];
      const tab = slug
        ? section.tabs.find((item) => item.slug === slug)
        : section.tabs[0];
      if (tab) return tab.label;
      return section.label;
    }
  }

  const route = ADMIN_NAV_ROUTES.find((item) => isAdminRouteActive(pathname, item));
  if (route?.id === "bulk-order") {
    const slug = pathname.replace("/dashboard/bulk-order", "").replace(/^\//, "").split("/")[0];
    if (slug === "sip") return "Bulk Order · SIP";
    if (slug === "lumpsum") return "Bulk Order · Lumpsum";
    return "Bulk Order";
  }
  if (pathname === "/dashboard/compliance" || pathname.startsWith("/dashboard/compliance/")) {
    const slug = pathname.replace("/dashboard/compliance", "").replace(/^\//, "").split("/")[0];
    if (slug === "security-reviews") return "Compliance · Security reviews";
    if (slug === "account-deletions") return "Compliance · Account deletions";
    if (slug === "admin-actions") return "Compliance · Admin actions";
    if (slug === "kyc-review") return "Compliance · KYC review";
    if (slug === "admin-accounts") return "Compliance · Admin accounts";
    return "Compliance";
  }
  if (pathname === "/dashboard/referrals" || pathname.startsWith("/dashboard/referrals/")) {
    const parts = pathname.replace("/dashboard/referrals", "").replace(/^\//, "").split("/").filter(Boolean);
    const slug = parts[0];
    if (slug === "referrers" && parts[1]) return "Referrals · Referrer";
    if (slug === "directory") return "Referrals · Attributions";
    if (slug === "redemptions") return "Referrals · Redemption history";
    if (slug === "rewards") return "Referrals · Reward categories";
    if (slug === "leaderboard") return "Referrals · Leaderboard";
    return "Referrals";
  }
  if (pathname === "/dashboard/risk-profile" || pathname.startsWith("/dashboard/risk-profile/")) {
    const slug = pathname.replace("/dashboard/risk-profile", "").replace(/^\//, "").split("/")[0];
    if (slug === "recommendation-baskets") return "Funds For You";
    const normalizedSlug = slug === "bulk" ? "questions" : slug;
    const tab = normalizedSlug
      ? RISK_PROFILE_TABS.find((item) => item.id === normalizedSlug)
      : RISK_PROFILE_TABS.find((item) => item.id === "users");
    if (tab) return `Risk profile · ${tab.label}`;
    return "Risk profile";
  }
  if (pathname === "/dashboard/recommendations" || pathname.startsWith("/dashboard/recommendations/")) {
    const slug = pathname.replace("/dashboard/recommendations", "").replace(/^\//, "").split("/")[0];
    const tab = slug
      ? RECOMMENDATIONS_TABS.find((item) => item.id === slug)
      : RECOMMENDATIONS_TABS.find((item) => item.id === "baskets");
    if (tab) return `Funds For You · ${tab.label}`;
    return "Funds For You";
  }
  if (pathname === "/dashboard/family-groups" || pathname.startsWith("/dashboard/family-groups/")) {
    const slug = pathname.replace("/dashboard/family-groups", "").replace(/^\//, "").split("/")[0];
    const tab = slug
      ? FAMILY_GROUPS_TABS.find((item) => item.id === slug)
      : FAMILY_GROUPS_TABS.find((item) => item.id === "groups");
    if (tab) return `Family groups · ${tab.label}`;
    if (slug) return "Family groups · Group";
    return "Family groups";
  }
  if (pathname === "/dashboard/users" || pathname.startsWith("/dashboard/users/")) {
    const parts = pathname.replace("/dashboard/users", "").replace(/^\//, "").split("/").filter(Boolean);
    if (parts.length === 0) {
      return USER_MANAGEMENT_TABS.find((tab) => tab.key === "people")?.label ?? "Users";
    }
    if (parts[0] === "team") {
      if (parts[1] === "invitations") return "Manage team · Invitations";
      return "Manage team";
    }
    const managementTab = USER_MANAGEMENT_TABS.find((tab) => tab.slug === parts[0]);
    if (managementTab) return managementTab.label;
    const profileTab = USER_PROFILE_TABS.find((tab) => tab.slug === parts[1]);
    if (profileTab) return `User · ${profileTab.label}`;
    if (parts[1] === "goals" && parts[2]) return "User · Goal";
    if (parts[1] === "family-group" && parts[2]) return "User · Family group";
    return "Users";
  }
  if (pathname === "/dashboard/security-config" || pathname.startsWith("/dashboard/security-config/")) {
    const slug = pathname.replace("/dashboard/security-config", "").replace(/^\//, "").split("/")[0];
    if (slug === "risk") return "Security · Adaptive risk";
    if (slug === "ops-thresholds") return "Security · Ops thresholds";
    if (slug === "other") return "Security · Other";
    return "Security · Login lockout";
  }
  if (pathname === "/dashboard/settings" || pathname.startsWith("/dashboard/settings/")) {
    const slug = pathname.replace("/dashboard/settings", "").replace(/^\//, "").split("/")[0];
    const item = slug
      ? ADMIN_SETTINGS_NAV.find((entry) => entry.id === slug)
      : ADMIN_SETTINGS_NAV[0];
    if (item) return `Settings · ${item.title}`;
    return "Settings";
  }
  if (pathname === "/dashboard/distributor-head" || pathname.startsWith("/dashboard/distributor-head/")) {
    const parts = pathname.replace("/dashboard/distributor-head", "").replace(/^\//, "").split("/");
    const section = parts[0];
    const entityId = parts[1];
    if (section === "managers" && entityId) {
      const manager = getDistributorHeadManager(entityId);
      return manager
        ? mitraHierarchyDocumentTitle(roleKeys, manager.name)
        : mitraHierarchyDocumentTitle(roleKeys, MITRA_HIERARCHY_COPY.branchManager);
    }
    if (section === "distributors" && entityId) {
      const distributor = getDistributorHeadDistributor(entityId);
      return distributor
        ? mitraHierarchyDocumentTitle(roleKeys, distributor.name)
        : mitraHierarchyDocumentTitle(roleKeys, MITRA_HIERARCHY_COPY.zyndMitra);
    }
    if (section === "queue") return mitraHierarchyDocumentTitle(roleKeys, "Queue");
    if (section === "state-heads") {
      return mitraHierarchyDocumentTitle(roleKeys, `${MITRA_HIERARCHY_COPY.stateHead}s`);
    }
    if (section === "managers") {
      return mitraHierarchyDocumentTitle(roleKeys, MITRA_HIERARCHY_COPY.branchManagers);
    }
    if (section === "distributors") {
      return mitraHierarchyDocumentTitle(roleKeys, MITRA_HIERARCHY_COPY.zyndMitras);
    }
    if (section === "branches") return mitraHierarchyDocumentTitle(roleKeys, "Branches");
    if (section === "sales") return mitraHierarchyDocumentTitle(roleKeys, "Sales");
    return resolveMitraConsoleTitle(roleKeys);
  }
  return route?.label ?? "Admin Console";
}

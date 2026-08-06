import {
  Crown,
  Gauge,
  Globe,
  Handshake,
  Layers,
  LayoutDashboard,
  Plug,
  ScrollText,
  Settings,
  Shield,
  Smartphone,
  Target,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

import {
  ADMIN_SETTINGS_NAV,
} from "@/lib/admin-settings-navigation";
import {
  ADMIN_TRANSACTION_SECTIONS,
  isSectionTabEnabled,
  sectionTabHref,
  type AdminSectionTab,
} from "@/lib/admin-transaction-sections";
import {
  mitraSuperHeadDocumentTitle,
  MITRA_HIERARCHY_COPY,
} from "@/lib/mitra-hierarchy-copy";
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
    description: "People, compliance, KYC review, and access overview",
    permissions: ["users.read", "rbac.manage"],
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
    id: "family-groups",
    label: "Family Groups",
    href: "/dashboard/family-groups",
    icon: Users,
    description: "Family group directory, invites, and moderation",
    permissions: ["family_groups.read", "family_groups.manage"],
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
    id: "distributor-accounts",
    label: "Distributor",
    href: "/dashboard/distributor-accounts",
    icon: Handshake,
    description: "Distributor onboarding, ARN records, and account management",
    showTrailingArrow: true,
    comingSoon: true,
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
    id: "zynd-android",
    label: "Zynd Android",
    href: env.zyndAndroidUrl || "/dashboard/zynd-android",
    icon: Smartphone,
    description: "Android app listing and release management",
    external: Boolean(env.zyndAndroidUrl),
    showTrailingArrow: true,
    comingSoon: !env.zyndAndroidUrl,
  },
  {
    id: "zynd-ios",
    label: "Zynd iOS",
    href: env.zyndIosUrl || "/dashboard/zynd-ios",
    icon: Smartphone,
    description: "iOS app listing and release management",
    external: Boolean(env.zyndIosUrl),
    showTrailingArrow: true,
    comingSoon: !env.zyndIosUrl,
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

export function canAccessAdminRoute(
  route: AdminNavRoute,
  hasPermission: (key: string) => boolean,
) {
  if (!route.permissions?.length) return true;
  return route.permissions.some((permission) => hasPermission(permission));
}

export function getVisibleAdminRoutes(hasPermission: (key: string) => boolean) {
  return ADMIN_NAV_ROUTES.filter((route) => canAccessAdminRoute(route, hasPermission));
}

const ADMIN_PLATFORM_LEADING_ROUTE_IDS = ["users", "mutual-funds"] as const;

const ADMIN_PLATFORM_TRAILING_ROUTE_IDS = [
  "bulk-order",
  "risk-profile",
  "distributor-head",
  "security-config",
] as const;

const ADMIN_PLATFORM_DROPDOWN_IDS = ["orders", "systematic-plans", "txn-requests"] as const;

const ADMIN_ADMINISTRATOR_ROUTE_IDS = [
  "mf-integrations",
  "settings",
  "zynd-logs",
] as const;

const ADMIN_PRODUCT_ROUTE_IDS = [
  "distributor-accounts",
  "zynd-web",
  "zynd-android",
  "zynd-ios",
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
  if (productRoutes.length > 0) {
    groups.push({ label: "Product", routes: productRoutes });
  }
  if (administratorRoutes.length > 0) {
    groups.push({ label: "Administrator", routes: administratorRoutes });
  }

  return { overview, groups };
}

export function getAdminPageTitle(pathname: string) {
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
        ? mitraSuperHeadDocumentTitle(manager.name)
        : mitraSuperHeadDocumentTitle(MITRA_HIERARCHY_COPY.branchManager);
    }
    if (section === "distributors" && entityId) {
      const distributor = getDistributorHeadDistributor(entityId);
      return distributor
        ? mitraSuperHeadDocumentTitle(distributor.name)
        : mitraSuperHeadDocumentTitle(MITRA_HIERARCHY_COPY.zyndMitra);
    }
    if (section === "queue") return mitraSuperHeadDocumentTitle("Queue");
    if (section === "state-heads") return mitraSuperHeadDocumentTitle(`${MITRA_HIERARCHY_COPY.stateHead}s`);
    if (section === "managers") return mitraSuperHeadDocumentTitle(MITRA_HIERARCHY_COPY.branchManagers);
    if (section === "distributors") return mitraSuperHeadDocumentTitle(MITRA_HIERARCHY_COPY.zyndMitras);
    if (section === "branches") return mitraSuperHeadDocumentTitle("Branches");
    if (section === "sales") return mitraSuperHeadDocumentTitle("Sales");
    return MITRA_HIERARCHY_COPY.superHead;
  }
  return route?.label ?? "Admin Console";
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  DISTRIBUTOR_SIDEBAR_CHROME_CLASS,
  DISTRIBUTOR_SIDEBAR_COLLAPSED_UI_CLASS,
  DISTRIBUTOR_SIDEBAR_HEADER_CLASS,
  DISTRIBUTOR_SIDEBAR_HEADER_COLLAPSED_CLASS,
  distributorSidebarContentTopClass,
} from "@/lib/distributor-layout";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DISTRIBUTOR_NAV_FLAT,
  DISTRIBUTOR_NAV_GROUPS,
  DISTRIBUTOR_SETTINGS_ROUTE,
  DISTRIBUTOR_WORKSPACE_ROUTES,
  getDistributorNavGroups,
  isDistributorRouteActive,
  isDistributorWorkspaceRouteActive,
  type DistributorNavItem,
} from "@/lib/distributor-navigation";
import { cn } from "@/lib/utils";
import { useDistributorAuth } from "@/contexts/distributor-auth-context";

function DistributorSidebarBrand() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Link
      href="/dashboard"
      className={cn(
        "distributor-sidebar-brand",
        collapsed ? "distributor-sidebar-brand--collapsed" : "distributor-sidebar-brand--expanded",
      )}
      aria-label="ZYND Distributor home"
    >
      <span
        className={cn(
          "distributor-sidebar-brand__logo-wrap",
          collapsed
            ? "distributor-sidebar-brand__logo-wrap--collapsed"
            : "distributor-sidebar-brand__logo-wrap--expanded",
        )}
      >
        <Image
          src="/logo.png"
          alt="ZYND"
          width={32}
          height={32}
          className={cn(
            "size-full object-contain",
            collapsed ? "object-center" : "object-left",
          )}
          priority
        />
      </span>
      {!collapsed ? (
        <span className="min-w-0 flex-1 leading-tight">
          <span className="distributor-sidebar-brand__title">ZYND</span>
          <span className="distributor-sidebar-brand__subtitle">Distributor Console</span>
        </span>
      ) : null}
    </Link>
  );
}

function DistributorSidebarNavItem({
  route,
  active,
  href,
  disabled = false,
}: {
  route: Pick<DistributorNavItem, "label" | "icon">;
  active: boolean;
  href: string;
  disabled?: boolean;
}) {
  const Icon = route.icon;

  if (disabled) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={false}
          tooltip={`${route.label} (coming soon)`}
          className="distributor-sidebar-menu-button distributor-sidebar-menu-button--disabled"
          aria-disabled
          disabled
        >
          <Icon strokeWidth={1.75} />
          <span>{route.label}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={false}
        tooltip={route.label}
        className="distributor-sidebar-menu-button"
        render={<Link href={href} aria-current={active ? "page" : undefined} />}
      >
        <Icon strokeWidth={active ? 2.25 : 1.75} />
        <span>{route.label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function DistributorDashboardSidebar() {
  const pathname = usePathname();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { isBranchManager } = useDistributorAuth();
  const navGroups = getDistributorNavGroups(isBranchManager);

  return (
    <Sidebar
      collapsible="icon"
      data-slot="distributor-sidebar"
      className={cn(DISTRIBUTOR_SIDEBAR_COLLAPSED_UI_CLASS, DISTRIBUTOR_SIDEBAR_CHROME_CLASS)}
    >
      <SidebarHeader
        className={
          collapsed ? DISTRIBUTOR_SIDEBAR_HEADER_COLLAPSED_CLASS : DISTRIBUTOR_SIDEBAR_HEADER_CLASS
        }
      >
        <DistributorSidebarBrand />
      </SidebarHeader>

      <SidebarContent
        className={cn(
          distributorSidebarContentTopClass(collapsed),
          "transition-[padding] duration-200 ease-linear",
        )}
      >
        <SidebarGroup>
          <SidebarGroupLabel
            className={cn(
              "distributor-sidebar-section-label distributor-sidebar-section-label--first group-data-[collapsible=icon]:hidden",
            )}
          >
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {DISTRIBUTOR_WORKSPACE_ROUTES.map((route) => (
                <DistributorSidebarNavItem
                  key={route.id}
                  route={route}
                  href={route.href}
                  active={isDistributorWorkspaceRouteActive(pathname, route)}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {navGroups.map((group) => (
          <SidebarGroup key={group.id}>
            <SidebarGroupLabel
              className="distributor-sidebar-section-label group-data-[collapsible=icon]:hidden"
            >
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((route) => (
                  <DistributorSidebarNavItem
                    key={route.id}
                    route={route}
                    href={route.href}
                    disabled={route.disabled}
                    active={!route.disabled && isDistributorRouteActive(pathname, route.href)}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <DistributorSidebarNavItem
            route={DISTRIBUTOR_SETTINGS_ROUTE}
            href={DISTRIBUTOR_SETTINGS_ROUTE.href}
            active={isDistributorRouteActive(pathname, DISTRIBUTOR_SETTINGS_ROUTE.href)}
          />
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

export function DistributorDashboardMobileNav() {
  const pathname = usePathname();
  const mobileRoutes = DISTRIBUTOR_NAV_FLAT.filter((route) =>
    ["dashboard", "your-clients", "orders", "systematic-plans", "txn-requests"].includes(route.id),
  );

  return (
    <nav className="distributor-mobile-nav" aria-label="Primary">
      <div className="distributor-mobile-nav__inner">
        {mobileRoutes.map((route) => {
          const Icon = route.icon;
          const active = isDistributorRouteActive(pathname, route.href);
          return (
            <Link
              key={route.id}
              href={route.href}
              className={cn(
                "distributor-mobile-nav__item",
                active && "distributor-mobile-nav__item--active",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon strokeWidth={active ? 2.25 : 1.75} />
              <span className="distributor-mobile-nav__label">{route.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

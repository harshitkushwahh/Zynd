"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  DISTRIBUTOR_SIDEBAR_CHROME_CLASS,
  DISTRIBUTOR_SIDEBAR_COLLAPSED_UI_CLASS,
} from "@/lib/distributor-layout";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  DISTRIBUTOR_NAV_FLAT,
  DISTRIBUTOR_SETTINGS_ROUTE,
  getDistributorSidebarNavItems,
  isDistributorRouteActive,
  isDistributorWorkspaceRouteActive,
  type DistributorNavItem,
} from "@/lib/distributor-navigation";
import { cn } from "@/lib/utils";
import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";
import { useDistributorAuth } from "@/contexts/distributor-auth-context";
import zynddLogo from "../../../public/zyndd.png";

function DistributorSidebarBrand() {
  return (
    <Link
      href="/dashboard"
      className="distributor-sidebar-brand distributor-sidebar-brand--logo-only"
      aria-label={ZYND_MITRA_COPY.consoleHome}
    >
      <span className="distributor-sidebar-brand__logo-wrap">
        <Image
          src={zynddLogo}
          alt="ZYND"
          width={32}
          height={32}
          className="distributor-sidebar-brand__logo"
          priority
        />
      </span>
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
  const tooltip = disabled ? `${route.label} (coming soon)` : route.label;

  if (disabled) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={false}
          tooltip={tooltip}
          className="distributor-sidebar-menu-button distributor-sidebar-menu-button--disabled"
          aria-disabled
          aria-label={route.label}
          disabled
        >
          <Icon strokeWidth={1.75} />
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        tooltip={tooltip}
        className="distributor-sidebar-menu-button"
        render={
          <Link href={href} aria-current={active ? "page" : undefined} aria-label={route.label} />
        }
      >
        <Icon strokeWidth={active ? 2.25 : 1.75} />
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function DistributorDashboardSidebar() {
  const pathname = usePathname();
  const { isBranchManager } = useDistributorAuth();
  const navItems = getDistributorSidebarNavItems(isBranchManager);

  return (
    <Sidebar
      collapsible="icon"
      variant="sidebar"
      data-slot="distributor-sidebar"
      className={cn(
        DISTRIBUTOR_SIDEBAR_COLLAPSED_UI_CLASS,
        DISTRIBUTOR_SIDEBAR_CHROME_CLASS,
        "distributor-sidebar-rail",
      )}
    >
      <SidebarHeader className="distributor-sidebar-rail__section distributor-sidebar-rail__brand">
        <DistributorSidebarBrand />
      </SidebarHeader>

      <SidebarContent className="distributor-sidebar-rail__section distributor-sidebar-rail__nav">
        <SidebarGroup className="distributor-sidebar-nav-group">
          <SidebarGroupContent>
            <SidebarMenu className="distributor-sidebar-rail__menu">
              {navItems.map((route) => (
                <DistributorSidebarNavItem
                  key={route.id}
                  route={route}
                  href={route.href}
                  disabled={route.disabled}
                  active={
                    route.disabled
                      ? false
                      : route.id === "dashboard" ||
                          route.id === "your-clients" ||
                          route.id === "your-operations"
                        ? isDistributorWorkspaceRouteActive(pathname, route)
                        : isDistributorRouteActive(pathname, route.href, route.id)
                  }
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="distributor-sidebar-rail__section distributor-sidebar-rail__footer">
        <SidebarMenu>
          <DistributorSidebarNavItem
            route={DISTRIBUTOR_SETTINGS_ROUTE}
            href={DISTRIBUTOR_SETTINGS_ROUTE.href}
            active={isDistributorRouteActive(pathname, DISTRIBUTOR_SETTINGS_ROUTE.href)}
          />
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export function DistributorDashboardMobileNav() {
  const pathname = usePathname();
  const mobileRoutes = DISTRIBUTOR_NAV_FLAT.filter((route) =>
    ["dashboard", "your-clients", "your-operations"].includes(route.id),
  );

  return (
    <nav className="distributor-mobile-nav" aria-label="Primary">
      <div className="distributor-mobile-nav__inner">
        {mobileRoutes.map((route) => {
          const Icon = route.icon;
          const active =
            route.id === "your-operations" || route.id === "your-clients"
              ? isDistributorWorkspaceRouteActive(pathname, route)
              : isDistributorRouteActive(pathname, route.href);
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

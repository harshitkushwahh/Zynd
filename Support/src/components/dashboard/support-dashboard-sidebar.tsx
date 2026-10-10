"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  SUPPORT_SIDEBAR_CHROME_CLASS,
  SUPPORT_SIDEBAR_COLLAPSED_UI_CLASS,
} from "@/lib/support-layout";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  isSupportRouteActive,
  SUPPORT_NAV_ROUTES,
  type SupportNavRoute,
} from "@/lib/support-navigation";
import { ZYND_SUPPORT_FAVICON_PNG_SRC } from "@/lib/support-brand-assets";
import { cn } from "@/lib/utils";

function SupportSidebarBrand() {
  return (
    <Link
      href="/dashboard"
      className="distributor-sidebar-brand distributor-sidebar-brand--logo-only"
      aria-label="ZYND Support home"
    >
      <span className="distributor-sidebar-brand__logo-wrap">
        <Image
          src={ZYND_SUPPORT_FAVICON_PNG_SRC}
          alt="ZYND Support"
          width={32}
          height={32}
          className="distributor-sidebar-brand__logo"
          priority
        />
      </span>
    </Link>
  );
}

function SupportSidebarNavItem({
  route,
  active,
  href,
}: {
  route: SupportNavRoute;
  active: boolean;
  href: string;
}) {
  const Icon = route.icon;
  const tooltip =
    route.badgeCount != null && route.badgeCount > 0
      ? `${route.label} (${route.badgeCount} open)`
      : route.label;

  const showBadge = route.badgeCount != null && route.badgeCount > 0;

  return (
    <SidebarMenuItem className="support-sidebar-menu-item">
      {showBadge ? (
        <span
          className="support-sidebar-menu-item__badge"
          aria-label={`${route.badgeCount} open tickets`}
        >
          {route.badgeCount! > 9 ? "9+" : route.badgeCount}
        </span>
      ) : null}
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

export function SupportDashboardSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar
      collapsible="icon"
      variant="sidebar"
      data-slot="distributor-sidebar"
      className={cn(
        SUPPORT_SIDEBAR_COLLAPSED_UI_CLASS,
        SUPPORT_SIDEBAR_CHROME_CLASS,
        "distributor-sidebar-rail",
      )}
    >
      <SidebarHeader className="distributor-sidebar-rail__section distributor-sidebar-rail__brand">
        <SupportSidebarBrand />
      </SidebarHeader>

      <SidebarContent className="distributor-sidebar-rail__section distributor-sidebar-rail__nav">
        <SidebarGroup className="distributor-sidebar-nav-group">
          <SidebarGroupContent>
            <SidebarMenu className="distributor-sidebar-rail__menu">
              {SUPPORT_NAV_ROUTES.map((route) => (
                <SupportSidebarNavItem
                  key={route.id}
                  route={route}
                  href={route.href}
                  active={isSupportRouteActive(pathname, route.href)}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

export function SupportDashboardMobileNav() {
  const pathname = usePathname();

  return (
    <nav className="distributor-mobile-nav" aria-label="Primary">
      <div className="distributor-mobile-nav__inner">
        {SUPPORT_NAV_ROUTES.map((route) => {
          const Icon = route.icon;
          const active = isSupportRouteActive(pathname, route.href);
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

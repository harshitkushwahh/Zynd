"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, RefreshCw, Settings, ShieldCheck, UserRound, Bell } from "lucide-react";

import {
  DASHBOARD_HEADER_CLASS,
  DASHBOARD_NAV_CLUSTER_CLASS,
  DASHBOARD_SIDEBAR_SECTION_GAP,
  DASHBOARD_SIDEBAR_WIDTH,
} from "@/components/dashboard/dashboard-layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/auth-context";
import { useSettingsNavigationOptional } from "@/contexts/settings-navigation-context";
import { useKycOptional } from "@/contexts/kyc-context";
import { useProfileImage } from "@/contexts/profile-image-context";
import { KycStatusRing } from "@/features/kyc/components/kyc-status-ring";
import {
  DASHBOARD_ROUTES,
  isDashboardRouteActive,
  NOTIFICATIONS_PAGE_META,
  type DashboardRoute,
} from "@/features/dashboard/navigation/dashboard-routes";
import {
  formatProfileMenuShortcut,
  PROFILE_MENU_SHORTCUTS,
} from "@/features/dashboard/navigation/profile-menu-shortcuts";
import { useProfileMenuActions } from "@/features/dashboard/navigation/use-profile-menu-actions";
import { PROFILE_SETTINGS_SECTIONS } from "@/components/dashboard/settings/settings-sidebar";
import { APP_NAME } from "@/shared/config/brand";
import { uiClasses } from "@/shared/config/ui-classes";
import { getUserInitials } from "@/shared/utils/user-display";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

function navButtonClass(active: boolean, compact = false) {
  return cn(
    "flex items-center justify-center rounded-full outline-none",
    compact ? "size-9" : "size-10",
    active
      ? "bg-foreground text-background"
      : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );
}

/** Above page content for hover-expanding pills; below dialog overlay (z-50). */
const SIDEBAR_NAV_ITEM_Z = "z-30";

function sidebarNavPillClass(active: boolean, disabled = false) {
  return cn(
    "group relative flex h-9 max-w-9 shrink-0 items-center overflow-hidden rounded-full outline-none",
    "transition-[max-width,background-color,color,box-shadow] duration-200 ease-out",
    "hover:max-w-56 focus-visible:max-w-56",
    SIDEBAR_NAV_ITEM_Z,
    disabled
      ? "cursor-not-allowed text-muted-foreground/60 hover:bg-[var(--zynd-white)] hover:text-muted-foreground hover:shadow-zynd-low dark:hover:bg-transparent dark:hover:shadow-none"
      : active
        ? "bg-[var(--zynd-neutral-900)] text-[var(--zynd-white)] shadow-zynd-low dark:bg-[var(--zynd-white)] dark:text-[var(--zynd-neutral-900)]"
        : cn(
            "text-muted-foreground hover:bg-[var(--zynd-white)] hover:text-[var(--zynd-neutral-900)] hover:shadow-zynd-low",
            "dark:bg-transparent dark:text-muted-foreground dark:hover:bg-background dark:hover:text-foreground dark:hover:shadow-zynd-low",
          ),
  );
}

function SidebarNavItemLabel({ label }: { label: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "min-w-0 overflow-hidden whitespace-nowrap pr-3 text-caption font-medium",
        "max-w-0 opacity-0 transition-[max-width,opacity] duration-200 ease-out",
        "group-hover:max-w-48 group-hover:opacity-100 group-focus-visible:max-w-48 group-focus-visible:opacity-100",
      )}
    >
      {label}
    </span>
  );
}

const SIDEBAR_NAV_ICON_OFFSET_CLASS = "absolute left-1/2 top-0 -translate-x-[1.125rem]";

function SidebarNavItem({
  item,
  active,
}: {
  item: DashboardRoute;
  active: boolean;
}) {
  const Icon = item.icon;
  const icon = <Icon className="size-[18px]" strokeWidth={active ? 2.25 : 2} />;

  if (item.disabled) {
    return (
      <div className="relative h-9 w-full overflow-visible">
        <span
          aria-disabled="true"
          className={cn(sidebarNavPillClass(false, true), SIDEBAR_NAV_ICON_OFFSET_CLASS)}
          aria-label={item.label}
        >
          <span className="flex size-9 shrink-0 items-center justify-center">{icon}</span>
          <SidebarNavItemLabel label={item.label} />
        </span>
      </div>
    );
  }

  return (
    <div className="relative h-9 w-full overflow-visible">
      <Link
        href={item.href}
        scroll={false}
        aria-current={active ? "page" : undefined}
        className={cn(sidebarNavPillClass(active), SIDEBAR_NAV_ICON_OFFSET_CLASS)}
        aria-label={item.label}
      >
        <span className="flex size-9 shrink-0 items-center justify-center">{icon}</span>
        <SidebarNavItemLabel label={item.label} />
      </Link>
    </div>
  );
}

function MobileNavItem({
  item,
  active,
}: {
  item: DashboardRoute;
  active: boolean;
}) {
  const Icon = item.icon;

  if (item.disabled) {
    return (
      <span
        aria-disabled="true"
        className={cn(navButtonClass(false), "cursor-not-allowed opacity-50")}
        aria-label={item.label}
      >
        <Icon className="size-[18px]" strokeWidth={2} />
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={navButtonClass(active)}
      aria-label={item.label}
    >
      <Icon className="size-[18px]" strokeWidth={active ? 2.25 : 2} />
    </Link>
  );
}

function profileMenuItemClass(active: boolean) {
  return cn(
    active &&
      "bg-primary/10 text-primary focus:bg-primary/10 focus:text-primary data-highlighted:bg-primary/10 data-highlighted:text-primary [&_svg]:text-primary",
  );
}

function ProfileAvatar({
  withMenu,
  menuSide = "right",
  menuAlign = "end",
  compact = false,
  className,
}: {
  withMenu?: boolean;
  menuSide?: "top" | "right" | "bottom" | "left";
  menuAlign?: "start" | "center" | "end";
  compact?: boolean;
  className?: string;
}) {
  const pathname = usePathname();
  const settingsNavigation = useSettingsNavigationOptional();
  const { user, displayName } = useAuth();
  const { profileUrl } = useProfileImage();
  const kyc = useKycOptional();
  const {
    checkingKraStatus,
    openProfile,
    openSettings,
    openNotifications,
    openKyc,
    checkKycStatus,
    signOutAndRedirect,
  } = useProfileMenuActions();
  const initials = getUserInitials(user?.first_name, user?.email);
  const profileLabel = displayName || user?.email || "Profile";
  const kycRingTone = kyc?.showRing && kyc.ringTone ? kyc.ringTone : null;
  const showWatchBadge = Boolean(kycRingTone && kyc?.status !== "complete");
  const showCheckKycStatus = Boolean(kyc?.overallStatus === "submitted" && kyc.kycAllowed);
  const kycComplete = kyc?.status === "complete";
  const kycMenuLabel = kycComplete ? copy.kyc.completeTitle : copy.kyc.menuLabel;

  const isSettingsPage = pathname === "/dashboard/settings";
  const isNotificationsPage = pathname.startsWith("/dashboard/notifications");
  const activeSettingsSection = settingsNavigation?.activeSection;
  const isProfileActive =
    isSettingsPage &&
    activeSettingsSection != null &&
    PROFILE_SETTINGS_SECTIONS.includes(activeSettingsSection);
  const isSecuritySettingsActive =
    isSettingsPage &&
    activeSettingsSection != null &&
    !PROFILE_SETTINGS_SECTIONS.includes(activeSettingsSection);

  const profileAvatar = (
    <Avatar className={compact ? "size-9" : "size-11"}>
      {profileUrl ? (
        <AvatarImage src={profileUrl} alt={profileLabel} />
      ) : null}
      <AvatarFallback className="bg-primary/10 text-caption font-semibold text-primary">
        {initials}
      </AvatarFallback>
    </Avatar>
  );

  const avatar = kycRingTone ? (
    <KycStatusRing tone={kycRingTone} showWatch={showWatchBadge} size={compact ? "compact" : "default"}>
      {profileAvatar}
    </KycStatusRing>
  ) : (
    profileAvatar
  );

  if (!withMenu) {
    return (
      <button type="button" aria-label={profileLabel} className={cn("rounded-full", className)}>
        {avatar}
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={profileLabel}
        className={cn("rounded-full outline-none ring-0 focus-visible:ring-0", className)}
        render={<button type="button" className="rounded-full outline-none ring-0 focus-visible:ring-0" />}
      >
        {avatar}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={menuSide}
        align={menuAlign}
        sideOffset={menuSide === "top" ? 8 : 12}
        className="w-56 p-2"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-1.5 font-normal">
            <div className="flex items-center gap-2.5">
              <Avatar className="size-8">
                {profileUrl ? <AvatarImage src={profileUrl} alt={profileLabel} /> : null}
                <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-caption font-semibold text-foreground">
                  {displayName || "Account"}
                </p>
                {user?.email ? (
                  <p className="truncate text-[11px] leading-tight text-muted-foreground">
                    {user.email}
                  </p>
                ) : null}
              </div>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            className={profileMenuItemClass(isProfileActive)}
            onClick={openProfile}
          >
            <UserRound />
            Profile
            <DropdownMenuShortcut>
              {formatProfileMenuShortcut(PROFILE_MENU_SHORTCUTS.profile)}
            </DropdownMenuShortcut>
          </DropdownMenuItem>
          {showCheckKycStatus ? (
            <DropdownMenuItem disabled={checkingKraStatus} onClick={() => void checkKycStatus()}>
              <RefreshCw className={cn(checkingKraStatus && "animate-spin")} />
              {checkingKraStatus ? copy.kyc.checkStatusChecking : copy.kyc.checkStatusAction}
              <DropdownMenuShortcut>
                {formatProfileMenuShortcut(PROFILE_MENU_SHORTCUTS.checkKycStatus)}
              </DropdownMenuShortcut>
            </DropdownMenuItem>
          ) : null}
          {kyc?.showKycMenu ? (
            <DropdownMenuItem
              disabled={!kyc.kycAllowed}
              title={!kyc.kycAllowed ? copy.kyc.entryGate.menuDisabledHint : undefined}
              onClick={openKyc}
            >
              <ShieldCheck className={cn(kycComplete && "text-success")} />
              {kycMenuLabel}
              {kyc.kycAllowed && !kycComplete ? (
                <DropdownMenuShortcut>
                  {formatProfileMenuShortcut(PROFILE_MENU_SHORTCUTS.kyc)}
                </DropdownMenuShortcut>
              ) : null}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            className={profileMenuItemClass(isSecuritySettingsActive)}
            onClick={openSettings}
          >
            <Settings />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem
            className={profileMenuItemClass(isNotificationsPage)}
            onClick={openNotifications}
          >
            <Bell />
            {NOTIFICATIONS_PAGE_META.title}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem variant="destructive" onClick={() => void signOutAndRedirect()}>
            <LogOut />
            Sign Out
            <DropdownMenuShortcut>
              {formatProfileMenuShortcut(PROFILE_MENU_SHORTCUTS.signOut)}
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function DashboardSidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const navRoutes = DASHBOARD_ROUTES.filter((route) => route.enabled);

  return (
    <aside
      className={cn(
        "relative isolate flex h-full shrink-0 flex-col overflow-visible",
        SIDEBAR_NAV_ITEM_Z,
        DASHBOARD_SIDEBAR_WIDTH,
        DASHBOARD_SIDEBAR_SECTION_GAP,
        className
      )}
    >
      <div className={cn(DASHBOARD_HEADER_CLASS, "justify-center")}>
        <Link href="/dashboard" className={cn(DASHBOARD_NAV_CLUSTER_CLASS, "w-full justify-center")}>
          <Image
            src="/logo.png"
            alt={APP_NAME}
            width={40}
            height={40}
            className="size-10 shrink-0 rounded-full object-cover"
            priority
          />
        </Link>
      </div>

      <div className="flex min-h-0 w-full flex-1 flex-col items-stretch justify-between">
        <nav
          className={cn(
            "relative flex w-full shrink-0 flex-col items-center gap-1 overflow-visible",
            uiClasses.navSurfaceSidebar,
          )}
        >
          {navRoutes.map((item) => (
            <SidebarNavItem
              key={item.id}
              item={item}
              active={isDashboardRouteActive(pathname, item)}
            />
          ))}
        </nav>

        <ProfileAvatar withMenu compact className="self-center pb-1" />
      </div>
    </aside>
  );
}

export function DashboardMobileNav() {
  const pathname = usePathname();
  const navRoutes = DASHBOARD_ROUTES.filter((route) => route.enabled);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-[var(--blur-sm)] md:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-2">
        {navRoutes.map((item) => (
          <MobileNavItem
            key={item.id}
            item={item}
            active={isDashboardRouteActive(pathname, item)}
          />
        ))}
        <ProfileAvatar withMenu menuSide="top" menuAlign="end" />
      </div>
    </nav>
  );
}

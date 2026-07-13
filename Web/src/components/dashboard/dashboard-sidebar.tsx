"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, RefreshCw, Settings, ShieldCheck, UserRound } from "lucide-react";

import {
  DASHBOARD_HEADER_CLASS,
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/auth-context";
import { useSettingsNavigationOptional } from "@/contexts/settings-navigation-context";
import { useKycOptional } from "@/contexts/kyc-context";
import { useProfileImage } from "@/contexts/profile-image-context";
import { KycStatusRing } from "@/features/kyc/components/kyc-status-ring";
import {
  DASHBOARD_ROUTES,
  isDashboardRouteActive,
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

function SidebarNavItem({
  item,
  active,
}: {
  item: DashboardRoute;
  active: boolean;
}) {
  const Icon = item.icon;
  const icon = <Icon className="size-[18px]" strokeWidth={active ? 2.25 : 2} />;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            href={item.href}
            scroll={false}
            aria-current={active ? "page" : undefined}
            className={navButtonClass(active, true)}
            aria-label={item.label}
          />
        }
      >
        {icon}
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {item.label}
      </TooltipContent>
    </Tooltip>
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
    openKyc,
    checkKycStatus,
    signOutAndRedirect,
  } = useProfileMenuActions();
  const initials = getUserInitials(user?.first_name, user?.email);
  const profileLabel = displayName || user?.email || "Profile";
  const showKycRing = Boolean(kyc?.showRing && kyc.ringTone);
  const showWatchBadge = showKycRing && kyc?.status !== "complete";
  const showCheckKycStatus = Boolean(kyc?.overallStatus === "submitted" && kyc.kycAllowed);

  const isSettingsPage = pathname === "/dashboard/settings";
  const activeSettingsSection = settingsNavigation?.activeSection;
  const isProfileActive =
    isSettingsPage &&
    activeSettingsSection != null &&
    PROFILE_SETTINGS_SECTIONS.includes(activeSettingsSection);
  const isSecuritySettingsActive =
    isSettingsPage &&
    activeSettingsSection != null &&
    !PROFILE_SETTINGS_SECTIONS.includes(activeSettingsSection);

  const avatar = (
    <KycStatusRing tone={showKycRing ? kyc!.ringTone : null} showWatch={showWatchBadge}>
      <Avatar className={compact ? "size-9" : "size-11"}>
        {profileUrl ? (
          <AvatarImage src={profileUrl} alt={profileLabel} />
        ) : null}
        <AvatarFallback className="bg-primary/10 text-caption font-semibold text-primary">
          {initials}
        </AvatarFallback>
      </Avatar>
    </KycStatusRing>
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
              <KycStatusRing tone={showKycRing ? kyc!.ringTone : null} showWatch={showWatchBadge}>
                <Avatar className="size-8">
                  {profileUrl ? <AvatarImage src={profileUrl} alt={profileLabel} /> : null}
                  <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </KycStatusRing>
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
              <ShieldCheck />
              {copy.kyc.menuLabel}
              {kyc.kycAllowed ? (
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
        "relative z-10 flex h-full shrink-0 flex-col",
        DASHBOARD_SIDEBAR_WIDTH,
        DASHBOARD_SIDEBAR_SECTION_GAP,
        className
      )}
    >
      <div className={cn(DASHBOARD_HEADER_CLASS, "justify-center")}>
        <Link href="/dashboard" className={uiClasses.navLogoLink}>
          <Image
            src="/logo.png"
            alt={APP_NAME}
            width={36}
            height={36}
            className="size-9 rounded-full object-cover"
            priority
          />
        </Link>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-between">
        <nav className={cn("flex shrink-0 flex-col items-center gap-1", uiClasses.navSurfaceSidebar)}>
          {navRoutes.map((item) => (
            <SidebarNavItem
              key={item.id}
              item={item}
              active={isDashboardRouteActive(pathname, item)}
            />
          ))}
        </nav>

        <ProfileAvatar withMenu compact className="pb-1" />
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

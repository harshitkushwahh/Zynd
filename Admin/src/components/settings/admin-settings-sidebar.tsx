"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import { userInitials } from "@/lib/admin-capabilities";
import {
  ADMIN_SETTINGS_GROUPS,
  getVisibleSettingsNav,
  isSettingsSectionActive,
  settingsSectionHref,
  type AdminSettingsNavItem,
} from "@/lib/admin-settings-navigation";
import { cn } from "@/lib/utils";

export function AdminSettingsSidebar() {
  const pathname = usePathname();
  const { displayName, user, hasPermission } = useAdminAuth();
  const visibleNav = getVisibleSettingsNav(hasPermission);

  const grouped = ADMIN_SETTINGS_GROUPS.map((group) => ({
    ...group,
    items: visibleNav.filter((item) => item.group === group.id),
  })).filter((group) => group.items.length > 0);

  if (!user) return null;

  return (
    <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-card md:w-72">
      <div className="shrink-0 border-b border-border px-5 py-6 text-center">
        <Avatar className="mx-auto size-[4.5rem]">
          <AvatarFallback className="bg-primary/10 text-h3 font-semibold text-primary">
            {userInitials(user.email)}
          </AvatarFallback>
        </Avatar>
        <p className="mt-3.5 truncate text-body font-semibold text-foreground">{displayName}</p>
        <p className="truncate text-caption text-muted-foreground">{user.email}</p>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {grouped.map((group) => (
          <div key={group.id} className="space-y-1">
            <p className="px-3.5 pb-1 text-tiny font-semibold uppercase tracking-wide text-muted-foreground">
              {group.label}
            </p>
            {group.items.map((item) => (
              <SettingsNavButton
                key={item.id}
                item={item}
                active={isSettingsSectionActive(pathname, item.id)}
              />
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}

function SettingsNavButton({ item, active }: { item: AdminSettingsNavItem; active: boolean }) {
  const Icon = item.icon;

  return (
    <Link
      href={settingsSectionHref(item.id)}
      className={cn(
        "flex items-center gap-3 rounded-[var(--radius-control)] px-3.5 py-3 text-left text-compact font-medium transition-colors",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="size-[1.125rem] shrink-0" />
      {item.label}
    </Link>
  );
}

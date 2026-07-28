"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useDistributorAuth } from "@/contexts/distributor-auth-context";
import {
  DISTRIBUTOR_SETTINGS_NAV,
  distributorSettingsSectionHref,
  isDistributorSettingsSectionActive,
  type DistributorSettingsNavItem,
} from "@/lib/distributor-settings-navigation";
import { cn } from "@/lib/utils";

export function DistributorSettingsSidebar() {
  const pathname = usePathname();
  const { user, displayName } = useDistributorAuth();

  if (!user) return null;

  return (
    <aside className="distributor-settings-sidebar">
      <div className="distributor-settings-sidebar__profile">
        <Avatar className={cn("mx-auto distributor-settings-avatar")}>
          <AvatarFallback className="bg-primary/10 text-h3 font-semibold text-primary">
            {user.initials}
          </AvatarFallback>
        </Avatar>
        <p className="distributor-settings-sidebar__profile-name">{displayName}</p>
        <p className="truncate text-caption text-muted-foreground">{user.email}</p>
      </div>

      <nav className="distributor-settings-sidebar__nav">
        {DISTRIBUTOR_SETTINGS_NAV.map((item) => (
          <SettingsNavButton
            key={item.id}
            item={item}
            active={isDistributorSettingsSectionActive(pathname, item.id)}
          />
        ))}
      </nav>
    </aside>
  );
}

function SettingsNavButton({
  item,
  active,
}: {
  item: DistributorSettingsNavItem;
  active: boolean;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={distributorSettingsSectionHref(item.id)}
      className="distributor-settings-nav-item"
      aria-current={active ? "page" : undefined}
    >
      <Icon />
      {item.label}
    </Link>
  );
}

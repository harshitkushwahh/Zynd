"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import { DistributorProfileAvatar } from "@/components/ui/distributor-profile-avatar";
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
  const router = useRouter();
  const { user, displayName, signOut } = useDistributorAuth();

  if (!user) return null;

  const handleSignOut = () => {
    void signOut().finally(() => {
      router.replace("/");
    });
  };

  return (
    <aside className="distributor-settings-sidebar">
      <div className="distributor-settings-sidebar__profile">
        <DistributorProfileAvatar
          name={displayName}
          imageSrc={user.avatarUrl}
          className={cn("mx-auto distributor-settings-avatar")}
        />
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

      <div className="distributor-settings-sidebar__footer">
        <DistributorActionButton
          type="button"
          variant="destructive"
          className="distributor-settings-sidebar__logout w-full gap-2"
          onClick={handleSignOut}
        >
          <LogOut className="size-4 shrink-0" strokeWidth={2.25} aria-hidden />
          Log out
        </DistributorActionButton>
      </div>
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

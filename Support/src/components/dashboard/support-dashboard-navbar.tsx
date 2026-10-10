"use client";

import { SupportAccountMenu } from "@/components/dashboard/support-account-menu";
import { SupportNotificationPopover } from "@/components/dashboard/support-notification-popover";
import { SearchConsoleTrigger } from "@/components/dashboard/search-console-trigger";
import {
  SUPPORT_NAVBAR_INNER_CLASS,
  SUPPORT_NAVBAR_OUTER_CLASS,
} from "@/lib/support-layout";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function SupportDashboardNavbar({ className }: { className?: string }) {
  return (
    <header className={cn(SUPPORT_NAVBAR_OUTER_CLASS, className)}>
      <div className={SUPPORT_NAVBAR_INNER_CLASS}>
        <div className="flex min-w-0 items-center gap-3">
          <SearchConsoleTrigger onOpen={() => {}} variant="leading" />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <SupportNotificationPopover />
          <ThemeToggle variant="distributor" />
          <SupportAccountMenu />
        </div>
      </div>
    </header>
  );
}

"use client";

import { useEffect, useState } from "react";

import { DistributorAccountMenu } from "@/components/dashboard/distributor-account-menu";
import { DistributorDashboardSearchDialog } from "@/components/dashboard/distributor-dashboard-search-dialog";
import { DistributorBranchBadge } from "@/components/dashboard/distributor-branch-badge";
import { DistributorDashboardTransactionActions } from "@/components/dashboard/distributor-dashboard-transaction-actions";
import { DistributorNotificationPopover } from "@/components/dashboard/distributor-notification-popover";
import { SearchConsoleTrigger } from "@/components/dashboard/search-console-trigger";
import {
  DISTRIBUTOR_NAVBAR_INNER_CLASS,
  DISTRIBUTOR_NAVBAR_OUTER_CLASS,
} from "@/lib/distributor-layout";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function DistributorDashboardNavbar({ className }: { className?: string }) {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key;
      if (!key || key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey)) {
        return;
      }
      event.preventDefault();
      setSearchOpen((open) => !open);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const openSearch = () => setSearchOpen(true);

  return (
    <>
      <header className={cn(DISTRIBUTOR_NAVBAR_OUTER_CLASS, className)}>
        <div className={DISTRIBUTOR_NAVBAR_INNER_CLASS}>
          <div className="flex min-w-0 items-center gap-3">
            <SearchConsoleTrigger onOpen={openSearch} variant="leading" />
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <DistributorBranchBadge className="hidden sm:flex" />
            <DistributorDashboardTransactionActions />
            <DistributorNotificationPopover />
            <ThemeToggle variant="distributor" />
            <DistributorAccountMenu />
          </div>
        </div>
      </header>

      <DistributorDashboardSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}

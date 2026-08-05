"use client";

import { cn } from "@/lib/utils";
import {
  DISTRIBUTOR_NOTIFICATION_FILTER_TAB_ACTIVE_CLASS,
  DISTRIBUTOR_NOTIFICATION_FILTER_TAB_CLASS,
  DISTRIBUTOR_NOTIFICATION_FILTER_TABS_CLASS,
} from "@/lib/distributor-layout";

export type DistributorNotificationFilter = "all" | "unread";

type DistributorNotificationFilterTabsProps = {
  filter: DistributorNotificationFilter;
  onFilterChange: (filter: DistributorNotificationFilter) => void;
  className?: string;
};

export function DistributorNotificationFilterTabs({
  filter,
  onFilterChange,
  className,
}: DistributorNotificationFilterTabsProps) {
  return (
    <div className={cn(DISTRIBUTOR_NOTIFICATION_FILTER_TABS_CLASS, className)}>
      {(["all", "unread"] as const).map((value) => {
        const active = filter === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onFilterChange(value)}
            className={
              active ? DISTRIBUTOR_NOTIFICATION_FILTER_TAB_ACTIVE_CLASS : DISTRIBUTOR_NOTIFICATION_FILTER_TAB_CLASS
            }
          >
            {value === "all" ? "All" : "Unread"}
          </button>
        );
      })}
    </div>
  );
}

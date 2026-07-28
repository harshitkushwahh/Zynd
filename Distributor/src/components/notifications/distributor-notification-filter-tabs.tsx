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
  allCount: number;
  unreadCount: number;
  className?: string;
};

export function DistributorNotificationFilterTabs({
  filter,
  onFilterChange,
  allCount,
  unreadCount,
  className,
}: DistributorNotificationFilterTabsProps) {
  return (
    <div className={cn(DISTRIBUTOR_NOTIFICATION_FILTER_TABS_CLASS, className)}>
      {(["all", "unread"] as const).map((value) => {
        const active = filter === value;
        const count = value === "unread" ? unreadCount : allCount;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onFilterChange(value)}
            className={active ? DISTRIBUTOR_NOTIFICATION_FILTER_TAB_ACTIVE_CLASS : DISTRIBUTOR_NOTIFICATION_FILTER_TAB_CLASS}
          >
            {value === "all" ? "All" : "Unread"}
            <span className="distributor-notification-filter-tab__count">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

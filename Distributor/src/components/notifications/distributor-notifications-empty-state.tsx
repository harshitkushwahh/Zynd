"use client";

import type { LucideIcon } from "lucide-react";
import { Bell, BellOff } from "lucide-react";

import { Card } from "@/components/ui/card";
import type { DistributorNotificationFilter } from "@/components/notifications/distributor-notification-filter-tabs";
import { cn } from "@/lib/utils";

type DistributorNotificationsEmptyStateProps = {
  filter: DistributorNotificationFilter;
  className?: string;
  compact?: boolean;
};

const EMPTY_COPY: Record<
  DistributorNotificationFilter,
  { title: string; description: string; icon: LucideIcon }
> = {
  unread: {
    title: "No unread notifications",
    description: "You're all caught up — nothing needs your attention right now.",
    icon: BellOff,
  },
  all: {
    title: "No notifications yet",
    description: "Commission, compliance, leads, and payroll updates for your role will appear here.",
    icon: Bell,
  },
};

export function DistributorNotificationsEmptyState({
  filter,
  className,
  compact = false,
}: DistributorNotificationsEmptyStateProps) {
  const copy = EMPTY_COPY[filter];
  const Icon = copy.icon;

  return (
    <Card
      className={cn(
        "distributor-notifications-empty-card border-border bg-muted/20 shadow-none",
        compact && "distributor-notifications-empty-card--compact",
        className,
      )}
    >
      <div className="distributor-notifications-empty-card__body">
        <span className="distributor-notifications-empty-card__icon" aria-hidden>
          <Icon className="size-5" strokeWidth={1.75} />
        </span>
        <div className="distributor-notifications-empty-card__copy">
          <p className="distributor-notifications-empty-card__title">{copy.title}</p>
          <p className="distributor-notifications-empty-card__description">{copy.description}</p>
        </div>
      </div>
    </Card>
  );
}

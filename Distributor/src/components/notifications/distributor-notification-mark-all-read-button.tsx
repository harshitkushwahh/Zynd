"use client";

import { CheckCheck } from "lucide-react";

import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import { cn } from "@/lib/utils";

type DistributorNotificationMarkAllReadButtonProps = {
  unreadCount: number;
  onClick: () => void;
  className?: string;
};

export function DistributorNotificationMarkAllReadButton({
  unreadCount,
  onClick,
  className,
}: DistributorNotificationMarkAllReadButtonProps) {
  if (unreadCount <= 0) {
    return null;
  }

  const badgeLabel = unreadCount > 9 ? "9+" : String(unreadCount);

  return (
    <DistributorActionButton
      type="button"
      variant="outline"
      size="sm"
      className={cn("distributor-notification-mark-all-read relative shrink-0 gap-1.5", className)}
      onClick={onClick}
      aria-label={`Mark all read, ${unreadCount} unread`}
    >
      <CheckCheck className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
      Mark all read
      <span className="distributor-notification-mark-all-read__badge" aria-hidden>
        {badgeLabel}
      </span>
    </DistributorActionButton>
  );
}

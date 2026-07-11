"use client";

import { BellOff } from "lucide-react";

import { cn } from "@/lib/utils";

type NotificationUnreadEmptyStateProps = {
  className?: string;
};

export function NotificationUnreadEmptyState({ className }: NotificationUnreadEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-16 text-center",
        className,
      )}
    >
      <div className="flex size-14 items-center justify-center rounded-full bg-muted/80 ring-1 ring-border/60">
        <BellOff className="size-6 text-muted-foreground" strokeWidth={1.75} />
      </div>

      <div className="mt-4 max-w-[16rem] space-y-1.5">
        <p className="text-compact font-semibold text-foreground">No unread notifications</p>
        <p className="text-caption leading-relaxed text-muted-foreground">
          Switch to All to browse your notification history.
        </p>
      </div>
    </div>
  );
}

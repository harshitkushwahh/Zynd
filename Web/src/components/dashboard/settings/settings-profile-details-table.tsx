import type { ReactNode } from "react";

import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

export function SettingsProfileDetailsTable({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("divide-y divide-border/50", className)}>{children}</div>;
}

type SettingsProfileDetailsRowProps = {
  label: string;
  value?: ReactNode;
  verifiedBadge?: boolean;
  mono?: boolean;
  multiline?: boolean;
  className?: string;
};

export function SettingsProfileDetailsRow({
  label,
  value,
  verifiedBadge,
  mono,
  multiline,
  className,
}: SettingsProfileDetailsRowProps) {
  const resolvedValue =
    typeof value === "string" ? value || "Not provided" : value ?? "Not provided";

  return (
    <div
      className={cn(
        "grid gap-1.5 py-3 sm:grid-cols-[minmax(10rem,12rem)_minmax(0,1fr)] sm:items-start sm:gap-x-5 sm:py-3.5",
        className,
      )}
    >
      <span className="min-w-0 text-compact text-muted-foreground">{label}</span>
      <div
        className={cn(
          "min-w-0 sm:text-right",
          multiline && "sm:text-left",
        )}
      >
        {verifiedBadge ? (
          <StatusBadge variant="success" className="h-5 px-2 text-[10px] sm:ml-auto">
            Verified
          </StatusBadge>
        ) : (
          <span
            className={cn(
              "text-body font-medium leading-snug text-foreground",
              mono && "font-mono text-compact uppercase tracking-[0.08em]",
              multiline && "whitespace-pre-line text-left leading-relaxed",
            )}
          >
            {resolvedValue}
          </span>
        )}
      </div>
    </div>
  );
}

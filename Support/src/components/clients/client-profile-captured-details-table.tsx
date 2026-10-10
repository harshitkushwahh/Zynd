"use client";

import { StatusBadge } from "@/components/ui/status-badge";
import type { SupportClientCapturedDetailRow } from "@/lib/support-client-captured-profile-model";
import { cn } from "@/lib/utils";

type ClientProfileCapturedDetailsTableProps = {
  rows: SupportClientCapturedDetailRow[];
  className?: string;
};

export function ClientProfileCapturedDetailsTable({
  rows,
  className,
}: ClientProfileCapturedDetailsTableProps) {
  return (
    <div className={cn("support-client-profile-captured-details", className)}>
      {rows.map((row) => (
        <div key={row.id} className="support-client-profile-captured-details__row">
          <span className="support-client-profile-captured-details__label">{row.label}</span>
          <div className="support-client-profile-captured-details__value-cell">
            {row.verified ? (
              <StatusBadge variant="success" className="h-5 px-2 text-[10px] sm:ml-auto">
                Verified
              </StatusBadge>
            ) : (
              <span
                className={cn(
                  "support-client-profile-captured-details__value",
                  row.mono && "support-client-profile-captured-details__value--mono",
                  row.multiline && "support-client-profile-captured-details__value--multiline",
                )}
              >
                {row.value || "Not captured"}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

import type { ReactNode } from "react";

import { TableCard, TableEmptyState } from "@/components/application/table";
import { cn } from "@/lib/utils";

export type DistributorTableCardShellProps = {
  /** Filter row rendered inside the card (above the table). */
  toolbar?: ReactNode;
  isEmpty: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  tableSize?: "sm" | "md";
  className?: string;
  children: ReactNode;
};

/**
 * Single wrapper for distributor data tables: card chrome, optional toolbar, empty state, and card-style rows.
 */
export function DistributorTableCardShell({
  toolbar,
  isEmpty,
  emptyTitle = "Nothing to show",
  emptyDescription,
  tableSize = "sm",
  className,
  children,
}: DistributorTableCardShellProps) {
  return (
    <div className={cn("distributor-table-card-shell flex w-full min-w-0 flex-col gap-3", className)}>
      {toolbar ? (
        <div className="distributor-table-card-shell__toolbar-region">{toolbar}</div>
      ) : null}
      <TableCard.Root size={tableSize} variant="card-rows" className="w-full min-w-0">
        {isEmpty ? (
          <TableEmptyState title={emptyTitle} description={emptyDescription} />
        ) : (
          children
        )}
      </TableCard.Root>
    </div>
  );
}

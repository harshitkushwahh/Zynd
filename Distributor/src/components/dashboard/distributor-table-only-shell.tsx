import type { ReactNode } from "react";

import { TableCard, TableEmptyState } from "@/components/application/table";

type DistributorTableOnlyShellProps = {
  toolbar?: ReactNode;
  isEmpty: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  tableSize?: "sm" | "md";
  children: ReactNode;
};

export function DistributorTableOnlyShell({
  toolbar,
  isEmpty,
  emptyTitle = "Nothing to show",
  emptyDescription,
  tableSize = "sm",
  children,
}: DistributorTableOnlyShellProps) {
  return (
    <div className="min-w-0 space-y-4">
      {toolbar}
      <TableCard.Root size={tableSize}>
        {isEmpty ? (
          <TableEmptyState title={emptyTitle} description={emptyDescription} />
        ) : (
          children
        )}
      </TableCard.Root>
    </div>
  );
}

"use client";

import type { ReactNode } from "react";

import { TableCard, TableEmptyState } from "@/components/application/table";
import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import { resolveDistributorPageIcon } from "@/components/dashboard/distributor-page-icons";
import type { DistributorPageIconName } from "@/components/dashboard/distributor-page-icons";
import { DISTRIBUTOR_PAGE_STACK_CLASS } from "@/lib/distributor-layout";

type DistributorPageShellProps = {
  iconName: DistributorPageIconName;
  title: string;
  description: string;
  metrics?: ReactNode;
  toolbar?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  isEmpty: boolean;
  tableSize?: "sm" | "md";
  children: ReactNode;
};

export function DistributorPageShell({
  iconName,
  title,
  description,
  metrics,
  toolbar,
  emptyTitle = "Nothing to show",
  emptyDescription,
  isEmpty,
  tableSize = "sm",
  children,
}: DistributorPageShellProps) {
  const Icon = resolveDistributorPageIcon(iconName);

  return (
    <div className={DISTRIBUTOR_PAGE_STACK_CLASS}>
      <DistributorPageHeader icon={Icon} title={title} description={description} />
      {metrics}
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

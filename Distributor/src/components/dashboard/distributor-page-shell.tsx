"use client";

import type { ReactNode } from "react";

import { DistributorTableCardShell } from "@/components/dashboard/distributor-table-card-shell";
import { DistributorPageHeader } from "@/components/dashboard/distributor-page-header";
import { DISTRIBUTOR_PAGE_STACK_CLASS } from "@/lib/distributor-layout";
import { cn } from "@/lib/utils";

type DistributorPageShellProps = {
  title: string;
  description?: string;
  headerActions?: ReactNode;
  headerClassName?: string;
  titleClassName?: string;
  titleAs?: "h1" | "h2" | "h3";
  titleSwitchKey?: string;
  stackClassName?: string;
  metrics?: ReactNode;
  toolbar?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  isEmpty: boolean;
  tableSize?: "sm" | "md";
  children: ReactNode;
};

export function DistributorPageShell({
  title,
  description = "",
  headerActions,
  headerClassName,
  titleClassName,
  titleAs,
  titleSwitchKey,
  stackClassName,
  metrics,
  toolbar,
  emptyTitle = "Nothing to show",
  emptyDescription,
  isEmpty,
  tableSize = "sm",
  children,
}: DistributorPageShellProps) {
  return (
    <div className={cn(DISTRIBUTOR_PAGE_STACK_CLASS, stackClassName)}>
      <DistributorPageHeader
        title={title}
        description={description}
        className={headerClassName}
        titleClassName={titleClassName}
        titleAs={titleAs}
        titleSwitchKey={titleSwitchKey}
      >
        {headerActions}
      </DistributorPageHeader>
      {metrics}
      <DistributorTableCardShell
        toolbar={toolbar}
        isEmpty={isEmpty}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        tableSize={tableSize}
      >
        {children}
      </DistributorTableCardShell>
    </div>
  );
}

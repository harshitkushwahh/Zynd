"use client";

import type { ReactNode } from "react";

import { SectionTitle } from "@/components/ui/page-title";
import { cn } from "@/lib/utils";

type MfCatalogSectionHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function MfCatalogSectionHeader({
  title,
  description,
  action,
  className,
}: MfCatalogSectionHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0">
        <SectionTitle>{title}</SectionTitle>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-compact text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

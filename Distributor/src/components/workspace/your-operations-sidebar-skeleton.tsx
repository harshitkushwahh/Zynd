"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  DISTRIBUTOR_WORKSPACE_SIDEBAR_CLASS,
  DISTRIBUTOR_WORKSPACE_SIDEBAR_HEADER_CLASS,
  DISTRIBUTOR_WORKSPACE_SIDEBAR_NAV_CLASS,
} from "@/lib/distributor-layout";
import { cn } from "@/lib/utils";

type YourOperationsSidebarSkeletonProps = {
  className?: string;
};

export function YourOperationsSidebarSkeleton({ className }: YourOperationsSidebarSkeletonProps) {
  return (
    <aside
      className={cn(DISTRIBUTOR_WORKSPACE_SIDEBAR_CLASS, "distributor-your-operations-sidebar-skeleton", className)}
      aria-hidden
    >
      <div className={DISTRIBUTOR_WORKSPACE_SIDEBAR_HEADER_CLASS}>
        <Skeleton className="h-3 w-[4.75rem] rounded-[var(--radius-sm)]" />
      </div>
      <nav className={DISTRIBUTOR_WORKSPACE_SIDEBAR_NAV_CLASS}>
        <div className="distributor-your-operations-sidebar-skeleton__sections">
          {Array.from({ length: 4 }, (_, sectionIndex) => (
            <div key={`section-${sectionIndex}`} className="distributor-your-operations-sidebar-skeleton__section">
              <Skeleton className="distributor-your-operations-sidebar-skeleton__trigger h-10 w-full rounded-[var(--radius-control)]" />
              {sectionIndex === 0 ? (
                <div className="distributor-your-operations-sidebar-skeleton__variants">
                  {Array.from({ length: 4 }, (_, variantIndex) => (
                    <Skeleton
                      key={`variant-${variantIndex}`}
                      className="distributor-your-operations-sidebar-skeleton__variant h-8 w-full rounded-[var(--radius-control)]"
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </nav>
    </aside>
  );
}

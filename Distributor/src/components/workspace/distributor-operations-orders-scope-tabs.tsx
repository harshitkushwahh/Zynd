"use client";

import { Globe2, UserRound } from "lucide-react";

import {
  DISTRIBUTOR_ORDERS_LIST_SCOPES,
  type DistributorOrdersListScope,
} from "@/lib/distributor-operations-orders-scope";
import { cn } from "@/lib/utils";

const SCOPE_TAB_ICONS: Record<DistributorOrdersListScope, typeof UserRound> = {
  "your-book": UserRound,
  all: Globe2,
};

type DistributorOperationsOrdersScopeTabsProps = {
  value: DistributorOrdersListScope;
  onChange: (scope: DistributorOrdersListScope) => void;
  className?: string;
  busy?: boolean;
};

export function DistributorOperationsOrdersScopeTabs({
  value,
  onChange,
  className,
  busy = false,
}: DistributorOperationsOrdersScopeTabsProps) {
  return (
    <div
      className={cn("distributor-operations-orders-scope-tabs", className)}
      role="tablist"
      aria-busy={busy || undefined}
      aria-label="Operations scope: your book or all platform orders"
    >
      {DISTRIBUTOR_ORDERS_LIST_SCOPES.map((scope) => {
        const active = value === scope.id;
        const Icon = SCOPE_TAB_ICONS[scope.id];
        return (
          <button
            key={scope.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={cn(
              "distributor-operations-orders-scope-tabs__tab",
              active && "distributor-operations-orders-scope-tabs__tab--active",
            )}
            onClick={() => onChange(scope.id)}
          >
            <span className="distributor-operations-orders-scope-tabs__tab-icon" aria-hidden>
              <Icon strokeWidth={2.25} />
            </span>
            {scope.label}
          </button>
        );
      })}
    </div>
  );
}

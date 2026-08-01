"use client";

import { Globe2, UserRound } from "lucide-react";

import {
  DISTRIBUTOR_CLIENTS_LIST_SCOPES,
  type DistributorClientsListScope,
} from "@/lib/distributor-clients-list-scope";
import { cn } from "@/lib/utils";

const SCOPE_TAB_ICONS: Record<DistributorClientsListScope, typeof UserRound> = {
  "your-book": UserRound,
  all: Globe2,
};

type DistributorClientsListScopeTabsProps = {
  value: DistributorClientsListScope;
  onChange: (scope: DistributorClientsListScope) => void;
  className?: string;
  busy?: boolean;
};

export function DistributorClientsListScopeTabs({
  value,
  onChange,
  className,
  busy = false,
}: DistributorClientsListScopeTabsProps) {
  return (
    <div
      className={cn("distributor-operations-orders-scope-tabs", className)}
      role="tablist"
      aria-busy={busy || undefined}
      aria-label="Client list scope: your book or all platform investors"
    >
      {DISTRIBUTOR_CLIENTS_LIST_SCOPES.map((scope) => {
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

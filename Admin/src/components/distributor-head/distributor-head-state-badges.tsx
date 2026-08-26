"use client";

import { useCallback, useEffect, useState } from "react";
import { MapPin, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import {
  fetchAdminHierarchyOverview,
  type AdminHierarchyOverview,
} from "@/lib/admin-distributor-hierarchy-api";
import type { MitraHierarchyPersona } from "@/lib/admin-mitra-roles";
import { MITRA_HIERARCHY_COPY } from "@/lib/mitra-hierarchy-copy";

type DistributorHeadStateBadgesProps = {
  persona?: MitraHierarchyPersona | null;
};

export function DistributorHeadStateBadges({ persona }: DistributorHeadStateBadgesProps) {
  const { displayName } = useAdminAuth();
  const [overview, setOverview] = useState<AdminHierarchyOverview | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setLoaded(false);
    try {
      const result = await fetchAdminHierarchyOverview();
      setOverview(result);
    } catch {
      setOverview(null);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!overview && persona !== "state_head") {
    return null;
  }

  const scopeLabel =
    persona === "super_head"
      ? "Pan India"
      : persona === "state_head"
        ? loaded && (!overview || overview.state_assigned === false || !overview.state_code)
          ? "No state assigned"
          : overview?.state_code
            ? `${overview.state_name} (${overview.state_code})`
            : null
        : overview?.state_code
          ? `${overview.state_name} (${overview.state_code})`
          : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {scopeLabel ? (
        <Badge variant="outline" className="h-6 gap-1.5 px-2.5 py-0 text-xs font-normal">
          <MapPin className="size-3" />
          {scopeLabel}
        </Badge>
      ) : null}
      {persona === "state_head" && displayName ? (
        <Badge variant="secondary" className="h-6 gap-1.5 px-2.5 py-0 text-xs font-normal">
          <UserRound className="size-3" />
          {MITRA_HIERARCHY_COPY.stateHead}: {displayName}
        </Badge>
      ) : null}
      {persona === "super_head" ? (
        <Badge variant="secondary" className="h-6 gap-1.5 px-2.5 py-0 text-xs font-normal">
          {MITRA_HIERARCHY_COPY.superHead}
        </Badge>
      ) : null}
    </div>
  );
}

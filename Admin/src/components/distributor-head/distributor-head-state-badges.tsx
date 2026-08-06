"use client";

import { useCallback, useEffect, useState } from "react";
import { MapPin, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import {
  fetchAdminHierarchyOverview,
  type AdminHierarchyOverview,
} from "@/lib/admin-distributor-hierarchy-api";
import { MITRA_HIERARCHY_COPY } from "@/lib/mitra-hierarchy-copy";

export function DistributorHeadStateBadges() {
  const { displayName, user } = useAdminAuth();
  const [overview, setOverview] = useState<AdminHierarchyOverview | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await fetchAdminHierarchyOverview();
      setOverview(result);
    } catch {
      setOverview(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stateHeadLabel = displayName || user?.email;
  if (!overview && !stateHeadLabel) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {overview ? (
        <Badge variant="outline" className="h-6 gap-1.5 px-2.5 py-0 text-xs font-normal">
          <MapPin className="size-3" />
          {overview.state_name} ({overview.state_code})
        </Badge>
      ) : null}
      {stateHeadLabel ? (
        <Badge variant="secondary" className="h-6 gap-1.5 px-2.5 py-0 text-xs font-normal">
          <UserRound className="size-3" />
          {MITRA_HIERARCHY_COPY.stateHead}: {stateHeadLabel}
        </Badge>
      ) : null}
    </div>
  );
}

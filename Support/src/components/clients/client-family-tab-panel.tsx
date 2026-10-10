"use client";

import { useMemo } from "react";

import { ClientFamilyGroupsSection } from "@/components/clients/client-family-groups-section";
import { ClientFamilyTabStatusMetrics } from "@/components/clients/client-family-tab-status-metrics";
import { filterDistributorVisibleFamilyGroups } from "@/lib/distributor-client-family-groups";
import type { DistributorClientListOrigin } from "@/lib/distributor-client-routes";
import type { DistributorClientFamilyGroup } from "@/lib/distributor-types";
import { cn } from "@/lib/utils";

type ClientFamilyTabPanelProps = {
  groups: DistributorClientFamilyGroup[];
  clientInDistributorBook: boolean;
  listOrigin: DistributorClientListOrigin;
  clientId: string;
  className?: string;
};

export function ClientFamilyTabPanel({
  groups,
  clientInDistributorBook,
  listOrigin,
  clientId,
  className,
}: ClientFamilyTabPanelProps) {
  const visibleGroups = useMemo(
    () => filterDistributorVisibleFamilyGroups(groups, clientInDistributorBook),
    [groups, clientInDistributorBook],
  );

  return (
    <div className={cn("distributor-client-family-tab", className)}>
      {visibleGroups.length > 0 ? <ClientFamilyTabStatusMetrics groups={visibleGroups} /> : null}
      <ClientFamilyGroupsSection
        groups={visibleGroups}
        listOrigin={listOrigin}
        clientId={clientId}
      />
    </div>
  );
}

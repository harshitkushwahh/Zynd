"use client";

import { useEffect, useState } from "react";

import { ClientFamilyGroupPageSkeleton } from "@/components/clients/client-family-group-page-skeleton";
import { FamilyGroupDashboard } from "@/components/clients/family-group-dashboard";
import { useClientPageReveal } from "@/components/clients/use-client-page-reveal";
import { canDistributorAccessClientFamilyGroup } from "@/lib/distributor-client-family-groups";
import { fetchDistributorClientFamilyGroup } from "@/lib/distributor-clients-api";
import type { DistributorClientFamilyGroup } from "@/lib/distributor-types";
import type { DistributorClientListOrigin } from "@/lib/distributor-client-routes";

type YourClientFamilyGroupPageProps = {
  listOrigin: DistributorClientListOrigin;
  clientId: string;
  groupId: string;
};

export function YourClientFamilyGroupPage({
  listOrigin,
  clientId,
  groupId,
}: YourClientFamilyGroupPageProps) {
  const [group, setGroup] = useState<DistributorClientFamilyGroup | null>(null);
  const [clientName, setClientName] = useState<string>("Client");
  const [loading, setLoading] = useState(true);
  const resetKey = `${clientId}:${groupId}`;
  const { showSkeleton } = useClientPageReveal({
    ready: !loading && group !== null,
    resetKey,
  });

  useEffect(() => {
    setLoading(true);
    setGroup(null);

    let cancelled = false;
    void fetchDistributorClientFamilyGroup(clientId, groupId)
      .then((payload) => {
        if (cancelled) return;
        const { clientDisplayName, clientUserId: _uid, ...rest } = payload;
        setClientName(clientDisplayName);
        const accessible = canDistributorAccessClientFamilyGroup(rest, true);
        setGroup(accessible ? rest : null);
      })
      .catch(() => {
        if (!cancelled) setGroup(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, groupId]);

  if (loading || (group && showSkeleton)) {
    return <ClientFamilyGroupPageSkeleton />;
  }

  if (!group) {
    return <p className="text-compact text-muted-foreground">Family group not found.</p>;
  }

  return (
    <FamilyGroupDashboard
      group={group}
      clientName={clientName}
      clientId={clientId}
      listOrigin={listOrigin}
    />
  );
}

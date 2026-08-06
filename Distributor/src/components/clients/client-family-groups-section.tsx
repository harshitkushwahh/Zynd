"use client";

import { useState } from "react";
import { Users, Plus } from "lucide-react";

import { ClientCreateFamilyGroupDialog } from "@/components/clients/client-create-family-group-dialog";
import { ClientFamilyGroupSummaryCard } from "@/components/clients/client-family-group-summary-card";
import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import { Card } from "@/components/ui/card";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import type { DistributorClientListOrigin } from "@/lib/distributor-client-routes";
import type { DistributorClientFamilyGroup } from "@/lib/distributor-types";
import { cn } from "@/lib/utils";

type ClientFamilyGroupsSectionProps = {
  groups: DistributorClientFamilyGroup[];
  listOrigin: DistributorClientListOrigin;
  clientId: string;
  className?: string;
};

export function ClientFamilyGroupsSection({
  groups,
  listOrigin,
  clientId,
  className,
}: ClientFamilyGroupsSectionProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.family;
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <section className={cn("distributor-client-family-groups-section", className)}>
        {groups.length === 0 ? (
          <Card className="distributor-client-family-groups-empty-card border-border bg-card shadow-sm">
            <div className="distributor-client-family-groups-empty-card__body">
              <span
                className="distributor-client-family-groups-empty-card__icon flex size-11 items-center justify-center rounded-full bg-muted/60 text-muted-foreground"
                aria-hidden
              >
                <Users className="size-5" strokeWidth={1.75} />
              </span>
              <p className="distributor-client-family-groups-empty-card__message">{copy.empty}</p>
              <DistributorActionButton
                variant="primary"
                className="gap-1.5"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="size-4 shrink-0" strokeWidth={2.25} aria-hidden />
                {copy.createFamilyGroupAction}
              </DistributorActionButton>
            </div>
          </Card>
        ) : (
          <>
            <header className="distributor-client-family-groups-section__header">
              <h3 className="distributor-client-family-groups-section__title">
                {copy.allFamilyGroupsTitle}
              </h3>
              <DistributorActionButton
                variant="primary"
                className="gap-1.5"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="size-4 shrink-0" strokeWidth={2.25} aria-hidden />
                {copy.createFamilyGroupAction}
              </DistributorActionButton>
            </header>

            <div className="distributor-client-family-groups__list">
              {groups.map((group) => (
                <ClientFamilyGroupSummaryCard
                  key={group.id}
                  group={group}
                  listOrigin={listOrigin}
                  clientId={clientId}
                />
              ))}
            </div>
          </>
        )}
      </section>

      <ClientCreateFamilyGroupDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}

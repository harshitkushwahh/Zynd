"use client";

import Link from "next/link";
import { ChevronRight, UsersRound } from "lucide-react";

import { FamilyGroupMemberAvatars } from "@/components/clients/family-group-member-avatars";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { distributorClientFamilyGroupHref } from "@/lib/dummy/client-profile";
import type { DistributorClientListOrigin } from "@/lib/distributor-client-routes";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import type { DistributorClientFamilyGroup } from "@/lib/dummy/types";
import { formatAum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DISTRIBUTOR_BADGE_COMPACT_CLASS } from "@/lib/distributor-layout";

type ClientFamilyGroupSummaryCardProps = {
  group: DistributorClientFamilyGroup;
  listOrigin: DistributorClientListOrigin;
  clientId: string;
  className?: string;
};

export function ClientFamilyGroupSummaryCard({
  group,
  listOrigin,
  clientId,
  className,
}: ClientFamilyGroupSummaryCardProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.family;
  const href = distributorClientFamilyGroupHref(listOrigin, clientId, group.id);

  return (
    <Link href={href} className={cn("block transition-opacity hover:opacity-95", className)}>
      <Card className="overflow-hidden border-border bg-card p-0 shadow-sm">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <UsersRound className="size-4 text-primary" aria-hidden />
              <h3 className="text-compact font-semibold text-foreground">{group.name}</h3>
              {group.tag ? (
                <Badge variant="secondary" className={DISTRIBUTOR_BADGE_COMPACT_CLASS}>
                  {group.tag}
                </Badge>
              ) : null}
              <Badge variant="outline" className={cn(DISTRIBUTOR_BADGE_COMPACT_CLASS, "capitalize")}>
                {group.role}
              </Badge>
            </div>
            {group.description ? (
              <p className="text-caption text-muted-foreground line-clamp-2">{group.description}</p>
            ) : null}
            {group.headDisplayName ? (
              <p className="text-caption text-muted-foreground">
                Group head:{" "}
                <span className="font-medium text-foreground">{group.headDisplayName}</span>
              </p>
            ) : null}
            <FamilyGroupMemberAvatars members={group.members} maxVisible={6} size="sm" />
            <p className="text-caption text-muted-foreground">
              {copy.members(group.memberCount)} · {copy.activeGoals(group.activeGoals)}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2 text-right">
            <p className="text-caption text-muted-foreground">Total value</p>
            <p className="text-h3 font-semibold tabular-nums">{formatAum(group.totalValue)}</p>
            <span className="inline-flex items-center gap-0.5 text-caption font-medium text-primary">
              View group
              <ChevronRight className="size-3.5" />
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}

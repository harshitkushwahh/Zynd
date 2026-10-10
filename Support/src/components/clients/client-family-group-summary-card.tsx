"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { FamilyGroupMemberAvatars } from "@/components/clients/family-group-member-avatars";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card } from "@/components/ui/card";
import { distributorClientFamilyGroupHref } from "@/lib/distributor-client-routes";
import type { DistributorClientListOrigin } from "@/lib/distributor-client-routes";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import {
  familyGroupAvatarInitials,
  familyGroupAvatarSrc,
  familyGroupDescription,
} from "@/lib/distributor-family-group-display";
import type { DistributorClientFamilyGroup } from "@/lib/distributor-types";
import { cn } from "@/lib/utils";

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
  const avatarSrc = familyGroupAvatarSrc(group);
  const description = familyGroupDescription(group, copy.familyGroupIdentityDescription);

  return (
    <article className={cn("distributor-client-family-group-summary", className)}>
      <Link href={href} className="distributor-client-family-group-summary__intro-link">
        <Card className="distributor-client-family-group-summary__intro border-border bg-card shadow-sm">
          <div className="distributor-client-family-group-summary__intro-stack">
            <Avatar className="distributor-client-family-group-summary__intro-avatar size-10 shrink-0">
              <AvatarImage src={avatarSrc} alt="" />
              <AvatarFallback className="text-caption font-semibold">
                {familyGroupAvatarInitials(group.name)}
              </AvatarFallback>
            </Avatar>
            <div className="distributor-client-family-group-summary__intro-body">
              <div className="distributor-client-family-group-summary__intro-title-row">
                <h2 className="distributor-client-family-group-summary__title">{group.name}</h2>
                {group.tag ? (
                  <StatusBadge variant="neutral">{group.tag}</StatusBadge>
                ) : null}
                <StatusBadge variant="neutral">{group.role}</StatusBadge>
              </div>
              <p className="distributor-client-family-group-summary__description">{description}</p>
              <FamilyGroupMemberAvatars members={group.members} maxVisible={5} size="sm" />
            </div>
          </div>
          <ChevronRight
            className="distributor-client-family-group-summary__intro-chevron size-4 shrink-0"
            strokeWidth={2.25}
            aria-hidden
          />
        </Card>
      </Link>
    </article>
  );
}

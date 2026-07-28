"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Crown, UsersRound } from "lucide-react";

import { FamilyGroupMemberAvatars } from "@/components/clients/family-group-member-avatars";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  distributorClientDetailHref,
  getDistributorClientProfile,
  getFamilyGroupFromProfile,
} from "@/lib/dummy/client-profile";
import { fetchDistributorClientFamilyGroup } from "@/lib/distributor-clients-api";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import type { DistributorClientListOrigin } from "@/lib/distributor-client-routes";
import { env } from "@/lib/env";
import type { DistributorClientFamilyGroup } from "@/lib/dummy/types";
import { cn } from "@/lib/utils";

type YourClientFamilyGroupPageProps = {
  listOrigin: DistributorClientListOrigin;
  clientId: string;
  groupId: string;
};

function memberInitials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function YourClientFamilyGroupPage({
  listOrigin,
  clientId,
  groupId,
}: YourClientFamilyGroupPageProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.family;
  const [group, setGroup] = useState<DistributorClientFamilyGroup | null>(null);
  const [clientName, setClientName] = useState<string>("Client");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!env.useBackendClients) {
      const profile = getDistributorClientProfile(clientId);
      setClientName(profile?.displayName ?? "Client");
      setGroup(profile ? getFamilyGroupFromProfile(profile, groupId) ?? null : null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    void fetchDistributorClientFamilyGroup(clientId, groupId)
      .then((payload) => {
        if (cancelled) return;
        const { clientDisplayName, clientUserId: _uid, ...rest } = payload;
        setClientName(clientDisplayName);
        setGroup(rest);
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

  const headMember = useMemo(
    () => group?.members.find((member) => member.role === "head") ?? group?.members[0],
    [group],
  );

  if (loading) {
    return <p className="text-compact text-muted-foreground">Loading family group…</p>;
  }

  if (!group) {
    return (
      <div className="space-y-4">
        <Link
          href={distributorClientDetailHref(listOrigin, clientId)}
          className="inline-flex items-center gap-1.5 text-caption font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back to {clientName}
        </Link>
        <p className="text-compact text-muted-foreground">Family group not found.</p>
      </div>
    );
  }

  const detailHref = distributorClientDetailHref(listOrigin, clientId);

  return (
    <div className="space-y-8">
      <Link
        href={detailHref}
        className="inline-flex w-fit items-center gap-1.5 text-caption font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        {clientName}
      </Link>

      <section
        className={cn(
          "relative isolate overflow-hidden rounded-[var(--radius-card)] p-6 shadow-zynd-mid ring-1 ring-inset ring-primary-foreground/10 sm:p-8",
          "bg-[linear-gradient(145deg,var(--zynd-navy)_0%,var(--zynd-blue-dark)_46%,var(--zynd-blue)_100%)] text-primary-foreground",
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,color-mix(in_srgb,var(--zynd-blue)_35%,transparent),transparent_55%)] opacity-80" />
        <div className="relative z-10 grid gap-8 lg:grid-cols-2 lg:items-center">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <UsersRound className="size-5" aria-hidden />
              <h1 className="font-heading text-h2 font-semibold">{group.name}</h1>
              {group.tag ? (
                <Badge className="border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground">
                  {group.tag}
                </Badge>
              ) : null}
            </div>
            <p className="max-w-xl text-compact text-primary-foreground/85">
              {group.description ?? copy.description}
            </p>
            {group.headDisplayName ? (
              <p className="text-caption text-primary-foreground/75">
                Group head:{" "}
                <span className="font-semibold text-primary-foreground">{group.headDisplayName}</span>
              </p>
            ) : null}
            <p className="text-caption text-primary-foreground/70">
              {clientName} · {group.role === "owner" ? "Group head / owner" : "Member"} ·{" "}
              {copy.members(group.memberCount)}
            </p>
          </div>

          <div className="flex flex-col items-center justify-center gap-4">
            <div className="relative flex size-36 items-center justify-center rounded-full bg-primary-foreground/10 ring-1 ring-primary-foreground/20">
              {headMember ? (
                <>
                  <Avatar className="size-28 ring-4 ring-primary-foreground/15">
                    {headMember.profileImageUrl ? (
                      <AvatarImage src={headMember.profileImageUrl} alt="" />
                    ) : null}
                    <AvatarFallback className="bg-primary-foreground/15 text-h3 font-semibold text-primary-foreground">
                      {memberInitials(headMember.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute -right-1 top-2 flex size-8 items-center justify-center rounded-full bg-amber-400 text-amber-950 ring-4 ring-[color-mix(in_srgb,var(--zynd-navy)_40%,transparent)]">
                    <Crown className="size-4" strokeWidth={2.25} />
                  </span>
                </>
              ) : null}
            </div>
            <FamilyGroupMemberAvatars
              members={group.members}
              maxVisible={8}
              size="md"
              className="justify-center"
            />
          </div>
        </div>
      </section>

      <DetailMembersPanel group={group} />
    </div>
  );
}

function DetailMembersPanel({ group }: { group: DistributorClientFamilyGroup }) {
  return (
    <Card className="overflow-hidden border-border bg-card p-0 shadow-sm">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-compact font-semibold">Family members</h2>
        <p className="text-caption text-muted-foreground">
          Active members in {group.name} · view-only for distributors
        </p>
      </div>
      <ul className="divide-y divide-border">
        {group.members.map((member) => (
          <li key={member.userId} className="flex items-center gap-4 px-4 py-3">
            <Avatar className="size-11">
              {member.profileImageUrl ? <AvatarImage src={member.profileImageUrl} alt="" /> : null}
              <AvatarFallback className="font-semibold">
                {memberInitials(member.displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-compact font-medium text-foreground">{member.displayName}</p>
              {member.emailMasked ? (
                <p className="text-caption text-muted-foreground">{member.emailMasked}</p>
              ) : null}
              {member.badgeLabel ? (
                <p className="text-caption text-muted-foreground">{member.badgeLabel}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <Badge variant="outline" className="capitalize">
                {member.role === "head" ? "Group head" : member.role}
              </Badge>
            </div>
          </li>
        ))}
      </ul>
      {group.members.length === 0 ? (
        <p className="px-4 py-8 text-center text-caption text-muted-foreground">No members listed.</p>
      ) : null}
    </Card>
  );
}

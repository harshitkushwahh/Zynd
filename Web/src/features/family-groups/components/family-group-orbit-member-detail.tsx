"use client";

import { CheckCircle2, Crown, PieChart, ShieldCheck, Wallet, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FamilyGroupMemberPreview } from "@/features/family-groups/api/family-groups-api";
import { FamilyMemberRoleBadge } from "@/features/family-groups/components/family-member-role-badge";
import {
  familyMemberInitials,
  FAMILY_GROUP_CARD_RADIUS_CLASS,
  FAMILY_GROUP_CONTROL_RADIUS_CLASS,
} from "@/features/family-groups/lib/family-group-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const ORBIT_MEMBER_DETAIL_SURFACE_CLASS = cn(
  FAMILY_GROUP_CARD_RADIUS_CLASS,
  "border border-primary-foreground/15",
);
const ORBIT_MEMBER_DETAIL_INNER_CLASS = cn(
  FAMILY_GROUP_CONTROL_RADIUS_CLASS,
  "border border-primary-foreground/15",
);

type FamilyGroupOrbitMemberDetailProps = {
  member: FamilyGroupMemberPreview | null;
  currentUserId?: string | null;
  className?: string;
};

function StatusPill({
  icon: Icon,
  label,
  value,
  positive,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
  positive: boolean;
}) {
  return (
    <div className={cn("flex min-w-0 flex-1 flex-col gap-2 p-2.5", ORBIT_MEMBER_DETAIL_INNER_CLASS)}>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-foreground/50">
        <Icon className="size-3 shrink-0" strokeWidth={2.25} />
        <span className="truncate">{label}</span>
      </div>
      <Badge
        variant="secondary"
        className={cn(
          "h-auto w-fit max-w-full gap-1 px-2 py-1 text-[10px] font-semibold leading-none",
          positive && "border-success/20 bg-success text-success-foreground hover:bg-success",
        )}
      >
        {positive ? (
          <CheckCircle2 className="size-3 shrink-0" strokeWidth={2.25} />
        ) : (
          <XCircle className="size-3 shrink-0" strokeWidth={2.25} />
        )}
        <span className="truncate">{value}</span>
      </Badge>
    </div>
  );
}

export function FamilyGroupOrbitMemberDetail({
  member,
  currentUserId,
  className,
}: FamilyGroupOrbitMemberDetailProps) {
  const detailCopy = copy.familyGroups.dashboard.orbitMemberDetail;

  if (!member) {
    return (
      <aside
        className={cn(
          "flex min-h-[18rem] flex-col items-center justify-center border border-dashed border-primary-foreground/15 px-4 py-6 text-center md:min-h-[20rem]",
          ORBIT_MEMBER_DETAIL_SURFACE_CLASS,
          className,
        )}
      >
        <div className="flex flex-col items-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary-foreground/10 ring-1 ring-primary-foreground/15">
            <ShieldCheck className="size-5 text-primary-foreground/45" strokeWidth={2} />
          </div>
          <p className="mt-3 text-compact font-medium text-primary-foreground/80">{detailCopy.emptyTitle}</p>
          <p className="mt-1.5 max-w-[14rem] text-[11px] leading-relaxed text-primary-foreground/55">
            {detailCopy.emptyDescription}
          </p>
        </div>
      </aside>
    );
  }

  const isCurrentUser = member.user_id === currentUserId;
  const isHead = member.role === "head";
  const kycCompleted = member.kyc_completed === true;
  const hasInvested = member.has_invested === true;
  const kycValue = kycCompleted ? detailCopy.kycCompleted : detailCopy.kycPending;
  const investedValue = hasInvested ? detailCopy.invested : detailCopy.notInvested;

  return (
    <aside
      className={cn(
        "relative flex min-h-[18rem] min-w-0 flex-col overflow-hidden p-4 sm:p-5 md:min-h-[20rem]",
        ORBIT_MEMBER_DETAIL_SURFACE_CLASS,
        className,
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-foreground/50">
            {detailCopy.title}
          </p>
          {isCurrentUser ? (
            <Badge className="bg-success text-success-foreground hover:bg-success">
              {detailCopy.youLabel}
            </Badge>
          ) : null}
        </div>

        <div className={cn("mt-4 p-3", ORBIT_MEMBER_DETAIL_INNER_CLASS)}>
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div
                className={cn(
                  "flex size-16 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary-foreground/15 to-primary-foreground/5 ring-2",
                  isHead ? "ring-amber-300/40" : "ring-primary-foreground/20",
                )}
              >
                {member.profile_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={member.profile_image_url} alt="" className="size-full object-cover" />
                ) : (
                  <span className="text-base font-semibold text-primary-foreground">
                    {familyMemberInitials(member.display_name)}
                  </span>
                )}
              </div>
              {isHead ? (
                <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-amber-400 text-amber-950">
                  <Crown className="size-2.5" strokeWidth={2.25} />
                </span>
              ) : null}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-body font-semibold leading-tight text-primary-foreground">
                {member.display_name}
              </p>
              <FamilyMemberRoleBadge
                role={member.role}
                badgeLabel={member.badge_label}
                surface="hero"
                className="mt-1.5"
              />
            </div>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <StatusPill
            icon={ShieldCheck}
            label={detailCopy.kycLabel}
            value={kycValue}
            positive={kycCompleted}
          />
          <StatusPill
            icon={Wallet}
            label={detailCopy.investmentLabel}
            value={investedValue}
            positive={hasInvested}
          />
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled
          className="mt-auto h-10 w-full min-w-0 justify-between gap-2 whitespace-normal border-primary-foreground/15 bg-primary-foreground/10 px-3 text-primary-foreground hover:bg-primary-foreground/10"
        >
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <PieChart className="size-3.5 shrink-0" strokeWidth={2.25} />
            <span className="truncate text-compact">{detailCopy.viewContribution}</span>
          </span>
          <Badge variant="secondary" className="shrink-0 text-[9px] uppercase tracking-wide">
            {copy.familyGroups.dashboard.comingSoonBadge}
          </Badge>
        </Button>
      </div>
    </aside>
  );
}

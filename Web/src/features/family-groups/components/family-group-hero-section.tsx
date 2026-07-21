"use client";

import { FamilyGroupOrbitVisual } from "@/features/family-groups/components/family-group-orbit-visual";
import type { FamilyGroupMemberPreview } from "@/features/family-groups/api/family-groups-api";
import {
  FAMILY_GROUP_HERO_GRADIENT_CLASS,
  RISK_PROFILE_HERO_RADIUS_CLASS,
} from "@/features/risk-profile/lib/risk-tier-ui";
import { cn } from "@/lib/utils";

type FamilyGroupHeroSectionProps = {
  members: FamilyGroupMemberPreview[];
  currentUserId?: string | null;
  className?: string;
};

export function FamilyGroupHeroSection({
  members,
  currentUserId,
  className,
}: FamilyGroupHeroSectionProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden border border-primary-foreground/10 p-4 shadow-zynd-mid sm:p-5 lg:p-6",
        RISK_PROFILE_HERO_RADIUS_CLASS,
        FAMILY_GROUP_HERO_GRADIENT_CLASS,
        className,
      )}
    >
      <div className="auth-brand-pattern pointer-events-none absolute inset-0 opacity-20" />
      <div className="pointer-events-none absolute -right-10 -top-10 size-44 rounded-full bg-primary-foreground/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 size-36 rounded-full bg-[color-mix(in_srgb,var(--zynd-emerald)_28%,transparent)] blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,color-mix(in_srgb,var(--zynd-navy)_35%,transparent)_100%)]" />

      <div className="relative z-10">
        <FamilyGroupOrbitVisual members={members} currentUserId={currentUserId} />
      </div>
    </section>
  );
}

"use client";

import { Shield, ShieldOff } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import type { DistributorClientProfile } from "@/lib/distributor-types";
import {
  complianceStatusVariant,
  investmentStatusVariant,
  onboardingStatusVariant,
} from "@/lib/status-meta";
import { cn } from "@/lib/utils";

type ClientProfileHeroStatusBadgesProps = {
  profile: DistributorClientProfile;
  className?: string;
};

export function ClientProfileHeroStatusBadges({ profile, className }: ClientProfileHeroStatusBadgesProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY;
  const { investor } = profile;
  const mfaVariant = profile.mfaEnabled ? "success" : "neutral";
  const mfaLabel = profile.mfaEnabled ? copy.overview.mfaBadgeOn : copy.overview.mfaBadgeOff;

  return (
    <div className={cn("distributor-profile-hero-card__status-stack", className)}>
      <StatusBadge variant={onboardingStatusVariant(investor.onboardingStatus)}>
        {investor.onboardingStatus}
      </StatusBadge>
      <StatusBadge variant={complianceStatusVariant(investor.complianceStatus)}>
        {investor.complianceStatus}
      </StatusBadge>
      <StatusBadge variant={investmentStatusVariant(investor.investmentStatus)}>
        {investor.investmentStatus}
      </StatusBadge>
      <StatusBadge
        variant={mfaVariant}
        icon={profile.mfaEnabled ? Shield : ShieldOff}
      >
        {mfaLabel}
      </StatusBadge>
    </div>
  );
}

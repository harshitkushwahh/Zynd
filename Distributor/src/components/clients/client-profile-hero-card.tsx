"use client";

import { ClientCodeCopyBadge } from "@/components/clients/client-code-copy-badge";
import { ClientProfileHeroOAuthIcons } from "@/components/clients/client-profile-hero-oauth-icons";
import { ClientProfileHeroStatusBadges } from "@/components/clients/client-profile-hero-status-badges";
import { DistributorProfileHeroCard } from "@/components/ui/distributor-profile-hero-card";
import { DISTRIBUTOR_CLIENT_PROFILE_FALLBACK_SRC } from "@/lib/distributor-client-profile-hero";
import type { DistributorClientProfile } from "@/lib/dummy/types";
import { cn } from "@/lib/utils";

type ClientProfileHeroCardProps = {
  profile: DistributorClientProfile;
  className?: string;
};

export function ClientProfileHeroCard({ profile, className }: ClientProfileHeroCardProps) {
  const { investor } = profile;
  const imageSrc = profile.profileImageUrl?.trim() || null;
  const roleLabel = investor.investorType;
  const email =
    profile.emailDisplay.includes("@") && !profile.emailDisplay.includes("*")
      ? profile.emailDisplay
      : null;

  return (
    <DistributorProfileHeroCard
      className={cn("distributor-client-detail-hero", className)}
      name={profile.displayName}
      roleLabel={roleLabel}
      badge={<ClientCodeCopyBadge clientCode={investor.clientCode} />}
      overlayTopEnd={<ClientProfileHeroStatusBadges profile={profile} />}
      overlayBottomStart={
        <ClientProfileHeroOAuthIcons connectedAccounts={profile.personalInfo.connectedAccounts} />
      }
      imageSrc={imageSrc}
      fallbackImageSrc={DISTRIBUTOR_CLIENT_PROFILE_FALLBACK_SRC}
      email={email}
      phone={profile.contactPhone}
    />
  );
}

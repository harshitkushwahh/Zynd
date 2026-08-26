"use client";

import { getDistributorOAuthProviderIconSvg } from "@/lib/distributor-oauth-provider-icons";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import type { DistributorClientPersonalInfo } from "@/lib/distributor-types";
import { cn } from "@/lib/utils";

type ClientProfileHeroOAuthIconsProps = {
  connectedAccounts: DistributorClientPersonalInfo["connectedAccounts"];
  className?: string;
};

function OAuthProviderIcon({
  provider,
  label,
  connected,
  emailMasked,
  connectedLabel,
  notConnectedLabel,
}: {
  provider: "google" | "apple";
  label: string;
  connected: boolean;
  emailMasked?: string | null;
  connectedLabel: string;
  notConnectedLabel: string;
}) {
  const statusLabel = connected ? connectedLabel : notConnectedLabel;
  const ariaLabel = emailMasked
    ? `${label}: ${statusLabel}. ${emailMasked}`
    : `${label}: ${statusLabel}`;

  return (
    <span
      className={cn(
        "distributor-profile-hero-card__oauth-badge",
        connected
          ? "distributor-profile-hero-card__oauth-badge--connected"
          : "distributor-profile-hero-card__oauth-badge--disconnected",
        provider === "apple" && "distributor-profile-hero-card__oauth-badge--apple",
      )}
      title={ariaLabel}
      aria-label={ariaLabel}
    >
      <span
        className="distributor-profile-hero-card__oauth-icon"
        aria-hidden
        dangerouslySetInnerHTML={{ __html: getDistributorOAuthProviderIconSvg(provider) }}
      />
    </span>
  );
}

export function ClientProfileHeroOAuthIcons({
  connectedAccounts,
  className,
}: ClientProfileHeroOAuthIconsProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.identity;

  return (
    <div className={cn("distributor-profile-hero-card__oauth-stack", className)}>
      <OAuthProviderIcon
        provider="apple"
        label={copy.apple}
        connected={connectedAccounts.apple.connected}
        emailMasked={connectedAccounts.apple.emailMasked}
        connectedLabel={copy.connected}
        notConnectedLabel={copy.notConnected}
      />
      <OAuthProviderIcon
        provider="google"
        label={copy.google}
        connected={connectedAccounts.google.connected}
        emailMasked={connectedAccounts.google.emailMasked}
        connectedLabel={copy.connected}
        notConnectedLabel={copy.notConnected}
      />
    </div>
  );
}

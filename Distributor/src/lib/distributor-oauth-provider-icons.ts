import icons from "@/lib/distributor-oauth-provider-icons.json";

export type DistributorOAuthProviderId = keyof typeof icons;

export const DISTRIBUTOR_OAUTH_PROVIDER_ICONS = icons;

export function getDistributorOAuthProviderIconSvg(
  provider: DistributorOAuthProviderId,
): string {
  return icons[provider];
}

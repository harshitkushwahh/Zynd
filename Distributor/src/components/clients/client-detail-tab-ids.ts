export const CLIENT_DETAIL_TAB_IDS = [
  "portfolio",
  "kyc",
  "documents",
  "risk",
  "goals",
  "family",
  "transactions",
] as const;

export type ClientDetailTabId = (typeof CLIENT_DETAIL_TAB_IDS)[number];

export function parseClientDetailTabId(value: string | null | undefined): ClientDetailTabId | undefined {
  if (!value) return undefined;
  return (CLIENT_DETAIL_TAB_IDS as readonly string[]).includes(value)
    ? (value as ClientDetailTabId)
    : undefined;
}

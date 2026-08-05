import type { DistributorOperationsSectionId } from "@/lib/distributor-operations-sections";

export type DistributorOperationsVariant = {
  id: string;
  label: string;
  disabled?: boolean;
  /** Circular divider row above this item in the operations sidebar */
  dividerBefore?: boolean;
};

export const DISTRIBUTOR_OPERATIONS_VARIANTS: Record<
  DistributorOperationsSectionId,
  DistributorOperationsVariant[]
> = {
  orders: [
    { id: "one-time", label: "One time" },
    { id: "sip", label: "SIP" },
    { id: "redemption", label: "Redemption" },
  ],
  "systematic-plans": [
    { id: "sip", label: "SIP" },
    { id: "stp", label: "STP", disabled: true },
    { id: "swp", label: "SWP", disabled: true },
  ],
  "txn-requests": [
    { id: "one-time", label: "One time" },
    { id: "sip", label: "SIP" },
    { id: "group-transaction", label: "Group transaction" },
  ],
  "transaction-groups": [
    { id: "one-time", label: "One time" },
    { id: "sip", label: "SIP" },
  ],
};

export function getDistributorOperationsVariants(
  sectionId: DistributorOperationsSectionId,
): DistributorOperationsVariant[] {
  return DISTRIBUTOR_OPERATIONS_VARIANTS[sectionId] ?? [];
}

export function getDistributorOperationsDefaultVariantId(
  sectionId: DistributorOperationsSectionId,
): string {
  const variants = getDistributorOperationsVariants(sectionId);
  return variants.find((v) => !v.disabled)?.id ?? variants[0]?.id ?? "one-time";
}

export function resolveDistributorOperationsVariant(
  sectionId: DistributorOperationsSectionId,
  variantSlug?: string,
): DistributorOperationsVariant | null {
  const variants = getDistributorOperationsVariants(sectionId);
  if (!variants.length) return null;

  if (variantSlug) {
    const match = variants.find((v) => v.id === variantSlug);
    if (match && !match.disabled) return match;
  }

  const defaultId = getDistributorOperationsDefaultVariantId(sectionId);
  return variants.find((v) => v.id === defaultId) ?? variants[0] ?? null;
}

export function distributorOperationsSectionHref(
  sectionId: DistributorOperationsSectionId,
  variantId?: string,
): string {
  const variant = variantId ?? getDistributorOperationsDefaultVariantId(sectionId);
  return `/dashboard/your-operations/${sectionId}/${variant}`;
}

export type ParsedYourOperationsPath = {
  sectionId: DistributorOperationsSectionId | null;
  variantId: string | null;
};

export function parseYourOperationsPathname(pathname: string): ParsedYourOperationsPath {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "dashboard" || parts[1] !== "your-operations") {
    return { sectionId: null, variantId: null };
  }

  const sectionRaw = parts[2];
  const variantRaw = parts[3];

  const sectionIds: DistributorOperationsSectionId[] = [
    "orders",
    "systematic-plans",
    "txn-requests",
    "transaction-groups",
  ];

  const sectionId = sectionIds.includes(sectionRaw as DistributorOperationsSectionId)
    ? (sectionRaw as DistributorOperationsSectionId)
    : null;

  return {
    sectionId,
    variantId: variantRaw ?? null,
  };
}

export function isDistributorOperationsVariantActive(
  pathname: string,
  sectionId: DistributorOperationsSectionId,
  variantId: string,
): boolean {
  const parsed = parseYourOperationsPathname(pathname);
  return parsed.sectionId === sectionId && parsed.variantId === variantId;
}

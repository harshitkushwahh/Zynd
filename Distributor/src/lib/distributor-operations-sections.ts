import type { DistributorNavItem } from "@/lib/distributor-navigation";
import { getDistributorNavGroup } from "@/lib/distributor-navigation";
import {
  DISTRIBUTOR_OPERATIONS_DEFAULT_SECTION,
  parseYourOperationsPathname,
  type DistributorOperationsSectionId,
} from "@/lib/distributor-operations-variants";

export type { DistributorOperationsSectionId } from "@/lib/distributor-operations-variants";
export { DISTRIBUTOR_OPERATIONS_DEFAULT_SECTION } from "@/lib/distributor-operations-variants";

export {
  distributorOperationsSectionHref,
  getDistributorOperationsDefaultVariantId,
  getDistributorOperationsVariants,
  resolveDistributorOperationsVariant,
} from "@/lib/distributor-operations-variants";

export function getDistributorOperationsSections(): DistributorNavItem[] {
  return getDistributorNavGroup("operations")?.items ?? [];
}

export function isDistributorOperationsSectionId(
  value: string,
): value is DistributorOperationsSectionId {
  return getDistributorOperationsSections().some((item) => item.id === value);
}

export function resolveDistributorOperationsSection(
  slug?: string,
): DistributorNavItem | null {
  const items = getDistributorOperationsSections();
  if (slug && isDistributorOperationsSectionId(slug)) {
    return items.find((item) => item.id === slug) ?? null;
  }
  return items.find((item) => item.id === DISTRIBUTOR_OPERATIONS_DEFAULT_SECTION) ?? items[0] ?? null;
}

export function isDistributorOperationsSectionActive(pathname: string, id: string): boolean {
  const parsed = parseYourOperationsPathname(pathname);
  return parsed.sectionId === id;
}

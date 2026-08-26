import type { InvestorType } from "@/lib/distributor-types";

export type DistributorClientsSectionId = "resident" | "nri";

export const DISTRIBUTOR_CLIENTS_DEFAULT_SECTION: DistributorClientsSectionId = "resident";

export type DistributorClientsSection = {
  id: DistributorClientsSectionId;
  label: string;
  investorType: InvestorType;
  disabled?: boolean;
};

export const DISTRIBUTOR_CLIENTS_SECTIONS: DistributorClientsSection[] = [
  {
    id: "resident",
    label: "Residential",
    investorType: "Resident Individual",
  },
  {
    id: "nri",
    label: "Non residential",
    investorType: "Non Resident Individual",
    disabled: true,
  },
];

export function getDistributorClientsSections(): DistributorClientsSection[] {
  return DISTRIBUTOR_CLIENTS_SECTIONS;
}

export function isDistributorClientsSectionId(
  value: string,
): value is DistributorClientsSectionId {
  return DISTRIBUTOR_CLIENTS_SECTIONS.some((section) => section.id === value);
}

export function resolveDistributorClientsSection(
  slug?: string,
): DistributorClientsSection | null {
  if (slug && isDistributorClientsSectionId(slug)) {
    const match = DISTRIBUTOR_CLIENTS_SECTIONS.find((section) => section.id === slug);
    if (match && !match.disabled) return match;
    if (match?.disabled) return null;
  }
  return (
    DISTRIBUTOR_CLIENTS_SECTIONS.find((section) => section.id === DISTRIBUTOR_CLIENTS_DEFAULT_SECTION) ??
    null
  );
}

export function distributorClientsSectionHref(sectionId: DistributorClientsSectionId): string {
  return `/dashboard/your-clients/${sectionId}`;
}

export function parseYourClientsPathname(pathname: string): {
  sectionId: DistributorClientsSectionId | null;
} {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "dashboard" || parts[1] !== "your-clients") {
    return { sectionId: null };
  }
  const raw = parts[2];
  return {
    sectionId: isDistributorClientsSectionId(raw) ? raw : null,
  };
}

export function isDistributorClientsSectionActive(
  pathname: string,
  sectionId: DistributorClientsSectionId,
): boolean {
  return parseYourClientsPathname(pathname).sectionId === sectionId;
}

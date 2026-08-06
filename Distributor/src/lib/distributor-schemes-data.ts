export type DistributorScheme = {
  id: string;
  name: string;
  amc: string;
  irn: string;
  minAmount: number;
  maxAmount: number;
  category: string;
  logoMark: string;
};

export const DUMMY_SCHEMES: DistributorScheme[] = [];

export function getDistributorSchemeById(id: string): DistributorScheme | undefined {
  return DUMMY_SCHEMES.find((scheme) => scheme.id === id);
}

export function searchSchemes(schemes: DistributorScheme[], query: string): DistributorScheme[] {
  const q = query.trim().toLowerCase();
  if (!q) return schemes;
  return schemes.filter(
    (scheme) =>
      scheme.name.toLowerCase().includes(q) ||
      scheme.amc.toLowerCase().includes(q) ||
      scheme.irn.toLowerCase().includes(q) ||
      scheme.category.toLowerCase().includes(q) ||
      scheme.logoMark.toLowerCase().includes(q),
  );
}

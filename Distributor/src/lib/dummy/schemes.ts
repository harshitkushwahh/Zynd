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

export const DUMMY_SCHEMES: DistributorScheme[] = [
  {
    id: "sch-flexi",
    name: "Zynd Flexi Cap Direct Growth",
    amc: "Zynd Mutual Fund",
    irn: "INFZYND001234",
    minAmount: 500,
    maxAmount: 500000,
    category: "Equity",
    logoMark: "ZF",
  },
  {
    id: "sch-liquid",
    name: "Zynd Liquid Direct Growth",
    amc: "Zynd Mutual Fund",
    irn: "INFZYND004321",
    minAmount: 1000,
    maxAmount: 1000000,
    category: "Debt",
    logoMark: "ZL",
  },
  {
    id: "sch-elss",
    name: "Zynd Tax Saver ELSS Direct Growth",
    amc: "Zynd Mutual Fund",
    irn: "INFZYND009876",
    minAmount: 500,
    maxAmount: 150000,
    category: "ELSS",
    logoMark: "ZE",
  },
  {
    id: "sch-index",
    name: "Zynd Nifty 50 Index Direct Growth",
    amc: "Zynd Mutual Fund",
    irn: "INFZYND005678",
    minAmount: 500,
    maxAmount: 250000,
    category: "Index",
    logoMark: "ZN",
  },
  {
    id: "sch-hybrid",
    name: "Zynd Balanced Advantage Direct Growth",
    amc: "Zynd Mutual Fund",
    irn: "INFZYND003456",
    minAmount: 500,
    maxAmount: 750000,
    category: "Hybrid",
    logoMark: "ZB",
  },
];

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

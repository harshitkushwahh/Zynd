import type {
  DistributorInvestor,
  InvestorServiceModel,
  InvestorType,
} from "@/lib/dummy/types";

const DISTRIBUTOR_BOOK_IDS = new Set([
  "inv-002",
  "inv-004",
  "inv-007",
  "inv-008",
  "inv-009",
  "inv-010",
  "inv-013",
  "inv-014",
]);

type InvestorSeed = Omit<DistributorInvestor, "inDistributorBook" | "serviceModel"> & {
  inDistributorBook?: boolean;
  serviceModel?: InvestorServiceModel;
};

function attachInvestorMeta(row: InvestorSeed): DistributorInvestor {
  const inDistributorBook = row.inDistributorBook ?? DISTRIBUTOR_BOOK_IDS.has(row.id);
  const serviceModel =
    row.serviceModel ??
    (row.investorType === "Resident Individual"
      ? Number.parseInt(row.id.replace(/\D/g, ""), 10) % 2 === 0
        ? "diy"
        : "pm"
      : undefined);

  const { inDistributorBook: _book, serviceModel: _model, ...rest } = row;
  return { ...rest, inDistributorBook, serviceModel };
}

const INVESTOR_SEEDS: InvestorSeed[] = [
  {
    id: "inv-001",
    emailMasked: "ne**************1204@gmail.com",
    panMasked: "AKHP*****R",
    clientCode: "ZYD0000194",
    mobileMasked: "*****48201",
    onboardingStatus: "Onboarded",
    complianceStatus: "Compliant",
    investmentStatus: "Non Invested",
    investorType: "Resident Individual",
    aum: 0,
    createdAt: "2026-07-10T09:12:00.000Z",
    inDistributorBook: false,
    serviceModel: "diy",
  },
  {
    id: "inv-002",
    emailMasked: "vi*******41@gmail.com",
    panMasked: "BWNP*****G",
    clientCode: "ZYD0000193",
    mobileMasked: "*****11889",
    onboardingStatus: "Pending",
    complianceStatus: "Compliant",
    investmentStatus: "Non Invested",
    investorType: "Resident Individual",
    aum: null,
    createdAt: "2026-06-16T11:40:00.000Z",
  },
  {
    id: "inv-003",
    emailMasked: "—",
    panMasked: "CHQP*****D",
    clientCode: "ZYD0000192",
    mobileMasked: "—",
    onboardingStatus: "Pending",
    complianceStatus: "Non Compliant",
    investmentStatus: "Non Invested",
    investorType: "Resident Individual",
    aum: null,
    createdAt: "2026-06-11T08:05:00.000Z",
    inDistributorBook: false,
  },
  {
    id: "inv-004",
    emailMasked: "mo********ews@gmail.com",
    panMasked: "AKMP*****D",
    clientCode: "ZYD0000191",
    mobileMasked: "*****52513",
    onboardingStatus: "Pending",
    complianceStatus: "Compliant",
    investmentStatus: "Non Invested",
    investorType: "Resident Individual",
    aum: null,
    createdAt: "2026-06-11T14:22:00.000Z",
  },
  {
    id: "inv-005",
    emailMasked: "sh*******asa@gmail.com",
    panMasked: "CDXP*****J",
    clientCode: "ZYD0000190",
    mobileMasked: "*****15426",
    onboardingStatus: "Pending",
    complianceStatus: "Non Compliant",
    investmentStatus: "Non Invested",
    investorType: "Resident Individual",
    aum: null,
    createdAt: "2026-06-10T16:18:00.000Z",
    inDistributorBook: false,
    serviceModel: "pm",
  },
  {
    id: "inv-006",
    emailMasked: "mo********401@gmail.com",
    panMasked: "GGSP*****A",
    clientCode: "ZYD0000188",
    mobileMasked: "*****54824",
    onboardingStatus: "Pending",
    complianceStatus: "Compliant",
    investmentStatus: "Non Invested",
    investorType: "Resident Individual",
    aum: null,
    createdAt: "2026-06-10T10:44:00.000Z",
    inDistributorBook: false,
    serviceModel: "diy",
  },
  {
    id: "inv-007",
    emailMasked: "k*******n6@gmail.com",
    panMasked: "IIWP*****A",
    clientCode: "ZYD0000187",
    mobileMasked: "*****47004",
    onboardingStatus: "Onboarded",
    complianceStatus: "Compliant",
    investmentStatus: "Invested",
    investorType: "Resident Individual",
    aum: 2_125_000,
    createdAt: "2026-06-10T07:30:00.000Z",
  },
  {
    id: "inv-008",
    emailMasked: "r****73@gmail.com",
    panMasked: "EOTP*****M",
    clientCode: "ZYD0000186",
    mobileMasked: "*****67640",
    onboardingStatus: "Onboarded",
    complianceStatus: "Non Compliant",
    investmentStatus: "Invested",
    investorType: "Resident Individual",
    aum: 999.96,
    createdAt: "2026-06-09T19:05:00.000Z",
  },
  {
    id: "inv-009",
    emailMasked: "ra**********023@gmail.com",
    panMasked: "BKGP*****P",
    clientCode: "ZYD0000185",
    mobileMasked: "*****41782",
    onboardingStatus: "Onboarded",
    complianceStatus: "Compliant",
    investmentStatus: "Invested",
    investorType: "Resident Individual",
    aum: 999.96,
    createdAt: "2026-06-09T12:50:00.000Z",
  },
  {
    id: "inv-010",
    emailMasked: "bi********708@gmail.com",
    panMasked: "GJZP*****J",
    clientCode: "ZYD0000184",
    mobileMasked: "*****21951",
    onboardingStatus: "Pending",
    complianceStatus: "Compliant",
    investmentStatus: "Non Invested",
    investorType: "Resident Individual",
    aum: null,
    createdAt: "2026-06-08T15:10:00.000Z",
  },
  {
    id: "inv-011",
    emailMasked: "pr*************yani@gmail.com",
    panMasked: "JKTP*****G",
    clientCode: "ZYD0000183",
    mobileMasked: "*****12519",
    onboardingStatus: "Pending",
    complianceStatus: "Non Compliant",
    investmentStatus: "Non Invested",
    investorType: "Resident Individual",
    aum: null,
    createdAt: "2026-06-08T09:28:00.000Z",
    inDistributorBook: false,
  },
  {
    id: "inv-012",
    emailMasked: "la********ahu@gmail.com",
    panMasked: "BSAP*****P",
    clientCode: "ZYD0000182",
    mobileMasked: "*****89591",
    onboardingStatus: "Pending",
    complianceStatus: "Non Compliant",
    investmentStatus: "Non Invested",
    investorType: "Resident Individual",
    aum: null,
    createdAt: "2026-06-08T08:15:00.000Z",
    inDistributorBook: false,
  },
  {
    id: "inv-013",
    emailMasked: "sa*************n663@gmail.com",
    panMasked: "BGDP*****A",
    clientCode: "ZYD0000181",
    mobileMasked: "*****86586",
    onboardingStatus: "Onboarded",
    complianceStatus: "Compliant",
    investmentStatus: "Invested",
    investorType: "Resident Individual",
    aum: 999.96,
    createdAt: "2026-06-05T13:42:00.000Z",
  },
  {
    id: "inv-014",
    emailMasked: "lo*******ata@icloud.com",
    panMasked: "DRNP*****A",
    clientCode: "ZYD0000180",
    mobileMasked: "*****30942",
    onboardingStatus: "Onboarded",
    complianceStatus: "Compliant",
    investmentStatus: "Invested",
    investorType: "Resident Individual",
    aum: 2499.5,
    createdAt: "2026-06-05T10:05:00.000Z",
  },
  {
    id: "inv-015",
    emailMasked: "am******uk@outlook.com",
    panMasked: "PQRS*****L",
    clientCode: "ZYD0000179",
    mobileMasked: "*****77120",
    onboardingStatus: "Onboarded",
    complianceStatus: "Compliant",
    investmentStatus: "Invested",
    investorType: "Non Resident Individual",
    aum: 12500,
    createdAt: "2026-05-28T17:20:00.000Z",
    inDistributorBook: false,
  },
  {
    id: "inv-016",
    emailMasked: "de******sg@yahoo.com",
    panMasked: "LMNO*****Q",
    clientCode: "ZYD0000178",
    mobileMasked: "*****33481",
    onboardingStatus: "Pending",
    complianceStatus: "Compliant",
    investmentStatus: "Non Invested",
    investorType: "Non Resident Individual",
    aum: null,
    createdAt: "2026-05-22T06:55:00.000Z",
    inDistributorBook: false,
  },
  {
    id: "inv-017",
    emailMasked: "ni********ae@gmail.com",
    panMasked: "UVWX*****T",
    clientCode: "ZYD0000177",
    mobileMasked: "*****90211",
    onboardingStatus: "Onboarded",
    complianceStatus: "Non Compliant",
    investmentStatus: "Invested",
    investorType: "Non Resident Individual",
    aum: 5200.25,
    createdAt: "2026-05-18T21:10:00.000Z",
    inDistributorBook: false,
  },
  {
    id: "inv-018",
    emailMasked: "ta******io@proton.me",
    panMasked: "YZAB*****C",
    clientCode: "ZYD0000176",
    mobileMasked: "*****44880",
    onboardingStatus: "Onboarded",
    complianceStatus: "Compliant",
    investmentStatus: "Invested",
    investorType: "Non Resident Individual",
    aum: 8750,
    createdAt: "2026-05-12T12:00:00.000Z",
    inDistributorBook: false,
  },
  {
    id: "inv-019",
    emailMasked: "pm***********desk@zynd.in",
    panMasked: "PMXX*****Z",
    clientCode: "ZYD0000175",
    mobileMasked: "*****22001",
    onboardingStatus: "Onboarded",
    complianceStatus: "Compliant",
    investmentStatus: "Invested",
    investorType: "Resident Individual",
    aum: 185000,
    createdAt: "2026-04-02T09:00:00.000Z",
    inDistributorBook: false,
    serviceModel: "pm",
  },
  {
    id: "inv-020",
    emailMasked: "diy*****user@gmail.com",
    panMasked: "DIYY*****K",
    clientCode: "ZYD0000174",
    mobileMasked: "*****88102",
    onboardingStatus: "Onboarded",
    complianceStatus: "Compliant",
    investmentStatus: "Invested",
    investorType: "Resident Individual",
    aum: 12400,
    createdAt: "2026-03-18T14:22:00.000Z",
    inDistributorBook: false,
    serviceModel: "diy",
  },
];

/** Fully synthetic investor book — no real PII. */
export const DUMMY_INVESTORS: DistributorInvestor[] = INVESTOR_SEEDS.map(attachInvestorMeta);

export function filterInvestorsByType(
  investors: DistributorInvestor[],
  investorType?: InvestorType,
): DistributorInvestor[] {
  if (!investorType) return investors;
  return investors.filter((investor) => investor.investorType === investorType);
}

export function filterDistributorBookInvestors(investors: DistributorInvestor[]): DistributorInvestor[] {
  return investors.filter((investor) => investor.inDistributorBook);
}

export function filterSystemResidentInvestors(investors: DistributorInvestor[]): DistributorInvestor[] {
  return filterInvestorsByType(investors, "Resident Individual");
}

export function searchInvestors(
  investors: DistributorInvestor[],
  query: string,
): DistributorInvestor[] {
  const q = query.trim().toLowerCase();
  if (!q) return investors;
  return investors.filter(
    (investor) =>
      investor.emailMasked.toLowerCase().includes(q) ||
      investor.panMasked.toLowerCase().includes(q) ||
      investor.clientCode.toLowerCase().includes(q) ||
      investor.mobileMasked.toLowerCase().includes(q),
  );
}

import { DUMMY_INVESTORS } from "@/lib/dummy/investors";
import { DUMMY_ORDERS } from "@/lib/dummy/orders";
import { DUMMY_SYSTEMATIC_PLANS } from "@/lib/dummy/systematic-plans";
import type {
  DistributorClientFamilyGroup,
  DistributorClientFamilyMember,
  DistributorClientGoal,
  DistributorClientHolding,
  DistributorClientKycStep,
  DistributorClientPersonalInfo,
  DistributorClientProfile,
  DistributorClientReferralSummary,
  DistributorClientSession,
  DistributorInvestor,
  DistributorOrder,
  DistributorSystematicPlan,
} from "@/lib/dummy/types";

import { applyKycStepApplicability, summarizeKycProgress } from "@/lib/distributor-client-kyc-steps";
import { buildClientDocumentsForInvestor } from "@/lib/client-documents";
import { buildKycAuditLogForClient } from "@/lib/client-kyc-audit-log";
import { DISTRIBUTOR_KYC_STEPS } from "@/lib/distributor-client-copy";
import {
  buildDistributorClientPortfolioDemoHoldings,
  getDistributorClientPortfolioDemo,
} from "@/lib/distributor-client-portfolio-demo";
import {
  normalizeRiskScore,
  tierIdFromLabel,
} from "@/lib/risk-profile/risk-tier-ui";

import {
  resolveDistributorClientContactEmail,
  resolveDistributorClientContactPhone,
} from "@/lib/distributor-client-contact";

const KYC_STEP_DEFS = DISTRIBUTOR_KYC_STEPS;

const DISPLAY_NAMES: Record<string, string> = {
  "inv-007": "Kiran N.",
  "inv-008": "Rahul S.",
  "inv-009": "Ravi K.",
  "inv-013": "Sanjay M.",
  "inv-014": "Lata S.",
  "inv-015": "Amrita K.",
  "inv-018": "Tanvi R.",
};

const RISK_LABELS = ["Conservative", "Moderate", "Balanced", "Growth", "Aggressive"] as const;

function hashSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function displayNameFor(investor: DistributorInvestor): string {
  return DISPLAY_NAMES[investor.id] ?? `Client ${investor.clientCode.slice(-4)}`;
}

function emailDisplayFor(investor: DistributorInvestor): string {
  if (investor.emailMasked === "—") return "Email not on file";
  return investor.emailMasked;
}

function buildStableRiskAssessedAt(investorId: string): string {
  const seed = hashSeed(investorId);
  // Fixed demo clock: 29 Jul 2026, 9:15 pm IST (15:45 UTC), offset per client for history variety.
  const base = Date.UTC(2026, 6, 29, 15, 45, 0);
  return new Date(base - (seed % 10) * 86400000).toISOString();
}

function buildKycInitiatedAt(investor: DistributorInvestor): string {
  const createdMs = new Date(investor.createdAt).getTime();
  const seed = hashSeed(investor.id);
  const daysBeforeStart = 2 + (seed % 10);
  return new Date(createdMs - daysBeforeStart * 86400000).toISOString();
}

function buildKycSteps(investor: DistributorInvestor): DistributorClientKycStep[] {
  const seed = hashSeed(investor.id);
  const onboarded = investor.onboardingStatus === "Onboarded";
  const completedCount = onboarded
    ? KYC_STEP_DEFS.length
    : Math.min(KYC_STEP_DEFS.length - 1, 2 + (seed % 5));

  return applyKycStepApplicability(
    KYC_STEP_DEFS.map((step, index) => {
      if (index < completedCount) {
        return { ...step, status: "completed" as const };
      }
      if (!onboarded && index === completedCount && investor.complianceStatus === "Non Compliant") {
        return { ...step, status: "failed" as const };
      }
      return { ...step, status: "pending" as const };
    }),
    investor.complianceStatus === "Compliant",
  );
}

function buildHoldings(investor: DistributorInvestor): DistributorClientHolding[] {
  if (investor.investmentStatus !== "Invested" || !investor.aum) {
    const demo = getDistributorClientPortfolioDemo(investor.id);
    return buildDistributorClientPortfolioDemoHoldings(investor.id, investor.clientCode, demo);
  }
  const seed = hashSeed(investor.clientCode);
  const primary = investor.aum * 0.65;
  const secondary = investor.aum - primary;
  const asOf = new Date().toISOString().slice(0, 10);

  const primaryUnits = 120 + (seed % 40);
  const primaryNav = primary / primaryUnits;

  return [
    {
      id: `${investor.id}-h1`,
      schemeName: "Zynd Flexi Cap Direct Growth",
      amcName: "Zynd Asset Management",
      folioNumber: `ZY${investor.clientCode.slice(-6)}01`,
      isin: "INF000000101",
      currentValue: primary,
      investedAmount: primary * 0.92,
      redeemableValue: primary,
      units: primaryUnits,
      navPerUnit: primaryNav,
      asOfDate: asOf,
    },
    ...(secondary > 100
      ? (() => {
          const secondaryUnits = 40 + (seed % 20);
          const secondaryNav = secondary / secondaryUnits;
          return [
            {
              id: `${investor.id}-h2`,
              schemeName: "Zynd Liquid Direct Growth",
              amcName: "Zynd Asset Management",
              folioNumber: `ZY${investor.clientCode.slice(-6)}02`,
              isin: "INF000000202",
              currentValue: secondary,
              investedAmount: secondary * 0.98,
              redeemableValue: secondary,
              units: secondaryUnits,
              navPerUnit: secondaryNav,
              asOfDate: asOf,
            },
          ];
        })()
      : []),
  ];
}

function buildGoals(investor: DistributorInvestor): DistributorClientGoal[] {
  const seed = hashSeed(investor.id);
  if (investor.investmentStatus !== "Invested") {
    return [
      {
        id: `${investor.id}-g1`,
        title: "Emergency fund",
        category: "Safety",
        targetAmount: 100000,
        currentAmount: 0,
        progressPct: 0,
        status: "draft",
        targetDate: "2027-12-31",
        scope: "personal",
      },
    ];
  }
  const retirementTarget = 5_000_000;
  const retirementCurrent = 1_875_000 + (seed % 5) * 125_000;
  const goals: DistributorClientGoal[] = [
    {
      id: `${investor.id}-g1`,
      title: "Retirement corpus",
      category: "Retirement",
      targetAmount: retirementTarget,
      currentAmount: retirementCurrent,
      progressPct: Math.min(100, Math.round((retirementCurrent / retirementTarget) * 100)),
      status: "active",
      targetDate: "2045-06-01",
      scope: "personal",
    },
  ];
  if (seed % 2 === 0) {
    const educationTarget = 2_500_000;
    const educationCurrent = 625_000 + (seed % 4) * 75_000;
    goals.push({
      id: `${investor.id}-g2`,
      title: "Child education",
      category: "Education",
      targetAmount: educationTarget,
      currentAmount: educationCurrent,
      progressPct: Math.min(100, Math.round((educationCurrent / educationTarget) * 100)),
      status: "active",
      targetDate: "2038-04-01",
      scope: "family",
      familyGroupName: "Family orbit",
    });
  }
  const reserveTarget = 800_000;
  const reserveCurrent = seed % 3 === 0 ? 0 : 120_000 + (seed % 4) * 40_000;
  goals.push({
    id: `${investor.id}-g3`,
    title: "Emergency reserve",
    category: "Safety",
    targetAmount: reserveTarget,
    currentAmount: reserveCurrent,
    progressPct: Math.min(100, Math.round((reserveCurrent / reserveTarget) * 100)),
    status: reserveCurrent > 0 ? "active" : "draft",
    targetDate: "2028-03-01",
    scope: "personal",
  });
  return goals;
}

/** Demo goal rows for client detail — kept in sync with profile builder. */
export function buildClientGoalsForInvestor(investor: DistributorInvestor): DistributorClientGoal[] {
  return buildGoals(investor);
}

function demoGoalProgressPct(current: number, target: number): number {
  if (target <= 0 || current <= 0) return 0;
  const raw = (current / target) * 100;
  if (raw > 0 && raw < 1) return 1;
  return Math.min(100, Math.round(raw));
}

function splitGoalMemberContributions(
  goalTotal: number,
  members: DistributorClientFamilyMember[],
): DistributorClientGoal["memberContributions"] {
  if (goalTotal <= 0 || members.length === 0) {
    return members.map((member) => ({
      userId: member.userId,
      displayName: member.displayName,
      amount: 0,
    }));
  }

  const portfolioTotal = members.reduce(
    (sum, member) => sum + (member.portfolioContribution ?? 0),
    0,
  );

  if (portfolioTotal <= 0) {
    const even = Math.floor(goalTotal / members.length);
    return members.map((member, index) => ({
      userId: member.userId,
      displayName: member.displayName,
      amount:
        index === members.length - 1
          ? goalTotal - even * (members.length - 1)
          : even,
    }));
  }

  let allocated = 0;
  return members.map((member, index) => {
    if (index === members.length - 1) {
      return {
        userId: member.userId,
        displayName: member.displayName,
        amount: goalTotal - allocated,
      };
    }
    const amount = Math.round(
      goalTotal * ((member.portfolioContribution ?? 0) / portfolioTotal),
    );
    allocated += amount;
    return {
      userId: member.userId,
      displayName: member.displayName,
      amount,
    };
  });
}

function buildFamilyGroupGoals(
  investor: DistributorInvestor,
  groupName: string,
  members: DistributorClientFamilyMember[],
  familyPortfolioTotal: number,
  goalIdPrefix: string,
): DistributorClientGoal[] {
  if (investor.investmentStatus !== "Invested") return [];
  const seed = hashSeed(investor.id);
  const portfolioBase =
    familyPortfolioTotal > 0 ? familyPortfolioTotal : Math.max(investor.aum ?? 0, 750_000);

  const head = members.find((member) => member.role === "head");
  const ownerName = head?.displayName ?? displayNameFor(investor);

  const homeCurrent = Math.round(portfolioBase * 0.35);
  const homeTarget = Math.max(Math.round(portfolioBase * 4.5), homeCurrent + 1);
  const educationCurrent = Math.round(portfolioBase * 0.18);
  const educationTarget = Math.max(Math.round(portfolioBase * 3.2), educationCurrent + 1);

  const goals: DistributorClientGoal[] = [
    {
      id: `${goalIdPrefix}-g1`,
      title: "Family home down payment",
      category: "Home",
      goalType: "home",
      priority: "high",
      createdByDisplayName: ownerName,
      createdByRole: "owner",
      memberContributions: splitGoalMemberContributions(homeCurrent, members),
      targetAmount: homeTarget,
      currentAmount: homeCurrent,
      progressPct: demoGoalProgressPct(homeCurrent, homeTarget),
      status: "active",
      targetDate: "2030-08-01",
      scope: "family",
      familyGroupName: groupName,
    },
    {
      id: `${goalIdPrefix}-g2`,
      title: "Children education",
      category: "Education",
      goalType: "education",
      priority: "medium",
      createdByDisplayName: ownerName,
      createdByRole: "owner",
      memberContributions: splitGoalMemberContributions(educationCurrent, members),
      targetAmount: educationTarget,
      currentAmount: educationCurrent,
      progressPct: demoGoalProgressPct(educationCurrent, educationTarget),
      status: seed % 3 === 0 ? "paused" : "active",
      targetDate: "2035-04-01",
      scope: "family",
      familyGroupName: groupName,
    },
  ];

  if (seed % 2 === 0) {
    const weddingCurrent = Math.round(portfolioBase * 0.12);
    const weddingTarget = Math.max(Math.round(portfolioBase * 3.8), weddingCurrent + 1);
    goals.push({
      id: `${goalIdPrefix}-g3`,
      title: "Wedding fund",
      category: "Wedding",
      goalType: "wedding",
      priority: "medium",
      createdByDisplayName: ownerName,
      createdByRole: "owner",
      memberContributions: splitGoalMemberContributions(weddingCurrent, members),
      targetAmount: weddingTarget,
      currentAmount: weddingCurrent,
      progressPct: demoGoalProgressPct(weddingCurrent, weddingTarget),
      status: "active",
      targetDate: "2032-11-01",
      scope: "family",
      familyGroupName: groupName,
    });
  } else {
    const carCurrent = Math.round(portfolioBase * 0.09);
    const carTarget = Math.max(Math.round(portfolioBase * 2.8), carCurrent + 1);
    goals.push({
      id: `${goalIdPrefix}-g3`,
      title: "Family car upgrade",
      category: "Car",
      goalType: "car",
      priority: "low",
      createdByDisplayName: ownerName,
      createdByRole: "owner",
      memberContributions: splitGoalMemberContributions(carCurrent, members),
      targetAmount: carTarget,
      currentAmount: carCurrent,
      progressPct: demoGoalProgressPct(carCurrent, carTarget),
      status: "active",
      targetDate: "2029-06-01",
      scope: "family",
      familyGroupName: groupName,
    });
  }

  return goals.filter((goal) => goal.status === "active" || goal.status === "paused").slice(0, 3);
}

function splitDemoAumThreeWays(total: number): [number, number, number] {
  if (total <= 0) return [0, 0, 0];
  const first = Math.round(total * 0.52 * 100) / 100;
  const second = Math.round(total * 0.28 * 100) / 100;
  const third = Math.round((total - first - second) * 100) / 100;
  return [first, second, third];
}

function demoMemberPortfolioShares(totalValue: number): {
  headShare: number;
  memberShare: number;
  memberShare2: number;
} {
  const headShare = totalValue > 0 ? Math.round(totalValue * 0.58 * 100) / 100 : 0;
  const memberShare = totalValue > 0 ? Math.round(totalValue * 0.27 * 100) / 100 : 0;
  const memberShare2 =
    totalValue > 0 ? Math.round((totalValue - headShare - memberShare) * 100) / 100 : 0;
  return { headShare, memberShare, memberShare2 };
}

function assembleFamilyGroup(input: {
  investor: DistributorInvestor;
  id: string;
  name: string;
  description: string;
  role: "owner" | "member";
  tag?: string | null;
  totalValue: number;
  members: DistributorClientFamilyMember[];
  goalIdPrefix: string;
}): DistributorClientFamilyGroup {
  const goals = buildFamilyGroupGoals(
    input.investor,
    input.name,
    input.members,
    input.totalValue,
    input.goalIdPrefix,
  );
  const head = input.members.find((member) => member.role === "head");
  return {
    id: input.id,
    name: input.name,
    description: input.description,
    tag: input.tag ?? null,
    role: input.role,
    memberCount: input.members.length,
    activeGoals: goals.filter((goal) => goal.status === "active").length,
    totalValue: input.totalValue,
    headDisplayName: head?.displayName ?? null,
    headUserId: head?.userId ?? null,
    members: input.members,
    goals,
  };
}

/** Demo: Ravi K. (ZYD0000185) belongs to three family groups for Family tab layout. */
function buildInv009FamilyGroups(investor: DistributorInvestor): DistributorClientFamilyGroup[] {
  const headName = displayNameFor(investor);
  const [totalSharma, totalMehta, totalOrbit] = splitDemoAumThreeWays(investor.aum ?? 0);
  const sharmaShares = demoMemberPortfolioShares(totalSharma);
  const mehtaShares = demoMemberPortfolioShares(totalMehta);
  const orbitShares = demoMemberPortfolioShares(totalOrbit);

  const raviAsYourClientFields = {
    linkedInvestorId: investor.id,
    inYourBook: investor.inDistributorBook,
    contactEmail: investor.inDistributorBook
      ? resolveDistributorClientContactEmail(investor)
      : null,
    contactPhone: investor.inDistributorBook
      ? resolveDistributorClientContactPhone(investor)
      : null,
    badgeLabel: investor.inDistributorBook ? "Your client" : null,
  } satisfies Partial<DistributorClientFamilyMember>;

  const sharmaMembers: DistributorClientFamilyMember[] = [
    {
      userId: `${investor.id}-head`,
      displayName: headName,
      role: "head",
      emailMasked: investor.emailMasked,
      portfolioContribution: sharmaShares.headShare,
      ...raviAsYourClientFields,
    },
    {
      userId: `${investor.id}-fg1-m2`,
      displayName: "Rohan K.",
      role: "member",
      emailMasked: "r***@example.com",
      portfolioContribution: sharmaShares.memberShare,
    },
    {
      userId: `${investor.id}-fg1-m3`,
      displayName: "Arjun T.",
      role: "member",
      emailMasked: "a***@example.com",
      portfolioContribution: sharmaShares.memberShare2,
    },
  ];

  const mehtaMembers: DistributorClientFamilyMember[] = [
    {
      userId: `${investor.id}-fg2-head`,
      displayName: "Suresh Mehta",
      role: "head",
      emailMasked: "s***@example.com",
      portfolioContribution: mehtaShares.headShare,
    },
    {
      userId: `${investor.id}-fg2-ravi`,
      displayName: headName,
      role: "member",
      emailMasked: investor.emailMasked,
      portfolioContribution: mehtaShares.memberShare,
      ...raviAsYourClientFields,
    },
    {
      userId: `${investor.id}-fg2-m3`,
      displayName: "Anita Mehta",
      role: "member",
      emailMasked: "a***@example.com",
      portfolioContribution: mehtaShares.memberShare2,
    },
  ];

  const orbitMembers: DistributorClientFamilyMember[] = [
    {
      userId: `${investor.id}-fg3-head`,
      displayName: "Priya S.",
      role: "head",
      emailMasked: "p***@example.com",
      portfolioContribution: orbitShares.headShare,
    },
    {
      userId: `${investor.id}-fg3-ravi`,
      displayName: headName,
      role: "member",
      emailMasked: investor.emailMasked,
      portfolioContribution: orbitShares.memberShare,
      ...raviAsYourClientFields,
    },
  ];

  return [
    assembleFamilyGroup({
      investor,
      id: `${investor.id}-fg1`,
      name: "Sharma family",
      description:
        "Shared investments, goals, and portfolio visibility for everyone in this group.",
      role: "owner",
      tag: null,
      totalValue: totalSharma,
      members: sharmaMembers,
      goalIdPrefix: `${investor.id}-fg1`,
    }),
    assembleFamilyGroup({
      investor,
      id: `${investor.id}-fg2`,
      name: "Mehta extended",
      description: "In-laws and siblings — coordinated SIPs and long-term goals.",
      role: "member",
      totalValue: totalMehta,
      members: mehtaMembers,
      goalIdPrefix: `${investor.id}-fg2`,
    }),
    assembleFamilyGroup({
      investor,
      id: `${investor.id}-fg3`,
      name: "Family orbit",
      description: "Close relatives investing together with shared visibility.",
      role: "member",
      totalValue: totalOrbit,
      members: orbitMembers,
      goalIdPrefix: `${investor.id}-fg3`,
    }),
  ];
}

function buildFamilyGroups(investor: DistributorInvestor): DistributorClientFamilyGroup[] {
  if (investor.id === "inv-009" || investor.clientCode === "ZYD0000185") {
    return buildInv009FamilyGroups(investor);
  }

  const seed = hashSeed(investor.id);
  if (seed % 3 === 0 && investor.investmentStatus !== "Invested") return [];

  const groupName = seed % 2 === 0 ? "Family orbit" : "Sharma family";
  const headName = displayNameFor(investor);
  const totalValue = investor.aum ?? 0;
  const headShare = totalValue > 0 ? Math.round(totalValue * 0.58) : 0;
  const memberShare = totalValue > 0 ? Math.round(totalValue * 0.27) : 0;
  const memberShare2 = totalValue > 0 ? totalValue - headShare - memberShare : 0;

  const headMember: DistributorClientFamilyMember = {
    userId: `${investor.id}-head`,
    displayName: headName,
    role: "head",
    emailMasked: investor.emailMasked,
    linkedInvestorId: investor.id,
    inYourBook: investor.inDistributorBook,
    contactEmail: investor.inDistributorBook
      ? resolveDistributorClientContactEmail(investor)
      : null,
    contactPhone: investor.inDistributorBook
      ? resolveDistributorClientContactPhone(investor)
      : null,
    badgeLabel: investor.inDistributorBook ? "Your client" : null,
    portfolioContribution: headShare,
  };

  const rawMembers: DistributorClientFamilyMember[] = [
    headMember,
    {
      userId: `${investor.id}-m2`,
      displayName: seed % 2 === 0 ? "Priya S." : "Rohan K.",
      role: "member",
      emailMasked: "p***@example.com",
      portfolioContribution: memberShare,
    },
    {
      userId: `${investor.id}-m3`,
      displayName: seed % 3 === 0 ? "Meera V." : "Arjun T.",
      role: "member",
      emailMasked: "a***@example.com",
      portfolioContribution: memberShare2,
    },
  ];

  const members = rawMembers.slice(0, 2 + (seed % 2));
  const familyGoals = buildFamilyGroupGoals(
    investor,
    groupName,
    members,
    totalValue,
    `${investor.id}-fg1`,
  );
  const activeGoals = familyGoals.filter((goal) => goal.status === "active").length;

  return [
    {
      id: `${investor.id}-fg1`,
      name: groupName,
      description:
        "Shared investments, goals, and portfolio visibility for everyone in this group.",
      role: seed % 4 === 0 ? "member" : "owner",
      memberCount: members.length,
      activeGoals,
      totalValue,
      headDisplayName: headName,
      headUserId: `${investor.id}-head`,
      members,
      goals: familyGoals,
    },
  ];
}

function buildReferrals(investor: DistributorInvestor): DistributorClientReferralSummary {
  const seed = hashSeed(investor.clientCode);
  const total = seed % 12;
  return {
    totalReferrals: total,
    kycVerified: Math.floor(total * 0.6),
    firstInvestment: Math.floor(total * 0.35),
    qualified: Math.floor(total * 0.2),
    referralCode: `ZYND${investor.clientCode.slice(-4)}`,
  };
}

function buildSessions(investor: DistributorInvestor): DistributorClientSession[] {
  const now = Date.now();
  return [
    {
      id: `${investor.id}-s1`,
      deviceLabel: "Chrome on macOS",
      os: "macOS",
      browser: "Chrome",
      lastActiveAt: new Date(now - 1000 * 60 * 12).toISOString(),
      isCurrent: true,
    },
  ];
}

function buildPersonalInfo(investor: DistributorInvestor): DistributorClientPersonalInfo {
  const onboarded = investor.onboardingStatus === "Onboarded";
  const seed = hashSeed(investor.id);

  if (!onboarded) {
    return {
      bankAccounts: [],
      addresses: [],
      connectedAccounts: {
        google: { connected: false },
        apple: { connected: false },
      },
    };
  }

  return {
    bankAccounts: [
      {
        id: `${investor.id}-bank-1`,
        bankName: seed % 2 === 0 ? "HDFC Bank" : "ICICI Bank",
        accountNumberMasked: "•••• 4820",
        ifscCode: seed % 2 === 0 ? "HDFC0001234" : "ICIC0000987",
        accountType: "Savings",
        isPrimary: true,
        verificationStatus: "verified",
      },
      {
        id: `${investor.id}-bank-2`,
        bankName: seed % 2 === 0 ? "Axis Bank" : "HDFC Bank",
        accountNumberMasked: "•••• 9102",
        ifscCode: seed % 2 === 0 ? "UTIB0000456" : "HDFC0005678",
        accountType: "Current",
        isPrimary: false,
        verificationStatus: "verified",
      },
    ],
    addresses: [
      {
        id: `${investor.id}-addr-1`,
        label: "Permanent",
        line1: "42, 1st Main Road, Indiranagar",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560038",
        country: "India",
        isPrimary: true,
      },
      {
        id: `${investor.id}-addr-2`,
        label: "Correspondence",
        line1: "9th Floor, Brigade Gateway, Malleshwaram",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560038",
        country: "India",
        isPrimary: false,
      },
    ],
    connectedAccounts: {
      google: {
        connected: true,
        emailMasked: investor.emailMasked,
      },
      apple: {
        connected: seed % 3 !== 0,
        emailMasked: seed % 3 !== 0 ? "pr*********@privaterelay.appleid.com" : null,
      },
    },
  };
}

export function getInvestorById(investorId: string): DistributorInvestor | undefined {
  return DUMMY_INVESTORS.find((investor) => investor.id === investorId);
}

export function getOrdersForClient(clientCode: string): DistributorOrder[] {
  return DUMMY_ORDERS.filter((order) => order.clientCode === clientCode);
}

export function getSipsForClient(clientCode: string): DistributorSystematicPlan[] {
  return DUMMY_SYSTEMATIC_PLANS.filter((plan) => plan.clientCode === clientCode);
}

/** Client detail — book rows first, then demo activity for invested / onboarded clients. */
export function buildClientOrdersForInvestor(investor: DistributorInvestor): DistributorOrder[] {
  const fromBook = getOrdersForClient(investor.clientCode);
  if (fromBook.length > 0) return fromBook;

  const seed = hashSeed(investor.id);
  const email = investor.emailMasked;
  const onboarded = investor.onboardingStatus === "Onboarded";
  const invested = investor.investmentStatus === "Invested";

  if (!invested && !(onboarded && investor.inDistributorBook)) return [];

  const schemes = [
    "Zynd Flexi Cap Direct Growth",
    "Zynd Large Cap Direct Growth",
    "Zynd Short Duration Direct Growth",
    "Zynd Index Nifty 50",
    "Zynd Mid Cap Direct Growth",
    "Zynd ELSS Tax Saver Direct Growth",
  ] as const;

  const statuses: DistributorOrder["status"][] = [
    "Completed",
    "Completed",
    "Processing",
    "Pending",
    "Failed",
  ];

  const types: DistributorOrder["orderType"][] = ["Purchase", "Purchase", "Redeem", "Switch", "Purchase"];
  const channels: DistributorOrder["operationChannel"][] = [
    "one-time",
    "sip",
    "redemption",
    "one-time",
    "sip",
  ];

  const count = invested ? 8 : 2;

  return Array.from({ length: count }, (_, index) => {
    const scheme = schemes[(seed + index) % schemes.length]!;
    const status = statuses[(seed + index) % statuses.length]!;
    const orderType = types[(seed + index) % types.length]!;
    const operationChannel = channels[(seed + index) % channels.length]!;
    const dayOffset = 3 + index * 4 + (seed % 5);
    const createdAt = new Date(Date.UTC(2026, 6, 28 - dayOffset, 10 + (index % 6), 15, 0)).toISOString();

    return {
      id: `${investor.id}-ord-${index + 1}`,
      orderRef: `ORD-2026-${8800 + ((seed + index * 7) % 90)}`,
      investorEmailMasked: email,
      clientCode: investor.clientCode,
      schemeName: scheme,
      orderType,
      operationChannel,
      amount: invested ? 499.98 + (seed % 20) * 250 + index * 180 : 999.96,
      status: invested ? status : index === 0 ? "Processing" : "Pending",
      createdAt,
      inDistributorBook: true,
    };
  });
}

export function buildClientSipsForInvestor(investor: DistributorInvestor): DistributorSystematicPlan[] {
  const fromBook = getSipsForClient(investor.clientCode).filter((plan) => plan.planType === "SIP");
  if (fromBook.length > 0) return fromBook;

  const seed = hashSeed(investor.id);
  const email = investor.emailMasked;
  const onboarded = investor.onboardingStatus === "Onboarded";
  const invested = investor.investmentStatus === "Invested";

  if (!invested && !(onboarded && investor.inDistributorBook)) return [];

  const plans: DistributorSystematicPlan[] = [
    {
      id: `${investor.id}-sip-1`,
      planRef: `SIP-${77900 + (seed % 40)}`,
      investorEmailMasked: email,
      clientCode: investor.clientCode,
      schemeName: "Zynd Flexi Cap Direct Growth",
      planType: "SIP",
      amount: invested ? 5000 : 1500,
      frequency: "Monthly",
      status: "Active",
      nextDueAt: "2026-08-08T00:00:00.000Z",
    },
    {
      id: `${investor.id}-sip-2`,
      planRef: `SIP-${77850 + (seed % 30)}`,
      investorEmailMasked: email,
      clientCode: investor.clientCode,
      schemeName: "Zynd Large Cap Direct Growth",
      planType: "SIP",
      amount: invested ? 2500 : 1000,
      frequency: "Monthly",
      status: invested ? "Active" : "Paused",
      nextDueAt: "2026-08-01T00:00:00.000Z",
    },
  ];

  if (invested) {
    plans.push(
      {
        id: `${investor.id}-sip-3`,
        planRef: `SIP-${77820 + (seed % 25)}`,
        investorEmailMasked: email,
        clientCode: investor.clientCode,
        schemeName: "Zynd Index Nifty 50",
        planType: "SIP",
        amount: 1000,
        frequency: "Weekly",
        status: "Cancelled",
        nextDueAt: "2026-05-15T00:00:00.000Z",
      },
      {
        id: `${investor.id}-sip-4`,
        planRef: `SIP-${77790 + (seed % 20)}`,
        investorEmailMasked: email,
        clientCode: investor.clientCode,
        schemeName: "Zynd ELSS Tax Saver Direct Growth",
        planType: "SIP",
        amount: 1500,
        frequency: "Monthly",
        status: "Paused",
        nextDueAt: "2026-09-01T00:00:00.000Z",
      },
      {
        id: `${investor.id}-sip-5`,
        planRef: `SIP-${77760 + (seed % 15)}`,
        investorEmailMasked: email,
        clientCode: investor.clientCode,
        schemeName: "Zynd Mid Cap Direct Growth",
        planType: "SIP",
        amount: 3000,
        frequency: "Monthly",
        status: seed % 3 === 0 ? "Active" : "Paused",
        nextDueAt: "2026-08-12T00:00:00.000Z",
      },
    );
  }

  return plans;
}

export function getDistributorClientProfile(investorId: string): DistributorClientProfile | null {
  const investor = getInvestorById(investorId);
  if (!investor) return null;

  const seed = hashSeed(investor.id);
  const kycSteps = buildKycSteps(investor);
  const { completed: completedSteps, total: applicableTotal } = summarizeKycProgress(kycSteps);
  const kycInitiatedAt = buildKycInitiatedAt(investor);
  const kycAuditLog = buildKycAuditLogForClient(investor, kycSteps, kycInitiatedAt);
  const clientDocuments = buildClientDocumentsForInvestor(investor, kycSteps);

  const riskLabel = RISK_LABELS[seed % RISK_LABELS.length] ?? "Moderate";
  const tier = tierIdFromLabel(riskLabel);
  const score = 200 + (seed % 700);

  return {
    investor,
    displayName: displayNameFor(investor),
    emailDisplay: emailDisplayFor(investor),
    contactEmail: resolveDistributorClientContactEmail(investor),
    contactPhone: resolveDistributorClientContactPhone(investor),
    riskProfileLabel: riskLabel,
    riskProfile: {
      label: riskLabel,
      tier,
      score,
      displayScore: normalizeRiskScore(score),
      assessedAt: buildStableRiskAssessedAt(investor.id),
    },
    mfaEnabled: investor.onboardingStatus === "Onboarded" && seed % 5 !== 0,
    kycOverallStatus:
      investor.onboardingStatus === "Onboarded"
        ? "Completed"
        : `${completedSteps}/${applicableTotal} steps`,
    kycInitiatedAt,
    kycSteps,
    kycAuditLog,
    clientDocuments,
    holdings: buildHoldings(investor),
    goals: buildGoals(investor),
    familyGroups: buildFamilyGroups(investor),
    referrals: buildReferrals(investor),
    sessions: buildSessions(investor),
    personalInfo: buildPersonalInfo(investor),
    orders: buildClientOrdersForInvestor(investor),
    systematicPlans: buildClientSipsForInvestor(investor),
  };
}

export function getFamilyGroupFromProfile(
  profile: DistributorClientProfile,
  groupId: string,
): DistributorClientFamilyGroup | undefined {
  return profile.familyGroups.find((group) => group.id === groupId);
}

export {
  distributorClientDetailHref,
  distributorClientFamilyGroupHref,
} from "@/lib/distributor-client-routes";

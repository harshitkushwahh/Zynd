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

import { DISTRIBUTOR_KYC_STEPS } from "@/lib/distributor-client-copy";
import {
  normalizeRiskScore,
  tierIdFromLabel,
} from "@/lib/risk-profile/risk-tier-ui";

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

function buildKycSteps(investor: DistributorInvestor): DistributorClientKycStep[] {
  const seed = hashSeed(investor.id);
  const onboarded = investor.onboardingStatus === "Onboarded";
  const completedCount = onboarded
    ? KYC_STEP_DEFS.length
    : Math.min(KYC_STEP_DEFS.length - 1, 2 + (seed % 5));

  return KYC_STEP_DEFS.map((step, index) => {
    if (index < completedCount) {
      return { ...step, status: "completed" as const };
    }
    if (!onboarded && index === completedCount && investor.complianceStatus === "Non Compliant") {
      return { ...step, status: "failed" as const };
    }
    return { ...step, status: "pending" as const };
  });
}

function buildHoldings(investor: DistributorInvestor): DistributorClientHolding[] {
  if (investor.investmentStatus !== "Invested" || !investor.aum) return [];
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
        targetAmount: 100000,
        currentAmount: 0,
        progressPct: 0,
        status: "draft",
        targetDate: "2027-12-31",
        scope: "personal",
      },
    ];
  }
  const goals: DistributorClientGoal[] = [
    {
      id: `${investor.id}-g1`,
      title: "Retirement corpus",
      targetAmount: 5000000,
      currentAmount: investor.aum ?? 0,
      progressPct: Math.min(100, Math.round(((investor.aum ?? 0) / 5000000) * 100)),
      status: "active",
      targetDate: "2045-06-01",
      scope: "personal",
    },
  ];
  if (seed % 2 === 0) {
    goals.push({
      id: `${investor.id}-g2`,
      title: "Child education",
      targetAmount: 2500000,
      currentAmount: Math.round((investor.aum ?? 0) * 0.3),
      progressPct: Math.min(
        100,
        Math.round((((investor.aum ?? 0) * 0.3) / 2500000) * 100),
      ),
      status: "active",
      targetDate: "2038-04-01",
      scope: "family",
      familyGroupName: "Family orbit",
    });
  }
  return goals;
}

function buildFamilyGroups(investor: DistributorInvestor): DistributorClientFamilyGroup[] {
  const seed = hashSeed(investor.id);
  if (seed % 3 === 0 && investor.investmentStatus !== "Invested") return [];

  const groupName = seed % 2 === 0 ? "Family orbit" : "Sharma family";
  const headName = displayNameFor(investor);
  const members: DistributorClientFamilyMember[] = [
    {
      userId: `${investor.id}-head`,
      displayName: headName,
      role: "head" as const,
      emailMasked: investor.emailMasked,
    },
    {
      userId: `${investor.id}-m2`,
      displayName: seed % 2 === 0 ? "Priya S." : "Rohan K.",
      role: "member" as const,
      emailMasked: "p***@example.com",
    },
    {
      userId: `${investor.id}-m3`,
      displayName: seed % 3 === 0 ? "Meera V." : "Arjun T.",
      role: "member" as const,
      emailMasked: "a***@example.com",
    },
  ].slice(0, 2 + (seed % 2));

  return [
    {
      id: `${investor.id}-fg1`,
      name: groupName,
      description:
        "Shared visibility for family investments, goals, and portfolio on Zynd.",
      tag: seed % 2 === 0 ? "Core family" : "Extended",
      role: seed % 4 === 0 ? "member" : "owner",
      memberCount: members.length,
      activeGoals: investor.investmentStatus === "Invested" ? 1 + (seed % 2) : 0,
      totalValue: investor.aum ?? 0,
      headDisplayName: headName,
      headUserId: `${investor.id}-head`,
      members,
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
    ],
    addresses: [
      {
        id: `${investor.id}-addr-1`,
        label: "Permanent",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "5600**",
        country: "India",
        isPrimary: true,
      },
      {
        id: `${investor.id}-addr-2`,
        label: "Correspondence",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "5600**",
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

export function getDistributorClientProfile(investorId: string): DistributorClientProfile | null {
  const investor = getInvestorById(investorId);
  if (!investor) return null;

  const seed = hashSeed(investor.id);
  const kycSteps = buildKycSteps(investor);
  const completedSteps = kycSteps.filter((step) => step.status === "completed").length;

  const riskLabel = RISK_LABELS[seed % RISK_LABELS.length] ?? "Moderate";
  const tier = tierIdFromLabel(riskLabel);
  const score = 200 + (seed % 700);

  return {
    investor,
    displayName: displayNameFor(investor),
    emailDisplay: emailDisplayFor(investor),
    riskProfileLabel: riskLabel,
    riskProfile: {
      label: riskLabel,
      tier,
      score,
      displayScore: normalizeRiskScore(score),
    },
    mfaEnabled: investor.onboardingStatus === "Onboarded" && seed % 5 !== 0,
    kycOverallStatus:
      investor.onboardingStatus === "Onboarded"
        ? "Completed"
        : `${completedSteps}/${KYC_STEP_DEFS.length} steps`,
    kycSteps,
    holdings: buildHoldings(investor),
    goals: buildGoals(investor),
    familyGroups: buildFamilyGroups(investor),
    referrals: buildReferrals(investor),
    sessions: buildSessions(investor),
    personalInfo: buildPersonalInfo(investor),
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

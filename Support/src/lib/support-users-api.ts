import { buildDistributorKycSteps } from "@/lib/distributor-client-kyc-steps";
import { buildSupportClientKycPartnerSnapshot } from "@/lib/support-client-kyc-partner-dummy-data";
import { buildSupportClientCapturedProfile } from "@/lib/support-client-captured-profile-dummy-data";
import { buildSupportClientKycRegistrySnapshot } from "@/lib/support-client-kyc-registry-dummy-data";
import { getInvestorById } from "@/lib/distributor-client-profile-data";
import { DUMMY_INVESTORS } from "@/lib/distributor-investor-utils";
import type { DistributorClientProfile, DistributorInvestor } from "@/lib/distributor-types";

function normalizeClientRef(clientId: string): string {
  const trimmed = clientId.trim();
  return trimmed.endsWith("@zynd") ? trimmed.slice(0, -"@zynd".length) : trimmed;
}

function findDummyInvestor(clientId: string): DistributorInvestor | undefined {
  const ref = normalizeClientRef(clientId);
  return (
    DUMMY_INVESTORS.find((row) => row.clientCode === ref || row.clientCode === clientId) ??
    DUMMY_INVESTORS.find((row) => row.id === ref || row.id === clientId)
  );
}

function buildDummyProfile(investor: DistributorInvestor): DistributorClientProfile {
  const kycCompliant = investor.complianceStatus === "Compliant";
  const kycSteps = buildDistributorKycSteps({
    kycCompliant,
    stepStatuses: kycCompliant
      ? { pan: "verified", address: "verified", bank: "verified" }
      : { pan: "verified", address: "pending", bank: "pending" },
  });

  const baseProfile: DistributorClientProfile = {
    investor: { ...investor, inDistributorBook: true },
    displayName: investor.displayName,
    emailDisplay: investor.emailMasked.replace(/\*/g, "•"),
    contactEmail: `${investor.displayName.split(" ")[0]?.toLowerCase() ?? "user"}@example.com`,
    contactPhone: investor.mobileMasked.replace(/\*/g, "•"),
    profileImageUrl: investor.profileImageUrl ?? null,
    riskProfileLabel: "Moderate",
    riskProfile: null,
    mfaEnabled: true,
    kycOverallStatus: kycCompliant ? "completed" : "in_progress",
    kycInitiatedAt: investor.createdAt,
    kycSteps,
    kycAuditLog: [],
    kycPartnerSnapshot: buildSupportClientKycPartnerSnapshot({
      investor,
      steps: kycSteps,
      kycInitiatedAt: investor.createdAt,
    }),
    kycRegistrySnapshot: buildSupportClientKycRegistrySnapshot({
      investor,
      kycInitiatedAt: investor.createdAt,
    }),
    clientDocuments: [],
    holdings: [],
    portfolioGrowth: [],
    goals: [],
    familyGroups: [],
    referrals: {
      totalReferrals: 0,
      kycVerified: 0,
      firstInvestment: 0,
      qualified: 0,
      referralCode: "—",
    },
    sessions: [],
    personalInfo: {
      bankAccounts: [
        {
          id: "bank-primary",
          bankName: "HDFC Bank",
          accountNumberMasked: "•••• 7890",
          ifscCode: "HDFC0001234",
          accountType: "Savings",
          isPrimary: true,
          verificationStatus: kycCompliant ? "verified" : "pending",
        },
        {
          id: "bank-secondary",
          bankName: "ICICI Bank",
          accountNumberMasked: "•••• 4521",
          ifscCode: "ICIC0000456",
          accountType: "Current",
          isPrimary: false,
          verificationStatus: "verified",
        },
      ],
      addresses: [
        {
          id: "addr-permanent",
          label: "Permanent",
          line1: "12, Lake View Apartments",
          line2: "5th Cross, Koramangala",
          city: "Bengaluru",
          state: "Karnataka",
          postalCode: "560034",
          country: "India",
          isPrimary: true,
        },
        {
          id: "addr-correspondence",
          label: "Correspondence",
          line1: "12, Lake View Apartments",
          line2: "5th Cross, Koramangala",
          city: "Bengaluru",
          state: "Karnataka",
          postalCode: "560034",
          country: "India",
        },
        {
          id: "addr-office",
          label: "Office correspondence",
          line1: "Unit 402, Enma Labs Tower",
          line2: "Outer Ring Road",
          city: "Bengaluru",
          state: "Karnataka",
          postalCode: "560103",
          country: "India",
        },
      ],
      connectedAccounts: {
        google: {
          connected: true,
          emailMasked: "pr•••••••••••@gmail.com",
        },
        apple: { connected: false },
      },
    },
    orders: [],
    systematicPlans: [],
  };

  return {
    ...baseProfile,
    capturedProfile: buildSupportClientCapturedProfile(baseProfile),
  };
}

export async function fetchSupportUserDetail(clientId: string): Promise<DistributorClientProfile> {
  await new Promise((resolve) => setTimeout(resolve, 120));
  const investor = findDummyInvestor(clientId) ?? getInvestorById(clientId);
  if (!investor) {
    const error = new Error("User not found");
    (error as Error & { code?: string }).code = "client_not_found";
    throw error;
  }
  return buildDummyProfile(investor);
}

export function listSupportDirectoryInvestors(): DistributorInvestor[] {
  return DUMMY_INVESTORS;
}

/**
 * User-facing labels aligned with Web investor app (`Web/src/shared/config/copy.ts`).
 * Distributor console shows the same concepts with read-only / masked context.
 */

export const DISTRIBUTOR_KYC_STEPS: Array<{ id: string; label: string }> = [
  { id: "pan", label: "PAN Card" },
  { id: "digilocker", label: "DigiLocker" },
  { id: "address", label: "Address" },
  { id: "personal", label: "Personal Info" },
  { id: "nominee", label: "Nominee" },
  { id: "bank", label: "Bank" },
  { id: "signature", label: "Signature" },
  { id: "review", label: "Review" },
];

export const DISTRIBUTOR_CLIENT_COPY = {
  loadingProfile: "Loading client profile…",
  clientNotFound: "Client not found.",

  overview: {
    zyndClientCode: "Zynd client code",
    riskProfile: "Risk profile",
    mfa: "Two-Factor Authentication",
    mfaEnabled: "Enabled",
    mfaDisabled: "Not enabled",
    mfaBadgeOn: "2FA enabled",
    mfaBadgeOff: "2FA disabled",
    memberSince: "Member since",
  },

  kyc: {
    title: "KYC verification",
    description:
      "Same journey investors complete on Zynd — PAN, address, bank, and review steps.",
    overallLabel: "Overall status",
    stepCompleted: "Completed",
    stepPending: "Pending",
    stepNeedsAttention: "Needs attention",
    identityNote: "Verified from PAN and KYC records (masked for distributor view).",
  },

  portfolio: {
    title: "MF Portfolio",
    description: "Mutual fund holdings and snapshot values for this investor.",
    currentValue: "Current value",
    invested: "Invested",
    totalReturns: "Total returns",
    redeemableValue: "Redeemable value",
    chartTitle: "Portfolio trend",
    chartEmpty: "Invest or import holdings to plot portfolio growth.",
    holdingsTitle: "Mutual fund holdings",
    holdingsDescription: "Schemes held by this investor",
    holdingsEmpty:
      "No holdings yet. Invest or import CAS to see a portfolio here.",
    holdingsColumnScheme: "Scheme",
    holdingsColumnUnits: "Units",
    holdingsColumnNav: "NAV",
    holdingsColumnInvested: "Invested",
    holdingsColumnCurrent: "Current value",
    holdingsColumnRedeemable: "Redeemable",
    holdingsColumnReturns: "Returns",
    holdingsUnknownAmc: "AMC not listed",
    holdingsFolio: (folio: string) => `Folio ${folio}`,
    holdingsAsOf: (date: string) => `As of ${date}`,
    units: (units: number) => `${units.toFixed(3)} units`,
  },

  activity: {
    transactionsTitle: "Transactions",
    transactionsDescription: "Latest mutual fund orders",
    transactionsEmpty: "No orders yet.",
    sipsTitle: "SIPs",
    sipsDescription: "Active and upcoming installments",
    sipsEmpty: "No SIPs yet. Start one from mutual funds.",
  },

  goals: {
    title: "Goals",
    description: "Progress toward personal and family targets",
    empty: "No goals yet. Set a target to start.",
    personal: "Personal",
    family: "Family",
    progress: "Goal progress",
    savedSoFar: "Saved so far",
    target: "Target",
  },

  family: {
    title: "Family groups",
    description: "Invest together. Grow together. Secure together.",
    empty: "No family groups yet.",
    members: (count: number) => `${count} members`,
    activeGoals: (count: number) => `${count} active goals`,
  },

  referrals: {
    title: "Referrals",
    description: "Invite → Invest → Qualify — same program investors see on Zynd.",
    referralCode: "Referral code",
    totalReferrals: "Total referrals",
    kycVerified: "KYC verified",
    firstInvestment: "First investment",
    qualified: "Qualified",
  },

  devices: {
    title: "Your Devices",
    description: "Active sessions on this account (read-only).",
    lastActive: (date: string) => `Last active ${date}`,
    thisDevice: "This Device",
    otherDevice: "Other device",
    empty: "No active sessions found.",
  },

  identity: {
    title: "Profile",
    description: "Account and identity details (masked).",
    account: "Account",
    accountCardDescription: "Login and client identifiers (masked).",
    identityDetails: "Identity Details",
    pan: "PAN",
    mobile: "Phone",
    email: "Email",
    valueNotAvailable: "Not on file",
    bankAccountsTitle: "Bank accounts",
    bankAccountsDescription: "Verified accounts linked for investments and payouts.",
    bankAccountsEmpty: "No bank accounts on file.",
    bankPrimary: "Primary",
    addressTitle: "Address",
    addressDescription: "KYC address on record (city and region only).",
    addressEmpty: "No address on file.",
    connectedAccountsTitle: "Connected sign-in",
    connectedAccountsDescription: "Google and Apple linked to this Zynd account.",
    google: "Google",
    apple: "Apple",
    connected: "Connected",
    notConnected: "Not connected",
  },

  tabs: {
    portfolio: "Portfolio",
    personal: "Personal info",
    kyc: "KYC",
    risk: "Risk profile",
    goals: "Goals",
    family: "Family",
    transactions: "Transactions",
    sips: "SIPs",
    ariaLabel: "Client profile sections",
  },

  riskProfile: {
    tabDescription: "Completed assessments and investor risk tolerance (read-only).",
    profileCreatedBadge: "Risk profile created",
    notCreatedBadge: "Not assessed",
    createAction: "Create risk profile",
    createDisabledHint:
      "Investors complete the risk questionnaire in the Zynd app. Distributor-initiated assessments are not available yet.",
    assessmentsTitle: "All assessments",
    assessmentsEmpty: "No risk assessments on record for this client.",
    currentAssessment: "Current",
    listAriaLabel: "Risk profile assessments",
    detailTitle: "Risk profile detail",
    detailDescription: "Score, tier, and guidance from this assessment.",
    scoreLabel: "Risk score",
    downloadPdf: "Download PDF",
    downloadingPdf: "Downloading…",
    viewAnswers: "View answers",
    viewAnswersTitle: "Assessment answers",
    viewAnswersDescription: "Questions and responses from this completed assessment.",
    viewAnswersLoading: "Loading answers…",
    viewAnswersEmpty: "No answers found for this assessment.",
    viewAnswersLoadFailed: "Could not load answers.",
  },
} as const;

export function kycStepLabelForId(stepId: string): string {
  return DISTRIBUTOR_KYC_STEPS.find((step) => step.id === stepId)?.label ?? stepId;
}

export function formatKycOverallStatus(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "completed" || normalized === "verified") return "KYC verified";
  if (normalized === "submitted" || normalized === "under_review") return "Under review";
  if (normalized === "none" || !status) return "Not started";
  return status.replace(/_/g, " ");
}

export function kycProgressPct(completedCount: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((completedCount / total) * 100));
}

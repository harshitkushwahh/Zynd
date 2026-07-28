export type InvestorType = "Resident Individual" | "Non Resident Individual";

export type InvestorOnboardingStatus = "Onboarded" | "Pending";
export type InvestorComplianceStatus = "Compliant" | "Non Compliant";
export type InvestorInvestmentStatus = "Invested" | "Non Invested";

export type InvestorServiceModel = "pm" | "diy";

export type DistributorInvestor = {
  id: string;
  emailMasked: string;
  panMasked: string;
  clientCode: string;
  mobileMasked: string;
  onboardingStatus: InvestorOnboardingStatus;
  complianceStatus: InvestorComplianceStatus;
  investmentStatus: InvestorInvestmentStatus;
  investorType: InvestorType;
  aum: number | null;
  createdAt: string;
  /** True when this investor was added to the logged-in distributor's book. */
  inDistributorBook: boolean;
  /** PM vs DIY — shown on system-wide resident lists. */
  serviceModel?: InvestorServiceModel;
};

export type OrderStatus = "Pending" | "Processing" | "Completed" | "Failed";

export type DistributorOrder = {
  id: string;
  orderRef: string;
  investorEmailMasked: string;
  clientCode: string;
  schemeName: string;
  orderType: "Purchase" | "Redeem" | "Switch";
  amount: number;
  status: OrderStatus;
  createdAt: string;
};

export type SystematicPlanStatus = "Active" | "Paused" | "Cancelled";

export type DistributorSystematicPlan = {
  id: string;
  planRef: string;
  investorEmailMasked: string;
  clientCode: string;
  schemeName: string;
  planType: "SIP" | "STP" | "SWP";
  amount: number;
  frequency: "Monthly" | "Weekly" | "Quarterly";
  status: SystematicPlanStatus;
  nextDueAt: string;
};

export type TxnRequestStatus = "Pending" | "Approved" | "Rejected";

export type DistributorTxnRequest = {
  id: string;
  requestRef: string;
  investorEmailMasked: string;
  clientCode: string;
  requestType: "Purchase" | "Redeem" | "SIP Register" | "Folio Update";
  amount: number | null;
  status: TxnRequestStatus;
  createdAt: string;
};

export type DistributorTransactionGroup = {
  id: string;
  groupRef: string;
  label: string;
  investorCount: number;
  legCount: number;
  totalAmount: number;
  status: "Draft" | "Submitted" | "Completed";
  createdAt: string;
};

export type DistributorKycStepStatus = "completed" | "pending" | "failed";

export type DistributorClientKycStep = {
  id: string;
  label: string;
  status: DistributorKycStepStatus;
};

export type DistributorClientOAuthConnection = {
  connected: boolean;
  emailMasked?: string | null;
};

export type DistributorClientBankAccount = {
  id: string;
  bankName: string;
  accountNumberMasked: string;
  ifscCode: string;
  accountType?: string;
  isPrimary: boolean;
  verificationStatus: string;
};

export type DistributorClientAddress = {
  id: string;
  label: string;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  isPrimary?: boolean;
};

export type DistributorClientPersonalInfo = {
  bankAccounts: DistributorClientBankAccount[];
  addresses: DistributorClientAddress[];
  connectedAccounts: {
    google: DistributorClientOAuthConnection;
    apple: DistributorClientOAuthConnection;
  };
};

export type DistributorClientHolding = {
  id: string;
  schemeName: string;
  amcName?: string | null;
  folioNumber?: string | null;
  isin?: string | null;
  currentValue: number;
  investedAmount: number;
  /** Approximate amount available to redeem (market value on latest NAV). */
  redeemableValue: number;
  units: number;
  navPerUnit?: number | null;
  asOfDate?: string | null;
};

export type DistributorClientGoal = {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  progressPct: number;
  status: "active" | "draft" | "achieved" | "paused";
  targetDate: string;
  scope: "personal" | "family";
  familyGroupName?: string;
};

export type DistributorClientFamilyMember = {
  userId: string;
  displayName: string;
  role: "head" | "member";
  emailMasked?: string;
  profileImageUrl?: string | null;
  badgeLabel?: string | null;
};

export type DistributorClientFamilyGroup = {
  id: string;
  name: string;
  description?: string | null;
  tag?: string | null;
  avatarUrl?: string | null;
  role: "owner" | "member";
  memberCount: number;
  activeGoals: number;
  totalValue: number;
  headDisplayName?: string | null;
  headUserId?: string | null;
  members: DistributorClientFamilyMember[];
};

export type DistributorClientRiskProfile = {
  label: string;
  tier: string;
  score: number;
  displayScore: number;
};

export type DistributorClientRiskAssessment = {
  assessmentId: string;
  score: number;
  displayScore: number;
  tier: string;
  completedAt: string | null;
  questionsAnswered: number;
  totalQuestions: number;
  messageSummary?: string;
  messageRecommendation?: string;
  isCurrent?: boolean;
};

export type DistributorClientRiskAssessmentAnswer = {
  questionId: string;
  categoryName?: string | null;
  prompt: string;
  helpText?: string | null;
  sortOrder: number;
  selectedOptionLabel: string;
};

export type DistributorClientReferralSummary = {
  totalReferrals: number;
  kycVerified: number;
  firstInvestment: number;
  qualified: number;
  referralCode: string;
};

export type DistributorClientSession = {
  id: string;
  deviceLabel: string;
  os: string;
  browser: string;
  lastActiveAt: string;
  isCurrent: boolean;
};

export type DistributorClientProfile = {
  investor: DistributorInvestor;
  displayName: string;
  emailDisplay: string;
  profileImageUrl?: string | null;
  riskProfileLabel: string;
  riskProfile?: DistributorClientRiskProfile | null;
  mfaEnabled: boolean;
  kycOverallStatus: string;
  kycSteps: DistributorClientKycStep[];
  holdings: DistributorClientHolding[];
  goals: DistributorClientGoal[];
  familyGroups: DistributorClientFamilyGroup[];
  referrals: DistributorClientReferralSummary;
  sessions: DistributorClientSession[];
  personalInfo: DistributorClientPersonalInfo;
};

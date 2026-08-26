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
  /** False for platform-wide rows in “All orders”. Defaults to true. */
  inDistributorBook?: boolean;
  operationChannel?: "one-time" | "sip" | "redemption";
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
  /** False for platform-wide rows in “All orders”. Defaults to true. */
  inDistributorBook?: boolean;
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
  /** False for platform-wide rows in “All orders”. Defaults to true. */
  inDistributorBook?: boolean;
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
  /** False for platform-wide rows in “All orders”. Defaults to true. */
  inDistributorBook?: boolean;
};

export type DistributorKycStepStatus = "completed" | "pending" | "failed" | "not_applicable";

export type DistributorClientDocumentStatus = "uploaded" | "missing" | "not_required";

export type DistributorClientDocumentCategory =
  | "pan"
  | "address_proof"
  | "bank_proof"
  | "signature"
  | "esign"
  | "kyc_form";

export type DistributorClientDocument = {
  id: string;
  category: DistributorClientDocumentCategory;
  label: string;
  fileName: string | null;
  identifierMasked: string | null;
  uploadedAt: string | null;
  status: DistributorClientDocumentStatus;
  source: string;
};

export type DistributorClientKycStep = {
  id: string;
  label: string;
  status: DistributorKycStepStatus;
  /** False when step is skipped for KRA-compliant investors (DigiLocker, signature). */
  applicable?: boolean;
};

export type DistributorClientKycAuditActor = "investor" | "system";

export type DistributorClientKycAuditEntry = {
  id: string;
  occurredAt: string;
  action: string;
  stepLabel: string | null;
  detail: string;
  actor: DistributorClientKycAuditActor;
  source: string;
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
  line1?: string | null;
  line2?: string | null;
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

export type DistributorClientGoalType =
  | "home"
  | "education"
  | "car"
  | "wedding"
  | "retirement"
  | "custom";

export type DistributorClientGoalPriority = "high" | "medium" | "low";

export type DistributorClientGoalMemberContribution = {
  userId: string;
  displayName: string;
  amount: number;
};

export type DistributorClientGoal = {
  id: string;
  title: string;
  /** Display category (e.g. Retirement, Education). */
  category?: string;
  /** Structured goal template (home, car, wedding, custom, etc.). */
  goalType?: DistributorClientGoalType;
  priority?: DistributorClientGoalPriority;
  createdByDisplayName?: string;
  createdByRole?: "owner" | "member";
  memberContributions?: DistributorClientGoalMemberContribution[];
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
  /** Full contact when member is a client in your book (distributor view). */
  contactEmail?: string | null;
  contactPhone?: string | null;
  linkedInvestorId?: string | null;
  inYourBook?: boolean;
  portfolioContribution?: number;
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
  /** Family-scoped goals (owners see full detail on group page). */
  goals?: DistributorClientGoal[];
};

export type DistributorClientRiskProfile = {
  label: string;
  tier: string;
  score: number;
  displayScore: number;
  /** ISO timestamp of latest assessment (stable in demo data). */
  assessedAt?: string;
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

export type DistributorClientPortfolioGrowthPoint = {
  label: string;
  value: number;
  invested: number;
  date?: string;
};

export type DistributorClientProfile = {
  investor: DistributorInvestor;
  displayName: string;
  emailDisplay: string;
  /** Full email on client detail (distributor view). */
  contactEmail: string;
  /** Full phone on client detail (distributor view). */
  contactPhone: string;
  profileImageUrl?: string | null;
  riskProfileLabel: string;
  riskProfile?: DistributorClientRiskProfile | null;
  mfaEnabled: boolean;
  kycOverallStatus: string;
  /** ISO timestamp when the investor started KYC on Zynd. */
  kycInitiatedAt: string;
  kycSteps: DistributorClientKycStep[];
  kycAuditLog: DistributorClientKycAuditEntry[];
  clientDocuments: DistributorClientDocument[];
  holdings: DistributorClientHolding[];
  portfolioGrowth: DistributorClientPortfolioGrowthPoint[];
  goals: DistributorClientGoal[];
  familyGroups: DistributorClientFamilyGroup[];
  referrals: DistributorClientReferralSummary;
  sessions: DistributorClientSession[];
  personalInfo: DistributorClientPersonalInfo;
  /** Demo / API activity for client detail SIPs & Transactions tab */
  orders?: DistributorOrder[];
  systematicPlans?: DistributorSystematicPlan[];
};

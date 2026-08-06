import { apiRequest } from "@/lib/api-client";
import { buildClientDocumentsForInvestor } from "@/lib/client-documents";
import { buildKycAuditLogForClient } from "@/lib/client-kyc-audit-log";
import { applyKycStepApplicability } from "@/lib/distributor-client-kyc-steps";
import { DISTRIBUTOR_KYC_STEPS } from "@/lib/distributor-client-copy";
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
  InvestorComplianceStatus,
  InvestorInvestmentStatus,
  InvestorOnboardingStatus,
  InvestorType,
  OrderStatus,
  SystematicPlanStatus,
} from "@/lib/distributor-types";

type ApiClientListItem = {
  user_id: string;
  client_id: string | null;
  display_name: string;
  email_masked: string;
  phone_masked: string | null;
  pan_masked: string;
  status: string;
  kyc_compliant: boolean;
  has_invested: boolean;
  onboarding_status: string;
  compliance_status: string;
  investment_status: string;
  investor_type: string;
  aum: number | null;
  created_at: string | null;
};

type ApiClientDetail = {
  summary: ApiClientListItem;
  display_name: string;
  email_masked: string;
  email_display: string;
  phone_masked: string | null;
  pan_masked: string;
  risk_profile_label: string;
  risk_profile: {
    label: string;
    tier: string | null;
    score: number | null;
    display_score: number | null;
  } | null;
  mfa_enabled: boolean;
  profile_image_url: string | null;
  kyc_overall_status: string;
  kyc: {
    step_statuses?: Record<string, string>;
    incomplete_steps?: Array<{ key: string; label: string; status?: string }>;
    address?: {
      permanent?: Record<string, unknown>;
      correspondence?: Record<string, unknown>;
      same_as_permanent?: boolean;
    };
    investor_addresses?: Array<Record<string, unknown>>;
    bank_accounts?: Array<Record<string, unknown>>;
  } | null;
  connected_accounts?: {
    google?: { connected?: boolean; email?: string | null };
    apple?: { connected?: boolean; email?: string | null };
  };
  investments: {
    purchases?: Array<Record<string, unknown>>;
    sip_plans?: Array<Record<string, unknown>>;
    holdings?: Array<Record<string, unknown>>;
  } | null;
  goals: Array<Record<string, unknown>>;
  family_groups: ApiFamilyGroup[];
  referrals: {
    total_referrals: number;
    kyc_verified: number;
    first_investment: number;
    qualified: number;
    referral_code: string;
  };
  sessions: Array<{
    id: string;
    device_label: string;
    os: string;
    browser: string;
    last_active_at: string | null;
    is_current: boolean;
  }>;
};

type ApiFamilyGroupMember = {
  user_id: string;
  display_name: string | null;
  email_masked: string | null;
  role: string | null;
  badge_label: string | null;
  profile_image_url: string | null;
};

type ApiFamilyGroup = {
  group_id: string;
  name: string | null;
  tag: string | null;
  description: string | null;
  avatar_url: string | null;
  head_user_id: string | null;
  head_display_name: string | null;
  client_role: string;
  member_count: number;
  status: string | null;
  members: ApiFamilyGroupMember[];
};

type ApiFamilyGroupDetail = ApiFamilyGroup & {
  client_user_id: string;
  client_display_name: string;
};


function mapInvestorType(value: string): InvestorType {
  return value === "Non Resident Individual" ? "Non Resident Individual" : "Resident Individual";
}

function mapOnboarding(value: string): InvestorOnboardingStatus {
  return value === "Onboarded" ? "Onboarded" : "Pending";
}

function mapCompliance(value: string): InvestorComplianceStatus {
  return value === "Compliant" ? "Compliant" : "Non Compliant";
}

function mapInvestment(value: string): InvestorInvestmentStatus {
  return value === "Invested" ? "Invested" : "Non Invested";
}

export function mapApiClientListItem(row: ApiClientListItem): DistributorInvestor {
  return {
    id: row.user_id,
    emailMasked: row.email_masked,
    panMasked: row.pan_masked,
    clientCode: row.client_id ?? "—",
    mobileMasked: row.phone_masked ?? "—",
    onboardingStatus: mapOnboarding(row.onboarding_status),
    complianceStatus: mapCompliance(row.compliance_status),
    investmentStatus: mapInvestment(row.investment_status),
    investorType: mapInvestorType(row.investor_type),
    aum: row.aum,
    createdAt: row.created_at ?? new Date().toISOString(),
    inDistributorBook: true,
  };
}

function mapOrderStatus(raw: string): OrderStatus {
  const normalized = raw.toUpperCase();
  if (normalized === "SUCCEEDED" || normalized === "COMPLETED") return "Completed";
  if (normalized === "FAILED") return "Failed";
  if (normalized === "PROCESSING") return "Processing";
  return "Pending";
}

function mapSipStatus(raw: string): SystematicPlanStatus {
  const normalized = raw.toLowerCase();
  if (normalized === "active") return "Active";
  if (normalized === "paused") return "Paused";
  return "Cancelled";
}

function buildKycSteps(
  kyc: ApiClientDetail["kyc"],
  kycCompliant: boolean,
): DistributorClientKycStep[] {
  const stepStatuses = kyc?.step_statuses ?? {};
  const incomplete = new Map(
    (kyc?.incomplete_steps ?? []).map((step) => [step.key, step.status ?? "pending"])
  );

  const steps = DISTRIBUTOR_KYC_STEPS.map(({ id, label }) => {
    const statusRaw = incomplete.get(id) ?? stepStatuses[id] ?? "pending";
    if (statusRaw === "completed" || statusRaw === "verified") {
      return { id, label, status: "completed" as const };
    }
    if (statusRaw === "failed") {
      return { id, label, status: "failed" as const };
    }
    return { id, label, status: "pending" as const };
  });

  return applyKycStepApplicability(steps, kycCompliant);
}

function mapBankAccounts(rows: Array<Record<string, unknown>> | undefined) {
  if (!rows?.length) return [];
  return rows.map((row, index) => ({
    id: String(row.id ?? index),
    bankName: String(row.bank_name ?? "Bank"),
    accountNumberMasked: String(row.account_number_masked ?? "••••"),
    ifscCode: String(row.ifsc_code ?? "—"),
    accountType: row.account_type ? String(row.account_type) : undefined,
    isPrimary: Boolean(row.is_primary),
    verificationStatus: String(row.verification_status ?? "unknown"),
  }));
}

function mapAddressesFromKyc(kyc: ApiClientDetail["kyc"]): DistributorClientPersonalInfo["addresses"] {
  if (!kyc) return [];
  const items: DistributorClientPersonalInfo["addresses"] = [];

  const pushBlock = (label: string, block: Record<string, unknown> | undefined, id: string) => {
    if (!block || typeof block !== "object") return;
    items.push({
      id,
      label,
      line1:
        block.line1 != null
          ? String(block.line1)
          : block.line_1 != null
            ? String(block.line_1)
            : block.address_line != null
              ? String(block.address_line)
              : null,
      line2:
        block.line2 != null
          ? String(block.line2)
          : block.line_2 != null
            ? String(block.line_2)
            : null,
      city: block.city != null ? String(block.city) : null,
      state: block.state != null ? String(block.state) : null,
      postalCode: block.pincode != null ? String(block.pincode) : null,
      country: block.country != null ? String(block.country) : null,
      isPrimary: label === "Permanent",
    });
  };

  pushBlock("Permanent", kyc.address?.permanent, "permanent");
  if (!kyc.address?.same_as_permanent) {
    pushBlock("Correspondence", kyc.address?.correspondence, "correspondence");
  }

  for (const [index, row] of (kyc.investor_addresses ?? []).entries()) {
    items.push({
      id: String(row.id ?? `addr-${index}`),
      label: String(row.nature ?? "Address"),
      line1:
        row.line1 != null
          ? String(row.line1)
          : row.line_1 != null
            ? String(row.line_1)
            : null,
      line2:
        row.line2 != null
          ? String(row.line2)
          : row.line_2 != null
            ? String(row.line_2)
            : null,
      city: row.city != null ? String(row.city) : null,
      state: row.state != null ? String(row.state) : null,
      postalCode: row.postal_code != null ? String(row.postal_code) : null,
      country: row.country != null ? String(row.country) : null,
      isPrimary: Boolean(row.is_primary),
    });
  }

  return items;
}

function mapConnectedAccounts(
  payload: ApiClientDetail["connected_accounts"],
): DistributorClientPersonalInfo["connectedAccounts"] {
  const google = payload?.google;
  const apple = payload?.apple;
  return {
    google: {
      connected: Boolean(google?.connected),
      emailMasked: google?.email ?? null,
    },
    apple: {
      connected: Boolean(apple?.connected),
      emailMasked: apple?.email ?? null,
    },
  };
}

function mapPersonalInfo(payload: ApiClientDetail): DistributorClientPersonalInfo {
  return {
    bankAccounts: mapBankAccounts(payload.kyc?.bank_accounts),
    addresses: mapAddressesFromKyc(payload.kyc),
    connectedAccounts: mapConnectedAccounts(payload.connected_accounts),
  };
}

function mapHoldings(rows: Array<Record<string, unknown>> | undefined): DistributorClientHolding[] {
  if (!rows?.length) return [];
  return rows.map((row, index) => {
    const currentValue = Number(row.current_value_inr ?? row.market_value_inr ?? 0);
    const investedAmount = Number(row.invested_amount_inr ?? row.cost_value_inr ?? 0);
    const redeemableValue = Number(
      row.redeemable_value_inr ?? row.market_value_inr ?? row.current_value_inr ?? 0,
    );
    const units = Number(row.units ?? 0);
    const navPerUnit =
      row.nav_value != null
        ? Number(row.nav_value)
        : units > 0 && currentValue > 0
          ? currentValue / units
          : null;

    return {
      id: String(row.id ?? row.isin ?? index),
      schemeName: String(row.matched_scheme_name ?? row.scheme_name ?? "Scheme"),
      amcName: row.amc_name != null ? String(row.amc_name) : null,
      folioNumber: row.folio_number != null ? String(row.folio_number) : null,
      isin: row.isin != null ? String(row.isin) : null,
      currentValue,
      investedAmount,
      redeemableValue: redeemableValue || currentValue,
      units,
      navPerUnit,
      asOfDate: row.as_of_date != null ? String(row.as_of_date) : null,
    };
  });
}

function mapGoals(rows: Array<Record<string, unknown>>): DistributorClientGoal[] {
  return rows.map((row) => ({
    id: String(row.id),
    title: String(row.title ?? "Goal"),
    category: row.category != null ? String(row.category) : undefined,
    targetAmount: Number(row.target_amount_inr ?? 0),
    currentAmount: Number(row.current_amount_inr ?? 0),
    progressPct: Number(row.progress_pct ?? 0),
    status: (row.status as DistributorClientGoal["status"]) ?? "active",
    targetDate: String(row.target_date ?? ""),
    scope: row.family_group_id ? "family" : "personal",
  }));
}

function mapFamilyMembers(rows: ApiFamilyGroupMember[]): DistributorClientFamilyMember[] {
  return rows.map((row) => ({
    userId: row.user_id,
    displayName: row.display_name ?? "Member",
    role: row.role === "head" ? "head" : "member",
    emailMasked: row.email_masked ?? undefined,
    profileImageUrl: row.profile_image_url,
    badgeLabel: row.badge_label,
  }));
}

function mapFamilyGroup(row: ApiFamilyGroup): DistributorClientFamilyGroup {
  return {
    id: row.group_id,
    name: row.name ?? "Family group",
    description: row.description,
    tag: row.tag,
    avatarUrl: row.avatar_url,
    role: row.client_role === "owner" ? "owner" : "member",
    memberCount: row.member_count,
    activeGoals: 0,
    totalValue: 0,
    headDisplayName: row.head_display_name,
    headUserId: row.head_user_id,
    members: mapFamilyMembers(row.members ?? []),
  };
}

function mapFamilyGroups(rows: ApiFamilyGroup[]): DistributorClientFamilyGroup[] {
  return rows.map(mapFamilyGroup);
}

function mapReferrals(row: ApiClientDetail["referrals"]): DistributorClientReferralSummary {
  return {
    totalReferrals: row.total_referrals,
    kycVerified: row.kyc_verified,
    firstInvestment: row.first_investment,
    qualified: row.qualified,
    referralCode: row.referral_code,
  };
}

function mapSessions(rows: ApiClientDetail["sessions"]): DistributorClientSession[] {
  return rows.map((row) => ({
    id: row.id,
    deviceLabel: row.device_label,
    os: row.os,
    browser: row.browser,
    lastActiveAt: row.last_active_at ?? new Date().toISOString(),
    isCurrent: row.is_current,
  }));
}

function mapOrders(
  rows: Array<Record<string, unknown>> | undefined,
  investor: DistributorInvestor
): DistributorOrder[] {
  if (!rows?.length) return [];
  return rows.map((row, index) => ({
    id: String(row.order_id ?? index),
    orderRef: String(row.fp_purchase_id ?? row.order_id ?? index),
    investorEmailMasked: investor.emailMasked,
    clientCode: investor.clientCode,
    schemeName: String(row.product_name ?? "Mutual fund"),
    orderType: "Purchase",
    amount: Number(row.amount_inr ?? 0),
    status: mapOrderStatus(String(row.status ?? "PENDING")),
    createdAt: String(row.created_at ?? new Date().toISOString()),
  }));
}

function mapSips(
  rows: Array<Record<string, unknown>> | undefined,
  investor: DistributorInvestor
): DistributorSystematicPlan[] {
  if (!rows?.length) return [];
  return rows.map((row, index) => ({
    id: String(row.plan_id ?? row.id ?? index),
    planRef: String(row.plan_id ?? row.id ?? index),
    investorEmailMasked: investor.emailMasked,
    clientCode: investor.clientCode,
    schemeName: String(row.product_name ?? "Mutual fund"),
    planType: "SIP",
    amount: Number(row.amount_inr ?? row.installment_amount_inr ?? 0),
    frequency: "Monthly",
    status: mapSipStatus(String(row.status ?? "active")),
    nextDueAt: String(row.next_installment_date ?? row.next_due_at ?? new Date().toISOString()),
  }));
}

export function mapApiClientDetail(payload: ApiClientDetail): DistributorClientProfile & {
  orders: DistributorOrder[];
  systematicPlans: DistributorSystematicPlan[];
} {
  const investor = mapApiClientListItem(payload.summary);
  const kycSteps = buildKycSteps(payload.kyc, payload.summary.kyc_compliant);
  const kycInitiatedAt = payload.summary.created_at ?? new Date().toISOString();
  const kycAuditLog = buildKycAuditLogForClient(investor, kycSteps, kycInitiatedAt);
  const clientDocuments = buildClientDocumentsForInvestor(investor, kycSteps);
  const investments = payload.investments ?? undefined;

  return {
    investor,
    displayName: payload.display_name,
    emailDisplay: payload.email_display,
    contactEmail: payload.email_display,
    contactPhone: payload.phone_masked ?? "Phone not on file",
    profileImageUrl: payload.profile_image_url,
    riskProfileLabel: payload.risk_profile_label,
    riskProfile: payload.risk_profile?.score
      ? {
          label: payload.risk_profile.label,
          tier: payload.risk_profile.tier ?? "moderate",
          score: payload.risk_profile.score,
          displayScore:
            payload.risk_profile.display_score ?? Math.round(payload.risk_profile.score / 10),
        }
      : null,
    mfaEnabled: payload.mfa_enabled,
    kycOverallStatus: payload.kyc_overall_status,
    kycInitiatedAt,
    kycSteps,
    kycAuditLog,
    clientDocuments,
    holdings: mapHoldings(investments?.holdings),
    goals: mapGoals(payload.goals ?? []),
    familyGroups: mapFamilyGroups(payload.family_groups ?? []),
    referrals: mapReferrals(payload.referrals),
    sessions: mapSessions(payload.sessions ?? []),
    orders: mapOrders(investments?.purchases, investor),
    systematicPlans: mapSips(investments?.sip_plans, investor),
    personalInfo: mapPersonalInfo(payload),
  };
}

export async function fetchDistributorClients(params?: { email?: string; limit?: number }) {
  const search = new URLSearchParams();
  if (params?.email) search.set("email", params.email);
  if (params?.limit) search.set("limit", String(params.limit));
  const query = search.toString();
  const path = query ? `/distributor/clients?${query}` : "/distributor/clients";
  const response = await apiRequest<{ items: ApiClientListItem[] }>(path);
  return response.items.map(mapApiClientListItem);
}

export async function fetchDistributorClientDetail(clientReference: string) {
  const response = await apiRequest<ApiClientDetail>(
    `/distributor/clients/${encodeURIComponent(clientReference)}`
  );
  return mapApiClientDetail(response);
}

export async function fetchDistributorClientFamilyGroup(
  clientReference: string,
  groupId: string,
): Promise<DistributorClientFamilyGroup & { clientDisplayName: string; clientUserId: string }> {
  const response = await apiRequest<ApiFamilyGroupDetail>(
    `/distributor/clients/${encodeURIComponent(clientReference)}/family-groups/${encodeURIComponent(groupId)}`,
  );
  return {
    ...mapFamilyGroup(response),
    clientDisplayName: response.client_display_name,
    clientUserId: response.client_user_id,
  };
}

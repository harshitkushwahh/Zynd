import { apiRequest } from "@/lib/api-client";
import {
  ADD_INVESTOR_BANK_ACCOUNT_TYPE_OPTIONS,
  lookupAddInvestorEnumLabel,
} from "@/lib/add-investor/add-investor-kyc-master-data";
import { buildClientDocumentsForInvestor, type ApiKycDocument } from "@/lib/client-documents";
import { mapKycAuditLogFromApi, type ApiKycAuditEntry } from "@/lib/client-kyc-audit-log";
import { buildDistributorKycSteps } from "@/lib/distributor-client-kyc-steps";
import { resolveClientPortfolioChartSeries } from "@/lib/client-portfolio-chart-data";
import { resolveDistributorAssetUrl } from "@/lib/distributor-asset-url";
import type {
  DistributorClientFamilyGroup,
  DistributorClientFamilyMember,
  DistributorClientGoal,
  DistributorClientHolding,
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
  mitra_client_id?: string | null;
  in_distributor_book?: boolean;
  service_model?: "pm" | "diy";
  profile_image_url?: string | null;
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
    overall_status?: string | null;
    step_statuses?: Record<string, string>;
    incomplete_steps?: Array<{ key: string; label: string; status?: string }>;
    kyc_already_registered?: boolean;
    documents?: ApiKycDocument[];
    audit_log?: ApiKycAuditEntry[];
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
    growth?: Array<Record<string, unknown>>;
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
    displayName: row.display_name?.trim() || row.client_id || "Investor",
    emailMasked: row.email_masked,
    panMasked: row.pan_masked,
    clientCode: row.client_id ?? "—",
    mobileMasked: row.phone_masked ?? "—",
    profileImageUrl: resolveDistributorAssetUrl(row.profile_image_url ?? null),
    onboardingStatus: mapOnboarding(row.onboarding_status),
    complianceStatus: mapCompliance(row.compliance_status),
    investmentStatus: mapInvestment(row.investment_status),
    investorType: mapInvestorType(row.investor_type),
    aum: row.aum,
    createdAt: row.created_at ?? new Date().toISOString(),
    inDistributorBook: row.in_distributor_book ?? true,
    serviceModel: row.service_model === "pm" ? "pm" : "diy",
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

function mapBankAccounts(rows: Array<Record<string, unknown>> | undefined) {
  if (!rows?.length) return [];
  return rows.map((row, index) => ({
    id: String(row.id ?? index),
    bankName: String(row.bank_name ?? "Bank"),
    accountNumberMasked: String(row.account_number_masked ?? "••••"),
    ifscCode: String(row.ifsc_code ?? "—"),
    accountType: row.account_type
      ? lookupAddInvestorEnumLabel(String(row.account_type), ADD_INVESTOR_BANK_ACCOUNT_TYPE_OPTIONS)
      : undefined,
    isPrimary: Boolean(row.is_primary),
    verificationStatus: String(row.verification_status ?? "unknown"),
  }));
}

function normalizeAddressLabel(raw: string): string {
  const normalized = raw.trim().toLowerCase();
  if (normalized === "residential" || normalized === "correspondence") {
    return "Correspondence";
  }
  if (normalized === "permanent") return "Permanent";
  return raw.trim() || "Address";
}

const CLIENT_ADDRESS_LABEL_ORDER: Record<string, number> = {
  Permanent: 0,
  Correspondence: 1,
};

function sortClientAddresses(
  addresses: DistributorClientPersonalInfo["addresses"],
): DistributorClientPersonalInfo["addresses"] {
  return [...addresses].sort((left, right) => {
    const leftOrder = CLIENT_ADDRESS_LABEL_ORDER[left.label] ?? 99;
    const rightOrder = CLIENT_ADDRESS_LABEL_ORDER[right.label] ?? 99;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    if (left.isPrimary !== right.isPrimary) return left.isPrimary ? -1 : 1;
    return left.id.localeCompare(right.id);
  });
}

function addressLocationKey(
  address: Pick<
    DistributorClientPersonalInfo["addresses"][number],
    "city" | "state" | "postalCode" | "country"
  >,
): string {
  return [address.city, address.state, address.postalCode, address.country]
    .map((part) => (part ?? "").trim().toLowerCase())
    .filter(Boolean)
    .join("|");
}

function dedupeClientAddresses(
  addresses: DistributorClientPersonalInfo["addresses"],
): DistributorClientPersonalInfo["addresses"] {
  const deduped: DistributorClientPersonalInfo["addresses"] = [];

  for (const address of addresses) {
    const locationKey = addressLocationKey(address);
    if (!locationKey) {
      deduped.push(address);
      continue;
    }

    const duplicateIndex = deduped.findIndex(
      (existing) => addressLocationKey(existing) === locationKey,
    );
    if (duplicateIndex < 0) {
      deduped.push(address);
      continue;
    }

    const existing = deduped[duplicateIndex];
    const keepCurrent =
      (address.isPrimary && !existing.isPrimary) ||
      (address.label === "Permanent" && existing.label !== "Permanent");
    if (keepCurrent) {
      deduped[duplicateIndex] = address;
    }
  }

  return deduped;
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
      postalCode:
        block.pincode != null
          ? String(block.pincode)
          : block.postal_code != null
            ? String(block.postal_code)
            : null,
      country: block.country != null ? String(block.country) : null,
      isPrimary: label === "Permanent",
    });
  };

  for (const [index, row] of (kyc.investor_addresses ?? []).entries()) {
    items.push({
      id: String(row.id ?? `addr-${index}`),
      label: normalizeAddressLabel(String(row.nature ?? "Address")),
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

  if (items.length === 0) {
    pushBlock("Permanent", kyc.address?.permanent, "permanent");
    if (!kyc.address?.same_as_permanent) {
      pushBlock("Correspondence", kyc.address?.correspondence, "correspondence");
    }
  } else {
    const permanentBlock = kyc.address?.permanent;
    const correspondenceBlock = kyc.address?.correspondence;
    const hasPermanent = items.some((row) => row.label === "Permanent");
    const hasCorrespondence = items.some((row) => row.label === "Correspondence");

    if (!hasPermanent && permanentBlock) {
      pushBlock("Permanent", permanentBlock, "permanent");
    }
    if (!hasCorrespondence && !kyc.address?.same_as_permanent && correspondenceBlock) {
      pushBlock("Correspondence", correspondenceBlock, "correspondence");
    }
  }

  return sortClientAddresses(dedupeClientAddresses(items));
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

function mapPortfolioGrowth(
  rows: Array<Record<string, unknown>> | undefined,
): import("@/lib/distributor-types").DistributorClientPortfolioGrowthPoint[] {
  if (!rows?.length) return [];
  return rows.map((row) => {
    const value = Number(row.value ?? 0);
    const investedRaw = row.invested;
    const invested =
      investedRaw != null && investedRaw !== ""
        ? Number(investedRaw)
        : value;
    return {
      label: String(row.label ?? ""),
      value,
      invested: Number.isFinite(invested) ? invested : 0,
      date: row.date != null ? String(row.date) : undefined,
    };
  });
}

function numberOrZero(...values: unknown[]): number {
  for (const value of values) {
    const amount = Number(value);
    if (Number.isFinite(amount) && amount > 0) return amount;
  }
  return 0;
}

function mapHoldings(rows: Array<Record<string, unknown>> | undefined): DistributorClientHolding[] {
  if (!rows?.length) return [];
  return rows.map((row, index) => {
    const currentValue = numberOrZero(row.current_value_inr, row.market_value_inr);
    const investedAmount = numberOrZero(
      row.invested_inr,
      row.invested_amount_inr,
      row.cost_value_inr,
    );
    const redeemableValue = numberOrZero(
      row.redeemable_amount_inr,
      row.redeemable_value_inr,
      row.market_value_inr,
      row.current_value_inr,
    );
    const units = Number(row.units ?? 0);
    const navPerUnit =
      row.nav_value != null || row.nav != null
        ? Number(row.nav_value ?? row.nav)
        : units > 0 && currentValue > 0
          ? currentValue / units
          : null;
    const returnPct = Number(row.return_pct);
    const returnAmount = Number(row.return_inr);

    return {
      id: String(row.id ?? row.holding_id ?? row.isin ?? index),
      schemeName: String(row.matched_scheme_name ?? row.scheme_name ?? row.fund_name ?? "Scheme"),
      amcName: row.amc_name != null ? String(row.amc_name) : null,
      folioNumber: row.folio_number != null ? String(row.folio_number) : null,
      isin: row.isin != null ? String(row.isin) : null,
      currentValue,
      investedAmount,
      redeemableValue: redeemableValue || currentValue,
      units,
      navPerUnit: Number.isFinite(navPerUnit) ? navPerUnit : null,
      returnAmount: Number.isFinite(returnAmount) ? returnAmount : undefined,
      returnPct: Number.isFinite(returnPct) ? returnPct : undefined,
      asOfDate: row.as_of_date != null ? String(row.as_of_date) : row.nav_as_on != null ? String(row.nav_as_on) : null,
    };
  });
}

function fillHoldingInvestedFromPurchases(
  holdings: DistributorClientHolding[],
  purchases: DistributorOrder[],
): DistributorClientHolding[] {
  const spentByScheme = new Map<string, number>();
  for (const order of purchases) {
    if (order.orderType !== "Purchase" || order.status !== "Completed" || order.amount <= 0) {
      continue;
    }
    const key = order.schemeName.trim().toLowerCase();
    if (!key) continue;
    spentByScheme.set(key, (spentByScheme.get(key) ?? 0) + order.amount);
  }

  return holdings.map((holding) => {
    if (holding.investedAmount > 0) return holding;
    const key = holding.schemeName.trim().toLowerCase();
    const exact = spentByScheme.get(key);
    if (exact && exact > 0) return { ...holding, investedAmount: exact };
    for (const [name, amount] of spentByScheme) {
      if (amount > 0 && (key.includes(name) || name.includes(key))) {
        return { ...holding, investedAmount: amount };
      }
    }
    return holding;
  });
}

function mapGoalPriority(priority: unknown): DistributorClientGoal["priority"] {
  const value = Number(priority);
  if (!Number.isFinite(value)) return undefined;
  if (value <= 2) return "high";
  if (value === 3) return "medium";
  return "low";
}

function mapGoalTypeFromRow(row: Record<string, unknown>): DistributorClientGoal["goalType"] {
  const template = row.template;
  if (!template || typeof template !== "object") return undefined;
  const slug = String((template as Record<string, unknown>).slug ?? "");
  const valid = new Set(["home", "education", "car", "wedding", "retirement", "custom"]);
  return valid.has(slug) ? (slug as DistributorClientGoal["goalType"]) : undefined;
}

function normalizeGoalStatus(status: unknown): DistributorClientGoal["status"] {
  const value = String(status ?? "active");
  if (value === "active" || value === "draft" || value === "achieved" || value === "paused") {
    return value;
  }
  return "active";
}

function mapGoals(rows: Array<Record<string, unknown>>): DistributorClientGoal[] {
  return rows.map((row) => {
    const targetAmount = Number(row.target_amount_inr ?? 0);
    const currentAmount = Number(
      row.effective_current_amount_inr ?? row.current_amount_inr ?? 0,
    );
    const progressPct = Number(
      row.effective_progress_pct ??
        row.progress_pct ??
        (targetAmount > 0 ? Math.round((currentAmount / targetAmount) * 100) : 0),
    );
    const template = row.template;
    const category =
      row.tag != null
        ? String(row.tag)
        : template && typeof template === "object"
          ? String((template as Record<string, unknown>).name ?? "")
          : undefined;

    return {
      id: String(row.id),
      title: String(row.title ?? "Goal"),
      category: category || undefined,
      goalType: mapGoalTypeFromRow(row),
      priority: mapGoalPriority(row.priority),
      targetAmount,
      currentAmount,
      progressPct,
      status: normalizeGoalStatus(row.status),
      targetDate: String(row.target_date ?? ""),
      scope: row.family_group_id || row.scope === "family" ? "family" : "personal",
      familyGroupName:
        row.family_group_name != null ? String(row.family_group_name) : undefined,
    };
  });
}

function mapFamilyMembers(rows: ApiFamilyGroupMember[]): DistributorClientFamilyMember[] {
  return rows.map((row) => ({
    userId: row.user_id,
    displayName: row.display_name ?? "Member",
    role: row.role === "head" ? "head" : "member",
    emailMasked: row.email_masked ?? undefined,
    profileImageUrl: resolveDistributorAssetUrl(row.profile_image_url),
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
  const kycCompliant = payload.summary.kyc_compliant;
  const kycSteps = buildDistributorKycSteps({
    stepStatuses: payload.kyc?.step_statuses,
    incompleteSteps: payload.kyc?.incomplete_steps,
    kycCompliant,
    kycAlreadyRegistered: payload.kyc?.kyc_already_registered === true,
  });
  const kycInitiatedAt = payload.summary.created_at ?? new Date().toISOString();
  const kycAuditLog = mapKycAuditLogFromApi(payload.kyc?.audit_log);
  const clientDocuments = buildClientDocumentsForInvestor(
    investor,
    kycSteps,
    payload.kyc?.documents,
    kycCompliant,
  );
  const investments = payload.investments ?? undefined;
  const purchases = mapOrders(investments?.purchases, investor);
  const holdings = fillHoldingInvestedFromPurchases(mapHoldings(investments?.holdings), purchases);
  const investedTotal = holdings.reduce((sum, row) => sum + row.investedAmount, 0);
  const currentTotal = holdings.reduce((sum, row) => sum + row.currentValue, 0);

  return {
    investor,
    displayName: payload.display_name,
    emailDisplay: payload.email_display,
    contactEmail: payload.email_display,
    contactPhone: payload.phone_masked ?? "Phone not on file",
    profileImageUrl: resolveDistributorAssetUrl(payload.profile_image_url),
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
    holdings,
    portfolioGrowth: resolveClientPortfolioChartSeries(
      mapPortfolioGrowth(investments?.growth),
      currentTotal,
      investedTotal,
    ),
    goals: mapGoals(payload.goals ?? []),
    familyGroups: mapFamilyGroups(payload.family_groups ?? []),
    referrals: mapReferrals(payload.referrals),
    sessions: mapSessions(payload.sessions ?? []),
    orders: purchases,
    systematicPlans: mapSips(investments?.sip_plans, investor),
    personalInfo: mapPersonalInfo(payload),
  };
}

export async function fetchDistributorClients(params?: {
  email?: string;
  limit?: number;
  scope?: "book" | "platform";
}) {
  const search = new URLSearchParams();
  if (params?.email) search.set("email", params.email);
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.scope) search.set("scope", params.scope);
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

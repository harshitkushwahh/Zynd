import { apiRequest } from "@/lib/api-client";

export type AdminFamilyGroupSummary = {
  id: string;
  title: string;
  tag: string | null;
  status: string;
  member_count: number;
  pending_invite_count: number;
  head_user_id: string | null;
  head_display_name: string | null;
  head_email_masked: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type AdminFamilyGroupMember = {
  user_id: string;
  display_name: string;
  display_nickname: string | null;
  email_masked: string;
  role: string;
  badge_key: string | null;
  badge_label: string | null;
  joined_at: string;
};

export type AdminFamilyGroupInvite = {
  id: string;
  group_id: string;
  invitee_email: string | null;
  invitee_user_id: string | null;
  intended_role: string;
  intended_badge_key: string | null;
  intended_badge_label: string | null;
  status: string;
  expires_at: string;
  created_at: string;
  group_title?: string;
  group_status?: string;
};

export type AdminFamilyGroupActivity = {
  id: string;
  event_type: string;
  message: string;
  actor_user_id: string | null;
  target_user_id: string | null;
  created_at: string;
};

export type AdminFamilyGroupDetail = AdminFamilyGroupSummary & {
  description: string | null;
  avatar_url: string | null;
  creator_display_name: string | null;
  creator_email_masked: string | null;
  members: AdminFamilyGroupMember[];
  invites: AdminFamilyGroupInvite[];
  activity: AdminFamilyGroupActivity[];
};

export type AdminFamilyGroupMemberPreview = {
  user_id: string;
  display_name: string;
  role: string;
  profile_image_url: string | null;
};

export type AdminUserFamilyGroupCard = AdminFamilyGroupSummary & {
  description: string | null;
  avatar_url: string | null;
  members_preview: AdminFamilyGroupMemberPreview[];
  active_goals_count: number;
  progress_pct: number;
};

export type AdminUserFamilyGroupMembership = AdminUserFamilyGroupCard & {
  group_id: string;
  role: string;
  badge_label: string | null;
  joined_at: string;
};

export type AdminUserFamilyGroups = {
  user_id: string;
  memberships: AdminUserFamilyGroupMembership[];
  created_groups: AdminUserFamilyGroupCard[];
};

export type AdminFamilyGroupAuditLogItem = {
  id: string;
  user_id: string | null;
  event_type: string;
  ip_address: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export async function fetchAdminFamilyGroups(params?: {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.search) search.set("search", params.search);
  if (params?.limit != null) search.set("limit", String(params.limit));
  if (params?.offset != null) search.set("offset", String(params.offset));
  const query = search.toString();
  return apiRequest<{ items: AdminFamilyGroupSummary[]; limit: number; offset: number }>(
    `/admin/family-groups${query ? `?${query}` : ""}`,
  );
}

export async function fetchAdminFamilyGroupDetail(groupId: string) {
  return apiRequest<AdminFamilyGroupDetail>(`/admin/family-groups/${groupId}`);
}

export type AdminFamilyGroupPortfolioSlice = {
  id: string;
  label: string;
  amount_inr: number;
  value_pct: number;
};

export type AdminFamilyGroupPortfolio = {
  total_current_value_inr: number;
  total_invested_inr: number;
  total_returns_inr: number;
  active_sips_count: number;
  active_goals_count: number;
  goal_funded_inr: number;
  goal_declared_savings_inr: number;
  goal_contributions_inr: number;
  has_holdings_data: boolean;
  slices: AdminFamilyGroupPortfolioSlice[];
};

export type AdminFamilyGroupAnalyticsMember = {
  user_id: string;
  display_name: string;
  display_nickname: string | null;
  email_masked: string;
  role: string;
  badge_key: string | null;
  badge_label: string | null;
  profile_image_url: string | null;
  joined_at: string;
  invested_amount_inr: number | null;
  goal_contribution_inr: number | null;
  portfolio_share_pct: number;
  linked_sip_count: number;
};

export type AdminFamilyGroupContributionChartPoint = {
  user_id: string;
  label: string;
  full_name: string;
  amount_inr: number;
};

export type AdminFamilyGroupProgressChartPoint = {
  period_key: string;
  year: number;
  label: string;
  goal_progress_inr: number;
  invested_inr: number;
};

export type AdminFamilyGroupSipAddon = {
  plan_id: string;
  user_id: string;
  member_label: string;
  goal_title: string | null;
  amount_inr: number;
  frequency: string;
  is_goal_linked: boolean;
};

export type AdminFamilyGroupMfHolding = {
  holding_id: number;
  user_id: string;
  member_label: string;
  member_display_name: string;
  scheme_name: string;
  matched_scheme_name: string | null;
  folio_number: string;
  isin: string;
  units: number;
  nav_value: number | null;
  market_value_inr: number | null;
  as_of_date: string | null;
  amc_name: string | null;
  source: string;
};

export type AdminFamilyGroupOneTimePayment = {
  contribution_id: string;
  user_id: string;
  member_label: string;
  member_display_name: string;
  goal_title: string;
  amount_inr: number;
  source_type: string;
  contributed_at: string | null;
};

export type AdminFamilyGroupAnalyticsGoal = {
  id: string;
  title: string;
  status: string;
  target_amount_inr: number | null;
  current_amount_inr: number | null;
  existing_savings_inr: number | null;
  progress_pct: number;
  target_date: string | null;
  contribution_total_inr: number | null;
  priority?: number | null;
  tag?: string | null;
};

export type AdminFamilyGroupAnalytics = AdminFamilyGroupSummary & {
  description: string | null;
  avatar_url: string | null;
  creator_display_name: string | null;
  creator_email_masked: string | null;
  progress_pct: number;
  portfolio: AdminFamilyGroupPortfolio;
  members: AdminFamilyGroupAnalyticsMember[];
  goals: AdminFamilyGroupAnalyticsGoal[];
  contribution_chart: AdminFamilyGroupContributionChartPoint[];
  activity: AdminFamilyGroupActivity[];
  progress_chart: AdminFamilyGroupProgressChartPoint[];
  sip_addons: AdminFamilyGroupSipAddon[];
  mf_holdings: AdminFamilyGroupMfHolding[];
  one_time_payments: AdminFamilyGroupOneTimePayment[];
};

export async function fetchAdminFamilyGroupAnalytics(groupId: string) {
  return apiRequest<AdminFamilyGroupAnalytics>(`/admin/family-groups/${groupId}/analytics`);
}

export async function fetchAdminFamilyGroupInvites(params?: {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.search) search.set("search", params.search);
  if (params?.limit != null) search.set("limit", String(params.limit));
  if (params?.offset != null) search.set("offset", String(params.offset));
  const query = search.toString();
  return apiRequest<{ items: AdminFamilyGroupInvite[]; limit: number; offset: number }>(
    `/admin/family-groups/invites${query ? `?${query}` : ""}`,
  );
}

export async function fetchAdminFamilyGroupAuditLogs(params?: {
  user_id?: string;
  event_type?: string;
  limit?: number;
  offset?: number;
}) {
  const search = new URLSearchParams();
  if (params?.user_id) search.set("user_id", params.user_id);
  if (params?.event_type) search.set("event_type", params.event_type);
  if (params?.limit != null) search.set("limit", String(params.limit));
  if (params?.offset != null) search.set("offset", String(params.offset));
  const query = search.toString();
  return apiRequest<{ items: AdminFamilyGroupAuditLogItem[]; limit: number; offset: number }>(
    `/admin/family-groups/audit${query ? `?${query}` : ""}`,
  );
}

export async function fetchAdminUserFamilyGroups(userId: string) {
  return apiRequest<AdminUserFamilyGroups>(`/admin/family-groups/users/${userId}`);
}

export async function adminArchiveFamilyGroup(groupId: string) {
  return apiRequest<AdminFamilyGroupDetail>(`/admin/family-groups/${groupId}/archive`, {
    method: "POST",
  });
}

export async function adminRemoveFamilyGroupMember(groupId: string, userId: string) {
  return apiRequest<{ ok: boolean }>(`/admin/family-groups/${groupId}/members/${userId}/remove`, {
    method: "POST",
  });
}

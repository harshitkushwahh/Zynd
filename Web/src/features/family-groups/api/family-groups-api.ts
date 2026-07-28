import { apiRequest } from "@/lib/api-client";

export type FamilyGroupRole = "head" | "contributor" | "viewer";
export type InvitableFamilyGroupRole = "contributor" | "viewer";

export type FamilyGroupMemberPreview = {
  user_id: string;
  display_name: string;
  display_nickname?: string | null;
  role: FamilyGroupRole;
  badge_key?: string | null;
  badge_label?: string | null;
  profile_image_url?: string | null;
  joined_at: string;
  kyc_completed?: boolean;
  has_invested?: boolean;
  email?: string | null;
  phone?: string | null;
  zynd_id?: string | null;
  details_masked?: boolean;
  contribution_amount?: number | null;
  group_sip_count?: number | null;
};

export type FamilyGroupSummary = {
  id: string;
  title: string;
  description?: string | null;
  tag?: string | null;
  status: "active" | "archived";
  created_by_user_id: string;
  avatar_url?: string | null;
  member_count: number;
  pending_invite_count?: number;
  member_limit?: number;
  my_role?: FamilyGroupRole | null;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
};

export type FamilyGroupInvite = {
  id: string;
  group_id: string;
  invitee_email?: string | null;
  invitee_user_id?: string | null;
  intended_role: InvitableFamilyGroupRole;
  intended_badge_key?: string | null;
  intended_badge_label?: string | null;
  status: "pending" | "accepted" | "declined" | "revoked" | "expired";
  expires_at: string;
  share_url?: string | null;
  created_at: string;
};

export type FamilyGroupBadgePreset = {
  key: string;
  label: string;
};

export type FamilyGroupInvitePreview = {
  group_id: string;
  group_title: string;
  inviter_name: string;
  intended_role: InvitableFamilyGroupRole;
  intended_badge_key?: string | null;
  intended_badge_label?: string | null;
  expires_at: string;
  invitee_email_masked?: string | null;
};

export type PendingFamilyGroupInvite = {
  id: string;
  group_id: string;
  group_title: string;
  inviter_name: string;
  intended_role: InvitableFamilyGroupRole;
  intended_badge_key?: string | null;
  intended_badge_label?: string | null;
  expires_at: string;
  created_at: string;
};

export type FamilyGroupListResponse = {
  items: FamilyGroupSummary[];
  limit: number;
  active_count: number;
};

export type FamilyGroupDetail = FamilyGroupSummary & {
  members: FamilyGroupMemberPreview[];
  invites?: FamilyGroupInvite[];
  active_goals_count?: number;
  active_sips_count?: number;
  total_invested_inr?: number;
  total_current_value_inr?: number;
};

export type FamilyGroupPortfolioSlice = {
  id: string;
  label: string;
  amount_inr: number;
  value_pct: number;
};

export type FamilyGroupPortfolio = {
  total_current_value_inr: number;
  total_invested_inr: number;
  active_sips_count: number;
  active_goals_count: number;
  goal_funded_inr: number;
  has_holdings_data: boolean;
  slices: FamilyGroupPortfolioSlice[];
};

export type FamilyGoal = {
  id: string;
  user_id: string;
  family_group_id: string;
  template_id?: string | null;
  title: string;
  tag?: string | null;
  priority: number;
  target_amount_inr: number;
  target_date: string;
  current_amount_inr: number;
  existing_savings_inr: number;
  expected_return_pct?: number | null;
  status: string;
  progress_pct: number;
  created_by_user_id?: string | null;
  contribution_total_inr?: number | null;
  projected_value_inr?: number | null;
  effective_current_amount_inr?: number | null;
};

export type FamilyGoalContributionItem = {
  id: string;
  user_id: string;
  display_name: string;
  amount_inr: number;
  source_type: string;
  note?: string | null;
  contributed_at?: string | null;
};

export type FamilyGoalContributions = {
  goal_id: string;
  total_contributed_inr: number;
  member_totals: Array<{
    user_id: string;
    display_name: string;
    total_inr: number;
    contribution_count: number;
  }>;
  items: FamilyGoalContributionItem[];
};

export type CreateFamilyGroupInput = {
  title: string;
  description?: string;
  tag?: string;
};

export type UpdateFamilyGroupInput = {
  title?: string;
  description?: string;
  tag?: string;
};

export type UpdateFamilyGroupMemberInput = {
  role?: InvitableFamilyGroupRole;
  badge_key?: string;
  badge_label?: string;
  clear_badge?: boolean;
  display_nickname?: string;
  clear_nickname?: boolean;
};

export type FamilyGroupActivityItem = {
  id: string;
  event_type: string;
  message: string;
  actor_user_id?: string | null;
  target_user_id?: string | null;
  actor_display_name?: string | null;
  actor_profile_image_url?: string | null;
  actor_role?: FamilyGroupRole | null;
  metadata?: Record<string, unknown>;
  created_at: string;
};

export type FamilyGroupActivityListResponse = {
  items: FamilyGroupActivityItem[];
  next_cursor?: string | null;
  has_more: boolean;
};

export type LeaveFamilyGroupResponse = {
  ok: boolean;
  group_archived: boolean;
};

export type TransferFamilyGroupHeadInput = {
  new_head_user_id: string;
};

export type CreateFamilyGroupInviteInput = {
  invitee_email: string;
  intended_role?: InvitableFamilyGroupRole;
  intended_badge_key?: string;
  intended_badge_label?: string;
};

export async function fetchFamilyGroups(): Promise<FamilyGroupListResponse> {
  return apiRequest<FamilyGroupListResponse>("/family-groups/me");
}

export async function fetchArchivedFamilyGroups(): Promise<FamilyGroupListResponse> {
  return apiRequest<FamilyGroupListResponse>("/family-groups/me/archived");
}

export async function fetchFamilyGroup(groupId: string): Promise<FamilyGroupDetail> {
  return apiRequest<FamilyGroupDetail>(`/family-groups/${groupId}`);
}

export async function fetchFamilyGroupBadges(): Promise<{ items: FamilyGroupBadgePreset[] }> {
  return apiRequest<{ items: FamilyGroupBadgePreset[] }>("/family-groups/badges");
}

export async function fetchPendingFamilyInvites(): Promise<{ items: PendingFamilyGroupInvite[] }> {
  return apiRequest<{ items: PendingFamilyGroupInvite[] }>("/family-groups/invites/pending");
}

export async function previewFamilyGroupInvite(token: string): Promise<FamilyGroupInvitePreview> {
  const params = new URLSearchParams({ token });
  return apiRequest<FamilyGroupInvitePreview>(`/family-groups/invites/preview?${params.toString()}`);
}

export async function acceptFamilyGroupInvite(token: string): Promise<FamilyGroupSummary> {
  return apiRequest<FamilyGroupSummary>("/family-groups/invites/accept", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export async function declineFamilyGroupInvite(token: string): Promise<{ ok: boolean }> {
  return apiRequest<{ ok: boolean }>("/family-groups/invites/decline", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export async function acceptFamilyGroupInviteById(inviteId: string): Promise<FamilyGroupSummary> {
  return apiRequest<FamilyGroupSummary>(`/family-groups/invites/${inviteId}/accept`, {
    method: "POST",
  });
}

export async function declineFamilyGroupInviteById(inviteId: string): Promise<{ ok: boolean }> {
  return apiRequest<{ ok: boolean }>(`/family-groups/invites/${inviteId}/decline`, {
    method: "POST",
  });
}

export async function createFamilyGroup(input: CreateFamilyGroupInput): Promise<FamilyGroupSummary> {
  return apiRequest<FamilyGroupSummary>("/family-groups", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function createFamilyGroupInvite(
  groupId: string,
  input: CreateFamilyGroupInviteInput,
): Promise<FamilyGroupInvite> {
  return apiRequest<FamilyGroupInvite>(`/family-groups/${groupId}/invites`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function revokeFamilyGroupInvite(groupId: string, inviteId: string): Promise<FamilyGroupInvite> {
  return apiRequest<FamilyGroupInvite>(`/family-groups/${groupId}/invites/${inviteId}/revoke`, {
    method: "POST",
  });
}

export async function resendFamilyGroupInvite(groupId: string, inviteId: string): Promise<FamilyGroupInvite> {
  return apiRequest<FamilyGroupInvite>(`/family-groups/${groupId}/invites/${inviteId}/resend`, {
    method: "POST",
  });
}

export async function updateFamilyGroup(
  groupId: string,
  input: UpdateFamilyGroupInput,
): Promise<FamilyGroupSummary> {
  return apiRequest<FamilyGroupSummary>(`/family-groups/${groupId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function archiveFamilyGroup(groupId: string): Promise<FamilyGroupSummary> {
  return apiRequest<FamilyGroupSummary>(`/family-groups/${groupId}`, {
    method: "DELETE",
  });
}

export async function uploadFamilyGroupAvatar(
  groupId: string,
  file: File,
): Promise<FamilyGroupSummary> {
  const formData = new FormData();
  formData.append("file", file);

  return apiRequest<FamilyGroupSummary>(`/family-groups/${groupId}/avatar`, {
    method: "POST",
    body: formData,
  });
}

export async function updateFamilyGroupMember(
  groupId: string,
  userId: string,
  input: UpdateFamilyGroupMemberInput,
): Promise<FamilyGroupMemberPreview> {
  return apiRequest<FamilyGroupMemberPreview>(`/family-groups/${groupId}/members/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function removeFamilyGroupMember(groupId: string, userId: string): Promise<{ ok: boolean }> {
  return apiRequest<{ ok: boolean }>(`/family-groups/${groupId}/members/${userId}`, {
    method: "DELETE",
  });
}

export async function leaveFamilyGroup(groupId: string): Promise<LeaveFamilyGroupResponse> {
  return apiRequest<LeaveFamilyGroupResponse>(`/family-groups/${groupId}/leave`, {
    method: "POST",
  });
}

export async function transferFamilyGroupHead(
  groupId: string,
  input: TransferFamilyGroupHeadInput,
): Promise<FamilyGroupSummary> {
  return apiRequest<FamilyGroupSummary>(`/family-groups/${groupId}/transfer-head`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchFamilyGroupActivity(
  groupId: string,
  params?: { cursor?: string; limit?: number },
): Promise<FamilyGroupActivityListResponse> {
  const search = new URLSearchParams();
  if (params?.cursor) search.set("cursor", params.cursor);
  if (params?.limit) search.set("limit", String(params.limit));
  const query = search.toString();
  return apiRequest<FamilyGroupActivityListResponse>(
    `/family-groups/${groupId}/activity${query ? `?${query}` : ""}`,
  );
}

export type NomineeFamilyGroupPreviewStatus =
  | "ok"
  | "already_member"
  | "invite_pending"
  | "group_full"
  | "not_group_head"
  | "no_groups"
  | "already_handled"
  | "select_group"
  | "no_email";

export type NomineeFamilyGroupPreview = {
  status: NomineeFamilyGroupPreviewStatus;
  message: string;
  groups: FamilyGroupSummary[];
  group_id?: string | null;
  suggested_badge_key?: string | null;
  suggested_badge_label?: string | null;
  invitee_email_masked?: string | null;
  existing_status?: string | null;
};

export type NomineeFamilyGroupAddInput = {
  nominee_email: string;
  nominee_name: string;
  relationship: string;
  kyc_nominee_id: string;
  group_id?: string;
  create_group_title?: string;
  action?: "invite" | "skip";
};

export async function previewNomineeFamilyGroupAdd(
  input: Omit<NomineeFamilyGroupAddInput, "action" | "create_group_title"> & { group_id?: string },
): Promise<NomineeFamilyGroupPreview> {
  return apiRequest<NomineeFamilyGroupPreview>("/family-groups/nominee-add/preview", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function addNomineeToFamilyGroup(
  input: NomineeFamilyGroupAddInput,
): Promise<{ ok: boolean; action: string; group?: FamilyGroupSummary; invite?: FamilyGroupInvite }> {
  return apiRequest<{ ok: boolean; action: string; group?: FamilyGroupSummary; invite?: FamilyGroupInvite }>(
    "/family-groups/nominee-add",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function fetchFamilyGroupPortfolio(groupId: string) {
  return apiRequest<FamilyGroupPortfolio>(`/family-groups/${groupId}/portfolio`);
}

export async function fetchFamilyGroupGoals(groupId: string, includeArchived = false) {
  const query = includeArchived ? "?include_archived=true" : "";
  return apiRequest<{ items: FamilyGoal[]; limit: number; active_count: number }>(
    `/family-groups/${groupId}/goals${query}`,
  );
}

export async function createFamilyGroupGoal(
  groupId: string,
  input: {
    title: string;
    target_amount_inr: number;
    target_date: string;
    template_id?: string;
    tag?: string;
    priority?: number;
    existing_savings_inr?: number;
    expected_return_pct?: number;
  },
) {
  return apiRequest<FamilyGoal>(`/family-groups/${groupId}/goals`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchFamilyGoalContributions(groupId: string, goalId: string) {
  return apiRequest<FamilyGoalContributions>(`/family-groups/${groupId}/goals/${goalId}/contributions`);
}

export async function addFamilyGoalContribution(
  groupId: string,
  goalId: string,
  input: { amount_inr: number; note?: string },
) {
  return apiRequest<FamilyGoalContributions>(`/family-groups/${groupId}/goals/${goalId}/contributions`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

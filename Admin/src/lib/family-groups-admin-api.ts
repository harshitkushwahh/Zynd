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

export type AdminUserFamilyGroups = {
  user_id: string;
  memberships: Array<{
    group_id: string;
    title: string;
    tag: string | null;
    status: string;
    role: string;
    badge_label: string | null;
    member_count: number;
    joined_at: string;
  }>;
  created_groups: AdminFamilyGroupSummary[];
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

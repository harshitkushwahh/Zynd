import { apiRequest } from "@/lib/api-client";

export type AdminGoalTemplate = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  icon_key: string;
  image_url?: string | null;
  default_tenure_months: number;
  suggested_return_pct?: number | null;
  is_active: boolean;
  sort_order: number;
  created_at?: string | null;
  updated_at?: string | null;
};

export async function fetchAdminGoalTemplates(includeInactive = true) {
  const query = includeInactive ? "?include_inactive=true" : "";
  return apiRequest<{ items: AdminGoalTemplate[] }>(`/admin/goals/templates${query}`);
}

export async function updateAdminGoalTemplate(
  templateId: string,
  input: Partial<{
    name: string;
    description: string | null;
    icon_key: string;
    image_url?: string | null;
    clear_image_url?: boolean;
    default_tenure_months: number;
    suggested_return_pct: number;
    is_active: boolean;
    sort_order: number;
  }>,
) {
  return apiRequest<AdminGoalTemplate>(`/admin/goals/templates/${templateId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

import { apiRequest } from "@/lib/api-client";

export type IntegrationEnvironment = "test" | "live";

export type MfIntegrationProviderId = "finprim" | "cybrilla" | "kyckart";

export type MfIntegrationProfilePreview = {
  configured: boolean;
  base_url?: string;
  tenant?: string;
  token_base_url?: string;
  client_id_masked?: string;
  client_secret_masked?: string;
  api_key_masked?: string;
  webhook_secret_masked?: string;
};

export type MfIntegrationProviderStatus = {
  id: MfIntegrationProviderId;
  active_environment: IntegrationEnvironment;
  active_configured: boolean;
  profiles: Record<IntegrationEnvironment, MfIntegrationProfilePreview>;
  notes: string[];
};

export async function fetchMfIntegrations() {
  const result = await apiRequest<{ items: MfIntegrationProviderStatus[] }>(
    "/admin/mf/integrations",
  );
  return result.items;
}

export async function updateMfIntegrationEnvironment(
  provider: MfIntegrationProviderId,
  environment: IntegrationEnvironment,
) {
  return apiRequest<MfIntegrationProviderStatus>(
    `/admin/mf/integrations/${provider}/environment`,
    {
      method: "PATCH",
      body: JSON.stringify({ environment }),
    },
  );
}

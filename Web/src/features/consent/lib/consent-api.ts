import { apiRequest } from "@/lib/api-client";

export type ConsentCurrentVersion = {
  consent_key: string;
  title: string;
  description?: string | null;
  acceptance_mode: string;
  reaccept_policy: string;
  consent_version_id: string;
  version_label: string;
  summary_text?: string | null;
  body_markdown?: string | null;
  document_url?: string | null;
};

export type ConsentRequiredResponse = {
  items: ConsentCurrentVersion[];
};

export async function fetchConsentCurrent(consentKey: string) {
  return apiRequest<ConsentCurrentVersion>(
    `/consents/definitions/${encodeURIComponent(consentKey)}/current`,
  );
}

export async function fetchRequiredConsents(context: "signup" | "login" | "kyc") {
  return apiRequest<ConsentRequiredResponse>(
    `/consents/me/required?context=${encodeURIComponent(context)}`,
  );
}

export async function acceptConsents(input: {
  consent_keys?: string[];
  consent_key?: string;
  consent_version_id?: string;
}) {
  return apiRequest<{ success: boolean; accepted_count: number }>("/consents/me/accept", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function revokeConsent(consentKey: string) {
  return apiRequest<{ success: boolean }>("/consents/me/revoke", {
    method: "POST",
    body: JSON.stringify({ consent_key: consentKey }),
  });
}

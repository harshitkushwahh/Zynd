import { env } from "@/lib/env";
import { apiRequest, getAccessToken } from "@/lib/api-client";

export const MAX_BANK_ACCOUNTS = 5;

export type InvestorBankAccountFailure = {
  field: string;
  code?: string | null;
  reason?: string | null;
};

export type InvestorBankAccount = {
  id: string;
  account_number_masked: string;
  account_number_last4: string;
  ifsc_code: string;
  account_type: string;
  account_holder_name: string;
  pan_account_holder_name?: string | null;
  bank_name?: string | null;
  branch_name?: string | null;
  is_primary: boolean;
  source: string;
  verification_status: "pending" | "verified" | "manual_required" | "failed";
  sync_status: string;
  requires_manual_verification: boolean;
  requires_proof_upload: boolean;
  proof_uploaded: boolean;
  preverify_id?: string | null;
  failure?: InvestorBankAccountFailure | null;
  readiness_verified: boolean;
  external_bank_account_id?: string | null;
  is_payment_ready?: boolean;
  active_sip_count?: number;
  blocks_removal?: boolean;
  blocks_primary_switch?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export type InvestorBankAccountVerifyResponse = InvestorBankAccount & {
  success: boolean;
  pan_verified: boolean;
  bank_verified: boolean;
  requires_manual_verification: boolean;
  requires_proof_upload: boolean;
};

export type InvestorBankAccountListResponse = {
  bank_accounts: InvestorBankAccount[];
};

export function fetchInvestorBankAccounts() {
  return apiRequest<InvestorBankAccountListResponse>("/invest/bank-accounts");
}

export function verifyInvestorBankAccount(body: {
  account_number: string;
  account_type: string;
  ifsc_code: string;
}) {
  return apiRequest<InvestorBankAccountVerifyResponse>("/invest/bank-accounts/verify", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function uploadInvestorBankAccountProof(bankAccountId: string, file: File) {
  const token = getAccessToken();
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${env.apiUrl}/invest/bank-accounts/${bankAccountId}/upload-proof`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
    credentials: "include",
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.detail?.message ?? payload?.message ?? "Could not upload bank proof.");
  }

  return response.json() as Promise<{ file_id: string; bank_account: InvestorBankAccount }>;
}

export function verifyInvestorBankAccountManual(bankAccountId: string) {
  return apiRequest<
    InvestorBankAccount & {
      success: boolean;
      bank_verified: boolean;
      readiness_verified: boolean;
      requires_manual_verification: boolean;
      requires_proof_upload: boolean;
    }
  >(`/invest/bank-accounts/${bankAccountId}/verify-manual`, { method: "POST" });
}

export function fetchInvestorBankAccountPreverifyStatus(bankAccountId: string, preverifyId: string) {
  return apiRequest<{
    status?: string | null;
    bank_verified: boolean;
    code?: string | null;
    reason?: string | null;
  }>(
    `/invest/bank-accounts/${bankAccountId}/preverify-status?preverify_id=${encodeURIComponent(preverifyId)}`,
  );
}

export function setPrimaryInvestorBankAccount(bankAccountId: string) {
  return apiRequest<InvestorBankAccount>(`/invest/bank-accounts/${bankAccountId}/set-primary`, {
    method: "PATCH",
  });
}

export function disableInvestorBankAccount(bankAccountId: string) {
  return apiRequest<void>(`/invest/bank-accounts/${bankAccountId}`, {
    method: "DELETE",
  });
}

const BANK_TYPE_LABELS: Record<string, string> = {
  savings: "Savings",
  current: "Current",
  nre_savings: "NRE",
  nro_savings: "NRO",
};

export function formatInvestorBankAccountType(accountType: string): string {
  const normalized = accountType.trim().toLowerCase();
  return BANK_TYPE_LABELS[normalized] ?? accountType;
}

export function isInvestorBankAccountVerified(account: InvestorBankAccount): boolean {
  return account.verification_status === "verified";
}

export function isInvestorBankAccountPaymentReady(account: InvestorBankAccount): boolean {
  if (typeof account.is_payment_ready === "boolean") {
    return account.is_payment_ready;
  }
  return (
    isInvestorBankAccountVerified(account) &&
    account.sync_status === "active" &&
    Boolean(account.external_bank_account_id)
  );
}

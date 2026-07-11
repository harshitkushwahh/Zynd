import { verifyKycBankHybrid } from "@/features/kyc/lib/kyc-api";
import type { KycBankVerificationResult } from "@/features/kyc/lib/kyc-bank";

type VerifyBankAccountInput = {
  accountNumber: string;
  accountType: string;
  ifscCode: string;
};

export async function verifyBankAccount(
  input: VerifyBankAccountInput,
): Promise<KycBankVerificationResult> {
  const result = await verifyKycBankHybrid({
    account_number: input.accountNumber,
    account_type: input.accountType,
    ifsc_code: input.ifscCode,
  });

  if (!result.success && !result.requires_manual_verification) {
    throw new Error(result.failure?.reason ?? "Bank account verification failed.");
  }

  return {
    panVerified: result.pan_verified,
    bankVerified: result.bank_verified,
    readinessVerified: result.readiness_verified,
    bankName: result.bank_name ?? "",
    branch: result.branch ?? "",
    requiresManualVerification: result.requires_manual_verification,
    requiresProofUpload: result.requires_proof_upload,
    preverifyId: result.preverify_id,
    failureReason: result.failure?.reason,
  };
}

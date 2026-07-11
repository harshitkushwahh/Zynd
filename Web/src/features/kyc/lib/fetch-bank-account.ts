import { verifyKycBankHybrid } from "@/features/kyc/lib/kyc-api";
import type { KycBankFetchResult } from "@/features/kyc/lib/kyc-bank";

type FetchBankAccountInput = {
  accountNumber: string;
  accountType: string;
  ifscCode: string;
};

export async function fetchBankAccountDetails(
  input: FetchBankAccountInput,
): Promise<KycBankFetchResult> {
  const result = await verifyKycBankHybrid({
    account_number: input.accountNumber,
    account_type: input.accountType,
    ifsc_code: input.ifscCode,
  });

  if (!result.account_holder_name) {
    throw new Error("Could not fetch bank account details.");
  }

  return {
    accountHolderName: result.account_holder_name,
  };
}

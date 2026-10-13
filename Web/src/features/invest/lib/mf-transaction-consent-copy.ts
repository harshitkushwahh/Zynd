import { copy } from "@/shared/config/copy";

export function formatMfTransactionConsentOtpMessage(input: {
  maskedMobile?: string | null;
  maskedEmail?: string | null;
}) {
  const mf = copy.mutualFunds.transactionConsent;
  const mobile = input.maskedMobile?.trim();
  const email = input.maskedEmail?.trim();
  if (mobile && email) {
    return mf.sentToMobileAndEmail.replace("{mobile}", mobile).replace("{email}", email);
  }
  if (mobile) {
    return mf.sentToMobile.replace("{mobile}", mobile);
  }
  return mf.sentGeneric;
}

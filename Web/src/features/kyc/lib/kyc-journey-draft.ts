import type { KycAddressFormValue } from "@/features/kyc/lib/kyc-address";
import type { KycBankAccountDetails, KycBankFormValue } from "@/features/kyc/lib/kyc-bank";
import type { KycNomineeRecord } from "@/features/kyc/lib/kyc-nominee";
import type { KycPersonalInfoValue } from "@/features/kyc/lib/kyc-personal-info";

export type KycPanDraft = {
  panNumber?: string;
  panMasked?: string;
  panLast4?: string;
  firstName: string;
  lastName: string;
  middleName: string;
  dateOfBirth?: string;
  panCategory?: string;
  fullName?: string;
};

export type KycSignatureMode = "draw" | "upload";

export type KycSignatureDraft = {
  mode: KycSignatureMode;
  dataUrl: string;
  documentId?: string;
};

export type KycJourneyDraft = {
  pan?: KycPanDraft;
  address?: KycAddressFormValue;
  personalInfo?: KycPersonalInfoValue;
  nominees?: KycNomineeRecord[];
  bank?: KycBankFormValue & { accountDetails: KycBankAccountDetails };
  signature?: KycSignatureDraft;
};

export function createEmptyJourneyDraft(): KycJourneyDraft {
  return {};
}

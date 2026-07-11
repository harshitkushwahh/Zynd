import type { KycMasterDataOption } from "@/features/kyc/lib/kyc-api";

/** Cybrilla/Finprim enum values with user-facing labels. Values are sent to the API. */
export const KYC_GENDER_OPTIONS: KycMasterDataOption[] = [
  { label: "Male", value: "male" },
  { label: "Female", value: "female" },
  { label: "Other", value: "transgender" },
];

export const KYC_MARITAL_STATUS_OPTIONS: KycMasterDataOption[] = [
  { label: "Single", value: "unmarried" },
  { label: "Married", value: "married" },
  { label: "Other", value: "others" },
];

export const KYC_OCCUPATION_OPTIONS: KycMasterDataOption[] = [
  { label: "Business", value: "business" },
  { label: "Professional", value: "professional" },
  { label: "Retired", value: "retired" },
  { label: "Homemaker", value: "housewife" },
  { label: "Student", value: "student" },
  { label: "Public Sector", value: "public_sector" },
  { label: "Private Sector", value: "private_sector" },
  { label: "Government Sector", value: "government_sector" },
  { label: "Other", value: "others" },
];

export const KYC_INCOME_SLAB_OPTIONS: KycMasterDataOption[] = [
  { label: "Up to ₹1 lakh", value: "upto_1lakh" },
  { label: "₹1 lakh – ₹5 lakhs", value: "above_1lakh_upto_5lakh" },
  { label: "₹5 lakhs – ₹10 lakhs", value: "above_5lakh_upto_10lakh" },
  { label: "₹10 lakhs – ₹25 lakhs", value: "above_10lakh_upto_25lakh" },
  { label: "₹25 lakhs – ₹1 crore", value: "above_25lakh_upto_1cr" },
  { label: "Above ₹1 crore", value: "above_1cr" },
];

export const KYC_PEP_OPTIONS: KycMasterDataOption[] = [
  { label: "No", value: "not_applicable" },
  { label: "Yes — I am PEP exposed", value: "pep_exposed" },
  { label: "Yes — related to a PEP", value: "pep_related" },
];

export const KYC_NOMINEE_RELATIONSHIP_OPTIONS: KycMasterDataOption[] = [
  { label: "Father", value: "father" },
  { label: "Mother", value: "mother" },
  { label: "Spouse", value: "spouse" },
  { label: "Son", value: "son" },
  { label: "Daughter", value: "daughter" },
  { label: "Brother", value: "brother" },
  { label: "Sister", value: "sister" },
  { label: "Grandfather", value: "grandfather" },
  { label: "Grandmother", value: "grandmother" },
  { label: "Other", value: "others" },
];

export const KYC_NOMINEE_SOURCE_OF_WEALTH_OPTIONS: KycMasterDataOption[] = [
  { label: "Salary", value: "salary" },
  { label: "Business", value: "business" },
  { label: "Gift", value: "gift" },
  { label: "Ancestral property", value: "ancestral_property" },
  { label: "Rental income", value: "rental_income" },
  { label: "Prize money", value: "prize_money" },
  { label: "Royalty", value: "royalty" },
  { label: "Other", value: "others" },
];

export const KYC_NOMINEE_DOCUMENT_TYPE_OPTIONS: KycMasterDataOption[] = [
  { label: "PAN", value: "pan" },
  { label: "Aadhaar", value: "aadhaar" },
  { label: "Passport", value: "passport" },
  { label: "Driving licence", value: "driving_licence" },
  { label: "Voter ID", value: "voter_id" },
];

export const KYC_BANK_ACCOUNT_TYPE_OPTIONS: KycMasterDataOption[] = [
  { label: "Savings", value: "Savings" },
  { label: "Current", value: "Current" },
  { label: "NRE", value: "NRE" },
  { label: "NRO", value: "NRO" },
];

const ALL_ENUM_OPTIONS: KycMasterDataOption[] = [
  ...KYC_GENDER_OPTIONS,
  ...KYC_MARITAL_STATUS_OPTIONS,
  ...KYC_OCCUPATION_OPTIONS,
  ...KYC_INCOME_SLAB_OPTIONS,
  ...KYC_PEP_OPTIONS,
  ...KYC_NOMINEE_RELATIONSHIP_OPTIONS,
  ...KYC_NOMINEE_SOURCE_OF_WEALTH_OPTIONS,
  ...KYC_NOMINEE_DOCUMENT_TYPE_OPTIONS,
  ...KYC_BANK_ACCOUNT_TYPE_OPTIONS,
];

export function titleCaseWords(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function lookupKycEnumLabel(
  value: string,
  options: readonly KycMasterDataOption[] = ALL_ENUM_OPTIONS,
): string {
  const normalized = value.trim();
  if (!normalized) return "";

  const match = options.find(
    (option) =>
      option.value.toLowerCase() === normalized.toLowerCase() ||
      option.label.toLowerCase() === normalized.toLowerCase(),
  );
  if (match) return match.label;

  return titleCaseWords(normalized);
}

export const KYC_PERSONAL_INFO_FALLBACK_OPTIONS = {
  gender: KYC_GENDER_OPTIONS,
  incomeSlab: KYC_INCOME_SLAB_OPTIONS,
  occupation: KYC_OCCUPATION_OPTIONS,
  maritalStatus: KYC_MARITAL_STATUS_OPTIONS,
  pepExposed: KYC_PEP_OPTIONS,
} as const;

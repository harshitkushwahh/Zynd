import type { KycPersonalInfoValue } from "@/features/kyc/lib/kyc-personal-info";
import {
  KYC_BANK_ACCOUNT_TYPE_OPTIONS,
  KYC_GENDER_OPTIONS,
  KYC_INCOME_SLAB_OPTIONS,
  KYC_MARITAL_STATUS_OPTIONS,
  KYC_OCCUPATION_OPTIONS,
  KYC_PEP_OPTIONS,
  lookupKycEnumLabel,
  titleCaseWords,
} from "@/features/kyc/lib/kyc-master-data-options";
import type { SettingsKycBank, SettingsKycProfile } from "@/features/kyc/lib/settings-kyc-profile";

const COUNTRY_LABELS: Record<string, string> = {
  IN: "India",
  US: "United States",
  GB: "United Kingdom",
  UK: "United Kingdom",
};

export function formatSettingsCountryCode(code: string): string {
  const normalized = code.trim().toUpperCase();
  return COUNTRY_LABELS[normalized] ?? code;
}

export function formatSettingsPersonalInfo(
  personalInfo: KycPersonalInfoValue | null | undefined,
): KycPersonalInfoValue | null {
  if (!personalInfo) return null;

  return {
    fathersName: personalInfo.fathersName.trim(),
    gender: lookupKycEnumLabel(personalInfo.gender, KYC_GENDER_OPTIONS),
    incomeSlab: lookupKycEnumLabel(personalInfo.incomeSlab, KYC_INCOME_SLAB_OPTIONS),
    occupation: lookupKycEnumLabel(personalInfo.occupation, KYC_OCCUPATION_OPTIONS),
    maritalStatus: lookupKycEnumLabel(personalInfo.maritalStatus, KYC_MARITAL_STATUS_OPTIONS),
    pepExposed: lookupKycEnumLabel(personalInfo.pepExposed, KYC_PEP_OPTIONS),
    placeOfBirth: titleCaseWords(personalInfo.placeOfBirth),
    nationality: personalInfo.nationality.trim() || titleCaseWords(personalInfo.nationality),
  };
}

export function formatSettingsBankAccount(bank: SettingsKycBank | null): SettingsKycBank | null {
  if (!bank) return null;

  return {
    ...bank,
    accountType: lookupKycEnumLabel(bank.accountType, KYC_BANK_ACCOUNT_TYPE_OPTIONS),
    accountHolderName: bank.accountHolderName.trim(),
    bankName: bank.bankName.trim(),
    branch: bank.branch.trim(),
    ifscCode: bank.ifscCode.trim().toUpperCase(),
  };
}

export function formatSettingsKycProfile(profile: SettingsKycProfile): SettingsKycProfile {
  return {
    ...profile,
    personalInfo: formatSettingsPersonalInfo(profile.personalInfo),
    bank: formatSettingsBankAccount(profile.bank),
  };
}

import type { KycMasterDataOption } from "@/lib/distributor-kyc-master-data-api";

/** Cybrilla/Finprim bank account type labels sent to verify-hybrid. */
export const ADD_INVESTOR_BANK_ACCOUNT_TYPE_OPTIONS: readonly KycMasterDataOption[] = [
  { label: "Savings", value: "Savings" },
  { label: "Current", value: "Current" },
  { label: "NRE", value: "NRE" },
  { label: "NRO", value: "NRO" },
];

export type AddInvestorPersonalOptions = {
  gender: KycMasterDataOption[];
  maritalStatus: KycMasterDataOption[];
  occupation: KycMasterDataOption[];
  incomeSlab: KycMasterDataOption[];
  pepExposed: KycMasterDataOption[];
  countryOfOrigin: KycMasterDataOption[];
};

export type AddInvestorNomineeOptions = {
  relationships: KycMasterDataOption[];
  sourceOfWealth: KycMasterDataOption[];
  documentTypes: KycMasterDataOption[];
};

export type AddInvestorKycMasterData = {
  personal: AddInvestorPersonalOptions;
  nominee: AddInvestorNomineeOptions;
  bankAccountTypes: readonly KycMasterDataOption[];
  states: string[];
  countries: KycMasterDataOption[];
};

export function lookupAddInvestorEnumLabel(
  value: string | null | undefined,
  options: readonly KycMasterDataOption[],
): string {
  const normalized = value?.trim() ?? "";
  if (!normalized) return "";
  const match = options.find(
    (option) =>
      option.value.toLowerCase() === normalized.toLowerCase() ||
      option.label.toLowerCase() === normalized.toLowerCase(),
  );
  return match?.label ?? normalized;
}

export function resolveAddInvestorStateOption(state: string, stateOptions: readonly string[]): string {
  const trimmed = state.trim();
  if (!trimmed) return "";
  const exact = stateOptions.find((item) => item === trimmed);
  if (exact) return exact;
  const insensitive = stateOptions.find((item) => item.toLowerCase() === trimmed.toLowerCase());
  return insensitive ?? trimmed;
}

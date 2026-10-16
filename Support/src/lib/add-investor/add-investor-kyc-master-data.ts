type KycMasterDataOption = { label: string; value: string };

/** Cybrilla/Finprim bank account type labels sent to verify-hybrid. */
export const ADD_INVESTOR_BANK_ACCOUNT_TYPE_OPTIONS: readonly KycMasterDataOption[] = [
  { label: "Savings", value: "Savings" },
  { label: "Current", value: "Current" },
  { label: "NRE", value: "NRE" },
  { label: "NRO", value: "NRO" },
];

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

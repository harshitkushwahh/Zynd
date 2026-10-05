import { DEFAULT_KYC_COUNTRY, canonicalizeIndianState } from "@/features/kyc/lib/indian-states";
import type { KycAddressFields } from "@/features/kyc/lib/kyc-address";
import { resolveStateOption } from "@/features/kyc/lib/kyc-digilocker-prefill";

export type KycPincodeLookup = {
  code: string;
  city: string;
  district: string;
  state_name: string;
  country_ansi_code: string;
};

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function namesLooselyMatch(left: string, right: string) {
  const first = normalizeName(left);
  const second = normalizeName(right);
  if (!first || !second) return false;
  return first === second || first.includes(second) || second.includes(first);
}

export function expectedCityFromPincode(lookup: KycPincodeLookup) {
  return (lookup.city || lookup.district).trim();
}

export function expectedStateFromPincode(lookup: KycPincodeLookup, stateOptions: readonly string[]) {
  return resolveStateOption(canonicalizeIndianState(lookup.state_name), [...stateOptions]);
}

export function stateMatchesDropdownOptions(state: string, stateOptions: readonly string[]) {
  const trimmed = state.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  return stateOptions.some((option) => option.toLowerCase() === lower);
}

export function addressMatchesPincode(
  address: KycAddressFields,
  lookup: KycPincodeLookup,
  stateOptions: readonly string[],
) {
  const expectedCity = expectedCityFromPincode(lookup);
  const expectedState = expectedStateFromPincode(lookup, stateOptions);
  const cityOk =
    !expectedCity ||
    namesLooselyMatch(address.city, lookup.city) ||
    namesLooselyMatch(address.city, lookup.district);
  const stateInDropdown = stateMatchesDropdownOptions(address.state, stateOptions);
  const stateOk =
    stateInDropdown &&
    expectedState &&
    (namesLooselyMatch(address.state, expectedState) ||
      namesLooselyMatch(address.state, lookup.state_name));
  const countryOk = namesLooselyMatch(address.country || DEFAULT_KYC_COUNTRY, DEFAULT_KYC_COUNTRY);
  return {
    matched: cityOk && stateOk && countryOk,
    expectedCity,
    expectedState,
  };
}

export function applyPincodeToAddress(
  address: KycAddressFields,
  lookup: KycPincodeLookup,
  stateOptions: readonly string[],
): KycAddressFields {
  const expectedCity = expectedCityFromPincode(lookup);
  const expectedState = expectedStateFromPincode(lookup, stateOptions);
  const shouldApplyCity = Boolean(expectedCity) && !address.city.trim();
  const shouldApplyState =
    Boolean(expectedState) &&
    (!address.state.trim() || !stateMatchesDropdownOptions(address.state, stateOptions));
  return {
    ...address,
    city: shouldApplyCity ? expectedCity : expectedCity || address.city,
    state: shouldApplyState ? expectedState : expectedState || address.state,
    country: DEFAULT_KYC_COUNTRY,
  };
}

export function addressHadValues(address: KycAddressFields) {
  return Boolean(address.city.trim() || address.state.trim());
}

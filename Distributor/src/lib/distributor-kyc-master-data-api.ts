import { apiRequest } from "@/lib/api-client";

export type KycMasterDataOption = { label: string; value: string };

export type KycMasterDataEnums = {
  gender: KycMasterDataOption[];
  marital_status: KycMasterDataOption[];
  occupation: KycMasterDataOption[];
  income_slab: KycMasterDataOption[];
  pep_exposed: KycMasterDataOption[];
};

export type KycNomineeEnums = {
  relationships: KycMasterDataOption[];
  source_of_wealth: KycMasterDataOption[];
  document_types: KycMasterDataOption[];
};

export type KycPincodeLookup = {
  code: string;
  city: string;
  district: string;
  state_name: string;
  country_ansi_code: string;
};

export async function fetchDistributorKycMasterDataEnums() {
  return apiRequest<KycMasterDataEnums>("/distributor/kyc/master-data/enums");
}

export async function fetchDistributorKycNomineeEnums() {
  return apiRequest<KycNomineeEnums>("/distributor/kyc/master-data/nominee-enums");
}

export async function fetchDistributorKycStates() {
  return apiRequest<Array<{ name: string; state_code: string; country_ansi_code: string }>>(
    "/distributor/kyc/master-data/states",
  );
}

export async function fetchDistributorKycCountries() {
  return apiRequest<Array<{ name: string; ansi_code: string }>>("/distributor/kyc/master-data/countries");
}

export async function fetchDistributorKycPincode(pincode: string) {
  return apiRequest<KycPincodeLookup>(
    `/distributor/kyc/master-data/pincode/${encodeURIComponent(pincode)}`,
  );
}

import { DEFAULT_KYC_COUNTRY } from "@/features/kyc/lib/indian-states";

export type KycAddressFields = {
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
};

export type KycAddressFormValue = {
  permanent: KycAddressFields;
  correspondence: KycAddressFields;
  sameAsPermanent: boolean;
};

export function createEmptyAddress(country = DEFAULT_KYC_COUNTRY): KycAddressFields {
  return {
    line1: "",
    line2: "",
    city: "",
    state: "",
    pincode: "",
    country,
  };
}

export function createEmptyAddressForm(country = DEFAULT_KYC_COUNTRY): KycAddressFormValue {
  return {
    permanent: createEmptyAddress(country),
    correspondence: createEmptyAddress(country),
    sameAsPermanent: true,
  };
}

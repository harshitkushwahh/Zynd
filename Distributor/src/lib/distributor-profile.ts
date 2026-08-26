export type DistributorProfileDocumentType = "aadhaar" | "pan";

export type DistributorProfileDocument = {
  type: DistributorProfileDocumentType;
  label: string;
  uploaded: boolean;
  fileName: string | null;
  identifierMasked: string | null;
  uploadedAt: string | null;
};

export type DistributorProfileAddress = {
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

export type DistributorProfile = {
  distributorCode: string;
  mobile: string;
  address: DistributorProfileAddress;
  documents: DistributorProfileDocument[];
};

const EMPTY_PROFILE: DistributorProfile = {
  distributorCode: "",
  mobile: "",
  address: {
    line1: "",
    line2: null,
    city: "",
    state: "",
    postalCode: "",
    country: "",
  },
  documents: [],
};

export function getDistributorProfile(_userId?: string | null): DistributorProfile {
  return EMPTY_PROFILE;
}

export function formatDistributorProfileAddress(address: DistributorProfileAddress): string {
  const parts = [
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.postalCode,
    address.country,
  ].filter(Boolean);
  return parts.join(", ");
}

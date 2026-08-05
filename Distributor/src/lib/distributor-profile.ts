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

const DEMO_PROFILES: Record<string, DistributorProfile> = {
  "dist-riya": {
    distributorCode: "ZYD-DIST-0142",
    mobile: "+91 98201 44780",
    address: {
      line1: "Unit 402, Peninsula Business Park",
      line2: "Senapati Bapat Marg, Lower Parel",
      city: "Mumbai",
      state: "Maharashtra",
      postalCode: "400013",
      country: "India",
    },
    documents: [
      {
        type: "aadhaar",
        label: "Aadhaar card",
        uploaded: true,
        fileName: "riya-mehta-aadhaar.pdf",
        identifierMasked: "XXXX XXXX 4821",
        uploadedAt: "2025-11-08T10:30:00.000Z",
      },
      {
        type: "pan",
        label: "PAN card",
        uploaded: true,
        fileName: "riya-mehta-pan.pdf",
        identifierMasked: "MEHPR*****4K",
        uploadedAt: "2025-11-08T10:32:00.000Z",
      },
    ],
  },
  "dist-arjun": {
    distributorCode: "ZYD-DIST-0198",
    mobile: "+91 98765 21043",
    address: {
      line1: "12, 3rd Cross, Indiranagar",
      line2: null,
      city: "Bengaluru",
      state: "Karnataka",
      postalCode: "560038",
      country: "India",
    },
    documents: [
      {
        type: "aadhaar",
        label: "Aadhaar card",
        uploaded: true,
        fileName: "arjun-kapoor-aadhaar.jpg",
        identifierMasked: "XXXX XXXX 9037",
        uploadedAt: "2026-01-15T14:00:00.000Z",
      },
      {
        type: "pan",
        label: "PAN card",
        uploaded: true,
        fileName: "arjun-kapoor-pan.pdf",
        identifierMasked: "KAPAR*****2F",
        uploadedAt: "2026-01-15T14:05:00.000Z",
      },
    ],
  },
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
  documents: [
    {
      type: "aadhaar",
      label: "Aadhaar card",
      uploaded: false,
      fileName: null,
      identifierMasked: null,
      uploadedAt: null,
    },
    {
      type: "pan",
      label: "PAN card",
      uploaded: false,
      fileName: null,
      identifierMasked: null,
      uploadedAt: null,
    },
  ],
};

export function getDistributorProfile(userId: string | undefined): DistributorProfile {
  if (!userId) return EMPTY_PROFILE;
  return DEMO_PROFILES[userId] ?? EMPTY_PROFILE;
}

export function formatDistributorProfileAddress(address: DistributorProfileAddress): string {
  const locality = [address.line1, address.line2].filter(Boolean).join(", ");
  const region = [address.city, address.state, address.postalCode].filter(Boolean).join(", ");
  const tail = [region, address.country].filter(Boolean).join(", ");
  return [locality, tail].filter(Boolean).join("\n");
}

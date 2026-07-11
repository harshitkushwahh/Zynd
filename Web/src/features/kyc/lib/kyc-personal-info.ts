export type KycPersonalInfoValue = {
  fathersName: string;
  gender: string;
  incomeSlab: string;
  occupation: string;
  maritalStatus: string;
  pepExposed: string;
  placeOfBirth: string;
  nationality: string;
};

export const DEFAULT_KYC_NATIONALITY = "India";

export function createEmptyPersonalInfo(): KycPersonalInfoValue {
  return {
    fathersName: "",
    gender: "",
    incomeSlab: "",
    occupation: "",
    maritalStatus: "",
    pepExposed: "",
    placeOfBirth: "",
    nationality: DEFAULT_KYC_NATIONALITY,
  };
}

export const KYC_GENDER_OPTIONS = ["Male", "Female", "Other"] as const;

export const KYC_INCOME_SLAB_OPTIONS = [
  "Below ₹1 lakh",
  "₹1 lakh – ₹5 lakhs",
  "₹5 lakhs – ₹10 lakhs",
  "₹10 lakhs – ₹25 lakhs",
  "₹25 lakhs – ₹1 crore",
  "Above ₹1 crore",
] as const;

export const KYC_OCCUPATION_OPTIONS = [
  "Salaried",
  "Self-employed / Business",
  "Professional",
  "Government employee",
  "Student",
  "Homemaker",
  "Retired",
  "Other",
] as const;

export const KYC_MARITAL_STATUS_OPTIONS = [
  "Single",
  "Married",
  "Divorced",
  "Widowed",
] as const;

export const KYC_PEP_OPTIONS = ["No", "Yes"] as const;

export const KYC_NATIONALITY_OPTIONS = [
  "India",
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "Singapore",
  "United Arab Emirates",
  "Germany",
  "France",
  "Japan",
  "China",
  "Nepal",
  "Bangladesh",
  "Sri Lanka",
  "Pakistan",
  "Other",
] as const;

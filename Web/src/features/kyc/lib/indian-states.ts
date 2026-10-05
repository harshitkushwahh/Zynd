export const DEFAULT_KYC_COUNTRY = "India";

const STATE_ALIASES: Record<string, string> = {
  "andaman & nicobar islands": "Andaman and Nicobar Islands",
  "andaman and nicobar": "Andaman and Nicobar Islands",
  "dadra and nagar haveli": "Dadra and Nagar Haveli and Daman and Diu",
  "daman and diu": "Dadra and Nagar Haveli and Daman and Diu",
  "delhi nct": "Delhi",
  "jammu & kashmir": "Jammu and Kashmir",
  "nct delhi": "Delhi",
  "nct of delhi": "Delhi",
  "new delhi": "Delhi",
  orissa: "Odisha",
  pondicherry: "Puducherry",
  uttaranchal: "Uttarakhand",
};

export const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;

export type IndianState = (typeof INDIAN_STATES)[number];

export function canonicalizeIndianState(candidate: string): string {
  const trimmed = candidate.trim();
  if (!trimmed) return "";

  const alias = STATE_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;

  const exact = INDIAN_STATES.find((state) => state.toLowerCase() === trimmed.toLowerCase());
  if (exact) return exact;

  const partial = INDIAN_STATES.find((state) => {
    const lower = state.toLowerCase();
    const candidateLower = trimmed.toLowerCase();
    return lower.includes(candidateLower) || candidateLower.includes(lower);
  });
  return partial ?? trimmed;
}

export function mergeIndianStateOptions(providerNames: readonly string[] = []): string[] {
  const extras: string[] = [];
  const known = new Set(INDIAN_STATES.map((state) => state.toLowerCase()));

  for (const raw of providerNames) {
    const resolved = canonicalizeIndianState(raw);
    if (!resolved || known.has(resolved.toLowerCase())) continue;
    known.add(resolved.toLowerCase());
    extras.push(resolved);
  }

  return extras.length > 0 ? [...INDIAN_STATES, ...extras] : [...INDIAN_STATES];
}

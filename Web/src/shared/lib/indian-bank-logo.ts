import banksCatalog from "@/shared/data/indian-banks.json";

export const INDIAN_BANK_LOGO_CDN_BASE = "https://indian-bank-logos.vercel.app";

type IndianBankRecord = {
  slug: string;
  name: string;
};

const INDIAN_BANKS: IndianBankRecord[] = banksCatalog.banks;

const IFSC_PREFIX_TO_SLUG: Record<string, string> = {
  HDFC: "hdfc-bank",
  ICIC: "icici-bank",
  SBIN: "state-bank-of-india",
  UTIB: "axis-bank",
  KKBK: "kotak-mahindra-bank",
  PUNB: "punjab-national-bank",
  BARB: "bank-of-baroda",
  CNRB: "canara-bank",
  BKID: "bank-of-india",
  MAHB: "bank-of-maharashtra",
  UBIN: "union-bank-of-india",
  IDFB: "idfc-first-bank",
  INDB: "indusind-bank",
  YESB: "yes-bank",
  FDRL: "federal-bank",
  CSBK: "csb-bank",
  RATN: "rbl-bank",
  AUBL: "au-small-finance-bank",
  BDBL: "bandhan-bank",
  IDIB: "indian-bank",
  IOBA: "indian-overseas-bank",
  PSIB: "punjab-and-sind-bank",
  UCBA: "uco-bank",
  CBIN: "central-bank-of-india",
  KVBL: "karur-vysya-bank",
  CIUB: "city-union-bank",
  ESFB: "equitas-small-finance-bank",
  JSFB: "jana-small-finance-bank",
  UJVN: "ujjivan-small-finance-bank",
  AIRP: "airtel-payments-bank",
  PYTM: "paytm-payments-bank",
  FINO: "fino-payments-bank",
  IPOS: "india-post-payments-bank",
  IBKL: "idbi-bank",
  KARB: "karnataka-bank",
  SIBL: "south-indian-bank",
  SCBL: "standard-chartered",
  HSBC: "hsbc",
  CITI: "citibank",
  DEUT: "deutsche-bank",
  DBSS: "dbs-bank-india",
  NTBL: "nainital-bank",
  TMBL: "tamilnad-mercantile-bank",
  DCBL: "dcb-bank",
  DLXB: "dhanlaxmi-bank",
  JAKA: "jammu-and-kashmir-bank",
  ESAF: "esaf-small-finance-bank",
  SURY: "suryoday-small-finance-bank",
  UTKS: "utkarsh-small-finance-bank",
  NSPB: "nsdl-payments-bank",
  JIOP: "jio-payments-bank",
  SURYODAY: "suryoday-small-finance-bank",
  SHIV: "shivalik-small-finance-bank",
  SVCB: "slice-small-finance-bank",
  STCB: "sbm-bank-india-limited",
  SYNB: "canara-bank",
  CORP: "union-bank-of-india",
  ALLA: "indian-bank",
  ORBC: "bank-of-baroda",
};

const SLUG_SET = new Set(INDIAN_BANKS.map((bank) => bank.slug));

function normalizeBankSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(limited|ltd|bank|plc|corporation|corp|na|n\.a\.|co\.|company)\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ifscPrefix(ifscCode?: string | null): string | null {
  const normalized = ifscCode?.trim().toUpperCase() ?? "";
  if (normalized.length < 4) return null;
  return normalized.slice(0, 4);
}

export function resolveIndianBankSlugFromIfsc(ifscCode?: string | null): string | null {
  const prefix = ifscPrefix(ifscCode);
  if (!prefix) return null;
  const slug = IFSC_PREFIX_TO_SLUG[prefix];
  return slug && SLUG_SET.has(slug) ? slug : null;
}

export function resolveIndianBankSlugFromName(bankName?: string | null): string | null {
  const normalized = normalizeBankSearchText(bankName ?? "");
  if (!normalized) return null;

  const directSlug = normalized.replace(/\s+/g, "-");
  if (SLUG_SET.has(directSlug)) return directSlug;

  for (const bank of INDIAN_BANKS) {
    if (normalizeBankSearchText(bank.name) === normalized) return bank.slug;
  }

  const tokens = normalized.split(" ").filter((token) => token.length > 1);
  if (tokens.length === 0) return null;

  let bestSlug: string | null = null;
  let bestScore = 0;

  for (const bank of INDIAN_BANKS) {
    const bankTokens = normalizeBankSearchText(bank.name).split(" ").filter(Boolean);
    const slugTokens = bank.slug.split("-");
    let score = 0;

    for (const token of tokens) {
      if (slugTokens.some((part) => part === token)) {
        score += 3;
      } else if (slugTokens.some((part) => part.startsWith(token) || token.startsWith(part))) {
        score += 1;
      }

      if (bankTokens.some((part) => part === token)) {
        score += 2;
      } else if (bankTokens.some((part) => part.startsWith(token) || token.startsWith(part))) {
        score += 1;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestSlug = bank.slug;
    }
  }

  const minimumScore = Math.max(2, tokens.length);
  return bestScore >= minimumScore ? bestSlug : null;
}

export function resolveIndianBankSlug(input: {
  bankName?: string | null;
  ifscCode?: string | null;
}): string | null {
  return (
    resolveIndianBankSlugFromIfsc(input.ifscCode) ??
    resolveIndianBankSlugFromName(input.bankName)
  );
}

export function getIndianBankLogoUrl(
  slug: string,
  variant: "standard" | "horizontal" = "standard",
): string {
  const suffix = variant === "horizontal" ? "-horizontal" : "";
  return `${INDIAN_BANK_LOGO_CDN_BASE}/logos/${slug}${suffix}.png`;
}

export function resolveIndianBankLogoUrl(input: {
  bankName?: string | null;
  ifscCode?: string | null;
  variant?: "standard" | "horizontal";
}): string | null {
  const slug = resolveIndianBankSlug(input);
  if (!slug) return null;
  return getIndianBankLogoUrl(slug, input.variant ?? "standard");
}

export function resolveIndianBankDisplayName(input: {
  bankName?: string | null;
  ifscCode?: string | null;
}): string | null {
  const slug =
    resolveIndianBankSlugFromIfsc(input.ifscCode) ??
    resolveIndianBankSlugFromName(input.bankName);
  if (slug) {
    const bank = INDIAN_BANKS.find((entry) => entry.slug === slug);
    if (bank) return bank.name;
  }
  const trimmed = input.bankName?.trim();
  if (trimmed && trimmed.toLowerCase() !== "bank") return trimmed;
  return null;
}

/** Parse a display label like "HDFC Bank ....9725" into a bank name hint. */
export function parseBankNameFromAccountLabel(label?: string | null): string | null {
  const trimmed = label?.trim();
  if (!trimmed) return null;
  const withoutMask = trimmed.replace(/[•*.]+\d[\d*•.]*/g, "").trim();
  return withoutMask || null;
}

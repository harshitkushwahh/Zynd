import { resolveAmcLogoUrl } from "@/features/invest/lib/mf-format";
import { copy } from "@/shared/config/copy";

const UNKNOWN_AMC_SLUG = "unknown-amc";

/** Keep in sync with Backend `amc_name_parser._KNOWN_AMC_PREFIXES` (longest first). */
const KNOWN_AMC_PREFIXES = [
  "Aditya Birla Sun Life",
  "ICICI Prudential",
  "Nippon India",
  "Franklin Templeton",
  "Mirae Asset",
  "Motilal Oswal",
  "Bandhan",
  "Baroda BNP Paribas",
  "Bank of India",
  "Canara Robeco",
  "Edelweiss",
  "HSBC",
  "Invesco",
  "JM Financial",
  "Kotak Mahindra",
  "Kotak",
  "L&T",
  "Mahindra Manulife",
  "PGIM India",
  "Quant Mutual Fund",
  "Quantum",
  "Samco",
  "Sundaram",
  "Tata",
  "Trust Mutual Fund",
  "Union",
  "UTI",
  "WhiteOak Capital",
  "360 ONE",
  "Axis",
  "DSP",
  "HDFC",
  "IDBI",
  "IIFL",
  "ITI",
  "Lic",
  "LIC",
  "PPFAS",
  "SBI",
  "Shriram",
  "Groww",
  "Zerodha",
  "Abakkus",
] as const;

const CANONICAL_AMC_NAMES: Record<string, string> = {
  "kotak mutual fund": "Kotak Mahindra Mutual Fund",
  "kotak mahindra mutual fund": "Kotak Mahindra Mutual Fund",
};

function slugifyAmc(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function canonicalAmcDisplayName(name: string) {
  const key = name.trim().toLowerCase();
  return CANONICAL_AMC_NAMES[key] ?? name.trim();
}

function parseAmcFromSchemeName(schemeName: string): string | null {
  const name = schemeName.trim();
  if (!name) return null;
  const lower = name.toLowerCase();
  for (const prefix of KNOWN_AMC_PREFIXES) {
    if (lower.startsWith(prefix.toLowerCase())) {
      const parsed = prefix.endsWith("Mutual Fund") ? prefix : `${prefix} Mutual Fund`;
      return canonicalAmcDisplayName(parsed);
    }
  }
  const match = /^([A-Za-z0-9&.\-\s]+?)\s+(?:Mutual Fund|MF)\b/i.exec(name);
  if (match) {
    const base = match[1]?.trim();
    if (base && base.length >= 3) {
      return canonicalAmcDisplayName(`${base} Mutual Fund`);
    }
  }
  return null;
}

export type InvestAmcDisplayInput = {
  amcName?: string | null;
  amcSlug?: string | null;
  amcLogoUrl?: string | null;
  schemeName?: string | null;
};

/** Client-side fallback when API rows still have Unknown AMC (matches backend `resolve_invest_amc_display`). */
export function enrichInvestAmcDisplay(input: InvestAmcDisplayInput): {
  amcName: string;
  amcSlug: string | null;
  amcLogoUrl: string | null;
} {
  const schemeName = input.schemeName?.trim() ?? "";
  const amcName = input.amcName?.trim() || copy.mutualFunds.unknownAmc;
  const amcSlug = input.amcSlug?.trim() || UNKNOWN_AMC_SLUG;
  const staleUnknown =
    amcSlug === UNKNOWN_AMC_SLUG || amcName.toLowerCase() === copy.mutualFunds.unknownAmc.toLowerCase();

  if (schemeName && staleUnknown) {
    const parsed = parseAmcFromSchemeName(schemeName);
    if (parsed) {
      const slug = slugifyAmc(parsed);
      return {
        amcName: parsed,
        amcSlug: slug,
        amcLogoUrl: resolveAmcLogoUrl(input.amcLogoUrl, slug),
      };
    }
  }

  const slug = amcSlug === UNKNOWN_AMC_SLUG ? null : amcSlug;
  return {
    amcName,
    amcSlug: slug,
    amcLogoUrl: resolveAmcLogoUrl(input.amcLogoUrl, slug),
  };
}

export type InvestAmcOrderLike = {
  amc_name?: string | null;
  amc_slug?: string | null;
  amc_logo_url?: string | null;
  product_name?: string | null;
};

export function enrichInvestAmcFromOrder(order: InvestAmcOrderLike) {
  return enrichInvestAmcDisplay({
    amcName: order.amc_name,
    amcSlug: order.amc_slug,
    amcLogoUrl: order.amc_logo_url,
    schemeName: order.product_name,
  });
}

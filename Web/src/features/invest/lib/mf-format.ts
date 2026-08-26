import { env } from "@/lib/env";
import { copy } from "@/shared/config/copy";

const INVEST_ASSETS_PREFIX = "/invest/assets/";

function buildInvestAssetUrl(assetPath: string) {
  const normalized = assetPath.replace(/^\/+/, "");
  return `${env.apiUrl}${INVEST_ASSETS_PREFIX}${normalized}`;
}

export function resolveInvestAssetUrl(url: string | null | undefined) {
  if (!url) return null;
  if (url.startsWith("/")) return url;

  const markerIndex = url.indexOf(INVEST_ASSETS_PREFIX);
  if (markerIndex !== -1) {
    const assetPath = url.slice(markerIndex + INVEST_ASSETS_PREFIX.length);
    return buildInvestAssetUrl(assetPath);
  }

  if (url.startsWith("public/")) {
    return buildInvestAssetUrl(url);
  }

  return url;
}

/** Resolve AMC logo from API value, falling back to the standard storage path from slug. */
export function resolveAmcLogoUrl(
  logoUrl: string | null | undefined,
  amcSlug: string | null | undefined,
) {
  const resolved = resolveInvestAssetUrl(logoUrl);
  if (resolved) return resolved;
  if (!amcSlug) return null;
  return buildInvestAssetUrl(`public/amcs/${amcSlug}.png`);
}

export function formatReturn(value: number | null | undefined) {
  if (value == null) return "—";
  return `${value.toFixed(2)}%`;
}

export function formatSignedReturn(value: number | null | undefined) {
  if (value == null) {
    return { text: copy.mutualFunds.noReturnData, tone: "muted" as const };
  }
  const prefix = value > 0 ? "+" : "";
  return {
    text: `${prefix}${value.toFixed(2)}%`,
    tone: value > 0 ? ("positive" as const) : value < 0 ? ("negative" as const) : ("muted" as const),
  };
}

export function formatInr(value: number | null | undefined, options?: { compact?: boolean }) {
  if (value == null) return "—";
  if (options?.compact && value >= 1_00_00_000) {
    return `₹${(value / 1_00_00_000).toFixed(2)} Cr`;
  }
  if (options?.compact && value >= 1_00_000) {
    return `₹${(value / 1_00_000).toFixed(2)} L`;
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: value < 100 ? 2 : 0,
  }).format(value);
}

function formatOverviewCompactUnit(value: number) {
  const rounded = Math.round(value * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  const withOneDecimal = Math.round(value * 10) / 10;
  if (Math.abs(withOneDecimal - rounded) < 0.001) {
    return withOneDecimal.toFixed(1).replace(/\.0$/, "");
  }
  return rounded.toFixed(2).replace(/\.?0+$/, "");
}

/** Overview card INR: full format below ₹10L, then ₹XL / ₹X Cr. */
export function formatInrOverview(value: number | null | undefined) {
  if (value == null) return "—";

  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (abs >= 1_00_00_000) {
    const crore = abs / 1_00_00_000;
    return `${sign}₹${formatOverviewCompactUnit(crore)} Cr`;
  }
  if (abs >= 10_00_000) {
    const lakh = abs / 1_00_000;
    return `${sign}₹${formatOverviewCompactUnit(lakh)} L`;
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: abs < 100 ? 2 : 0,
  }).format(value);
}

export function formatNav(value: number | null | undefined) {
  if (value == null) return "—";
  return value.toFixed(4);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function isSipNextInstallmentNoData(plan: {
  status?: string | null;
  next_installment_date?: string | null;
}) {
  const status = (plan.status ?? "").trim().toUpperCase();
  return status === "FAILED" && !plan.next_installment_date;
}

export function formatSipNextInstallmentDate(plan: {
  status?: string | null;
  next_installment_date?: string | null;
}) {
  if (isSipNextInstallmentNoData(plan)) {
    return copy.mySips.nextInstallmentNoData;
  }
  return formatDate(plan.next_installment_date);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatChartAxisDate(value: string | null | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

export function healthBadgeLabel(flag: string) {
  switch (flag) {
    case "shallow_nav_history":
      return "Limited history";
    case "missing_3y_metrics":
      return "New fund";
    case "force_show_not_purchasable":
      return "View only";
    default:
      return flag.replaceAll("_", " ");
  }
}

type SipScheduleFields = {
  frequency?: string | null;
  installment_day?: number | null;
  number_of_installments?: number | null;
};

export function formatSipFrequencyLabel(frequency: string | null | undefined) {
  const normalized = (frequency ?? "").trim().toLowerCase();
  if (normalized === "daily") return copy.mySips.frequencyDaily;
  return copy.mySips.frequencyMonthly;
}

export function formatSipInstallmentDay(day: number | null | undefined) {
  if (!day) return "—";
  return copy.mySips.installmentDay.replace("{day}", String(day));
}

export function formatSipInstallmentCount(count: number | null | undefined) {
  if (!count) return "—";
  return copy.mySips.installmentCount.replace("{count}", String(count));
}

export function formatSipScheduleSummary(plan: SipScheduleFields) {
  const parts: string[] = [formatSipFrequencyLabel(plan.frequency)];
  if ((plan.frequency ?? "").trim().toLowerCase() !== "daily" && plan.installment_day) {
    parts.push(formatSipInstallmentDay(plan.installment_day));
  }
  if (plan.number_of_installments) {
    parts.push(formatSipInstallmentCount(plan.number_of_installments));
  }
  return parts.join(" · ");
}

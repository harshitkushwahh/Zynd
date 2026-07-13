import { env } from "@/lib/env";

export function resolveInvestAssetUrl(url: string | null | undefined) {
  if (!url) return null;
  if (url.startsWith("/")) return url;

  const marker = "/invest/assets/";
  const markerIndex = url.indexOf(marker);
  if (markerIndex !== -1) {
    const assetPath = url.slice(markerIndex + marker.length);
    return `${env.apiUrl}${marker}${assetPath}`;
  }

  return url;
}

export function formatReturn(value: number | null | undefined) {
  if (value == null) return "—";
  return `${value.toFixed(2)}%`;
}

export function formatSignedReturn(value: number | null | undefined) {
  if (value == null) return { text: "—", tone: "muted" as const };
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

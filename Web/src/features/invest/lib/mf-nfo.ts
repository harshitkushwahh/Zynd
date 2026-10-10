import type { InvestNfoBlock } from "@/features/invest/api/invest-api";
import { formatDate } from "@/features/invest/lib/mf-format";

const SUBSCRIPTION_STATUSES = new Set(["OPEN", "UPCOMING"]);
const NFO_NAME_PATTERN = /\bnfo\b|new fund offer/i;

type NfoFundLike = {
  name?: string | null;
  nfo?: InvestNfoBlock | null;
} | null | undefined;

export function nameLooksLikeNfo(name?: string | null) {
  return Boolean(name && NFO_NAME_PATTERN.test(name));
}

export function hasNfoOfferWindow(nfo?: InvestNfoBlock | null) {
  return Boolean(nfo?.subscription_open_date || nfo?.subscription_close_date);
}

export function isInvestNfo(fund: NfoFundLike) {
  if (!isSubscriptionNfo(fund)) return false;
  return hasNfoOfferWindow(fund?.nfo) || nameLooksLikeNfo(fund?.name);
}

export function isSubscriptionNfo(fund: NfoFundLike) {
  const status = fund?.nfo?.status?.toUpperCase();
  return Boolean(status && SUBSCRIPTION_STATUSES.has(status));
}

export function nfoStatusLabel(status: string | null | undefined) {
  const normalized = (status ?? "").toUpperCase();
  if (normalized === "OPEN") return "Open for subscription";
  if (normalized === "UPCOMING") return "Opens soon";
  if (normalized === "CLOSED") return "Subscription closed";
  if (normalized === "ALLOTTED") return "Allotted";
  return status || "NFO";
}

export function formatNfoSubscriptionPeriod(
  openDate?: string | null,
  closeDate?: string | null,
) {
  if (!openDate && !closeDate) return "—";
  if (!openDate) return formatDate(closeDate);
  if (!closeDate) return formatDate(openDate);

  const open = new Date(openDate);
  const close = new Date(closeDate);
  if (Number.isNaN(open.getTime()) || Number.isNaN(close.getTime())) {
    return `${formatDate(openDate)} – ${formatDate(closeDate)}`;
  }

  const sameYear = open.getFullYear() === close.getFullYear();
  const openLabel = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: sameYear ? undefined : "numeric",
  }).format(open);
  const closeLabel = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(close);
  return `${openLabel} – ${closeLabel}`;
}

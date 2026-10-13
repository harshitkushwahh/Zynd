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

export const NFO_EXPIRING_SOON_DAYS = 3;

export type NfoClosePhase = "closed" | "closes_today" | "expiring_soon" | "open";

export type NfoCloseCountdown = {
  phase: NfoClosePhase;
  daysUntilClose: number | null;
  /** End of close date in local time (23:59:59.999). */
  endsAt: Date | null;
  closingInLabel: string;
};

function parseDateOnlyLocal(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function nfoCloseCountdown(
  closeDate?: string | null,
  now: Date = new Date(),
  labels: {
    closed: string;
    today: string;
    oneDay: string;
    days: (count: number) => string;
    expiringSoon: string;
  },
): NfoCloseCountdown | null {
  if (!closeDate) return null;
  const close = parseDateOnlyLocal(closeDate);
  if (!close) return null;

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  close.setHours(0, 0, 0, 0);
  const days = Math.round((close.getTime() - today.getTime()) / 86_400_000);

  const endsAt = new Date(close);
  endsAt.setHours(23, 59, 59, 999);

  if (days < 0) {
    return { phase: "closed", daysUntilClose: days, endsAt: null, closingInLabel: labels.closed };
  }
  if (days === 0) {
    return { phase: "closes_today", daysUntilClose: 0, endsAt, closingInLabel: labels.today };
  }
  if (days === 1) {
    return { phase: "expiring_soon", daysUntilClose: 1, endsAt, closingInLabel: labels.oneDay };
  }
  if (days <= NFO_EXPIRING_SOON_DAYS) {
    return {
      phase: "expiring_soon",
      daysUntilClose: days,
      endsAt,
      closingInLabel: labels.expiringSoon,
    };
  }
  return {
    phase: "open",
    daysUntilClose: days,
    endsAt,
    closingInLabel: labels.days(days),
  };
}

export type NfoClosingUrgencyTier = "green" | "yellow" | "red";

export function nfoClosingUrgencyTier(countdown: NfoCloseCountdown): NfoClosingUrgencyTier | null {
  if (countdown.phase === "closed") return null;
  if (countdown.phase === "closes_today") return "red";
  if (countdown.daysUntilClose === 1) return "yellow";
  if (
    countdown.daysUntilClose != null &&
    countdown.daysUntilClose >= 2 &&
    countdown.daysUntilClose <= NFO_EXPIRING_SOON_DAYS
  ) {
    return "green";
  }
  return null;
}

export function nfoClosesInTimePart(
  countdown: NfoCloseCountdown,
  now: Date,
  labels: { oneDay: string; days: (count: number) => string },
): string {
  if (countdown.phase === "closes_today" && countdown.endsAt) {
    return formatNfoCountdownRemaining(countdown.endsAt, now);
  }
  if (countdown.daysUntilClose === 1) return labels.oneDay;
  if (countdown.daysUntilClose != null && countdown.daysUntilClose > 1) {
    return labels.days(countdown.daysUntilClose);
  }
  return countdown.closingInLabel;
}

export type NfoOfferStatusHintTone = "muted" | "amber" | "red";

function daysUntilDate(dateStr: string | null | undefined, now: Date): number | null {
  if (!dateStr) return null;
  const target = parseDateOnlyLocal(dateStr);
  if (!target) return null;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function nfoOfferStatusPresentation(
  nfo: InvestNfoBlock | null | undefined,
  now: Date,
  labels: {
    closesIn: (time: string) => string;
    oneDay: string;
    days: (count: number) => string;
    opensInDays: (count: number) => string;
    opensInOneDay: string;
    opensToday: string;
    statusOpen: string;
    statusUpcoming: string;
  },
): {
  statusLabel: string;
  isOpen: boolean;
  hint: string | null;
  hintTone: NfoOfferStatusHintTone;
} {
  const status = (nfo?.status ?? "").toUpperCase();
  if (status === "UPCOMING") {
    const days = daysUntilDate(nfo?.subscription_open_date, now);
    let hint: string | null = null;
    if (days != null) {
      if (days <= 0) hint = labels.opensToday;
      else if (days === 1) hint = labels.opensInOneDay;
      else hint = labels.opensInDays(days);
    }
    return {
      statusLabel: labels.statusUpcoming,
      isOpen: false,
      hint,
      hintTone: "muted",
    };
  }

  const countdown = nfo?.subscription_close_date
    ? nfoCloseCountdown(nfo.subscription_close_date, now, {
        closed: "",
        today: "",
        oneDay: labels.oneDay,
        days: labels.days,
        expiringSoon: "",
      })
    : null;
  const tier = countdown ? nfoClosingUrgencyTier(countdown) : null;
  let hint: string | null = null;
  let hintTone: NfoOfferStatusHintTone = "muted";
  if (countdown && countdown.phase !== "closed") {
    const timePart = nfoClosesInTimePart(countdown, now, {
      oneDay: labels.oneDay,
      days: labels.days,
    });
    hint = labels.closesIn(timePart);
    if (tier === "red") hintTone = "red";
    else if (tier === "yellow" || tier === "green") hintTone = "amber";
  }

  return {
    statusLabel: labels.statusOpen,
    isOpen: true,
    hint,
    hintTone,
  };
}

export function formatNfoCountdownRemaining(endsAt: Date, now: Date = new Date()): string {
  const ms = Math.max(0, endsAt.getTime() - now.getTime());
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  }
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

/** Semi-high card radius used across the referral dashboard. */
export const REFERRAL_CARD_RADIUS_CLASS = "rounded-[var(--radius-medium)]";

/** Same navy → blue hero gradient as risk profile, mirrored direction (145° → 325°). */
export const REFERRAL_HERO_GRADIENT_CLASS =
  "bg-[linear-gradient(325deg,var(--zynd-navy)_0%,var(--zynd-blue-dark)_46%,var(--zynd-blue)_100%)]";

/** Darkening overlay for referral hero — top-weighted (inverse of risk profile bottom overlay). */
export const REFERRAL_HERO_OVERLAY_CLASS =
  "bg-[linear-gradient(0deg,transparent_0%,color-mix(in_srgb,var(--zynd-navy)_35%,transparent)_100%)]";

/** Left column: share link + leaderboard. */
export const REFERRAL_LEFT_COLUMN_CLASS = "flex min-w-0 w-full flex-col gap-4";

/** Right column: stat cards + earnings overview + referrals list. */
export const REFERRAL_RIGHT_COLUMN_CLASS =
  "flex min-h-0 w-full min-w-0 flex-col gap-4 xl:h-full";

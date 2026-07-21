/** Repeated layout/surface class strings — prefer Button size/variant for actions. */

/** Standard dashboard card radius — maps to `--radius-card` via zynd-brand.css `.rounded-card`. */
export const ZYND_CARD_RADIUS_CLASS = "rounded-card";

/** Inputs, chips, and compact controls — maps to `--radius-control`. */
export const ZYND_CONTROL_RADIUS_CLASS = "rounded-control";

/** Larger promo / MF surfaces — maps to `--radius-medium` (intentionally rounder than card). */
export const ZYND_MEDIUM_RADIUS_CLASS = "rounded-medium";

export const uiClasses = {
  navSurface: "rounded-[var(--radius-full)] border border-border/80 bg-card p-1.5 shadow-zynd-low",
  navSurfaceSidebar: "rounded-[var(--radius-full)] border border-border/80 bg-card p-1.5 shadow-zynd-low",
  navLogoLink: "shrink-0 rounded-full border border-border/80 bg-card p-1 shadow-zynd-low",
} as const;

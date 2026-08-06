import { cn } from "@/lib/utils";
import { ZYND_3XL_RADIUS_CLASS } from "@/shared/config/ui-classes";

/** MF calculator surfaces — backed by CSS variables in zynd-brand.css */
export const MF_CALC_CARD_CLASS = cn(
  ZYND_3XL_RADIUS_CLASS,
  "border border-border bg-card py-0 shadow-none ring-0 [--card-spacing:0]",
);

export const MF_CALC_CARD_CONTENT_CLASS = "flex flex-col gap-3 p-5 sm:gap-4 sm:p-6";

export const MF_CALC_PANEL_CLASS = "sip-panel px-3.5 py-3 sm:px-4 sm:py-3.5";

export const MF_CALC_STAT_CLASS = "sip-stat px-3 py-2.5 text-center sm:py-3";

export const MF_CALC_HERO_CLASS = "sip-hero px-4 py-4";

export const MF_CALC_ICON_BADGE_CLASS =
  "flex size-8 shrink-0 items-center justify-center rounded-full sip-icon-badge";

export const MF_CALC_GAIN_TEXT_CLASS = "sip-gain-text";

export const MF_CALC_INVESTED_DOT_CLASS = "size-2 rounded-full sip-invested-dot";

export const MF_CALC_GAIN_DOT_CLASS = "size-2 rounded-full sip-gain-dot";

export const MF_CALC_INVESTED_BAR_CLASS = "rounded-full bg-[var(--sip-invested-track)]";

export const MF_CALC_GAIN_BAR_CLASS = "rounded-full bg-[var(--sip-gain-track)]";

/** @deprecated Use MF_CALC_* */
export const MF_SIP_CARD_CLASS = MF_CALC_CARD_CLASS;
/** @deprecated Use MF_CALC_* */
export const MF_SIP_CARD_CONTENT_CLASS = MF_CALC_CARD_CONTENT_CLASS;
/** @deprecated Use MF_CALC_* */
export const MF_SIP_PANEL_CLASS = MF_CALC_PANEL_CLASS;
/** @deprecated Use MF_CALC_* */
export const MF_SIP_STAT_CLASS = MF_CALC_STAT_CLASS;
/** @deprecated Use MF_CALC_* */
export const MF_SIP_HERO_CLASS = MF_CALC_HERO_CLASS;
/** @deprecated Use MF_CALC_* */
export const MF_SIP_ICON_BADGE_CLASS = MF_CALC_ICON_BADGE_CLASS;
/** @deprecated Use MF_CALC_* */
export const MF_SIP_GAIN_TEXT_CLASS = MF_CALC_GAIN_TEXT_CLASS;
/** @deprecated Use MF_CALC_* */
export const MF_SIP_INVESTED_DOT_CLASS = MF_CALC_INVESTED_DOT_CLASS;
/** @deprecated Use MF_CALC_* */
export const MF_SIP_GAIN_DOT_CLASS = MF_CALC_GAIN_DOT_CLASS;
/** @deprecated Use MF_CALC_* */
export const MF_SIP_INVESTED_BAR_CLASS = MF_CALC_INVESTED_BAR_CLASS;
/** @deprecated Use MF_CALC_* */
export const MF_SIP_GAIN_BAR_CLASS = MF_CALC_GAIN_BAR_CLASS;

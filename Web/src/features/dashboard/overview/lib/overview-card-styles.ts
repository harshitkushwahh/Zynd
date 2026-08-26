/** Shared radius tokens for dashboard overview cards. */
export const OVERVIEW_CARD_RADIUS_CLASS = "rounded-[1.75rem]";

/** Inner tiles and badges on overview cards use the same radius as the shell. */
export const OVERVIEW_TILE_RADIUS_CLASS = "rounded-[1.75rem]";

/** Minimum height for the compact overview row (risk + SIPs + goals). */
export const OVERVIEW_COMPACT_CARD_MIN_HEIGHT_CLASS = "min-h-[9.5rem]";

/** Compact overview cards stretch to match the tallest card in the row. */
export const OVERVIEW_COMPACT_CARD_STRETCH_CLASS = `${OVERVIEW_COMPACT_CARD_MIN_HEIGHT_CLASS} h-full`;

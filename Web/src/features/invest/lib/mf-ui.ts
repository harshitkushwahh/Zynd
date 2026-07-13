/** Shared layout tokens for the mutual funds dashboard section. */
export const MF_CARD_RADIUS_CLASS = "rounded-[var(--radius-medium)]";

export const MF_PAGE_SECTION_CLASS = "w-full min-w-0 max-w-full overflow-x-hidden";

/** Grid used for fund card rows — prevents flex/grid children from stretching the page width. */
export const MF_FUNDS_GRID_CLASS =
  "grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 [&>*]:min-w-0";

/** Subtle hover surface for fund cards (visible in light mode). */
export const MF_FUND_CARD_HOVER_CLASS = "hover:bg-muted dark:hover:bg-muted/70";

/** Shared layout tokens for the mutual funds dashboard section. */
export const MF_CARD_RADIUS_CLASS = "rounded-medium";

/** Fund catalog cards on the MF dashboard browse grids. */
export const MF_FUND_CARD_RADIUS_CLASS = "rounded-3xl";

/** Fund detail page section surfaces (chart, cards, etc.). */
export const MF_FUND_DETAIL_RADIUS_CLASS = "rounded-3xl";

/** Fund detail stat tiles (NAV, AUM, TER, 1 day change). */
export const MF_FUND_DETAIL_METRIC_RADIUS_CLASS = "rounded-card";

/** @deprecated Use {@link MF_FUND_DETAIL_RADIUS_CLASS}. */
export const MF_FUND_DETAIL_SURFACE_RADIUS_CLASS = MF_FUND_DETAIL_RADIUS_CLASS;

export const MF_PAGE_SECTION_CLASS = "w-full min-w-0 max-w-full overflow-x-hidden";

/** Transactions table frame — shrinks to content, scrolls internally when rows exceed viewport budget. */
export const MF_TRANSACTIONS_TABLE_FRAME_CLASS =
  "flex max-h-[calc(100dvh-23rem)] flex-col overflow-hidden max-md:max-h-[calc(100dvh-27rem)] md:max-h-[calc(100dvh-18.5rem)]";

/** Grid used for fund card rows — prevents flex/grid children from stretching the page width. */
export const MF_FUNDS_GRID_CLASS =
  "grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 [&>*]:min-w-0";

/** Horizontal scroll row for fund cards (e.g. popular funds). */
export const MF_FUNDS_HORIZONTAL_ROW_CLASS =
  "flex min-w-0 gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/** Full-width grid for collection theme cards. */
export const MF_COLLECTIONS_GRID_CLASS =
  "grid min-w-0 grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4 [&>*]:min-w-0";

export const MF_COLLECTION_CARD_MIN_HEIGHT_CLASS = "min-h-[9.75rem] sm:min-h-[10.5rem]";

/** Fixed width for fund cards inside a horizontal scroll row. */
export const MF_FUND_CARD_HORIZONTAL_WIDTH_CLASS = "w-[17.5rem] shrink-0";

/** Invest payment card surface — 2xl radius token, border only (no shadow). */
export const MF_INVEST_PAYMENT_CARD_CLASS =
  "rounded-invest-card border border-zinc-200 bg-card dark:border-zinc-700/80";

/** Invest / payment card sidebar on fund detail and catalog table pages. */
export const MF_INVEST_SIDEBAR_WIDTH_CLASS = "w-full shrink-0 lg:w-[24rem] xl:w-[26rem]";

export const MF_INVEST_SIDEBAR_GRID_CLASS =
  "lg:grid-cols-[minmax(0,1fr)_24rem] xl:grid-cols-[minmax(0,1fr)_26rem]";

export const MF_INVEST_SIDEBAR_STICKY_CLASS = "lg:sticky lg:top-6 lg:z-20 lg:self-start";

/** Subtle hover surface for fund cards (visible in light mode). */
export const MF_FUND_CARD_HOVER_CLASS = "hover:bg-muted dark:hover:bg-muted/70";

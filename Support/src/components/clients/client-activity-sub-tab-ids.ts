export const CLIENT_ACTIVITY_SUB_TAB_IDS = ["sips", "transactions"] as const;

export type ClientActivitySubTabId = (typeof CLIENT_ACTIVITY_SUB_TAB_IDS)[number];

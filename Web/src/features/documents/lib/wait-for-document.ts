export const TERMINAL_STATUSES = new Set(["active", "rejected", "quarantined"]);

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

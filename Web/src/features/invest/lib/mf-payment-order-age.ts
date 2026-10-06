const FRESH_ORDER_MS = 60_000;

/** True when the order was created recently (guards against stale abandoned copy on setup failures). */
export function isFreshInvestOrder(createdAt: string | null | undefined, withinMs = FRESH_ORDER_MS) {
  if (!createdAt) return false;
  const created = Date.parse(createdAt);
  if (Number.isNaN(created)) return false;
  return Date.now() - created < withinMs;
}

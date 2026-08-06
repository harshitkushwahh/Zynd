import type { DistributorTxnRequest } from "@/lib/distributor-types";

export function createTxnRequestRef(existing: DistributorTxnRequest[]): string {
  const max = existing.reduce((acc, row) => {
    const match = row.requestRef.match(/TXR-(\d+)/);
    return match ? Math.max(acc, Number.parseInt(match[1]!, 10)) : acc;
  }, 0);
  return `TXR-${String(max + 1).padStart(4, "0")}`;
}

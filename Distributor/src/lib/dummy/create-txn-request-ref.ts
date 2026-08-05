import type { DistributorTxnRequest } from "@/lib/dummy/types";

export function createTxnRequestRef(existing: DistributorTxnRequest[]): string {
  let max = 90000;
  for (const request of existing) {
    const match = /^TXR-(\d+)$/.exec(request.requestRef);
    if (match) {
      const num = Number.parseInt(match[1], 10);
      if (Number.isFinite(num) && num > max) {
        max = num;
      }
    }
  }
  return `TXR-${max + 1}`;
}

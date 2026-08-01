import type { DistributorOperationsSectionId } from "@/lib/distributor-operations-sections";
import type { DistributorOrder } from "@/lib/dummy/types";
import { DUMMY_TRANSACTION_GROUPS } from "@/lib/dummy/transaction-groups";
import { DUMMY_SYSTEMATIC_PLANS } from "@/lib/dummy/systematic-plans";
import { DUMMY_TXN_REQUESTS } from "@/lib/dummy/txn-requests";

export type OperationsDualRingMetrics = {
  outerPct: number;
  innerPct: number;
  outerLabel: string;
  innerLabel: string;
  outerRatio: string;
  innerRatio: string;
  denominator: number;
};

export type YourOrdersOperationMix = {
  total: number;
  oneTime: number;
  sip: number;
  redemption: number;
};

export type TransactionGroupsOperationMix = {
  total: number;
  oneTime: number;
  groupTransaction: number;
  sips: number;
};

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function ratio(part: number, total: number): string {
  return `${part}/${total}`;
}

/** Demo mix aligned with Orders sidebar: One time, SIP, Redemption. */
export function getYourOrdersOperationMix(orders: DistributorOrder[]): YourOrdersOperationMix {
  const channelFor = (order: DistributorOrder): "one-time" | "sip" | "redemption" => {
    if (order.operationChannel) return order.operationChannel;
    if (order.orderType === "Redeem") return "redemption";
    return "one-time";
  };

  const oneTime = orders.filter((o) => channelFor(o) === "one-time").length;
  const sip = orders.filter((o) => channelFor(o) === "sip").length;
  const redemption = orders.filter((o) => channelFor(o) === "redemption").length;

  return {
    total: orders.length,
    oneTime,
    sip,
    redemption,
  };
}

export function getYourOrdersDualRing(mix: YourOrdersOperationMix): OperationsDualRingMetrics {
  return {
    outerPct: pct(mix.oneTime, mix.total),
    innerPct: pct(mix.sip, mix.total),
    outerLabel: "One time",
    innerLabel: "SIP",
    outerRatio: ratio(mix.oneTime, mix.total),
    innerRatio: ratio(mix.sip, mix.total),
    denominator: mix.total,
  };
}

export function getTransactionGroupsOperationMix(): TransactionGroupsOperationMix {
  const total = DUMMY_TRANSACTION_GROUPS.length;
  return {
    total,
    oneTime: 1,
    groupTransaction: 1,
    sips: 1,
  };
}

export function getTransactionGroupsDualRing(
  mix: TransactionGroupsOperationMix,
): OperationsDualRingMetrics {
  return {
    outerPct: pct(mix.oneTime, mix.total),
    innerPct: pct(mix.groupTransaction, mix.total),
    outerLabel: "One time",
    innerLabel: "Group transaction",
    outerRatio: ratio(mix.oneTime, mix.total),
    innerRatio: ratio(mix.groupTransaction, mix.total),
    denominator: mix.total,
  };
}

export function getOperationsDualRingMetrics(
  sectionId: DistributorOperationsSectionId,
  ordersMix?: YourOrdersOperationMix,
): OperationsDualRingMetrics {
  switch (sectionId) {
    case "orders": {
      const mix = ordersMix ?? getYourOrdersOperationMix([]);
      return getYourOrdersDualRing(mix);
    }
    case "systematic-plans": {
      const sip = DUMMY_SYSTEMATIC_PLANS.filter((p) => p.planType === "SIP").length;
      const total = DUMMY_SYSTEMATIC_PLANS.length;
      const stp = DUMMY_SYSTEMATIC_PLANS.filter((p) => p.planType === "STP").length;
      return {
        outerPct: pct(sip, total),
        innerPct: pct(stp, total),
        outerLabel: "SIP",
        innerLabel: "STP",
        outerRatio: ratio(sip, total),
        innerRatio: ratio(stp, total),
        denominator: total,
      };
    }
    case "txn-requests": {
      const total = DUMMY_TXN_REQUESTS.length;
      const oneTime = Math.max(1, Math.round(total * 0.45));
      const sip = Math.max(1, total - oneTime);
      return {
        outerPct: pct(oneTime, total),
        innerPct: pct(sip, total),
        outerLabel: "One time",
        innerLabel: "SIP",
        outerRatio: ratio(oneTime, total),
        innerRatio: ratio(sip, total),
        denominator: total,
      };
    }
    case "transaction-groups": {
      return getTransactionGroupsDualRing(getTransactionGroupsOperationMix());
    }
    default:
      return getYourOrdersDualRing(getYourOrdersOperationMix([]));
  }
}

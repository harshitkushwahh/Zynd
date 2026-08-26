import type { DistributorOrder } from "@/lib/distributor-types";

export type YourOrdersMetricStats = {
  total: number;
  open: number;
  completed: number;
  failed: number;
  trendVsLastWeek: number;
};

export type YourOrdersMonthlyBar = {
  month: string;
  count: number;
  amount: number;
  isCurrent: boolean;
};

export type YourOrdersMonthlyVolume = {
  bars: YourOrdersMonthlyBar[];
  currentMonthAmount: number;
  currentMonthCount: number;
  title?: string;
};

function buildMonthlyBarsFromOrders(orders: DistributorOrder[]): YourOrdersMonthlyBar[] {
  const buckets = new Map<string, { count: number; amount: number; sortKey: number }>();

  for (const order of orders) {
    const created = new Date(order.createdAt);
    const sortKey = created.getUTCFullYear() * 12 + created.getUTCMonth();
    const month = created.toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" });
    const existing = buckets.get(month) ?? { count: 0, amount: 0, sortKey };
    existing.count += 1;
    existing.amount += order.amount;
    buckets.set(month, existing);
  }

  const now = new Date();
  const currentSortKey = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const currentMonth = now.toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" });

  return [...buckets.entries()]
    .sort(([, a], [, b]) => a.sortKey - b.sortKey)
    .slice(-6)
    .map(([month, row]) => ({
      month,
      count: row.count,
      amount: row.amount,
      isCurrent: row.sortKey === currentSortKey || month === currentMonth,
    }));
}

export function getYourOrdersMetricStats(orders: DistributorOrder[]): YourOrdersMetricStats {
  const open = orders.filter((o) => o.status === "Pending" || o.status === "Processing").length;
  const completed = orders.filter((o) => o.status === "Completed").length;
  const failed = orders.filter((o) => o.status === "Failed").length;

  return {
    total: orders.length,
    open,
    completed,
    failed,
    trendVsLastWeek: 0,
  };
}

export function getYourOrdersMonthlyVolume(orders: DistributorOrder[]): YourOrdersMonthlyVolume {
  const bars = buildMonthlyBarsFromOrders(orders);
  const currentBar = bars.find((row) => row.isCurrent);

  return {
    title: "Monthly orders",
    bars,
    currentMonthAmount: currentBar?.amount ?? 0,
    currentMonthCount: currentBar?.count ?? 0,
  };
}

export function getTransactionGroupsMonthlyVolume(): YourOrdersMonthlyVolume {
  return {
    title: "Monthly groups",
    bars: [],
    currentMonthAmount: 0,
    currentMonthCount: 0,
  };
}

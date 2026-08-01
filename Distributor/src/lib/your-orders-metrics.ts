import type { DistributorOrder } from "@/lib/dummy/types";
import { DUMMY_TRANSACTION_GROUPS } from "@/lib/dummy/transaction-groups";

export type YourOrdersMetricStats = {
  total: number;
  open: number;
  completed: number;
  failed: number;
  /** Demo week-over-week change in percentage points */
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

const DEMO_MONTHLY_BASE: Omit<YourOrdersMonthlyBar, "isCurrent">[] = [
  { month: "Apr", count: 3, amount: 4200 },
  { month: "May", count: 2, amount: 3100 },
  { month: "Jun", count: 4, amount: 5800 },
  { month: "Jul", count: 3, amount: 4900 },
];

export function getYourOrdersMetricStats(orders: DistributorOrder[]): YourOrdersMetricStats {
  const open = orders.filter((o) => o.status === "Pending" || o.status === "Processing").length;
  const completed = orders.filter((o) => o.status === "Completed").length;
  const failed = orders.filter((o) => o.status === "Failed").length;

  return {
    total: orders.length,
    open,
    completed,
    failed,
    trendVsLastWeek: 1.8,
  };
}

export function getYourOrdersMonthlyVolume(orders: DistributorOrder[]): YourOrdersMonthlyVolume {
  const now = new Date("2026-07-29T12:00:00.000Z");
  const currentMonth = now.getUTCMonth();
  const currentYear = now.getUTCFullYear();

  const currentMonthOrders = orders.filter((order) => {
    const created = new Date(order.createdAt);
    return created.getUTCMonth() === currentMonth && created.getUTCFullYear() === currentYear;
  });

  const currentMonthAmount = currentMonthOrders.reduce((sum, row) => sum + row.amount, 0);
  const currentMonthCount = currentMonthOrders.length;

  const bars: YourOrdersMonthlyBar[] = [
    ...DEMO_MONTHLY_BASE.map((row) => ({ ...row, isCurrent: false })),
    {
      month: "Aug",
      count: Math.max(currentMonthCount, 5),
      amount: Math.max(currentMonthAmount, 7249.94),
      isCurrent: true,
    },
  ];

  return {
    title: "Monthly orders",
    bars,
    currentMonthAmount: bars[bars.length - 1]?.amount ?? currentMonthAmount,
    currentMonthCount: bars[bars.length - 1]?.count ?? currentMonthCount,
  };
}

export function getTransactionGroupsMonthlyVolume(): YourOrdersMonthlyVolume {
  const currentAmount = DUMMY_TRANSACTION_GROUPS.reduce((sum, row) => sum + row.totalAmount, 0);

  const bars: YourOrdersMonthlyBar[] = [
    { month: "Apr", count: 2, amount: 32000, isCurrent: false },
    { month: "May", count: 3, amount: 41000, isCurrent: false },
    { month: "Jun", count: 2, amount: 28000, isCurrent: false },
    { month: "Jul", count: 4, amount: 52000, isCurrent: false },
    {
      month: "Aug",
      count: DUMMY_TRANSACTION_GROUPS.length,
      amount: Math.max(currentAmount, 50000),
      isCurrent: true,
    },
  ];

  return {
    title: "Monthly groups",
    bars,
    currentMonthAmount: bars[bars.length - 1]?.amount ?? currentAmount,
    currentMonthCount: bars[bars.length - 1]?.count ?? DUMMY_TRANSACTION_GROUPS.length,
  };
}

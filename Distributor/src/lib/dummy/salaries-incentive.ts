export type SalaryPayoutStatus = "waiting" | "done" | "failed";

export type SalaryPayoutBreakdown = {
  basicSalary: number;
  perform: number;
  gift: number;
  takeHome: number;
  paymentPct: number;
};

export type SalaryPayoutRow = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  amount: number;
  whenLabel: string;
  status: SalaryPayoutStatus;
  breakdown: SalaryPayoutBreakdown;
};

export const DUMMY_SALARY_PAYOUTS: SalaryPayoutRow[] = [
  {
    id: "payout-1",
    name: "Syafanah San",
    whenLabel: "Today",
    amount: 254_000,
    status: "waiting",
    breakdown: {
      basicSalary: 204_000,
      perform: 30_000,
      gift: 20_000,
      takeHome: 254_000,
      paymentPct: 100,
    },
  },
  {
    id: "payout-2",
    name: "Devon Lane",
    whenLabel: "Today",
    amount: 254_000,
    status: "done",
    breakdown: {
      basicSalary: 204_000,
      perform: 30_000,
      gift: 20_000,
      takeHome: 254_000,
      paymentPct: 100,
    },
  },
  {
    id: "payout-3",
    name: "Devon Lane",
    whenLabel: "Yesterday",
    amount: 254_000,
    status: "done",
    breakdown: {
      basicSalary: 204_000,
      perform: 30_000,
      gift: 20_000,
      takeHome: 254_000,
      paymentPct: 100,
    },
  },
  {
    id: "payout-4",
    name: "Devon Lane",
    whenLabel: "Yesterday",
    amount: 254_000,
    status: "done",
    breakdown: {
      basicSalary: 204_000,
      perform: 30_000,
      gift: 20_000,
      takeHome: 254_000,
      paymentPct: 100,
    },
  },
  {
    id: "payout-5",
    name: "Devon Lane",
    whenLabel: "Yesterday",
    amount: 254_000,
    status: "failed",
    breakdown: {
      basicSalary: 204_000,
      perform: 30_000,
      gift: 20_000,
      takeHome: 254_000,
      paymentPct: 72,
    },
  },
];

export const DEFAULT_SALARY_PAYOUT_ID = "payout-2";

export function getSalaryPayoutStatusLabel(status: SalaryPayoutStatus): string {
  switch (status) {
    case "waiting":
      return "Waiting";
    case "done":
      return "Done";
    case "failed":
      return "Failed";
  }
}

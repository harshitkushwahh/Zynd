export type DistributorPayoutStatus = "Scheduled" | "Processing" | "Paid" | "Failed";

export type DistributorPayoutRow = {
  id: string;
  payoutRef: string;
  periodLabel: string;
  grossAmount: number;
  holdAmount: number;
  netAmount: number;
  status: DistributorPayoutStatus;
  settlementDate: string;
  bankAccountMasked: string;
};

export const DUMMY_DISTRIBUTOR_PAYOUTS: DistributorPayoutRow[] = [
  {
    id: "dp-1",
    payoutRef: "PYT-2026-03",
    periodLabel: "Mar 2026 (MTD)",
    grossAmount: 1_84_500,
    holdAmount: 22_300,
    netAmount: 1_62_200,
    status: "Scheduled",
    settlementDate: "2026-04-05",
    bankAccountMasked: "HDFC ···4821",
  },
  {
    id: "dp-2",
    payoutRef: "PYT-2026-02",
    periodLabel: "Feb 2026",
    grossAmount: 2_01_800,
    holdAmount: 0,
    netAmount: 2_01_800,
    status: "Paid",
    settlementDate: "2026-03-05",
    bankAccountMasked: "HDFC ···4821",
  },
  {
    id: "dp-3",
    payoutRef: "PYT-2026-01",
    periodLabel: "Jan 2026",
    grossAmount: 1_76_400,
    holdAmount: 8_500,
    netAmount: 1_67_900,
    status: "Paid",
    settlementDate: "2026-02-05",
    bankAccountMasked: "HDFC ···4821",
  },
  {
    id: "dp-4",
    payoutRef: "PYT-2025-12",
    periodLabel: "Dec 2025",
    grossAmount: 1_92_100,
    holdAmount: 0,
    netAmount: 1_92_100,
    status: "Paid",
    settlementDate: "2026-01-05",
    bankAccountMasked: "HDFC ···4821",
  },
  {
    id: "dp-5",
    payoutRef: "PYT-2025-11",
    periodLabel: "Nov 2025",
    grossAmount: 1_58_750,
    holdAmount: 12_000,
    netAmount: 1_46_750,
    status: "Failed",
    settlementDate: "2025-12-05",
    bankAccountMasked: "HDFC ···4821",
  },
];

export function getDistributorPayoutSummary(rows: DistributorPayoutRow[]) {
  const nextPayout = rows.find((row) => row.status === "Scheduled" || row.status === "Processing");
  const paidThisMonth = rows
    .filter((row) => row.status === "Paid" && row.periodLabel.includes("2026"))
    .reduce((sum, row) => sum + row.netAmount, 0);
  const onHold = rows.reduce((sum, row) => sum + row.holdAmount, 0);

  return {
    nextPayoutAmount: nextPayout?.netAmount ?? 0,
    nextPayoutDate: nextPayout?.settlementDate ?? null,
    paidThisMonth,
    onHold,
  };
}

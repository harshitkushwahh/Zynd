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

export const DUMMY_DISTRIBUTOR_PAYOUTS: DistributorPayoutRow[] = [];

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

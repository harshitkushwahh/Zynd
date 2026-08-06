export type DistributorSalaryPaymentStatus = "waiting" | "done" | "partial" | "failed";

export type DistributorJobCompensation = {
  id: string;
  periodLabel: string;
  basicSalary: number;
  performanceIncentive: number;
  spotBonus: number;
  deductions: number;
  takeHome: number;
  paymentStatus: DistributorSalaryPaymentStatus;
  paidOn: string | null;
};

export type DistributorPayrollPromotion = {
  label: string;
  previousBaseSalary: number;
  newBaseSalary: number;
  hikePct: number;
  effectiveLabel: string;
};

export type DistributorJobPerformanceCalc = {
  netSalesTarget: number;
  netSalesAchieved: number;
  achievementPct: number;
  incentiveSlab: number;
  calculatedIncentive: number;
  adjustments: number;
  finalIncentive: number;
};

export type DistributorJobWorkDay = {
  day: string;
  hours: number;
  status: "present" | "half-day" | "leave" | "holiday";
};

export type DistributorWorkLocationType = "Office" | "Client site" | "Home";

export type DistributorWorkAttendanceStatus = "complete" | "partial" | "leave" | "holiday";

export type DistributorWorkAttendanceRow = {
  id: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  hours: number;
  workType: DistributorWorkLocationType | null;
  payFactor: number;
  status: DistributorWorkAttendanceStatus;
};

export type DistributorJobWorkHours = {
  weekLabel: string;
  totalHours: number;
  targetHours: number;
  trendPct: number;
  avgDailyHours: number;
  overtimeHours: number;
  daily: DistributorJobWorkDay[];
};

export type DistributorLeaveType = "Annual" | "Sick" | "Casual" | "Unpaid";

export type DistributorLeaveBalance = {
  type: DistributorLeaveType;
  total: number;
  used: number;
  remaining: number;
};

export type DistributorLeaveRequestStatus = "Pending" | "Approved" | "Rejected";

export type DistributorLeaveRequest = {
  id: string;
  type: DistributorLeaveType;
  fromDate: string;
  toDate: string;
  days: number;
  reason: string;
  status: DistributorLeaveRequestStatus;
  appliedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
};

export type DistributorSalarySlipRow = {
  id: string;
  payrollId: string;
  periodLabel: string;
  basicSalary: number;
  performanceIncentive: number;
  spotBonus: number;
  deductions: number;
  takeHome: number;
  status: DistributorSalaryPaymentStatus;
  paidOn: string;
};

export const CURRENT_PAYROLL_ID = "jul-2026";

export const DUMMY_DISTRIBUTOR_JOB_COMPENSATION: DistributorJobCompensation = {
  id: "",
  periodLabel: "",
  basicSalary: 0,
  performanceIncentive: 0,
  spotBonus: 0,
  deductions: 0,
  takeHome: 0,
  paymentStatus: "waiting",
  paidOn: null,
};

export const DUMMY_DISTRIBUTOR_PAYROLL_PROMOTION: DistributorPayrollPromotion = {
  label: "",
  previousBaseSalary: 0,
  newBaseSalary: 0,
  hikePct: 0,
  effectiveLabel: "",
};

export const DUMMY_DISTRIBUTOR_JOB_PERFORMANCE: DistributorJobPerformanceCalc = {
  netSalesTarget: 0,
  netSalesAchieved: 0,
  achievementPct: 0,
  incentiveSlab: 0,
  calculatedIncentive: 0,
  adjustments: 0,
  finalIncentive: 0,
};

export const DUMMY_DISTRIBUTOR_WORK_ATTENDANCE: DistributorWorkAttendanceRow[] = [];

export const DUMMY_DISTRIBUTOR_JOB_WORK_HOURS: DistributorJobWorkHours = {
  weekLabel: "",
  totalHours: 0,
  targetHours: 0,
  trendPct: 0,
  avgDailyHours: 0,
  overtimeHours: 0,
  daily: [],
};

export const DUMMY_DISTRIBUTOR_LEAVE_BALANCES: DistributorLeaveBalance[] = [];

export const DUMMY_DISTRIBUTOR_LEAVE_REQUESTS: DistributorLeaveRequest[] = [];

export const DUMMY_DISTRIBUTOR_SALARY_SLIPS: DistributorSalarySlipRow[] = [];

export function getDistributorJobCompensationSummary(comp: DistributorJobCompensation) {
  return {
    takeHome: comp.takeHome,
    basicSalary: comp.basicSalary,
    performanceIncentive: comp.performanceIncentive,
    spotBonus: comp.spotBonus,
    variablePay: comp.performanceIncentive + comp.spotBonus,
  };
}

export function getDistributorJobCompensationSplit(comp: DistributorJobCompensation) {
  return [
    { id: "basic", label: "Base salary", value: comp.basicSalary, color: "#3d6b5e" },
    {
      id: "performance",
      label: "Performance",
      value: comp.performanceIncentive,
      color: "#5a9fd4",
    },
    { id: "bonus", label: "Spot bonus", value: comp.spotBonus, color: "#7ec8a8" },
  ] as const;
}

export function getDistributorWorkAttendanceSummary(rows: DistributorWorkAttendanceRow[]) {
  const logged = rows.filter((row) => row.status === "complete" || row.status === "partial");
  const totalHours = logged.reduce((sum, row) => sum + row.hours, 0);
  const weightedHours = logged.reduce((sum, row) => sum + row.hours * row.payFactor, 0);
  const officeDays = rows.filter((row) => row.workType === "Office").length;
  const clientSiteDays = rows.filter((row) => row.workType === "Client site").length;
  const homeDays = rows.filter((row) => row.workType === "Home").length;

  return {
    totalHours: Math.round(totalHours * 10) / 10,
    weightedHours: Math.round(weightedHours * 10) / 10,
    officeDays,
    clientSiteDays,
    homeDays,
    loggedDays: logged.length,
  };
}

export type DistributorWorkAttendanceChartPoint = {
  id: string;
  label: string;
  hours: number;
  weightedHours: number;
  workType: DistributorWorkLocationType | null;
  status: DistributorWorkAttendanceStatus;
  fill: string;
};

function attendanceBarFill(row: DistributorWorkAttendanceRow): string {
  if (row.status === "leave") return "color-mix(in srgb, var(--destructive) 55%, var(--muted-foreground))";
  if (row.status === "holiday") return "color-mix(in srgb, var(--muted-foreground) 45%, var(--border))";
  if (row.status === "partial") return "color-mix(in srgb, var(--warning) 65%, var(--muted-foreground))";
  if (row.workType === "Client site") return "var(--chart-2)";
  if (row.workType === "Home") return "var(--chart-3)";
  return "color-mix(in srgb, var(--foreground) 42%, var(--muted-foreground))";
}

export function getDistributorWorkAttendanceChartData(
  rows: DistributorWorkAttendanceRow[],
): DistributorWorkAttendanceChartPoint[] {
  return [...rows]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row) => {
      const day = new Date(`${row.date}T00:00:00`).getDate();
      return {
        id: row.id,
        label: String(day),
        hours: row.hours,
        weightedHours: Math.round(row.hours * row.payFactor * 10) / 10,
        workType: row.workType,
        status: row.status,
        fill: attendanceBarFill(row),
      };
    });
}

export function getSalaryPaymentStatusLabel(status: DistributorSalaryPaymentStatus): string {
  switch (status) {
    case "waiting":
      return "Waiting";
    case "done":
      return "Paid";
    case "partial":
      return "Partial";
    case "failed":
      return "Failed";
  }
}

export const SALARY_PAYMENT_STATUS_OPTIONS: Array<{
  value: DistributorSalaryPaymentStatus;
  label: string;
}> = [
  { value: "waiting", label: "Waiting" },
  { value: "done", label: "Paid" },
  { value: "partial", label: "Partial" },
  { value: "failed", label: "Failed" },
];

export function getPayrollHistorySummary(rows: DistributorSalarySlipRow[]) {
  const paidRows = rows.filter((row) => row.status === "done");
  const waitingRows = rows.filter((row) => row.status === "waiting");
  const current = rows.find((row) => row.payrollId === CURRENT_PAYROLL_ID) ?? rows[0];

  const ytdPaid = paidRows.reduce((sum, row) => sum + row.takeHome, 0);
  const avgVariablePay =
    rows.length > 0
      ? Math.round(
          rows.reduce((sum, row) => sum + row.performanceIncentive + row.spotBonus, 0) / rows.length,
        )
      : 0;

  return {
    currentTakeHome: current?.takeHome ?? 0,
    currentPeriodLabel: current?.periodLabel ?? "",
    ytdPaid,
    paidPeriods: paidRows.length,
    waitingPeriods: waitingRows.length,
    totalPeriods: rows.length,
    avgVariablePay,
  };
}

export function getLeaveRequestStatusLabel(status: DistributorLeaveRequestStatus): string {
  if (status === "Rejected") return "Declined";
  return status;
}

export const LEAVE_REQUEST_STATUS_OPTIONS: Array<{
  value: DistributorLeaveRequestStatus;
  label: string;
}> = [
  { value: "Pending", label: "Pending" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Declined" },
];

export const LEAVE_TYPE_OPTIONS: Array<{ value: DistributorLeaveType; label: string }> = [
  { value: "Annual", label: "Annual" },
  { value: "Sick", label: "Sick" },
  { value: "Casual", label: "Casual" },
  { value: "Unpaid", label: "Unpaid" },
];

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
  id: CURRENT_PAYROLL_ID,
  periodLabel: "Jul 2026",
  basicSalary: 204_000,
  performanceIncentive: 30_000,
  spotBonus: 20_000,
  deductions: 0,
  takeHome: 254_000,
  paymentStatus: "waiting",
  paidOn: null,
};

export const DUMMY_DISTRIBUTOR_PAYROLL_PROMOTION: DistributorPayrollPromotion = {
  label: "Promotion · RM Grade II",
  previousBaseSalary: 184_000,
  newBaseSalary: 204_000,
  hikePct: 10.9,
  effectiveLabel: "Effective Apr 2026",
};

export const DUMMY_DISTRIBUTOR_JOB_PERFORMANCE: DistributorJobPerformanceCalc = {
  netSalesTarget: 35_00_000,
  netSalesAchieved: 29_75_000,
  achievementPct: 85,
  incentiveSlab: 35_000,
  calculatedIncentive: 29_750,
  adjustments: 250,
  finalIncentive: 30_000,
};

export const DUMMY_DISTRIBUTOR_WORK_ATTENDANCE: DistributorWorkAttendanceRow[] = [
  {
    id: "wa-1",
    date: "2026-07-21",
    clockIn: "2026-07-21T09:08:00.000Z",
    clockOut: "2026-07-21T18:02:00.000Z",
    hours: 8.9,
    workType: "Office",
    payFactor: 1,
    status: "complete",
  },
  {
    id: "wa-2",
    date: "2026-07-22",
    clockIn: "2026-07-22T09:22:00.000Z",
    clockOut: "2026-07-22T17:45:00.000Z",
    hours: 8.4,
    workType: "Client site",
    payFactor: 1.15,
    status: "complete",
  },
  {
    id: "wa-3",
    date: "2026-07-23",
    clockIn: "2026-07-23T08:55:00.000Z",
    clockOut: "2026-07-23T18:10:00.000Z",
    hours: 9.25,
    workType: "Office",
    payFactor: 1,
    status: "complete",
  },
  {
    id: "wa-4",
    date: "2026-07-24",
    clockIn: "2026-07-24T09:15:00.000Z",
    clockOut: "2026-07-24T17:30:00.000Z",
    hours: 8.25,
    workType: "Home",
    payFactor: 0.95,
    status: "complete",
  },
  {
    id: "wa-5",
    date: "2026-07-25",
    clockIn: "2026-07-25T09:05:00.000Z",
    clockOut: "2026-07-25T19:20:00.000Z",
    hours: 10.25,
    workType: "Client site",
    payFactor: 1.15,
    status: "complete",
  },
  {
    id: "wa-6",
    date: "2026-07-26",
    clockIn: "2026-07-26T10:00:00.000Z",
    clockOut: "2026-07-26T14:30:00.000Z",
    hours: 4.5,
    workType: "Office",
    payFactor: 1,
    status: "partial",
  },
  {
    id: "wa-7",
    date: "2026-07-27",
    clockIn: null,
    clockOut: null,
    hours: 0,
    workType: null,
    payFactor: 0,
    status: "holiday",
  },
  {
    id: "wa-8",
    date: "2026-07-18",
    clockIn: "2026-07-18T09:10:00.000Z",
    clockOut: "2026-07-18T17:50:00.000Z",
    hours: 8.7,
    workType: "Office",
    payFactor: 1,
    status: "complete",
  },
  {
    id: "wa-9",
    date: "2026-07-17",
    clockIn: "2026-07-17T09:00:00.000Z",
    clockOut: "2026-07-17T18:00:00.000Z",
    hours: 9,
    workType: "Client site",
    payFactor: 1.15,
    status: "complete",
  },
  {
    id: "wa-10",
    date: "2026-07-16",
    clockIn: null,
    clockOut: null,
    hours: 0,
    workType: null,
    payFactor: 0,
    status: "leave",
  },
];

export const DUMMY_DISTRIBUTOR_JOB_WORK_HOURS: DistributorJobWorkHours = {
  weekLabel: "This week",
  totalHours: 46,
  targetHours: 48,
  trendPct: 0.5,
  avgDailyHours: 7.7,
  overtimeHours: 2.1,
  daily: [
    { day: "Mon", hours: 6.5, status: "present" },
    { day: "Tue", hours: 7.2, status: "present" },
    { day: "Wed", hours: 8, status: "present" },
    { day: "Thu", hours: 7.4, status: "present" },
    { day: "Fri", hours: 9.1, status: "present" },
    { day: "Sat", hours: 5.8, status: "half-day" },
    { day: "Sun", hours: 4.2, status: "holiday" },
  ],
};

export const DUMMY_DISTRIBUTOR_LEAVE_BALANCES: DistributorLeaveBalance[] = [
  { type: "Annual", total: 12, used: 4, remaining: 8 },
  { type: "Sick", total: 6, used: 1, remaining: 5 },
  { type: "Casual", total: 4, used: 2, remaining: 2 },
];

export const DUMMY_DISTRIBUTOR_LEAVE_REQUESTS: DistributorLeaveRequest[] = [
  {
    id: "lv-1",
    type: "Annual",
    fromDate: "2026-08-12",
    toDate: "2026-08-14",
    days: 3,
    reason: "Family travel",
    status: "Pending",
    appliedAt: "2026-07-28T10:15:00.000Z",
    reviewedAt: null,
    reviewNote: null,
  },
  {
    id: "lv-2",
    type: "Sick",
    fromDate: "2026-06-03",
    toDate: "2026-06-03",
    days: 1,
    reason: "Medical rest",
    status: "Approved",
    appliedAt: "2026-06-02T16:40:00.000Z",
    reviewedAt: "2026-06-02T18:05:00.000Z",
    reviewNote: "Approved by branch manager",
  },
  {
    id: "lv-3",
    type: "Casual",
    fromDate: "2026-05-20",
    toDate: "2026-05-20",
    days: 1,
    reason: "Personal errand",
    status: "Approved",
    appliedAt: "2026-05-18T09:00:00.000Z",
    reviewedAt: "2026-05-18T11:30:00.000Z",
    reviewNote: "Approved",
  },
  {
    id: "lv-4",
    type: "Annual",
    fromDate: "2026-04-10",
    toDate: "2026-04-12",
    days: 3,
    reason: "Long weekend trip",
    status: "Approved",
    appliedAt: "2026-04-01T09:20:00.000Z",
    reviewedAt: "2026-04-01T14:00:00.000Z",
    reviewNote: "Approved — coverage arranged",
  },
  {
    id: "lv-5",
    type: "Casual",
    fromDate: "2026-03-08",
    toDate: "2026-03-08",
    days: 1,
    reason: "Bank work",
    status: "Rejected",
    appliedAt: "2026-03-06T10:00:00.000Z",
    reviewedAt: "2026-03-06T16:45:00.000Z",
    reviewNote: "Declined — month-end closing week",
  },
  {
    id: "lv-6",
    type: "Annual",
    fromDate: "2026-02-14",
    toDate: "2026-02-16",
    days: 3,
    reason: "Family function",
    status: "Approved",
    appliedAt: "2026-02-05T11:10:00.000Z",
    reviewedAt: "2026-02-05T15:20:00.000Z",
    reviewNote: "Approved",
  },
  {
    id: "lv-7",
    type: "Sick",
    fromDate: "2026-01-22",
    toDate: "2026-01-23",
    days: 2,
    reason: "Flu recovery",
    status: "Approved",
    appliedAt: "2026-01-21T08:30:00.000Z",
    reviewedAt: "2026-01-21T09:15:00.000Z",
    reviewNote: "Approved with medical note on file",
  },
  {
    id: "lv-8",
    type: "Unpaid",
    fromDate: "2025-12-26",
    toDate: "2025-12-27",
    days: 2,
    reason: "Extended holiday travel",
    status: "Rejected",
    appliedAt: "2025-12-18T12:00:00.000Z",
    reviewedAt: "2025-12-19T10:30:00.000Z",
    reviewNote: "Declined — use annual balance instead",
  },
  {
    id: "lv-9",
    type: "Annual",
    fromDate: "2025-11-01",
    toDate: "2025-11-04",
    days: 4,
    reason: "Diwali break",
    status: "Approved",
    appliedAt: "2025-10-20T09:45:00.000Z",
    reviewedAt: "2025-10-20T13:00:00.000Z",
    reviewNote: "Approved",
  },
];

export const DUMMY_DISTRIBUTOR_SALARY_SLIPS: DistributorSalarySlipRow[] = [
  {
    id: "sl-1",
    payrollId: CURRENT_PAYROLL_ID,
    periodLabel: "Jul 2026",
    basicSalary: 204_000,
    performanceIncentive: 30_000,
    spotBonus: 20_000,
    deductions: 0,
    takeHome: 254_000,
    status: "waiting",
    paidOn: "2026-08-01",
  },
  {
    id: "sl-2",
    payrollId: "jun-2026",
    periodLabel: "Jun 2026",
    basicSalary: 204_000,
    performanceIncentive: 35_000,
    spotBonus: 15_000,
    deductions: 0,
    takeHome: 254_000,
    status: "done",
    paidOn: "2026-07-01",
  },
  {
    id: "sl-3",
    payrollId: "may-2026",
    periodLabel: "May 2026",
    basicSalary: 204_000,
    performanceIncentive: 28_000,
    spotBonus: 10_000,
    deductions: 0,
    takeHome: 242_000,
    status: "done",
    paidOn: "2026-06-01",
  },
  {
    id: "sl-4",
    payrollId: "apr-2026",
    periodLabel: "Apr 2026",
    basicSalary: 204_000,
    performanceIncentive: 32_000,
    spotBonus: 18_000,
    deductions: 0,
    takeHome: 254_000,
    status: "done",
    paidOn: "2026-05-01",
  },
  {
    id: "sl-5",
    payrollId: "mar-2026",
    periodLabel: "Mar 2026",
    basicSalary: 204_000,
    performanceIncentive: 22_000,
    spotBonus: 8_000,
    deductions: 2_000,
    takeHome: 232_000,
    status: "partial",
    paidOn: "2026-04-01",
  },
];

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

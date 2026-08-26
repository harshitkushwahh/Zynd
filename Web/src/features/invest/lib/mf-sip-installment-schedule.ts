const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const MIN_RECURRING_GAP_DAYS = 30;

function clampInstallmentDay(day: number, maxDay = 28) {
  return Math.min(Math.max(Math.trunc(day), 1), maxDay);
}

function buildDate(year: number, monthIndex: number, day: number) {
  return new Date(year, monthIndex, clampInstallmentDay(day) - 1, 12, 0, 0, 0);
}

function formatScheduleDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function resolveNextRecurringSipInstallmentDate(
  installmentDay: number,
  fromDate: Date = new Date(),
) {
  const day = clampInstallmentDay(installmentDay);
  const firstEligible = new Date(fromDate);
  firstEligible.setDate(firstEligible.getDate() + MIN_RECURRING_GAP_DAYS);

  let candidate = buildDate(firstEligible.getFullYear(), firstEligible.getMonth(), day);
  if (candidate < firstEligible) {
    candidate = buildDate(firstEligible.getFullYear(), firstEligible.getMonth() + 1, day);
  }

  while (candidate < firstEligible) {
    candidate = buildDate(candidate.getFullYear(), candidate.getMonth() + 1, day);
  }

  return candidate;
}

export function formatNextRecurringSipInstallmentDate(installmentDay: number, fromDate?: Date) {
  const nextDate = resolveNextRecurringSipInstallmentDate(installmentDay, fromDate);
  return formatScheduleDate(nextDate);
}

export function nextSipCalendarMonthLabel(installmentDay: number, fromDate?: Date) {
  const nextDate = resolveNextRecurringSipInstallmentDate(installmentDay, fromDate);
  return `${MONTH_LABELS[nextDate.getMonth()]} ${nextDate.getFullYear()}`;
}

export function formatGoalTargetMonthYear(targetDate: string) {
  const parsed = new Date(targetDate);
  if (Number.isNaN(parsed.getTime())) return targetDate;
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "numeric",
  }).format(parsed);
}

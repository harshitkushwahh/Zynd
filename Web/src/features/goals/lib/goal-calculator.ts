export const GOAL_MIN_PRIORITY = 1;
export const GOAL_MAX_PRIORITY = 5;
export const GOAL_DEFAULT_PRIORITY = 3;
export const GOAL_DEFAULT_RETURN_PCT = 12;
export const GOAL_MIN_TARGET_AMOUNT = 1;
export const GOAL_MAX_TARGET_AMOUNT = 100_000_000;

export function addMonthsToDate(base: Date, months: number) {
  const date = new Date(base);
  const targetMonth = date.getMonth() + months;
  date.setMonth(targetMonth);
  return date;
}

export function formatGoalDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function defaultTargetDate(months = 60) {
  return formatGoalDateInput(addMonthsToDate(new Date(), months));
}

export function clampGoalAmount(amount: number) {
  return Math.min(Math.max(amount, GOAL_MIN_TARGET_AMOUNT), GOAL_MAX_TARGET_AMOUNT);
}

export function clampGoalPriority(priority: number) {
  return Math.min(Math.max(priority, GOAL_MIN_PRIORITY), GOAL_MAX_PRIORITY);
}

export function goalAmountStep(amount: number) {
  if (amount >= 10_00_000) return 50_000;
  if (amount >= 1_00_000) return 5_000;
  if (amount >= 10_000) return 1_000;
  return 500;
}

export function goalIconKeyToLucide(iconKey: string) {
  switch (iconKey) {
    case "car":
      return "car";
    case "plane":
      return "plane";
    case "graduation-cap":
      return "graduation-cap";
    case "heart":
      return "heart";
    case "home":
      return "home";
    case "sunset":
      return "sunset";
    default:
      return "target";
  }
}

export function monthsUntil(dateInput: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateInput);
  target.setHours(0, 0, 0, 0);
  if (Number.isNaN(target.getTime()) || target <= today) return 0;

  let months = (target.getFullYear() - today.getFullYear()) * 12;
  months += target.getMonth() - today.getMonth();
  if (target.getDate() < today.getDate()) months -= 1;
  return Math.max(months, 0);
}

const ADMIN_GOAL_PRIORITY_LABELS: Record<number, string> = {
  1: "Highest",
  2: "High",
  3: "Medium",
  4: "Low",
  5: "Lowest",
};

export function formatAdminGoalPriorityLabel(priority: number) {
  return ADMIN_GOAL_PRIORITY_LABELS[priority] ?? ADMIN_GOAL_PRIORITY_LABELS[3];
}

export function normalizeAdminGoalPriority(priority: number) {
  if (priority >= 1 && priority <= 5) return priority;
  return 3;
}

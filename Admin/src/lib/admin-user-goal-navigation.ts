export function userGoalsTabHref(profilePath: string) {
  return `/dashboard/users/${encodeURIComponent(profilePath)}/goals`;
}

export function userGoalDetailHref(profilePath: string, goalId: string) {
  return `/dashboard/users/${encodeURIComponent(profilePath)}/goals/${encodeURIComponent(goalId)}`;
}

export function formatGoalTargetCompact(amount: number) {
  if (amount >= 1_00_00_000) {
    const value = amount / 1_00_00_000;
    return `${value >= 10 ? Math.round(value) : Number(value.toFixed(1))}Cr`;
  }
  if (amount >= 1_00_000) {
    const value = amount / 1_00_000;
    return `${value >= 10 ? Math.round(value) : Number(value.toFixed(1))}L`;
  }
  if (amount >= 1_000) {
    return `${Math.round(amount / 1_000)}K`;
  }
  return String(Math.round(amount));
}

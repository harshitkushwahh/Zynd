import { formatInr } from "@/features/invest/lib/mf-format";

/** Compact INR for tight dialog panels; falls back to full format for smaller amounts. */
export function formatGoalPanelInr(value: number | null | undefined) {
  if (value == null) return "—";
  if (value >= 1_00_000 || value <= -1_00_000) {
    return formatInr(value, { compact: true });
  }
  return formatInr(value);
}

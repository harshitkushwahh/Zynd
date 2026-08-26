import { cn } from "@/lib/utils";

export const ADMIN_METRIC_CARDS_GRID_CLASS = "admin-metric-cards-grid";

type AdminMetricCardsGridProps = {
  children: React.ReactNode;
  className?: string;
  columns?: "auto" | "two" | "three" | "four";
};

export function AdminMetricCardsGrid({
  children,
  className,
  columns = "auto",
}: AdminMetricCardsGridProps) {
  return (
    <div
      className={cn(
        ADMIN_METRIC_CARDS_GRID_CLASS,
        columns === "two" && "admin-metric-cards-grid--two",
        columns === "three" && "admin-metric-cards-grid--three",
        columns === "four" && "admin-metric-cards-grid--four",
        className,
      )}
    >
      {children}
    </div>
  );
}

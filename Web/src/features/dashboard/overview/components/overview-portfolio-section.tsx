import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { overviewContent } from "@/features/dashboard/config/dashboard-content";

export function OverviewPortfolioSection() {
  const { portfolio } = overviewContent;

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>{portfolio.title}</CardTitle>
        <CardDescription>{portfolio.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex min-h-[180px] items-center justify-center rounded-[var(--radius-card)] border border-dashed border-border bg-card/80">
          <p className="text-compact text-muted-foreground">{portfolio.placeholder}</p>
        </div>
      </CardContent>
    </Card>
  );
}

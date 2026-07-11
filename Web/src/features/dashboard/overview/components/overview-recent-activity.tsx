import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { overviewContent } from "@/features/dashboard/config/dashboard-content";

export function OverviewRecentActivity() {
  const { recentActivity } = overviewContent;

  return (
    <Card className="lg:col-span-3">
      <CardHeader>
        <CardTitle>{recentActivity.title}</CardTitle>
        <CardDescription>{recentActivity.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-[var(--radius-card)] border border-border bg-card/80 px-4 py-3 text-compact text-muted-foreground">
          {recentActivity.placeholder}
        </div>
      </CardContent>
    </Card>
  );
}

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageTitle } from "@/components/ui/page-title";
import { sectionPlaceholderContent } from "@/features/dashboard/config/dashboard-content";
import type { DashboardRoute } from "@/features/dashboard/navigation/dashboard-routes";

type DashboardSectionPlaceholderProps = {
  route: DashboardRoute;
};

export function DashboardSectionPlaceholder({ route }: DashboardSectionPlaceholderProps) {
  const Icon = route.icon;

  return (
    <div className="w-full min-w-0">
      <div className="mb-8">
        <PageTitle>{route.label}</PageTitle>
        <p className="mt-2 text-compact text-muted-foreground">{route.description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon className="size-5 text-primary" strokeWidth={2.25} />
            {route.label}
          </CardTitle>
          <CardDescription>{sectionPlaceholderContent.modulePreviewLabel}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex min-h-[220px] items-center justify-center rounded-[var(--radius-card)] border border-dashed border-border bg-card/80 px-6 text-center">
            <p className="text-compact text-muted-foreground">
              {sectionPlaceholderContent.comingSoon(route.label)}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

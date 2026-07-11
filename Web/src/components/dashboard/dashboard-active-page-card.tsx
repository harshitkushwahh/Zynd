"use client";

import { useDashboardRoute } from "@/features/dashboard/navigation/use-dashboard-route";
import { uiClasses } from "@/shared/config/ui-classes";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";

export function DashboardActivePageCard() {
  const { pageMeta } = useDashboardRoute();
  const Icon = pageMeta.icon;

  return (
    <div className={cn("flex items-center", uiClasses.navSurface)}>
      <HoverCard>
        <HoverCardTrigger
          delay={200}
          closeDelay={120}
          render={
            <button
              type="button"
              className={cn(
                "inline-flex h-9 max-w-[10rem] items-center gap-1.5 rounded-[var(--radius-full)] px-2.5 outline-none transition-colors",
                "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              )}
              aria-label={`${pageMeta.title} page info`}
            />
          }
        >
          <Icon className="size-4 shrink-0" strokeWidth={2.25} />
          <span className="truncate text-[13px] font-medium leading-none">{pageMeta.title}</span>
        </HoverCardTrigger>

        <HoverCardContent side="bottom" align="end" className="w-72">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-primary/10 text-primary">
              <Icon className="size-4" strokeWidth={2.25} />
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-compact font-semibold text-foreground">{pageMeta.title}</p>
              <p className="text-caption leading-relaxed text-muted-foreground">
                {pageMeta.description}
              </p>
            </div>
          </div>
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}

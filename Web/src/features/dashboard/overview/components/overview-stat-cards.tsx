"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { overviewContent } from "@/features/dashboard/config/dashboard-content";

export function OverviewStatCards() {
  return (
    <div className="mb-6 grid gap-4 sm:grid-cols-3">
      {overviewContent.statCards.map((stat) => (
        <Card key={stat.label}>
          <CardHeader className="pb-2">
            <CardDescription>{stat.label}</CardDescription>
            <CardTitle className="text-h3">{stat.value}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-caption text-muted-foreground">{stat.hint}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

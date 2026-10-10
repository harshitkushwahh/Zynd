"use client";

import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

type SupportPagePlaceholderProps = {
  title: string;
  description?: string;
  icon: LucideIcon;
  emptyTitle?: string;
};

export function SupportPagePlaceholder({
  title,
  description,
  icon: Icon,
  emptyTitle = "Nothing here yet",
}: SupportPagePlaceholderProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-h3 font-semibold text-foreground">{title}</h1>
        {description ? (
          <p className="mt-1 text-caption text-muted-foreground">{description}</p>
        ) : null}
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <Icon className="size-10 text-muted-foreground" strokeWidth={1.5} />
          <p className="text-body font-medium text-foreground">{emptyTitle}</p>
        </CardContent>
      </Card>
    </div>
  );
}

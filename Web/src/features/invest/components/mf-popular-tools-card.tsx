"use client";

import Link from "next/link";
import {
  CalendarClock,
  FileInput,
  LineChart,
  Search,
  type LucideIcon,
} from "lucide-react";

import {
  MF_POPULAR_TOOLS,
  type MfPopularTool,
} from "@/features/invest/lib/mf-dashboard-sidebar-data";
import { MF_CARD_RADIUS_CLASS } from "@/features/invest/lib/mf-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const TOOL_ICONS: Record<MfPopularTool["icon"], LucideIcon> = {
  cas: FileInput,
  screener: Search,
  "high-return": LineChart,
  "best-sip": CalendarClock,
};

function ToolRow({ tool }: { tool: MfPopularTool }) {
  const Icon = TOOL_ICONS[tool.icon];

  return (
    <Link
      href={tool.href}
      className={cn(
        "group flex items-center gap-3 rounded-[var(--radius-control)] border border-transparent px-2 py-2.5 transition-colors",
        "hover:border-border/70 hover:bg-muted/40",
      )}
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted/60 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
        <Icon className="size-4" strokeWidth={2.25} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-compact font-medium text-foreground">{tool.label}</p>
        <p className="mt-0.5 truncate text-caption text-muted-foreground">{tool.description}</p>
      </div>
    </Link>
  );
}

type MfPopularToolsCardProps = {
  tools?: MfPopularTool[];
};

export function MfPopularToolsCard({ tools = MF_POPULAR_TOOLS }: MfPopularToolsCardProps) {
  return (
    <section className={cn("border border-border bg-card p-4 sm:p-5", MF_CARD_RADIUS_CLASS)}>
      <p className="text-compact font-semibold text-foreground">{copy.mutualFunds.popularToolsTitle}</p>
      <p className="mt-1 text-caption text-muted-foreground">{copy.mutualFunds.popularToolsDescription}</p>

      <div className="mt-3 flex flex-col gap-0.5">
        {tools.map((tool) => (
          <ToolRow key={tool.id} tool={tool} />
        ))}
      </div>
    </section>
  );
}

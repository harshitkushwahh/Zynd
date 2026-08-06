"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import {
  MF_POPULAR_TOOLS,
  MF_TOOL_ICONS,
  type MfPopularTool,
} from "@/features/invest/lib/mf-dashboard-sidebar-data";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

function ToolRow({ tool }: { tool: MfPopularTool }) {
  const Icon = MF_TOOL_ICONS[tool.icon];

  const rowClassName = cn(
    "flex items-center gap-3 rounded-2xl bg-muted/35 px-3 py-3",
    tool.disabled
      ? "cursor-not-allowed opacity-50"
      : "transition-colors hover:bg-muted/55",
  );

  const content = (
    <>
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card ring-1 ring-border/50">
        <Icon className="size-4 text-foreground" strokeWidth={2.25} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-compact font-semibold text-foreground">{tool.label}</p>
        <p className="mt-0.5 truncate text-caption text-muted-foreground">{tool.description}</p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" strokeWidth={2.25} />
    </>
  );

  if (tool.disabled) {
    return (
      <div aria-disabled="true" className={rowClassName}>
        {content}
      </div>
    );
  }

  return (
    <Link href={tool.href} className={rowClassName}>
      {content}
    </Link>
  );
}

type MfPopularToolsCardProps = {
  tools?: MfPopularTool[];
};

export function MfPopularToolsCard({ tools = MF_POPULAR_TOOLS }: MfPopularToolsCardProps) {
  return (
    <section className="min-w-0 max-w-full overflow-hidden rounded-3xl border border-border/70 bg-card p-4">
      <p className="text-compact font-semibold text-foreground">{copy.mutualFunds.popularToolsTitle}</p>

      <div className="mt-3 flex flex-col gap-2">
        {tools.map((tool) => (
          <ToolRow key={tool.id} tool={tool} />
        ))}
      </div>
    </section>
  );
}

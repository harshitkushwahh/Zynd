"use client";

import { Activity, PieChart, TrendingUp } from "lucide-react";

import {
  MF_INVESTED_PREVIEW,
  type MfInvestedPreview,
} from "@/features/invest/lib/mf-dashboard-sidebar-data";
import { formatInr, formatSignedReturn } from "@/features/invest/lib/mf-format";
import { MF_CARD_RADIUS_CLASS } from "@/features/invest/lib/mf-ui";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type MfYourInvestedCardProps = {
  data?: MfInvestedPreview;
};

function toneClass(tone: "positive" | "negative" | "muted") {
  return cn(
    tone === "positive" && "text-success",
    tone === "negative" && "text-destructive",
    tone === "muted" && "text-foreground",
  );
}

function ReturnStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: number;
}) {
  const display = formatSignedReturn(value);

  return (
    <div className="min-w-0 flex-1 rounded-[var(--radius-control)] border border-border/60 bg-background/70 px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-caption text-muted-foreground">
        <Icon className="size-3 shrink-0" strokeWidth={2.25} />
        <span className="truncate">{label}</span>
      </div>
      <p className={cn("mt-1 text-compact font-semibold tabular-nums", toneClass(display.tone))}>
        {display.text}
      </p>
    </div>
  );
}

export function MfYourInvestedCard({ data = MF_INVESTED_PREVIEW }: MfYourInvestedCardProps) {
  return (
    <section
      className={cn(
        "min-w-0 max-w-full overflow-hidden border border-border bg-card",
        MF_CARD_RADIUS_CLASS,
      )}
    >
      <div className="px-3.5 pb-3 pt-3.5">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/15">
            <PieChart className="size-4 text-primary" strokeWidth={2.25} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-compact font-semibold text-foreground">{copy.mutualFunds.yourInvestedTitle}</p>
            <p className="mt-0.5 text-caption leading-snug text-muted-foreground [overflow-wrap:anywhere]">
              {copy.mutualFunds.yourInvestedDescription}
            </p>
          </div>
        </div>
      </div>

      <div className="px-3.5 pb-3.5">
        <div className="rounded-[var(--radius-control)] border border-border/70 bg-muted/15 px-3 py-2.5">
          <p className="text-caption text-muted-foreground">{copy.mutualFunds.yourInvestedTotalLabel}</p>
          <p className="mt-0.5 text-h4 font-semibold tabular-nums tracking-tight text-foreground">
            {formatInr(data.totalValueInr)}
          </p>
        </div>

        <div className="mt-2.5 flex min-w-0 gap-2">
          <ReturnStat
            icon={TrendingUp}
            label={copy.mutualFunds.yourInvestedTotalReturn}
            value={data.totalReturnPct}
          />
          <ReturnStat
            icon={Activity}
            label={copy.mutualFunds.yourInvestedDayChange}
            value={data.dayChangePct}
          />
        </div>
      </div>
    </section>
  );
}

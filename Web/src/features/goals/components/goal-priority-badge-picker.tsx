"use client";

import type { LucideIcon } from "lucide-react";
import {
  ChevronDown,
  ChevronsDown,
  ChevronUp,
  Minus,
  Star,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const PRIORITY_LEVELS = [1, 2, 3, 4, 5] as const;

type GoalPriorityLevel = (typeof PRIORITY_LEVELS)[number];

type PriorityTheme = {
  icon: LucideIcon;
  badge: { selected: string; unselected: string };
  segment: { selected: string; unselected: string };
  iconClass: { selected: string; unselected: string };
};

const PRIORITY_THEMES: Record<GoalPriorityLevel, PriorityTheme> = {
  1: {
    icon: Star,
    badge: {
      selected: "border-blue-300/80 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-300",
      unselected: "border-border/70 bg-background text-blue-600/70 hover:border-blue-200 hover:bg-blue-50/60 dark:text-blue-400/70",
    },
    segment: {
      selected: "border-blue-300/80 bg-blue-50 text-blue-700 shadow-sm dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-300",
      unselected: "border-transparent text-blue-700/55 hover:bg-blue-50/50 dark:text-blue-300/55",
    },
    iconClass: {
      selected: "text-blue-600 dark:text-blue-300",
      unselected: "text-blue-500/70 dark:text-blue-400/55",
    },
  },
  2: {
    icon: ChevronUp,
    badge: {
      selected: "border-amber-300/80 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300",
      unselected: "border-border/70 bg-background text-amber-600/70 hover:border-amber-200 hover:bg-amber-50/60 dark:text-amber-400/70",
    },
    segment: {
      selected: "border-amber-300/80 bg-amber-50 text-amber-700 shadow-sm dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300",
      unselected: "border-transparent text-amber-700/55 hover:bg-amber-50/50 dark:text-amber-300/55",
    },
    iconClass: {
      selected: "text-amber-600 dark:text-amber-300",
      unselected: "text-amber-500/70 dark:text-amber-400/55",
    },
  },
  3: {
    icon: Minus,
    badge: {
      selected: "border-violet-300/80 bg-violet-50 text-violet-700 dark:border-violet-500/40 dark:bg-violet-500/15 dark:text-violet-300",
      unselected: "border-border/70 bg-background text-violet-600/70 hover:border-violet-200 hover:bg-violet-50/60 dark:text-violet-400/70",
    },
    segment: {
      selected: "border-violet-300/80 bg-violet-50 text-violet-700 shadow-sm dark:border-violet-500/40 dark:bg-violet-500/15 dark:text-violet-300",
      unselected: "border-transparent text-violet-700/55 hover:bg-violet-50/50 dark:text-violet-300/55",
    },
    iconClass: {
      selected: "text-violet-600 dark:text-violet-300",
      unselected: "text-violet-500/70 dark:text-violet-400/55",
    },
  },
  4: {
    icon: ChevronDown,
    badge: {
      selected: "border-slate-300/80 bg-slate-50 text-slate-700 dark:border-slate-500/40 dark:bg-slate-500/15 dark:text-slate-300",
      unselected: "border-border/70 bg-background text-slate-600/70 hover:border-slate-200 hover:bg-slate-50/60 dark:text-slate-400/70",
    },
    segment: {
      selected: "border-slate-300/80 bg-slate-50 text-slate-700 shadow-sm dark:border-slate-500/40 dark:bg-slate-500/15 dark:text-slate-300",
      unselected: "border-transparent text-slate-600/55 hover:bg-slate-50/50 dark:text-slate-300/55",
    },
    iconClass: {
      selected: "text-slate-600 dark:text-slate-300",
      unselected: "text-slate-500/70 dark:text-slate-400/55",
    },
  },
  5: {
    icon: ChevronsDown,
    badge: {
      selected: "border-zinc-300/80 bg-zinc-50 text-zinc-600 dark:border-zinc-500/40 dark:bg-zinc-500/15 dark:text-zinc-300",
      unselected: "border-border/70 bg-background text-zinc-500/80 hover:border-zinc-200 hover:bg-zinc-50/60 dark:text-zinc-400/70",
    },
    segment: {
      selected: "border-zinc-300/80 bg-zinc-50 text-zinc-600 shadow-sm dark:border-zinc-500/40 dark:bg-zinc-500/15 dark:text-zinc-300",
      unselected: "border-transparent text-zinc-500/60 hover:bg-zinc-50/50 dark:text-zinc-400/55",
    },
    iconClass: {
      selected: "text-zinc-600 dark:text-zinc-300",
      unselected: "text-zinc-400/80 dark:text-zinc-500/55",
    },
  },
};

export function goalPriorityThemeFor(level: number): PriorityTheme {
  const normalized = PRIORITY_LEVELS.includes(level as GoalPriorityLevel)
    ? (level as GoalPriorityLevel)
    : 3;
  return PRIORITY_THEMES[normalized];
}

type GoalPriorityChipProps = {
  priority: number;
  className?: string;
};

export function GoalPriorityDot({ priority, className }: GoalPriorityChipProps) {
  const normalized = PRIORITY_LEVELS.includes(priority as GoalPriorityLevel)
    ? (priority as GoalPriorityLevel)
    : 3;
  const label = copy.goals.priorityOptions[normalized] ?? copy.goals.priorityOptions[3];
  const dotClass: Record<GoalPriorityLevel, string> = {
    1: "bg-blue-500",
    2: "bg-amber-500",
    3: "bg-violet-500",
    4: "bg-slate-400",
    5: "bg-zinc-400",
  };

  return (
    <span
      className={cn("size-2 shrink-0 rounded-full ring-2 ring-background", dotClass[normalized], className)}
      title={label}
      aria-label={label}
    />
  );
}

export function GoalPriorityChip({ priority, className }: GoalPriorityChipProps) {
  const theme = goalPriorityThemeFor(priority);
  const Icon = theme.icon;
  const label = copy.goals.priorityOptions[priority as GoalPriorityLevel] ?? copy.goals.priorityOptions[3];

  return (
    <div
      className={cn(
        "inline-flex h-7 max-w-full items-center gap-1.5 rounded-[var(--radius-control)] border px-2.5 text-[10px] font-medium shadow-sm",
        theme.badge.selected,
        className,
      )}
    >
      <Icon className={cn("size-3 shrink-0", theme.iconClass.selected)} aria-hidden />
      <span className="truncate">{label}</span>
    </div>
  );
}

type GoalPriorityBadgePickerProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  variant?: "badges" | "segmented";
  className?: string;
};

export function GoalPriorityBadgePicker({
  id,
  value,
  onChange,
  disabled = false,
  variant = "badges",
  className,
}: GoalPriorityBadgePickerProps) {
  if (variant === "segmented") {
    return (
      <div
        id={id}
        className={cn(
          "grid grid-cols-5 gap-1 rounded-[var(--radius-card)] border border-border/70 bg-muted/10 p-1",
          className,
        )}
        role="radiogroup"
        aria-label={copy.goals.priorityLabel}
      >
        {PRIORITY_LEVELS.map((level) => {
          const selected = value === String(level);
          const theme = PRIORITY_THEMES[level];
          const Icon = theme.icon;

          return (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(String(level))}
              className={cn(
                "flex min-w-0 flex-col items-center justify-center gap-1 rounded-[calc(var(--radius-control)-2px)] border px-1 py-2 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                selected ? theme.segment.selected : theme.segment.unselected,
              )}
            >
              <Icon
                className={cn(
                  "size-3.5 shrink-0",
                  selected ? theme.iconClass.selected : theme.iconClass.unselected,
                )}
                aria-hidden
              />
              <span className="truncate leading-none">{copy.goals.priorityOptions[level]}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div id={id} className={cn("flex flex-wrap gap-1.5", className)} role="radiogroup" aria-label={copy.goals.priorityLabel}>
      {PRIORITY_LEVELS.map((level) => {
        const selected = value === String(level);
        const theme = PRIORITY_THEMES[level];
        const Icon = theme.icon;

        return (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(String(level))}
            className="rounded-[var(--radius-control)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Badge
              variant="outline"
              className={cn(
                "h-7 cursor-pointer gap-1 px-2.5 text-[11px] font-medium transition-colors",
                selected ? theme.badge.selected : theme.badge.unselected,
              )}
            >
              <Icon
                className={cn("size-3 shrink-0", selected ? theme.iconClass.selected : theme.iconClass.unselected)}
                aria-hidden
              />
              {copy.goals.priorityOptions[level]}
            </Badge>
          </button>
        );
      })}
    </div>
  );
}

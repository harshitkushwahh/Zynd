"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Shared max-height shell for goal dialogs — keeps footer visible while body scrolls. */
export const GOAL_DIALOG_SHELL_CLASS =
  "flex max-h-[min(92vh,820px)] w-full flex-col overflow-hidden";

export const GOAL_DIALOG_BODY_SCROLL_CLASS =
  "min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border";

type GoalDialogBodyProps = {
  children: ReactNode;
  className?: string;
};

export function GoalDialogBody({ children, className }: GoalDialogBodyProps) {
  return (
    <div className={cn(GOAL_DIALOG_BODY_SCROLL_CLASS, "px-5 py-4 sm:px-6 sm:py-5", className)}>
      {children}
    </div>
  );
}

type GoalDialogSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  tone?: "default" | "muted";
};

export function GoalDialogSection({
  title,
  description,
  children,
  className,
  tone = "default",
}: GoalDialogSectionProps) {
  return (
    <section
      className={cn(
        "space-y-3 rounded-[var(--radius-card)] border p-4",
        tone === "muted"
          ? "border-border/50 bg-muted/20"
          : "border-border/70 bg-card/40 shadow-sm",
        className,
      )}
    >
      <div className="space-y-0.5">
        <h3 className="text-compact font-semibold text-foreground">{title}</h3>
        {description ? (
          <p className="text-caption leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

type GoalDialogSplitLayoutProps = {
  main: ReactNode;
  aside: ReactNode;
  className?: string;
};

/** Calculator-style split: scrollable inputs + sticky results sidebar on large screens. */
export function GoalDialogSplitLayout({ main, aside, className }: GoalDialogSplitLayoutProps) {
  return (
    <div
      className={cn(
        GOAL_DIALOG_BODY_SCROLL_CLASS,
        "flex min-h-0 flex-1 flex-col bg-background lg:flex-row lg:items-stretch lg:overflow-hidden",
        className,
      )}
    >
      <div className="min-h-0 flex-1 bg-background px-5 py-4 sm:px-6 sm:py-5 lg:overflow-y-auto lg:[scrollbar-width:thin] lg:[&::-webkit-scrollbar]:w-1.5 lg:[&::-webkit-scrollbar-thumb]:rounded-full lg:[&::-webkit-scrollbar-thumb]:bg-border">
        {main}
      </div>
      <aside className="flex min-h-0 shrink-0 flex-col border-t border-border/70 bg-background lg:w-[20rem] lg:overflow-hidden lg:border-l lg:border-t-0 xl:w-[22rem]">
        <div className="flex min-h-0 flex-1 flex-col lg:overflow-y-auto lg:[scrollbar-width:thin] lg:[&::-webkit-scrollbar]:w-1.5 lg:[&::-webkit-scrollbar-thumb]:rounded-full lg:[&::-webkit-scrollbar-thumb]:bg-border">
          {aside}
        </div>
      </aside>
    </div>
  );
}

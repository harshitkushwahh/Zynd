"use client";

import { cn } from "@/lib/utils";

type SettingsContentCardProps = {
  header: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function SettingsContentCard({ header, children, className }: SettingsContentCardProps) {
  return (
    <div
      className={cn(
        "flex h-full max-h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-card",
        className,
      )}
    >
      <div className="shrink-0 px-6 pt-6 sm:px-8">{header}</div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8 sm:py-8 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
        {children}
      </div>
    </div>
  );
}

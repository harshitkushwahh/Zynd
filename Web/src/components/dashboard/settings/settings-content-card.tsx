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
      <div className="shrink-0 px-5 pt-5 sm:px-6">{header}</div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
        {children}
      </div>
    </div>
  );
}

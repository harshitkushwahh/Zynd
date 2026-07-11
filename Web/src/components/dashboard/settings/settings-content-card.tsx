"use client";

type SettingsContentCardProps = {
  header: React.ReactNode;
  children: React.ReactNode;
};

export function SettingsContentCard({ header, children }: SettingsContentCardProps) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-card">
      <div className="shrink-0 px-6 pt-6 sm:px-8">{header}</div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8 sm:py-8 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
        {children}
      </div>
    </div>
  );
}

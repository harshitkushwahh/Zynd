import type { ReactNode } from "react";

type AdminSettingsContentCardProps = {
  title: string;
  description?: string;
  headerAside?: ReactNode;
  children: ReactNode;
};

export function AdminSettingsContentCard({
  title,
  description,
  headerAside,
  children,
}: AdminSettingsContentCardProps) {
  return (
    <div className="min-w-0 flex-1 rounded-[var(--radius-card)] border border-border bg-card">
      <div className="border-b border-border px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="font-heading text-body font-semibold text-foreground">{title}</h2>
            {description ? (
              <p className="mt-1 text-caption text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {headerAside ? <div className="shrink-0">{headerAside}</div> : null}
        </div>
      </div>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </div>
  );
}

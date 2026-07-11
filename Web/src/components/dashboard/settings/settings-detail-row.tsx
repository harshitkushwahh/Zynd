import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

type SettingsDetailRowProps = {
  label: string;
  value: string;
  verified?: boolean;
  mono?: boolean;
  className?: string;
};

export function SettingsDetailRow({
  label,
  value,
  verified,
  mono,
  className,
}: SettingsDetailRowProps) {
  return (
    <div className={cn("flex flex-col gap-1.5 border-b border-border/60 py-4 last:border-b-0", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-compact font-medium text-muted-foreground">{label}</span>
        {verified ? (
          <StatusBadge variant="success" className="h-5 px-2 text-[10px]">
            Verified
          </StatusBadge>
        ) : null}
      </div>
      <span className={cn("text-body font-medium text-foreground", mono && "font-mono uppercase tracking-wide")}>
        {value || "Not Provided"}
      </span>
    </div>
  );
}

export function SettingsDetailSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[var(--radius-card)] border border-border bg-muted/15 p-4 sm:p-5">
      <div className="mb-3">
        <h3 className="text-body font-semibold text-foreground">{title}</h3>
        {description ? (
          <p className="mt-1 text-caption text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

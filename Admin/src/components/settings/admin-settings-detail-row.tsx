import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type AdminSettingsDetailRowProps = {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
};

export function AdminSettingsDetailRow({ label, value, icon: Icon }: AdminSettingsDetailRowProps) {
  return (
    <div className="flex flex-col gap-1 border-b border-border py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 text-caption text-muted-foreground">
        {Icon ? <Icon className="size-4 shrink-0" /> : null}
        <span>{label}</span>
      </div>
      <div className="text-compact font-medium text-foreground">{value}</div>
    </div>
  );
}

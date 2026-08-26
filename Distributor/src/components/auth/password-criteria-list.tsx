import { Check, ListChecks } from "lucide-react";

import { PASSWORD_CRITERIA } from "@/lib/password-criteria";
import { cn } from "@/lib/utils";

function CriteriaIndicator({ met }: { met: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-3.5 shrink-0 items-center justify-center rounded-full border transition-colors duration-200",
        met
          ? "border-success bg-success text-success-foreground"
          : "border-muted-foreground/30 bg-transparent",
      )}
    >
      {met ? <Check className="size-2" strokeWidth={3} aria-hidden /> : null}
    </span>
  );
}

export function PasswordCriteriaList({ password }: { password: string }) {
  return (
    <div className="mt-3 rounded-[var(--radius-control)] border border-border/70 bg-muted/15 px-2.5 py-2">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <ListChecks className="size-3.5 shrink-0" aria-hidden />
        <span>Must include</span>
      </div>
      <ul className="flex flex-wrap gap-x-2 gap-y-1">
        {PASSWORD_CRITERIA.map((criterion) => {
          const met = criterion.test(password);
          return (
            <li
              key={criterion.id}
              className={cn(
                "inline-flex items-center gap-1 text-xs leading-none transition-colors duration-200",
                met ? "text-success" : "text-muted-foreground",
              )}
            >
              <CriteriaIndicator met={met} />
              <span>{criterion.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

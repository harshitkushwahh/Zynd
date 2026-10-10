import type { LucideIcon } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

type ClientProfileCapturedFieldCardProps = {
  label: string;
  value: string;
  secondaryLabel?: string;
  secondaryValue?: string;
  tertiaryLabel?: string;
  tertiaryValue?: string;
  verified?: boolean;
  mono?: boolean;
  monoSecondary?: boolean;
  icon?: LucideIcon;
  multiline?: boolean;
  className?: string;
};

export function ClientProfileCapturedFieldCard({
  label,
  value,
  secondaryLabel,
  secondaryValue,
  tertiaryLabel,
  tertiaryValue,
  verified,
  mono,
  monoSecondary,
  icon: Icon,
  multiline = false,
  className,
}: ClientProfileCapturedFieldCardProps) {
  return (
    <article
      className={cn(
        "support-client-profile-captured-card",
        verified && "support-client-profile-captured-card--verified",
        className,
      )}
    >
      <div className="support-client-profile-captured-card__head">
        <div className="support-client-profile-captured-card__label-row">
          {Icon ? (
            <span className="support-client-profile-captured-card__icon" aria-hidden>
              <Icon strokeWidth={2.25} />
            </span>
          ) : null}
          <span className="support-client-profile-captured-card__label">{label}</span>
        </div>
        {verified ? (
          <StatusBadge variant="success" className="h-5 shrink-0 px-1.5 text-[9px]">
            Verified
          </StatusBadge>
        ) : null}
      </div>
      <div className="support-client-profile-captured-card__body">
        <FieldLine value={value} mono={mono} multiline={multiline} />
        {secondaryLabel && secondaryValue ? (
          <div className="support-client-profile-captured-card__secondary">
            <span className="support-client-profile-captured-card__secondary-label">{secondaryLabel}</span>
            <FieldLine value={secondaryValue} mono={monoSecondary} />
          </div>
        ) : null}
        {tertiaryLabel && tertiaryValue ? (
          <div className="support-client-profile-captured-card__secondary">
            <span className="support-client-profile-captured-card__secondary-label">{tertiaryLabel}</span>
            <FieldLine value={tertiaryValue} />
          </div>
        ) : null}
      </div>
    </article>
  );
}

function FieldLine({
  value,
  mono,
  multiline,
}: {
  value: string;
  mono?: boolean;
  multiline?: boolean;
}) {
  return (
    <p
      className={cn(
        "support-client-profile-captured-card__value",
        mono && "support-client-profile-captured-card__value--mono",
        multiline && "support-client-profile-captured-card__value--multiline",
      )}
    >
      {value || "Not captured"}
    </p>
  );
}

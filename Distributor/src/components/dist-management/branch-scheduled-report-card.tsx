"use client";

import {
  BarChart3,
  CalendarClock,
  ClipboardList,
  LineChart,
  Mail,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import { DistributorInfoBadge } from "@/components/ui/distributor-info-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Switch } from "@/components/ui/switch";
import type { BranchScheduledReport } from "@/lib/distributor-branch-reports-data";
import { formatDistributorDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const SCHEDULED_REPORT_ICONS: Record<string, LucideIcon> = {
  "sr-1": LineChart,
  "sr-2": BarChart3,
  "sr-3": ShieldCheck,
  "sr-4": ShieldCheck,
};

type BranchScheduledReportCardProps = {
  report: BranchScheduledReport;
  onToggle: (id: string, enabled: boolean) => void;
  className?: string;
};

export function BranchScheduledReportCard({
  report,
  onToggle,
  className,
}: BranchScheduledReportCardProps) {
  const Icon = SCHEDULED_REPORT_ICONS[report.id] ?? Mail;

  return (
    <article className={cn("distributor-report-template-card distributor-branch-scheduled-report-card", className)}>
      <div className="distributor-branch-scheduled-report-card__head">
        <div className="distributor-report-template-card__identity">
          <span className="distributor-report-template-card__icon" aria-hidden>
            <Icon className="size-4" strokeWidth={2.25} />
          </span>
          <div className="distributor-branch-scheduled-report-card__title-row">
            <h3 className="distributor-report-template-card__title">{report.name}</h3>
            <StatusBadge variant={report.enabled ? "success" : "neutral"}>
              {report.enabled ? "Active" : "Paused"}
            </StatusBadge>
          </div>
        </div>
        <Switch
          checked={report.enabled}
          onCheckedChange={(checked) => onToggle(report.id, checked)}
          aria-label={`Enable ${report.name}`}
          className="distributor-branch-scheduled-report-card__switch shrink-0"
        />
      </div>

      <p className="distributor-report-template-card__description">{report.description}</p>

      <DistributorInfoBadge
        icon={CalendarClock}
        label={report.frequency}
        className="distributor-branch-scheduled-report-card__frequency-badge max-w-full"
        aria-label={`Frequency: ${report.frequency}`}
      />

      <div className="distributor-branch-scheduled-report-card__recipients">
        <p className="distributor-branch-scheduled-report-card__recipients-label">Recipients</p>
        <ul className="distributor-branch-scheduled-report-card__recipient-list">
          {report.recipients.map((recipient) => (
            <li key={recipient}>
              <DistributorInfoBadge
                icon={Mail}
                label={recipient}
                className="distributor-branch-scheduled-report-card__recipient-badge max-w-full"
                title={recipient}
              />
            </li>
          ))}
        </ul>
      </div>

      <div className="distributor-branch-scheduled-report-card__footer">
        <dl className="distributor-branch-scheduled-report-card__schedule">
          <div className="distributor-branch-scheduled-report-card__schedule-item">
            <dt>Last sent</dt>
            <dd>{report.lastSentAt ? formatDistributorDate(report.lastSentAt) : "—"}</dd>
          </div>
          <div className="distributor-branch-scheduled-report-card__schedule-item">
            <dt>Next run</dt>
            <dd>{formatDistributorDate(report.nextRunAt)}</dd>
          </div>
        </dl>
        <DistributorActionButton
          type="button"
          variant="outline"
          size="sm"
          className="distributor-branch-scheduled-report-card__preview gap-1.5 shrink-0"
          aria-label={`Preview ${report.name}`}
        >
          <ClipboardList className="size-3.5" aria-hidden />
          Preview
        </DistributorActionButton>
      </div>
    </article>
  );
}

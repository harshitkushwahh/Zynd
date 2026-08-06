"use client";

import { useState } from "react";
import {
  ArrowDownRight,
  BarChart3,
  CalendarClock,
  Download,
  Receipt,
  ShieldCheck,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import {
  DistributorOptionBox,
  DistributorOptionBoxContent,
  DistributorOptionBoxItem,
  DistributorOptionBoxTrigger,
  DistributorOptionBoxValue,
} from "@/components/ui/distributor-option-box";
import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/status-badge";
import {
  DISTRIBUTOR_REPORT_TEMPLATE_PERIOD_OPTIONS,
  type DistributorReportFormat,
  type DistributorReportTemplate,
  type DistributorReportTemplatePeriod,
} from "@/lib/distributor-reports-data";
import { cn } from "@/lib/utils";

const REPORT_TEMPLATE_ICONS: Record<string, LucideIcon> = {
  "rt-sip": CalendarClock,
  "rt-redemptions": ArrowDownRight,
  "rt-growth": TrendingUp,
  "rt-incentive": Receipt,
  "rt-compliance": ShieldCheck,
  "bd-rt-aum": TrendingUp,
  "bd-rt-holdings": BarChart3,
  "bd-rt-sip": CalendarClock,
  "bd-rt-growth": TrendingUp,
  "bd-rt-kyc": ShieldCheck,
  "bd-rt-compliance": ShieldCheck,
};

const REPORT_CATEGORY_BADGE_VARIANT: Record<
  DistributorReportTemplate["category"],
  StatusBadgeVariant
> = {
  Book: "info",
  Incentives: "success",
  Compliance: "warning",
  Growth: "neutral",
};

const EXPORT_FORMATS: DistributorReportFormat[] = ["PDF", "Excel"];

type DistributorReportTemplateCardProps = {
  template: DistributorReportTemplate;
  className?: string;
};

export function DistributorReportTemplateCard({
  template,
  className,
}: DistributorReportTemplateCardProps) {
  const [period, setPeriod] = useState<DistributorReportTemplatePeriod>("6M");
  const Icon = REPORT_TEMPLATE_ICONS[template.id] ?? BarChart3;
  const periodLabel =
    DISTRIBUTOR_REPORT_TEMPLATE_PERIOD_OPTIONS.find((option) => option.value === period)?.label ??
    "Last 6M";

  return (
    <article className={cn("distributor-report-template-card", className)}>
      <div className="distributor-report-template-card__head">
        <div className="distributor-report-template-card__identity">
          <span className="distributor-report-template-card__icon" aria-hidden>
            <Icon className="size-4" strokeWidth={2.25} />
          </span>
          <h3 className="distributor-report-template-card__title">{template.name}</h3>
        </div>
        <StatusBadge variant={REPORT_CATEGORY_BADGE_VARIANT[template.category]}>
          {template.category}
        </StatusBadge>
      </div>

      <p className="distributor-report-template-card__description">{template.description}</p>

      <div className="distributor-report-template-card__footer">
        <DistributorOptionBox
          value={period}
          onValueChange={(value) => setPeriod(value as DistributorReportTemplatePeriod)}
        >
          <DistributorOptionBoxTrigger
            className="distributor-report-template-card__period-trigger"
            aria-label={`Period for ${template.name}`}
          >
            <DistributorOptionBoxValue>{periodLabel}</DistributorOptionBoxValue>
          </DistributorOptionBoxTrigger>
          <DistributorOptionBoxContent align="start">
            {DISTRIBUTOR_REPORT_TEMPLATE_PERIOD_OPTIONS.map((option) => (
              <DistributorOptionBoxItem key={option.value} value={option.value}>
                {option.label}
              </DistributorOptionBoxItem>
            ))}
          </DistributorOptionBoxContent>
        </DistributorOptionBox>

        <div className="distributor-report-template-card__actions">
          {EXPORT_FORMATS.filter((format) => template.formats.includes(format)).map((format) => (
            <DistributorActionButton
              key={format}
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              aria-label={`Download ${template.name} as ${format} for ${periodLabel}`}
            >
              <Download className="size-3.5" aria-hidden />
              {format}
            </DistributorActionButton>
          ))}
        </div>
      </div>
    </article>
  );
}

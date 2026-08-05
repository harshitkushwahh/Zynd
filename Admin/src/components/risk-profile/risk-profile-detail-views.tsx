"use client";

import {
  FolderTree,
  LayoutTemplate,
  ListOrdered,
  MessageSquareText,
  Scale,
} from "lucide-react";

import { AdminMetricCard } from "@/components/ui/admin-metric-card";
import { AdminMetricCardsGrid } from "@/components/ui/admin-metric-cards-grid";
import { StatusBadge } from "@/components/ui/status-badge";
import type { RiskCategory, RiskQuestion, RiskTemplate } from "@/lib/risk-profile-admin-api";
import { cn } from "@/lib/utils";

function DetailHero({
  icon: Icon,
  title,
  badges,
  description,
}: {
  icon: typeof FolderTree;
  title: string;
  badges?: React.ReactNode;
  description?: string | null;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-muted/15 p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-[var(--radius-card)] border border-border bg-primary/10 p-3 text-primary">
          <Icon className="size-5" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold leading-snug text-foreground">{title}</p>
          {badges ? <div className="mt-2 flex flex-wrap items-center gap-2">{badges}</div> : null}
          {description ? (
            <p className="mt-3 text-compact leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DetailSectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-compact font-semibold text-foreground">{children}</p>;
}

export function RiskCategoryDetailView({ category }: { category: RiskCategory }) {
  return (
    <div className="space-y-5">
      <DetailHero
        icon={FolderTree}
        title={category.name}
        badges={
          <>
            <span className="inline-flex items-center rounded-[var(--radius-control)] border border-border bg-background px-2 py-0.5 font-mono text-tiny text-muted-foreground">
              {category.slug}
            </span>
            <StatusBadge variant={category.is_active ? "success" : "neutral"} showIcon={false}>
              {category.is_active ? "Active" : "Inactive"}
            </StatusBadge>
          </>
        }
        description={category.description}
      />

      <AdminMetricCardsGrid columns="three">
        <AdminMetricCard
          label="Weight"
          value={category.weight.toFixed(2)}
          hint="Share of the 0–1000 score"
          icon={Scale}
          tone="info"
        />
        <AdminMetricCard
          label="Questions"
          value={(category.question_count ?? 0).toLocaleString()}
          hint="Active questions in this category"
          icon={MessageSquareText}
          tone={(category.question_count ?? 0) > 0 ? "success" : "muted"}
        />
        <AdminMetricCard
          label="Sort order"
          value={category.sort_order.toLocaleString()}
          icon={ListOrdered}
          tone="muted"
        />
      </AdminMetricCardsGrid>
    </div>
  );
}

export function RiskQuestionDetailView({ question }: { question: RiskQuestion }) {
  return (
    <div className="space-y-5">
      <DetailHero
        icon={MessageSquareText}
        title={question.prompt}
        badges={
          <>
            <span className="inline-flex items-center rounded-[var(--radius-control)] border border-border bg-background px-2 py-0.5 text-tiny text-foreground">
              {question.category_name ?? question.category_slug ?? "Uncategorized"}
            </span>
            <StatusBadge variant={question.is_active ? "success" : "neutral"} showIcon={false}>
              {question.is_active ? "Active" : "Inactive"}
            </StatusBadge>
          </>
        }
        description={question.help_text}
      />

      <div className="space-y-3">
        <DetailSectionTitle>Scored options</DetailSectionTitle>
        <div className="space-y-2">
          {question.options.map((option, index) => (
            <div
              key={option.id}
              className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-border bg-card px-3 py-2.5"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full",
                    "bg-muted text-tiny font-semibold text-muted-foreground",
                  )}
                >
                  {index + 1}
                </span>
                <span className="text-compact text-foreground">{option.label}</span>
              </div>
              <span className="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-tiny font-semibold tabular-nums text-primary">
                {option.score_value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function templateModeBadge(mode: RiskTemplate["selection_mode"]) {
  return (
    <StatusBadge variant={mode === "auto" ? "success" : "info"} showIcon={false}>
      {mode === "auto" ? "Auto" : "Manual"}
    </StatusBadge>
  );
}

export function RiskTemplateDetailView({ template }: { template: RiskTemplate }) {
  return (
    <div className="space-y-5">
      <DetailHero
        icon={LayoutTemplate}
        title={template.name}
        badges={
          <>
            {templateModeBadge(template.selection_mode)}
            <StatusBadge variant={template.is_default ? "success" : "neutral"} showIcon={false}>
              {template.is_default ? "Default" : "Not default"}
            </StatusBadge>
            <StatusBadge variant={template.is_active ? "success" : "neutral"} showIcon={false}>
              {template.is_active ? "Active" : "Inactive"}
            </StatusBadge>
          </>
        }
        description={template.description}
      />

      <AdminMetricCardsGrid>
        <AdminMetricCard
          label="Questions"
          value={template.total_questions.toLocaleString()}
          hint="Total questions resolved from rules"
          icon={MessageSquareText}
          tone={template.total_questions > 0 ? "success" : "muted"}
        />
        <AdminMetricCard
          label="Sort order"
          value={template.sort_order.toLocaleString()}
          icon={ListOrdered}
          tone="muted"
        />
      </AdminMetricCardsGrid>

      <div className="space-y-3">
        <DetailSectionTitle>Category rules</DetailSectionTitle>
        <div className="space-y-2">
          {template.rules.map((rule, index) => (
            <div
              key={`${template.id}-${rule.category_id}`}
              className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-border bg-card px-3 py-2.5"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full",
                    "bg-muted text-tiny font-semibold text-muted-foreground",
                  )}
                >
                  {index + 1}
                </span>
                <span className="text-compact text-foreground">
                  {rule.category_name ?? rule.category_slug ?? "Unknown category"}
                </span>
              </div>
              <span className="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-tiny font-semibold tabular-nums text-primary">
                {rule.question_count} question{rule.question_count === 1 ? "" : "s"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const RISK_CATEGORY_DETAIL_ICON = FolderTree;
export const RISK_QUESTION_DETAIL_ICON = MessageSquareText;
export const RISK_TEMPLATE_DETAIL_ICON = LayoutTemplate;

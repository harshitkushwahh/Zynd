"use client";

import type { LucideIcon } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

export type AddInvestorReviewItemTone = "default" | "success" | "muted" | "warning";

export type AddInvestorReviewItem = {
  label: string;
  value: string;
  tone?: AddInvestorReviewItemTone;
};

export type AddInvestorReviewSection = {
  id: string;
  title: string;
  icon: LucideIcon;
  items: AddInvestorReviewItem[];
  wide?: boolean;
};

export type AddInvestorReviewHero = {
  name: string;
  pan: string;
  kycPathLabel: string;
};

type AddInvestorReviewPanelProps = {
  hero: AddInvestorReviewHero;
  sections: AddInvestorReviewSection[];
};

function ReviewValue({ item }: { item: AddInvestorReviewItem }) {
  const tone = item.tone ?? "default";

  if (tone === "success") {
    return (
      <dd className="add-investor-review__value add-investor-review__value--badge">
        <StatusBadge variant="success">
          {item.value}
        </StatusBadge>
      </dd>
    );
  }

  if (tone === "warning") {
    return (
      <dd className="add-investor-review__value add-investor-review__value--badge">
        <StatusBadge variant="warning">
          {item.value}
        </StatusBadge>
      </dd>
    );
  }

  return (
    <dd
      className={cn(
        "add-investor-review__value",
        tone === "muted" && "add-investor-review__value--muted",
      )}
    >
      {item.value}
    </dd>
  );
}

function ReviewSectionCard({ section }: { section: AddInvestorReviewSection }) {
  const Icon = section.icon;

  return (
    <section
      className={cn(
        "add-investor-review__section",
        section.wide && "add-investor-review__section--wide",
      )}
    >
      <header className="add-investor-review__section-header">
        <span className="add-investor-review__section-icon" aria-hidden>
          <Icon className="size-4" strokeWidth={2.1} />
        </span>
        <h3 className="add-investor-review__section-title">{section.title}</h3>
      </header>

      <dl className="add-investor-review__section-body">
        {section.items.map((item) => (
          <div key={`${section.id}-${item.label}`} className="add-investor-review__row">
            <dt>{item.label}</dt>
            <ReviewValue item={item} />
          </div>
        ))}
      </dl>
    </section>
  );
}

export function AddInvestorReviewPanel({ hero, sections }: AddInvestorReviewPanelProps) {
  return (
    <div className="add-investor-review">
      <header className="add-investor-review__hero">
        <p className="add-investor-review__hero-name">{hero.name}</p>
        <div className="add-investor-review__hero-meta">
          <span className="add-investor-review__hero-pan">{hero.pan}</span>
          <StatusBadge variant="info">
            {hero.kycPathLabel}
          </StatusBadge>
        </div>
      </header>

      <div className="add-investor-review__grid">
        {sections.map((section) => (
          <ReviewSectionCard key={section.id} section={section} />
        ))}
      </div>
    </div>
  );
}

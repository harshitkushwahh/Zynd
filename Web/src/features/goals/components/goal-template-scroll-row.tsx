"use client";

import type { ReactNode } from "react";

import { GoalsHorizontalScrollRow } from "@/features/goals/components/goals-horizontal-scroll-row";
import { GOAL_TEMPLATE_SCROLL_ROW_CLASS } from "@/features/goals/lib/goal-template-meta";
type GoalTemplateScrollRowProps = {
  children: ReactNode;
  className?: string;
};

export function GoalTemplateScrollRow({ children, className }: GoalTemplateScrollRowProps) {
  return (
    <GoalsHorizontalScrollRow
      className={className}
      scrollClassName={GOAL_TEMPLATE_SCROLL_ROW_CLASS}
      fadeInsetClassName="top-4 bottom-10"
    >
      {children}
    </GoalsHorizontalScrollRow>
  );
}

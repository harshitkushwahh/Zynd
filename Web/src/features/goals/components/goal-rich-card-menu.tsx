"use client";

import { useRouter } from "next/navigation";
import { Archive, Eye, MoreHorizontal, Pencil } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Goal } from "@/features/goals/api/goals-api";
import { goalDetailHref } from "@/features/goals/lib/goal-navigation";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type GoalRichCardMenuProps = {
  goal: Goal;
  className?: string;
};

export function GoalRichCardMenu({ goal, className }: GoalRichCardMenuProps) {
  const router = useRouter();
  const detailHref = goalDetailHref(goal.id);
  const showArchive = goal.status !== "archived";

  const openDetail = () => {
    router.push(detailHref);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        className={cn("goal-rich-card__dots-btn goal-rich-card__dots-btn--header", className)}
        aria-label={copy.goals.richCardMenuLabel}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <MoreHorizontal className="size-3.5" strokeWidth={2} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[11rem]">
        <DropdownMenuItem
          onClick={() => {
            openDetail();
          }}
        >
          <Eye aria-hidden />
          {copy.goals.detailTitle}
        </DropdownMenuItem>
        {showArchive ? (
          <>
            <DropdownMenuItem onClick={openDetail}>
              <Pencil aria-hidden />
              {copy.goals.editTitle}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={openDetail}>
              <Archive aria-hidden />
              {copy.goals.archiveAction}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

import { FileClock, Trash2, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { AddInvestorInProgressItem } from "@/lib/add-investor/add-investor-in-progress-items";

type AddInvestorInProgressDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: AddInvestorInProgressItem[];
  activeClientUserId?: string | null;
  onResume: (item: AddInvestorInProgressItem) => void;
  onDiscardActiveSession?: () => void;
  hasActiveSession?: boolean;
};

export function AddInvestorInProgressDialog({
  open,
  onOpenChange,
  items,
  activeClientUserId,
  onResume,
  onDiscardActiveSession,
  hasActiveSession = false,
}: AddInvestorInProgressDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 p-0">
        <div className="border-b border-border px-6 py-5">
          <div className="mb-3 flex size-10 items-center justify-center rounded-[var(--radius-card)] bg-primary/10 text-primary">
            <FileClock className="size-5" strokeWidth={2.25} aria-hidden />
          </div>
          <DialogTitle className="text-compact font-semibold text-foreground">In progress</DialogTitle>
          <DialogDescription className="mt-1.5 text-sm text-muted-foreground">
            Resume KYC for investors in your book who have not finished onboarding yet.
          </DialogDescription>
        </div>

        <div className="max-h-[min(24rem,50vh)] overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No onboarding drafts right now.</p>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => {
                const active = item.id === activeClientUserId;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                        active
                          ? "border-primary/40 bg-primary/5"
                          : "border-border/60 bg-background hover:bg-muted/30",
                      )}
                      onClick={() => onResume(item)}
                    >
                      <span
                        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                        aria-hidden
                      >
                        <UserRound className="size-4" strokeWidth={2.25} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">{item.label}</span>
                        <span className="block truncate text-caption text-muted-foreground">
                          {item.clientCode} · {item.stepLabel}
                        </span>
                      </span>
                      <span className="shrink-0 text-caption font-medium text-primary">
                        {active ? "Current" : "Resume"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {hasActiveSession && onDiscardActiveSession ? (
          <div className="border-t border-border px-6 py-4">
            <Button
              type="button"
              variant="outline"
              className="w-full justify-center text-destructive hover:text-destructive"
              onClick={onDiscardActiveSession}
            >
              <Trash2 className="size-4" aria-hidden />
              Discard current session
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

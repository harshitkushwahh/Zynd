"use client";

import { FileClock, Mail, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type AddInvestorOnboardingDraftDialogProps = {
  open: boolean;
  mode: "resume" | "change-email" | "change-mobile";
  email?: string;
  mobile?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onDiscard?: () => void;
};

export function AddInvestorOnboardingDraftDialog({
  open,
  mode,
  email,
  mobile,
  onOpenChange,
  onConfirm,
  onDiscard,
}: AddInvestorOnboardingDraftDialogProps) {
  const isResume = mode === "resume";
  const isEmail = mode === "change-email";
  const Icon = isResume ? FileClock : isEmail ? Mail : Phone;

  const title = isResume
    ? "Resume investor draft?"
    : isEmail
      ? "Change investor email?"
      : "Change mobile number?";

  const description = isResume
    ? "You have an investor onboarding draft in progress. The investor is not added to your book until both email and mobile are verified and you create the account."
    : isEmail
      ? "We will keep this draft open, but the new email must be verified again. Mobile verification will also reset if you already entered a number."
      : "We will keep this draft open, but the new mobile number must be verified again before the investor can be created.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-4 p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="size-5 shrink-0" aria-hidden />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {isResume && (email || mobile) ? (
          <dl className="space-y-2 rounded-lg border border-border/70 bg-muted/20 px-4 py-3 text-sm">
            {email ? (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Draft email</dt>
                <dd className="font-medium">{email}</dd>
              </div>
            ) : null}
            {mobile ? (
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Draft mobile</dt>
                <dd className="font-medium">+91 {mobile}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {isResume && onDiscard ? (
            <Button type="button" variant="outline" onClick={onDiscard}>
              Start fresh
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}
          <Button type="button" onClick={onConfirm}>
            {isResume ? "Continue draft" : "Continue"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

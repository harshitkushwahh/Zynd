"use client";

import type { FormEvent } from "react";
import { useState } from "react";

import { DistributorActionButton } from "@/components/ui/distributor-action-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ClientCreateFamilyGroupDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ClientCreateFamilyGroupDialog({
  open,
  onOpenChange,
}: ClientCreateFamilyGroupDialogProps) {
  const copy = DISTRIBUTOR_CLIENT_COPY.family;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [showUnavailableHint, setShowUnavailableHint] = useState(false);

  const resetForm = () => {
    setName("");
    setDescription("");
    setShowUnavailableHint(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm();
    onOpenChange(next);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setShowUnavailableHint(true);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogHeader className="sr-only">
        <DialogTitle>{copy.createFamilyGroupDialogTitle}</DialogTitle>
        <DialogDescription>{copy.createFamilyGroupDialogDescription}</DialogDescription>
      </DialogHeader>
      <DialogContent className="max-w-md gap-0 p-0">
        <form className="distributor-create-family-group-dialog" onSubmit={handleSubmit}>
          <div className="distributor-create-family-group-dialog__header">
            <DialogTitle className="distributor-create-family-group-dialog__title">
              {copy.createFamilyGroupDialogTitle}
            </DialogTitle>
            <DialogDescription className="distributor-create-family-group-dialog__description">
              {copy.createFamilyGroupDialogDescription}
            </DialogDescription>
          </div>

          {showUnavailableHint ? (
            <p className="distributor-create-family-group-dialog__hint" role="status">
              {copy.createFamilyGroupDisabledHint}
            </p>
          ) : (
            <div className="distributor-create-family-group-dialog__fields">
              <div className="distributor-create-family-group-dialog__field">
                <Label htmlFor="family-group-name">{copy.createFamilyGroupNameLabel}</Label>
                <Input
                  id="family-group-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={copy.createFamilyGroupNamePlaceholder}
                  autoComplete="off"
                />
              </div>
              <div className="distributor-create-family-group-dialog__field">
                <Label htmlFor="family-group-description">{copy.createFamilyGroupDescriptionLabel}</Label>
                <textarea
                  id="family-group-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder={copy.createFamilyGroupDescriptionPlaceholder}
                  rows={3}
                  className={cn(
                    "min-h-[4.5rem] w-full min-w-0 resize-y rounded-[var(--radius-control)] border border-input bg-transparent px-2.5 py-2 text-body transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-compact dark:bg-input/30",
                  )}
                />
              </div>
            </div>
          )}

          <div className="distributor-create-family-group-dialog__actions">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              {copy.createFamilyGroupCancel}
            </Button>
            {showUnavailableHint ? null : (
              <DistributorActionButton type="submit" variant="primary">
                {copy.createFamilyGroupSubmit}
              </DistributorActionButton>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

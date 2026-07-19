"use client";

import { useMemo, useState } from "react";
import { Info, ShieldAlert } from "lucide-react";

import { AdminInfoDialog } from "@/components/ui/admin-dialog-presets";
import { Button } from "@/components/ui/button";
import type { SecurityConfigItem } from "@/lib/admin-api";
import {
  formatSecurityConfigDisplayValue,
  formatSecurityConfigValue,
} from "@/lib/admin-security-config-meta";

function findConfigItem(items: SecurityConfigItem[], key: string) {
  return items.find((item) => item.key === key) ?? null;
}

export function getRiskEnforcementLadderData(items: SecurityConfigItem[]) {
  const mediumScore = findConfigItem(items, "risk.medium_score");
  const highScore = findConfigItem(items, "risk.high_score");
  const mediumAction = findConfigItem(items, "risk.medium_action");
  const highAction = findConfigItem(items, "risk.high_action");

  return {
    mediumValue: Number(formatSecurityConfigValue(mediumScore?.value)),
    highValue: Number(formatSecurityConfigValue(highScore?.value)),
    mediumActionLabel: mediumAction
      ? formatSecurityConfigDisplayValue("risk.medium_action", mediumAction.value)
      : "Step-up enforcement",
    highActionLabel: highAction
      ? formatSecurityConfigDisplayValue("risk.high_action", highAction.value)
      : "Block sign-in",
  };
}

export function RiskEnforcementLadderDialog({
  open,
  onClose,
  mediumValue,
  highValue,
  mediumActionLabel,
  highActionLabel,
}: {
  open: boolean;
  onClose: () => void;
  mediumValue: number;
  highValue: number;
  mediumActionLabel: string;
  highActionLabel: string;
}) {
  const lowMax = Number.isFinite(mediumValue) ? Math.max(mediumValue - 1, 0) : null;
  const mediumMin = Number.isFinite(mediumValue) ? mediumValue : null;
  const mediumMax = Number.isFinite(highValue) ? Math.max(highValue - 1, mediumValue) : null;
  const highMin = Number.isFinite(highValue) ? highValue : null;

  return (
    <AdminInfoDialog
      open={open}
      onClose={onClose}
      title="Enforcement ladder"
      description="How risk scores map to sign-in enforcement using your current thresholds."
      icon={ShieldAlert}
      iconTone="info"
      size="md"
    >
      <div className="grid gap-2 sm:grid-cols-1">
        <div className="rounded-control border border-border bg-card px-3 py-2.5">
          <p className="text-tiny font-medium uppercase tracking-wide text-muted-foreground">
            Low risk
          </p>
          <p className="mt-1 text-compact font-medium text-foreground">
            {lowMax !== null ? `0 – ${lowMax}` : "—"}
          </p>
          <p className="text-caption text-muted-foreground">Allow sign-in</p>
        </div>
        <div className="rounded-control border border-primary/20 bg-primary/5 px-3 py-2.5">
          <p className="text-tiny font-medium uppercase tracking-wide text-primary">Medium risk</p>
          <p className="mt-1 text-compact font-medium text-foreground">
            {mediumMin !== null && mediumMax !== null ? `${mediumMin} – ${mediumMax}` : "—"}
          </p>
          <p className="text-caption text-muted-foreground">{mediumActionLabel}</p>
        </div>
        <div className="rounded-control border border-destructive/20 bg-destructive/5 px-3 py-2.5">
          <p className="text-tiny font-medium uppercase tracking-wide text-destructive">
            High risk
          </p>
          <p className="mt-1 text-compact font-medium text-foreground">
            {highMin !== null ? `${highMin}+` : "—"}
          </p>
          <p className="text-caption text-muted-foreground">{highActionLabel}</p>
        </div>
      </div>
    </AdminInfoDialog>
  );
}

export function RiskEnforcementLadderButton({
  items,
  className,
}: {
  items: SecurityConfigItem[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ladder = useMemo(() => getRiskEnforcementLadderData(items), [items]);

  return (
    <>
      <Button variant="outline" size="sm" className={className} onClick={() => setOpen(true)}>
        <Info className="size-3.5" />
        Enforcement ladder
      </Button>
      <RiskEnforcementLadderDialog open={open} onClose={() => setOpen(false)} {...ladder} />
    </>
  );
}

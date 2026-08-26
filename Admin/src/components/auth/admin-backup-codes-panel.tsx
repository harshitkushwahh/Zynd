"use client";

import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";

import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AdminBackupCodesPanelProps = {
  codes: string[];
  className?: string;
  onActionMessage?: (message: string) => void;
};

export function AdminBackupCodesPanel({
  codes,
  className,
  onActionMessage,
}: AdminBackupCodesPanelProps) {
  const [localMessage, setLocalMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const notify = (message: string) => {
    setLocalMessage(message);
    onActionMessage?.(message);
  };

  const copyBackupCodes = async () => {
    if (!codes.length) return;
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      notify("Backup codes copied to clipboard.");
    } catch {
      notify("Could not copy backup codes. Select and copy them manually.");
    }
  };

  const downloadBackupCodes = () => {
    if (!codes.length) return;
    const blob = new Blob([codes.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "zynd-admin-backup-codes.txt";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    notify("Backup codes downloaded.");
  };

  if (!codes.length) return null;

  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-border bg-card px-4 py-4 shadow-zynd-low",
        className,
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-compact font-semibold text-foreground">Backup codes</p>
          <p className="mt-1 text-caption text-muted-foreground">
            Store these somewhere safe before continuing. Each code works once if you lose your
            authenticator app.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={copied ? "Backup codes copied" : "Copy backup codes"}
            onClick={() => void copyBackupCodes()}
          >
            {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Download backup codes"
            onClick={downloadBackupCodes}
          >
            <Download className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 font-mono text-compact">
        {codes.map((code) => (
          <span
            key={code}
            className="rounded-[var(--radius-control)] border border-border bg-background px-2.5 py-2 text-center text-foreground"
          >
            {code}
          </span>
        ))}
      </div>

      {localMessage ? (
        <AdminFeedbackMessage variant="success" className="mt-4" onDismiss={() => setLocalMessage("")}>
          {localMessage}
        </AdminFeedbackMessage>
      ) : null}
    </div>
  );
}

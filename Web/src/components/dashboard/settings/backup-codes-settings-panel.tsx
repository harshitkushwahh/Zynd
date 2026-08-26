"use client";

import { Check, Copy, Download, Eye, KeyRound } from "lucide-react";
import { useEffect, useState } from "react";

import {
  MfaBackupCodesAccessDialog,
  MfaRegenerateBackupDialog,
} from "@/features/account/mfa";
import { SecurityFeatureCard } from "@/components/dashboard/settings/security-feature-card";
import { SecurityFeatureCardSkeleton } from "@/components/dashboard/settings/settings-skeleton";
import { downloadBackupCodesJson } from "@/features/account/mfa/lib/backup-codes-download";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";
import { copy } from "@/shared/config/copy";

type BackupStatus = {
  enrolled: boolean;
  total: number;
  remaining: number;
  used: number;
};

type BackupCodesSettingsPanelProps = {
  mfaEnabled: boolean;
  backupStatus: BackupStatus;
  backupCodesLoading: boolean;
  backupCodesHydrated: boolean;
  storedBackupCodes: string[];
  onRefreshBackupCodes: () => Promise<void>;
  backupCodesRevealed: boolean;
  onBackupCodesRevealed: (revealed: boolean) => void;
};

export function BackupCodesSettingsPanel({
  mfaEnabled,
  backupStatus,
  backupCodesLoading,
  backupCodesHydrated,
  storedBackupCodes,
  onRefreshBackupCodes,
  backupCodesRevealed,
  onBackupCodesRevealed,
}: BackupCodesSettingsPanelProps) {
  const { user } = useAuth();
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [copiedBackup, setCopiedBackup] = useState(false);

  useEffect(() => {
    onBackupCodesRevealed(false);
  }, [user?.id, onBackupCodesRevealed]);

  if (!user || !mfaEnabled) return null;

  const canRevealStoredCodes = storedBackupCodes.length > 0;

  const handleCopyBackupCodes = async () => {
    if (!storedBackupCodes.length) return;
    await navigator.clipboard.writeText(storedBackupCodes.join("\n"));
    setCopiedBackup(true);
    window.setTimeout(() => setCopiedBackup(false), 2000);
  };

  const backupUsagePercent =
    backupStatus.total > 0
      ? Math.round((backupStatus.remaining / backupStatus.total) * 100)
      : 0;

  const backupTone =
    backupUsagePercent > 50 ? "success" : backupUsagePercent > 20 ? "warning" : "destructive";

  const showBackupSkeleton = backupCodesLoading && !backupCodesHydrated;

  const backupBody =
    canRevealStoredCodes && backupCodesRevealed ? (
      <div className="grid grid-cols-2 gap-2 font-mono text-compact sm:grid-cols-3">
        {storedBackupCodes.map((code) => (
          <span
            key={code}
            className="rounded-[var(--radius-control)] border border-border bg-muted/15 px-2.5 py-2 text-center"
          >
            {code}
          </span>
        ))}
      </div>
    ) : !canRevealStoredCodes ? (
      <p className="text-caption leading-relaxed text-muted-foreground">
        {copy.settings.backupCodesMissingHint}
      </p>
    ) : null;

  return (
    <>
      <SecurityFeatureCard
        title={copy.settings.backupCodesTitle}
        description={copy.settings.backupCodesDescription}
        icon={KeyRound}
        tone={backupTone === "success" ? "success" : "muted"}
        hideDivider
        badge={
          showBackupSkeleton ? (
            <Skeleton className="h-5 w-28 rounded-full" />
          ) : (
            <StatusBadge variant={backupTone} showIcon={false}>
              {copy.settings.backupCodesRemaining(backupStatus.remaining, backupStatus.total)}
            </StatusBadge>
          )
        }
        actions={
          showBackupSkeleton ? undefined : (
          <div className="flex flex-wrap gap-2">
            {canRevealStoredCodes && backupCodesRevealed ? (
              <>
                <Button type="button" variant="outline" size="sm" onClick={() => void handleCopyBackupCodes()}>
                  {copiedBackup ? (
                    <>
                      <Check className="size-3.5 text-success" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" />
                      {copy.settings.copyCodes}
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => downloadBackupCodesJson(storedBackupCodes, user.email)}
                >
                  <Download className="size-3.5" />
                  {copy.mfa.enroll.downloadBackupCodesJson}
                </Button>
              </>
            ) : canRevealStoredCodes ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setAccessOpen(true)}>
                <Eye className="size-3.5" />
                {copy.mfa.backupAccess.reveal}
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={() => setRegenerateOpen(true)}>
              <KeyRound className="size-3.5" />
              {copy.settings.regenerateCodes}
            </Button>
          </div>
          )
        }
      >
        {showBackupSkeleton ? <SecurityFeatureCardSkeleton /> : backupBody}
      </SecurityFeatureCard>

      <MfaRegenerateBackupDialog
        open={regenerateOpen}
        onOpenChange={setRegenerateOpen}
        onCompleted={async () => {
          await onRefreshBackupCodes();
          onBackupCodesRevealed(true);
        }}
      />
      <MfaBackupCodesAccessDialog
        open={accessOpen}
        onOpenChange={setAccessOpen}
        pinEnrolled={user.pin_enrolled}
        onVerified={() => onBackupCodesRevealed(true)}
      />
    </>
  );
}

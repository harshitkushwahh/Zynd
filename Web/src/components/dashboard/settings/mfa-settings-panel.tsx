"use client";

import { Check, Copy, Download, Eye, KeyRound, RefreshCw, ShieldCheck, ShieldOff } from "lucide-react";
import { useEffect, useState } from "react";

import {
  MfaBackupCodesAccessDialog,
  MfaDisableDialog,
  MfaEnrollDialog,
  MfaRegenerateBackupDialog,
  MfaResetDialog,
} from "@/features/account/mfa";
import { SecurityMethodsSummary } from "@/features/account/mfa/components/security-methods-summary";
import { downloadBackupCodesJson } from "@/features/account/mfa/lib/backup-codes-download";
import { MfaPanelSkeleton } from "@/components/dashboard/settings/settings-skeleton";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/contexts/auth-context";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type BackupStatus = {
  enrolled: boolean;
  total: number;
  remaining: number;
  used: number;
};

type MfaSettingsPanelProps = {
  backupStatus: BackupStatus;
  backupCodesLoading: boolean;
  storedBackupCodes: string[];
  onRefreshBackupCodes: () => Promise<void>;
  autoOpenEnroll?: boolean;
  onAutoOpenEnrollHandled?: () => void;
};

function formatEnrolledDate(value: string | null) {
  if (!value) return "Your Account";
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function MfaSettingsPanel({
  backupStatus,
  backupCodesLoading,
  storedBackupCodes,
  onRefreshBackupCodes,
  autoOpenEnroll = false,
  onAutoOpenEnrollHandled,
}: MfaSettingsPanelProps) {
  const { user, refreshUser } = useAuth();
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [backupCodesRevealed, setBackupCodesRevealed] = useState(false);
  const [copiedBackup, setCopiedBackup] = useState(false);

  const mfaEnabled = Boolean(user?.mfa_enrolled);

  useEffect(() => {
    setBackupCodesRevealed(false);
  }, [storedBackupCodes.length, user?.id]);

  useEffect(() => {
    if (!autoOpenEnroll || mfaEnabled) return;
    setEnrollOpen(true);
    onAutoOpenEnrollHandled?.();
  }, [autoOpenEnroll, mfaEnabled, onAutoOpenEnrollHandled]);

  if (!user) return null;

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

  const panelBody = backupCodesLoading ? (
    <MfaPanelSkeleton />
  ) : (
    <div className="space-y-6">
      <SecurityMethodsSummary phoneVerified={Boolean(user.phone_verified_at)} />

      <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-card)]",
              mfaEnabled ? "bg-success/10 text-success" : "bg-muted text-muted-foreground",
            )}
          >
            <ShieldCheck className="size-5" />
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-compact font-semibold text-foreground">
                {mfaEnabled ? copy.settings.mfaActiveTitle : copy.settings.mfaInactiveTitle}
              </p>
              <StatusBadge variant={mfaEnabled ? "success" : "neutral"}>
                {mfaEnabled ? copy.settings.mfaEnabledBadge : copy.settings.mfaNotSetUpBadge}
              </StatusBadge>
            </div>
            <p className="text-caption text-muted-foreground">
              {mfaEnabled
                ? copy.settings.mfaEnrolledOn(formatEnrolledDate(user.mfa_enrolled_at))
                : copy.settings.mfaEnableHint}
            </p>
          </div>
        </div>

        {mfaEnabled ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setResetOpen(true)}>
              <RefreshCw className="size-3.5" />
              {copy.settings.changeAuthenticator}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDisableOpen(true)}>
              <ShieldOff className="size-3.5" />
              {copy.settings.disableMfa}
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={() => setEnrollOpen(true)}>
            <ShieldCheck className="size-3.5" />
            {copy.mfa.setupButton}
          </Button>
        )}
      </div>

      {mfaEnabled ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-compact font-semibold text-foreground">{copy.settings.backupCodesTitle}</p>
                <StatusBadge variant={backupTone}>
                  {copy.settings.backupCodesRemaining(backupStatus.remaining, backupStatus.total)}
                </StatusBadge>
              </div>
              <p className="text-caption text-muted-foreground">
                {copy.settings.backupCodesDescription}
              </p>
            </div>

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
          </div>

          <div className="h-1.5 overflow-hidden rounded-[var(--radius-full)] bg-muted">
            <div
              className={cn(
                "h-full rounded-[var(--radius-full)] transition-all",
                backupTone === "success" && "bg-success",
                backupTone === "warning" && "bg-warning",
                backupTone === "destructive" && "bg-destructive",
              )}
              style={{ width: `${backupUsagePercent}%` }}
            />
          </div>

          {canRevealStoredCodes && backupCodesRevealed ? (
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
          ) : canRevealStoredCodes ? (
            <p className="text-caption leading-relaxed text-muted-foreground">
              {copy.mfa.backupAccess.hiddenHint}
            </p>
          ) : (
            <p className="text-caption leading-relaxed text-muted-foreground">
              {copy.settings.backupCodesMissingHint}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      {panelBody}

      <MfaEnrollDialog
        open={enrollOpen}
        onOpenChange={(open) => {
          setEnrollOpen(open);
          if (!open) {
            void refreshUser();
            void onRefreshBackupCodes();
          }
        }}
        onCompleted={() => {
          setBackupCodesRevealed(true);
        }}
      />
      <MfaResetDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        onCompleted={async () => {
          await refreshUser();
          await onRefreshBackupCodes();
          setBackupCodesRevealed(true);
        }}
      />
      <MfaRegenerateBackupDialog
        open={regenerateOpen}
        onOpenChange={setRegenerateOpen}
        onCompleted={async () => {
          await onRefreshBackupCodes();
          setBackupCodesRevealed(true);
        }}
      />
      <MfaDisableDialog
        open={disableOpen}
        onOpenChange={setDisableOpen}
        userId={user.id}
        onCompleted={async () => {
          setBackupCodesRevealed(false);
          await refreshUser();
          await onRefreshBackupCodes();
        }}
      />
      <MfaBackupCodesAccessDialog
        open={accessOpen}
        onOpenChange={setAccessOpen}
        pinEnrolled={user.pin_enrolled}
        onVerified={() => setBackupCodesRevealed(true)}
      />
    </>
  );
}

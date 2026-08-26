"use client";

import { RefreshCw, ShieldCheck, ShieldOff } from "lucide-react";
import { useEffect, useState } from "react";

import {
  MfaDisableDialog,
  MfaEnrollDialog,
  MfaResetDialog,
} from "@/features/account/mfa";
import { SecurityFeatureCard } from "@/components/dashboard/settings/security-feature-card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/contexts/auth-context";
import { copy } from "@/shared/config/copy";

type MfaSettingsPanelProps = {
  onRefreshBackupCodes: () => Promise<void>;
  autoOpenEnroll?: boolean;
  onAutoOpenEnrollHandled?: () => void;
  onEnrollCompleted?: () => void;
};

function formatEnrolledDate(value: string | null) {
  if (!value) return "Your Account";
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function MfaSettingsPanel({
  onRefreshBackupCodes,
  autoOpenEnroll = false,
  onAutoOpenEnrollHandled,
  onEnrollCompleted,
}: MfaSettingsPanelProps) {
  const { user, refreshUser } = useAuth();
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);

  const mfaEnabled = Boolean(user?.mfa_enrolled);

  useEffect(() => {
    if (!autoOpenEnroll || mfaEnabled) return;
    setEnrollOpen(true);
    onAutoOpenEnrollHandled?.();
  }, [autoOpenEnroll, mfaEnabled, onAutoOpenEnrollHandled]);

  if (!user) return null;

  return (
    <>
      <SecurityFeatureCard
        title={copy.settings.mfaTitle}
        description={
          mfaEnabled
            ? copy.settings.mfaEnrolledOn(formatEnrolledDate(user.mfa_enrolled_at))
            : copy.settings.mfaEnableHint
        }
        icon={ShieldCheck}
        tone={mfaEnabled ? "success" : "muted"}
        badge={
          <StatusBadge variant={mfaEnabled ? "success" : "neutral"} showIcon={false}>
            {mfaEnabled ? copy.settings.mfaEnabledBadge : copy.settings.mfaNotSetUpBadge}
          </StatusBadge>
        }
        actions={
          mfaEnabled ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setResetOpen(true)}>
                <RefreshCw className="size-3.5" />
                {copy.settings.changeAuthenticator}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setDisableOpen(true)}>
                <ShieldOff className="size-3.5" />
                {copy.settings.disableMfa}
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => setEnrollOpen(true)}>
              <ShieldCheck className="size-3.5" />
              {copy.mfa.setupButton}
            </Button>
          )
        }
      />

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
          onEnrollCompleted?.();
        }}
      />
      <MfaResetDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        onCompleted={async () => {
          await refreshUser();
          await onRefreshBackupCodes();
          onEnrollCompleted?.();
        }}
      />
      <MfaDisableDialog
        open={disableOpen}
        onOpenChange={setDisableOpen}
        userId={user.id}
        onCompleted={async () => {
          await refreshUser();
          await onRefreshBackupCodes();
        }}
      />
    </>
  );
}

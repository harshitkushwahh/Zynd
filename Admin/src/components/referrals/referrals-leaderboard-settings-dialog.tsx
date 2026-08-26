"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Settings2 } from "lucide-react";

import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminFormDialog, AdminDialogFooterActions } from "@/components/ui/admin-dialog-presets";
import { AdminSelect, type AdminSelectOption } from "@/components/ui/admin-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import {
  fetchAdminReferralLeaderboardConfig,
  fetchAdminReferralProgramSettings,
  updateAdminReferralLeaderboardConfig,
  updateAdminReferralProgramSettings,
  type AdminReferralLeaderboardConfig,
  type AdminReferralProgramSettings,
} from "@/lib/referrals-admin-api";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "ranking", label: "Ranking" },
  { id: "tiebreak", label: "Tie-break" },
  { id: "rules", label: "Rules" },
] as const;

type SettingsStep = (typeof STEPS)[number]["id"];

const PRIMARY_METRIC_OPTIONS: AdminSelectOption[] = [
  { value: "signup_count", label: "Signup count" },
  { value: "kyc_verified_count", label: "KYC verified" },
  { value: "first_investment_count", label: "First investment" },
  { value: "qualified_count", label: "Qualified referrals" },
];

const TIE_BREAKER_OPTIONS: AdminSelectOption[] = [
  { value: "earnings_inr_desc", label: "Higher earnings" },
  { value: "referral_count_desc", label: "Higher referral count" },
  { value: "earliest_referral_asc", label: "Earliest referral" },
];

const PERIOD_FIELD_OPTIONS: AdminSelectOption[] = [
  { value: "signed_up_at", label: "Signup date" },
  { value: "first_investment_at", label: "First investment date" },
  { value: "qualified_at", label: "Qualification date" },
];

function formatRetentionDays(days: number) {
  if (days % 30 === 0 && days >= 30) {
    const months = days / 30;
    return months === 1 ? "1 month" : `${months} months`;
  }
  return `${days} days`;
}

type ReferralsLeaderboardSettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
};

export function ReferralsLeaderboardSettingsDialog({
  open,
  onOpenChange,
  onSaved,
}: ReferralsLeaderboardSettingsDialogProps) {
  const { hasPermission } = useAdminAuth();
  const canManage = hasPermission("referrals.manage");
  const [step, setStep] = useState<SettingsStep>("ranking");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [leaderboardConfig, setLeaderboardConfig] = useState<AdminReferralLeaderboardConfig | null>(null);
  const [programSettings, setProgramSettings] = useState<AdminReferralProgramSettings | null>(null);

  const stepIndex = STEPS.findIndex((item) => item.id === step);
  const isLastStep = stepIndex === STEPS.length - 1;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [config, settings] = await Promise.all([
        fetchAdminReferralLeaderboardConfig(),
        fetchAdminReferralProgramSettings(),
      ]);
      setLeaderboardConfig(config);
      setProgramSettings(settings);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load settings."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setStep("ranking");
    void load();
  }, [load, open]);

  const handleSave = async () => {
    if (!leaderboardConfig || !programSettings || !canManage) return;
    setSaving(true);
    setError("");
    try {
      await Promise.all([
        updateAdminReferralLeaderboardConfig({
          primary_metric: leaderboardConfig.primary_metric,
          tie_breaker_1: leaderboardConfig.tie_breaker_1,
          tie_breaker_2: leaderboardConfig.tie_breaker_2,
          period_field: leaderboardConfig.period_field,
          auto_snapshot_enabled: leaderboardConfig.auto_snapshot_enabled,
        }),
        updateAdminReferralProgramSettings({
          min_referrals_to_redeem: programSettings.min_referrals_to_redeem,
          lumpsum_retention_days: programSettings.lumpsum_retention_days,
          default_qualification_hold_days: programSettings.default_qualification_hold_days,
          min_first_investment_inr: programSettings.min_first_investment_inr,
          timezone: programSettings.timezone,
        }),
      ]);
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err, "Could not save settings."));
    } finally {
      setSaving(false);
    }
  };

  const stepDescription = useMemo(() => {
    if (step === "ranking") return "Choose what counts toward the monthly score.";
    if (step === "tiebreak") return "Set how equal scores are ordered.";
    return "Set qualification and redemption gates.";
  }, [step]);

  return (
    <AdminFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Leaderboard settings"
      description={stepDescription}
      icon={Settings2}
      size="sm"
      footer={
        <AdminDialogFooterActions
          cancelLabel={stepIndex === 0 ? "Cancel" : "Back"}
          confirmLabel={isLastStep ? "Save" : "Continue"}
          loading={saving}
          confirmDisabled={loading || !leaderboardConfig || !programSettings || !canManage}
          onCancel={() => {
            if (stepIndex === 0) {
              onOpenChange(false);
              return;
            }
            setStep(STEPS[stepIndex - 1].id);
          }}
          onConfirm={() => {
            if (isLastStep) {
              void handleSave();
              return;
            }
            setStep(STEPS[stepIndex + 1].id);
          }}
          loadingLabel="Saving…"
        />
      }
    >
      {error ? (
        <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>
          {error}
        </AdminFeedbackMessage>
      ) : null}

      <div className="flex items-center gap-2 pb-1 text-caption text-muted-foreground">
        {STEPS.map((item, index) => (
          <span key={item.id} className="flex items-center gap-2">
            {index > 0 ? <span aria-hidden="true" className="text-border">/</span> : null}
            <span className={cn("tabular-nums", item.id === step && "font-medium text-foreground")}>
              {item.label}
            </span>
          </span>
        ))}
      </div>

      {loading || !leaderboardConfig || !programSettings ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : step === "ranking" ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Rank by</Label>
            <AdminSelect
              value={leaderboardConfig.primary_metric}
              onValueChange={(value) =>
                setLeaderboardConfig((prev) =>
                  prev
                    ? {
                        ...prev,
                        primary_metric: value as AdminReferralLeaderboardConfig["primary_metric"],
                      }
                    : prev,
                )
              }
              options={PRIMARY_METRIC_OPTIONS}
              disabled={!canManage}
            />
          </div>
          <div className="space-y-2">
            <Label>Within each month, count by</Label>
            <AdminSelect
              value={leaderboardConfig.period_field}
              onValueChange={(value) =>
                setLeaderboardConfig((prev) =>
                  prev
                    ? { ...prev, period_field: value as AdminReferralLeaderboardConfig["period_field"] }
                    : prev,
                )
              }
              options={PERIOD_FIELD_OPTIONS}
              disabled={!canManage}
            />
          </div>
        </div>
      ) : step === "tiebreak" ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>First tie-break</Label>
            <AdminSelect
              value={leaderboardConfig.tie_breaker_1}
              onValueChange={(value) =>
                setLeaderboardConfig((prev) =>
                  prev
                    ? { ...prev, tie_breaker_1: value as AdminReferralLeaderboardConfig["tie_breaker_1"] }
                    : prev,
                )
              }
              options={TIE_BREAKER_OPTIONS}
              disabled={!canManage}
            />
          </div>
          <div className="space-y-2">
            <Label>Second tie-break</Label>
            <AdminSelect
              value={leaderboardConfig.tie_breaker_2}
              onValueChange={(value) =>
                setLeaderboardConfig((prev) =>
                  prev
                    ? { ...prev, tie_breaker_2: value as AdminReferralLeaderboardConfig["tie_breaker_2"] }
                    : prev,
                )
              }
              options={TIE_BREAKER_OPTIONS}
              disabled={!canManage}
            />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Auto snapshot past months</p>
              <p className="text-caption text-muted-foreground">Freeze completed months when saved.</p>
            </div>
            <Switch
              checked={leaderboardConfig.auto_snapshot_enabled}
              onCheckedChange={(checked) =>
                setLeaderboardConfig((prev) => (prev ? { ...prev, auto_snapshot_enabled: checked } : prev))
              }
              disabled={!canManage}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="min-referrals">Min qualified referrals to redeem</Label>
            <Input
              id="min-referrals"
              type="number"
              min={1}
              value={programSettings.min_referrals_to_redeem}
              onChange={(event) =>
                setProgramSettings((prev) =>
                  prev
                    ? { ...prev, min_referrals_to_redeem: Number(event.target.value) || 0 }
                    : prev,
                )
              }
              disabled={!canManage}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lumpsum-retention">Lumpsum retention (days)</Label>
            <Input
              id="lumpsum-retention"
              type="number"
              min={1}
              value={programSettings.lumpsum_retention_days}
              onChange={(event) =>
                setProgramSettings((prev) =>
                  prev
                    ? { ...prev, lumpsum_retention_days: Number(event.target.value) || 0 }
                    : prev,
                )
              }
              disabled={!canManage}
            />
            <p className="text-caption text-muted-foreground">
              {formatRetentionDays(programSettings.lumpsum_retention_days)} hold for lumpsum MF investments.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="default-hold">Other investments (days)</Label>
              <Input
                id="default-hold"
                type="number"
                min={1}
                value={programSettings.default_qualification_hold_days}
                onChange={(event) =>
                  setProgramSettings((prev) =>
                    prev
                      ? { ...prev, default_qualification_hold_days: Number(event.target.value) || 0 }
                      : prev,
                  )
                }
                disabled={!canManage}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="min-investment">Min first investment (INR)</Label>
              <Input
                id="min-investment"
                type="number"
                min={1}
                value={programSettings.min_first_investment_inr}
                onChange={(event) =>
                  setProgramSettings((prev) =>
                    prev
                      ? { ...prev, min_first_investment_inr: Number(event.target.value) || 0 }
                      : prev,
                  )
                }
                disabled={!canManage}
              />
            </div>
          </div>
        </div>
      )}
    </AdminFormDialog>
  );
}

"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Building2, FileText, Info, Pencil, ShieldCheck } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";

import { AdminSectionTitle } from "@/components/dashboard/admin-section-title";
import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import {
  AdminFormDialog,
  AdminInfoDialog,
} from "@/components/ui/admin-dialog-presets";
import { AdminMetricCard } from "@/components/ui/admin-metric-card";
import { AdminMetricCardsGrid } from "@/components/ui/admin-metric-cards-grid";
import { AdminFormSkeleton } from "@/components/ui/admin-skeletons";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fetchMfComplianceSettings,
  updateMfComplianceSettings,
  type MfComplianceSettings,
} from "@/lib/mf-admin-api";

function formatSourceLabel(source: string) {
  return source.replaceAll("_", " ");
}

function ComplianceInfoDialog({
  open,
  onClose,
  settings,
}: {
  open: boolean;
  onClose: () => void;
  settings: MfComplianceSettings;
}) {
  return (
    <AdminInfoDialog
      open={open}
      onClose={onClose}
      title="Compliance settings"
      description="How global disclaimers and distributor identifiers are used."
      icon={ShieldCheck}
      iconTone="info"
    >
      <p className="text-compact text-muted-foreground">
        These values are shown on fund detail pages and invest configuration across the platform.
      </p>
      <dl className="space-y-3 text-compact">
        <div className="flex items-start justify-between gap-4">
          <dt className="text-muted-foreground">Last updated</dt>
          <dd className="font-medium text-foreground">
            {settings.updated_at ? new Date(settings.updated_at).toLocaleString() : "—"}
          </dd>
        </div>
        <div className="flex items-start justify-between gap-4">
          <dt className="text-muted-foreground">Disclaimer source</dt>
          <dd className="font-medium text-foreground">
            {formatSourceLabel(settings.source.default_disclaimer)}
          </dd>
        </div>
        <div className="flex items-start justify-between gap-4">
          <dt className="text-muted-foreground">ARN source</dt>
          <dd className="font-medium text-foreground">
            {formatSourceLabel(settings.source.distributor_arn)}
          </dd>
        </div>
        <div className="flex items-start justify-between gap-4">
          <dt className="text-muted-foreground">EUIN source</dt>
          <dd className="font-medium text-foreground">
            {formatSourceLabel(settings.source.distributor_euin)}
          </dd>
        </div>
      </dl>
    </AdminInfoDialog>
  );
}

function ComplianceEditDialog({
  open,
  disclaimer,
  arn,
  euin,
  saving,
  onDisclaimerChange,
  onArnChange,
  onEuinChange,
  onSave,
  onReset,
  onClose,
}: {
  open: boolean;
  disclaimer: string;
  arn: string;
  euin: string;
  saving?: boolean;
  onDisclaimerChange: (value: string) => void;
  onArnChange: (value: string) => void;
  onEuinChange: (value: string) => void;
  onSave: () => void;
  onReset: () => void;
  onClose: () => void;
}) {
  return (
    <AdminFormDialog
      open={open}
      onClose={onClose}
      title="Edit compliance settings"
      description="These values appear on fund detail pages and invest configuration across the platform."
      icon={Pencil}
      iconTone="info"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="outline" onClick={onReset} disabled={saving}>
            Use config defaults
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="mf-edit-disclaimer">Default disclaimer</Label>
          <textarea
            id="mf-edit-disclaimer"
            className="min-h-field-lg w-full rounded-control border border-input bg-transparent px-3 py-2 text-compact leading-relaxed"
            value={disclaimer}
            onChange={(event) => onDisclaimerChange(event.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="mf-edit-arn">Distributor ARN</Label>
            <Input
              id="mf-edit-arn"
              placeholder="ARN-…"
              value={arn}
              onChange={(event) => onArnChange(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mf-edit-euin">EUIN</Label>
            <Input
              id="mf-edit-euin"
              placeholder="E…"
              value={euin}
              onChange={(event) => onEuinChange(event.target.value)}
            />
          </div>
        </div>
      </div>
    </AdminFormDialog>
  );
}

export type ComplianceSettingsPanelHandle = {
  openInfoDialog: () => void;
  openEditDialog: () => void;
  canOpenInfo: () => boolean;
};

export const ComplianceSettingsPanel = forwardRef<
  ComplianceSettingsPanelHandle,
  {
    canManage: boolean;
    embedded?: boolean;
  }
>(function ComplianceSettingsPanel({ canManage, embedded = false }, ref) {
  const [settings, setSettings] = useState<MfComplianceSettings | null>(null);
  const [disclaimer, setDisclaimer] = useState("");
  const [arn, setArn] = useState("");
  const [euin, setEuin] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);

  const syncForm = (data: MfComplianceSettings) => {
    setDisclaimer(data.default_disclaimer);
    setArn(data.distributor_arn ?? "");
    setEuin(data.distributor_euin ?? "");
  };

  useEffect(() => {
    fetchMfComplianceSettings()
      .then((data) => {
        setSettings(data);
        syncForm(data);
      })
      .catch((err) => setError(getErrorMessage(err, "Could not load compliance settings.")))
      .finally(() => setLoading(false));
  }, []);

  const closeEditDialog = () => {
    if (saving) return;
    if (settings) syncForm(settings);
    setEditDialogOpen(false);
  };

  const openEditDialog = () => {
    if (settings) syncForm(settings);
    setEditDialogOpen(true);
  };

  useImperativeHandle(
    ref,
    () => ({
      openInfoDialog: () => setInfoDialogOpen(true),
      openEditDialog,
      canOpenInfo: () => Boolean(settings),
    }),
    [settings],
  );

  const handleSave = async () => {
    if (!canManage) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const updated = await updateMfComplianceSettings({
        default_disclaimer: disclaimer,
        distributor_arn: arn,
        distributor_euin: euin,
      });
      setSettings(updated);
      syncForm(updated);
      setEditDialogOpen(false);
      setMessage("Compliance settings saved.");
    } catch (err) {
      setError(getErrorMessage(err, "Could not save compliance settings."));
    } finally {
      setSaving(false);
    }
  };

  const handleResetToConfig = async () => {
    if (!canManage) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const updated = await updateMfComplianceSettings({
        clear_default_disclaimer: true,
        clear_distributor_arn: true,
        clear_distributor_euin: true,
      });
      setSettings(updated);
      syncForm(updated);
      setEditDialogOpen(false);
      setMessage("Reverted to environment config defaults.");
    } catch (err) {
      setError(getErrorMessage(err, "Could not reset compliance settings."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <AdminFormSkeleton rows={5} />;
  }

  const content = (
    <div className="space-y-5">
      {error ? <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>{error}</AdminFeedbackMessage> : null}
      {message ? <AdminFeedbackMessage variant="success" onDismiss={() => setMessage("")}>{message}</AdminFeedbackMessage> : null}

      {!embedded ? (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="icon"
            disabled={!settings}
            onClick={() => setInfoDialogOpen(true)}
            aria-label="View compliance settings info"
          >
            <Info className="size-3.5" />
          </Button>
          {canManage ? (
            <Button size="sm" variant="outline" onClick={openEditDialog}>
              <Pencil className="size-3.5" />
              Edit settings
            </Button>
          ) : null}
        </div>
      ) : null}

      <AdminMetricCardsGrid>
        <AdminMetricCard
          label="Distributor ARN"
          value={settings?.distributor_arn?.trim() || "No data"}
          icon={Building2}
          tone={settings?.distributor_arn ? "info" : "muted"}
        />
        <AdminMetricCard
          label="EUIN"
          value={settings?.distributor_euin?.trim() || "No data"}
          icon={ShieldCheck}
          tone={settings?.distributor_euin ? "info" : "muted"}
        />
      </AdminMetricCardsGrid>

      <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-card">
        <div className="flex flex-wrap items-start gap-3 border-b border-border bg-muted/15 px-5 py-4">
          <AdminSectionTitle
            icon={FileText}
            variant="section"
            description="Global mutual fund risk disclaimer for the invest experience."
          >
            Default disclaimer
          </AdminSectionTitle>
        </div>
        <div className="px-5 py-5">
          <div className="rounded-[var(--radius-control)] border border-border/80 bg-muted/10 px-4 py-4">
            <p className="whitespace-pre-wrap border-l-2 border-primary/30 pl-4 text-compact leading-relaxed text-foreground">
              {settings?.default_disclaimer?.trim() || "No disclaimer configured."}
            </p>
          </div>
        </div>
      </div>

      {settings ? (
        <ComplianceInfoDialog
          open={infoDialogOpen}
          onClose={() => setInfoDialogOpen(false)}
          settings={settings}
        />
      ) : null}

      <ComplianceEditDialog
        open={editDialogOpen}
        disclaimer={disclaimer}
        arn={arn}
        euin={euin}
        saving={saving}
        onDisclaimerChange={setDisclaimer}
        onArnChange={setArn}
        onEuinChange={setEuin}
        onSave={() => void handleSave()}
        onReset={() => void handleResetToConfig()}
        onClose={closeEditDialog}
      />
    </div>
  );

  if (embedded) return content;

  return (
    <Card className="mt-0">
      <CardHeader>
        <CardTitle>Compliance & disclaimers</CardTitle>
        <CardDescription>
          Global MF disclaimer and distributor identifiers shown on fund detail and invest config.
        </CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
});

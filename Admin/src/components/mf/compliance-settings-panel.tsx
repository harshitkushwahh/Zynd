"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import {
  fetchMfComplianceSettings,
  updateMfComplianceSettings,
  type MfComplianceSettings,
} from "@/lib/mf-admin-api";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

export function ComplianceSettingsPanel({ canManage }: { canManage: boolean }) {
  const [settings, setSettings] = useState<MfComplianceSettings | null>(null);
  const [disclaimer, setDisclaimer] = useState("");
  const [arn, setArn] = useState("");
  const [euin, setEuin] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchMfComplianceSettings()
      .then((data) => {
        setSettings(data);
        setDisclaimer(data.default_disclaimer);
        setArn(data.distributor_arn ?? "");
        setEuin(data.distributor_euin ?? "");
      })
      .catch((err) => setError(getErrorMessage(err, "Could not load compliance settings.")))
      .finally(() => setLoading(false));
  }, []);

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
      setDisclaimer(updated.default_disclaimer);
      setArn(updated.distributor_arn ?? "");
      setEuin(updated.distributor_euin ?? "");
      setMessage("Reverted to environment config defaults.");
    } catch (err) {
      setError(getErrorMessage(err, "Could not reset compliance settings."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-compact text-muted-foreground">Loading compliance settings…</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compliance & disclaimers</CardTitle>
        <CardDescription>
          Global MF disclaimer and distributor identifiers shown on fund detail and invest config.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <p className="text-compact text-destructive">{error}</p> : null}
        {message ? <p className="text-compact text-success">{message}</p> : null}
        <label className="block space-y-1 text-compact">
          <span className="text-muted-foreground">Default disclaimer</span>
          <textarea
            className="min-h-[120px] w-full rounded-[var(--radius-control)] border border-input bg-transparent px-2.5 py-2 text-compact"
            value={disclaimer}
            onChange={(event) => setDisclaimer(event.target.value)}
            disabled={!canManage}
          />
          {settings ? (
            <span className="text-caption text-muted-foreground">
              Source: {settings.source.default_disclaimer}
            </span>
          ) : null}
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-compact">
            <span className="text-muted-foreground">Distributor ARN</span>
            <Input value={arn} onChange={(event) => setArn(event.target.value)} disabled={!canManage} />
          </label>
          <label className="space-y-1 text-compact">
            <span className="text-muted-foreground">EUIN</span>
            <Input value={euin} onChange={(event) => setEuin(event.target.value)} disabled={!canManage} />
          </label>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={saving} onClick={() => void handleSave()}>
              {saving ? "Saving…" : "Save settings"}
            </Button>
            <Button size="sm" variant="outline" disabled={saving} onClick={() => void handleResetToConfig()}>
              Use config defaults
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

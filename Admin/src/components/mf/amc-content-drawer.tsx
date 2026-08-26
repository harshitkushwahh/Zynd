"use client";

import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";

import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminFormSkeleton } from "@/components/ui/admin-skeletons";
import { AdminDrawer } from "@/components/ui/admin-drawer";
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
  fetchMfAmcContent,
  updateMfAmcContent,
  type MfAmcContent,
} from "@/lib/mf-admin-api";


export function AmcContentDrawer({
  amcId,
  amcName,
  canManage,
  onClose,
}: {
  amcId: number;
  amcName: string;
  canManage: boolean;
  onClose: () => void;
}) {
  const [content, setContent] = useState<MfAmcContent | null>(null);
  const [marketingName, setMarketingName] = useState("");
  const [description, setDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchMfAmcContent(amcId)
      .then((data) => {
        setContent(data);
        setMarketingName(data.content.marketing_name ?? "");
        setDescription(data.content.description ?? "");
        setWebsiteUrl(data.content.website_url ?? "");
      })
      .catch((err) => setError(getErrorMessage(err, "Could not load AMC content.")))
      .finally(() => setLoading(false));
  }, [amcId]);

  const handleSave = async () => {
    if (!canManage) return;
    setSaving(true);
    setError("");
    try {
      const updated = await updateMfAmcContent(amcId, {
        marketing_name: marketingName,
        description,
        website_url: websiteUrl,
      });
      setContent(updated);
    } catch (err) {
      setError(getErrorMessage(err, "Could not save AMC content."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminDrawer
      open
      onClose={onClose}
      subtitle="AMC content"
      title={amcName}
      icon={Building2}
      size="lg"
    >
      {loading ? (
        <AdminFormSkeleton rows={4} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Marketing profile</CardTitle>
            <CardDescription>Shown on fund detail via invest API merge.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {error ? <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>{error}</AdminFeedbackMessage> : null}
            <label className="block space-y-1 text-compact">
              <span className="text-muted-foreground">Marketing name</span>
              <Input value={marketingName} onChange={(e) => setMarketingName(e.target.value)} disabled={!canManage} />
            </label>
            <label className="block space-y-1 text-compact">
              <span className="text-muted-foreground">Description</span>
              <textarea
                className="min-h-field-md w-full rounded-control border border-input bg-transparent px-2.5 py-2 text-compact"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={!canManage}
              />
            </label>
            <label className="block space-y-1 text-compact">
              <span className="text-muted-foreground">Website URL</span>
              <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} disabled={!canManage} />
            </label>
            {content?.content.updated_at ? (
              <p className="text-caption text-muted-foreground">
                Updated {new Date(content.content.updated_at).toLocaleString()}
              </p>
            ) : null}
            {canManage ? (
              <Button size="sm" disabled={saving} onClick={() => void handleSave()}>
                {saving ? "Saving…" : "Save AMC content"}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      )}
    </AdminDrawer>
  );
}

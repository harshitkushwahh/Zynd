"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Building2, Plug } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";

import { AdminFeedbackMessage } from "@/components/ui/admin-feedback-message";
import { AdminCardListSkeleton } from "@/components/ui/admin-skeletons";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { AdminTabList, AdminTabTrigger } from "@/components/ui/admin-tab-bar";
import { useAdminAuth } from "@/contexts/admin-auth-context";
import {
  MF_INTEGRATION_PROVIDERS,
  ZYND_LOGS_HREF,
} from "@/lib/admin-settings-navigation";
import {
  fetchMfIntegrations,
  fetchZyndCompanySettings,
  updateMfIntegrationEnvironment,
  updateZyndCompanySettings,
  type IntegrationEnvironment,
  type MfIntegrationProfilePreview,
  type MfIntegrationProviderStatus,
  type ZyndCompanySettings,
} from "@/lib/mf-integrations-admin-api";
import { cn } from "@/lib/utils";

const INTEGRATION_CARD_GRID_CLASS = "grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2";
const INTEGRATION_CARD_CLASS = "w-full min-w-0 border border-border ring-0 shadow-none";

function environmentLabel(environment: IntegrationEnvironment) {
  return environment === "live" ? "Live" : "Test";
}

function activeEnvironmentStatus(provider: MfIntegrationProviderStatus) {
  const environment = environmentLabel(provider.active_environment);
  if (provider.active_configured) {
    return {
      label: `${environment} · Ready`,
      variant: "success" as const,
    };
  }

  return {
    label: `${environment} · Incomplete`,
    variant: "warning" as const,
  };
}

function EnvironmentTabTrigger({
  environment,
  activeEnvironment,
  disabled,
}: {
  environment: IntegrationEnvironment;
  activeEnvironment: IntegrationEnvironment;
  disabled?: boolean;
}) {
  const isRuntimeActive = environment === activeEnvironment;

  return (
    <AdminTabTrigger value={environment} disabled={disabled}>
      <span className="flex items-center gap-1.5">
        {environmentLabel(environment)}
        {isRuntimeActive ? (
          <span
            className="size-1.5 rounded-full bg-success"
            aria-label="Runtime environment"
          />
        ) : null}
      </span>
    </AdminTabTrigger>
  );
}

function CredentialField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value?: string;
  mono?: boolean;
}) {
  const display = value?.trim() || "—";
  return (
    <div className="grid gap-0.5 sm:grid-cols-label-value sm:items-baseline">
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className={cn("break-all text-caption text-foreground", mono && "font-mono")}>{display}</dd>
    </div>
  );
}

function ProfileCredentialDetails({
  providerId,
  profile,
}: {
  providerId: MfIntegrationProviderStatus["id"];
  profile: MfIntegrationProfilePreview;
}) {
  if (!profile.configured) {
    return (
      <div className="rounded-[var(--radius-control)] border border-dashed border-border bg-muted/10 px-3 py-4">
        <p className="text-caption text-muted-foreground">Not configured in .env for this mode.</p>
      </div>
    );
  }

  if (providerId === "kyckart") {
    return (
      <dl className="space-y-2 rounded-[var(--radius-control)] border border-border bg-muted/10 px-3 py-3">
        <CredentialField label="Base URL" value={profile.base_url} />
        <CredentialField label="API key" value={profile.api_key_masked} mono />
      </dl>
    );
  }

  return (
    <dl className="space-y-2 rounded-[var(--radius-control)] border border-border bg-muted/10 px-3 py-3">
      <CredentialField label="Base URL" value={profile.base_url} />
      {providerId === "cybrilla" && profile.token_base_url ? (
        <CredentialField label="Token URL" value={profile.token_base_url} />
      ) : null}
      <CredentialField label="Tenant" value={profile.tenant} />
      <CredentialField label="Client ID" value={profile.client_id_masked} mono />
      <CredentialField label="Client secret" value={profile.client_secret_masked} mono />
      {providerId === "finprim" && profile.webhook_secret_masked ? (
        <CredentialField label="Webhook secret" value={profile.webhook_secret_masked} mono />
      ) : null}
    </dl>
  );
}

function IntegrationProviderCard({
  provider,
  meta,
  canManage,
  isSwitching,
  onEnvironmentChange,
}: {
  provider: MfIntegrationProviderStatus;
  meta?: (typeof MF_INTEGRATION_PROVIDERS)[number];
  canManage: boolean;
  isSwitching: boolean;
  onEnvironmentChange: (
    providerId: MfIntegrationProviderStatus["id"],
    environment: IntegrationEnvironment,
  ) => Promise<void>;
}) {
  const [viewEnvironment, setViewEnvironment] = useState<IntegrationEnvironment>(
    provider.active_environment,
  );

  useEffect(() => {
    setViewEnvironment(provider.active_environment);
  }, [provider.active_environment]);

  const viewedProfile = provider.profiles[viewEnvironment];
  const isViewingActive = viewEnvironment === provider.active_environment;
  const runtimeStatus = activeEnvironmentStatus(provider);

  const handleEnvironmentSelect = (environment: IntegrationEnvironment) => {
    setViewEnvironment(environment);
  };

  return (
    <Tabs
      value={viewEnvironment}
      onValueChange={(value) => handleEnvironmentSelect(value as IntegrationEnvironment)}
    >
      <Card className={cn("h-full", INTEGRATION_CARD_CLASS)}>
        <CardHeader className="gap-4 border-b border-border pb-4">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-card)] bg-primary/10 text-primary">
                  <Plug className="size-5" />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <CardTitle className="text-base">{meta?.label ?? provider.id}</CardTitle>
                  <StatusBadge variant={runtimeStatus.variant} showIcon={false}>
                    {runtimeStatus.label}
                  </StatusBadge>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                <AdminTabList aria-label={`${meta?.label ?? provider.id} environment`}>
                  <EnvironmentTabTrigger
                    environment="test"
                    activeEnvironment={provider.active_environment}
                    disabled={isSwitching}
                  />
                  <EnvironmentTabTrigger
                    environment="live"
                    activeEnvironment={provider.active_environment}
                    disabled={isSwitching}
                  />
                </AdminTabList>
                <Link
                  href={`${ZYND_LOGS_HREF}?provider=${meta?.logsFilter ?? provider.id}`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
                >
                  View logs
                  <ArrowUpRight className="size-3.5" />
                </Link>
              </div>
            </div>

            <CardDescription className="text-pretty">
              {meta?.description ?? "Provider integration"}
            </CardDescription>
            {provider.notes.map((note) => (
              <p key={note} className="text-pretty text-caption text-muted-foreground">
                {note}
              </p>
            ))}
          </div>
        </CardHeader>

        <CardContent className="space-y-3 pt-4">
          {!isViewingActive ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-control)] border border-border bg-muted/15 px-3 py-2">
              <StatusBadge variant="neutral" showIcon={false}>
                Preview · {environmentLabel(viewEnvironment)}
              </StatusBadge>
              {canManage ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isSwitching}
                  onClick={() => void onEnvironmentChange(provider.id, viewEnvironment)}
                >
                  {isSwitching ? "Switching…" : `Use ${environmentLabel(viewEnvironment)}`}
                </Button>
              ) : null}
            </div>
          ) : !viewedProfile.configured ? (
            <StatusBadge variant="warning" showIcon={false}>
              {environmentLabel(viewEnvironment)} · Not configured
            </StatusBadge>
          ) : null}

          {(["test", "live"] as const).map((environment) => (
            <TabsContent key={environment} value={environment} className="mt-0">
              <ProfileCredentialDetails
                providerId={provider.id}
                profile={provider.profiles[environment]}
              />
            </TabsContent>
          ))}
        </CardContent>
      </Card>
    </Tabs>
  );
}

function ZyndCompanyDetailsCard({
  settings,
  loading,
  saving,
  canManage,
  onSave,
}: {
  settings: ZyndCompanySettings | null;
  loading: boolean;
  saving: boolean;
  canManage: boolean;
  onSave: (payload: { distributor_arn: string; distributor_euin: string }) => Promise<void>;
}) {
  const [arn, setArn] = useState("");
  const [euin, setEuin] = useState("");

  useEffect(() => {
    setArn(settings?.distributor_arn ?? "");
    setEuin(settings?.distributor_euin ?? "");
  }, [settings?.distributor_arn, settings?.distributor_euin]);

  const arnConfigured = Boolean(settings?.distributor_arn?.trim());

  return (
    <Card className={INTEGRATION_CARD_CLASS}>
      <CardHeader className="gap-4 border-b border-border pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-card)] bg-primary/10 text-primary">
              <Building2 className="size-5" />
            </div>
            <div className="min-w-0 space-y-1.5">
              <CardTitle className="text-base">Zynd company details</CardTitle>
              <StatusBadge variant={arnConfigured ? "success" : "warning"} showIcon={false}>
                {arnConfigured ? "Distributor ARN configured" : "Distributor ARN required"}
              </StatusBadge>
            </div>
          </div>
        </div>
        <CardDescription className="text-pretty">
          Global distributor ARN for mutual fund orders and Zynd Mitra HO approvals. All Mitras operate under
          this company ARN.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {loading ? (
          <AdminCardListSkeleton count={1} lines={2} />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="zynd-company-arn">Distributor ARN</Label>
                <Input
                  id="zynd-company-arn"
                  placeholder="ARN-…"
                  value={arn}
                  disabled={!canManage || saving}
                  onChange={(event) => setArn(event.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zynd-company-euin">EUIN (optional)</Label>
                <Input
                  id="zynd-company-euin"
                  placeholder="EUIN"
                  value={euin}
                  disabled={!canManage || saving}
                  onChange={(event) => setEuin(event.target.value.toUpperCase())}
                />
              </div>
            </div>
            {canManage ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  disabled={saving || !arn.trim()}
                  onClick={() => void onSave({ distributor_arn: arn.trim(), distributor_euin: euin.trim() })}
                >
                  {saving ? "Saving…" : "Save company details"}
                </Button>
                {settings?.updated_at ? (
                  <p className="text-caption text-muted-foreground">
                    Updated {new Date(settings.updated_at).toLocaleString()}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-caption text-muted-foreground">
                You can view company details but do not have permission to edit them.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function AdminMfIntegrationsSettingsPanel() {
  const { hasPermission } = useAdminAuth();
  const canManage = hasPermission("mf.integrations.manage");

  const [providers, setProviders] = useState<MfIntegrationProviderStatus[]>([]);
  const [companySettings, setCompanySettings] = useState<ZyndCompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyLoading, setCompanyLoading] = useState(true);
  const [companySaving, setCompanySaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  const providerMeta = useMemo(
    () => Object.fromEntries(MF_INTEGRATION_PROVIDERS.map((item) => [item.id, item])),
    [],
  );

  const loadIntegrations = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const items = await fetchMfIntegrations();
      setProviders(items);
    } catch (err) {
      setProviders([]);
      setError(getErrorMessage(err, "Could not load Zynd Integrations status."));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCompanySettings = useCallback(async () => {
    setCompanyLoading(true);
    try {
      const settings = await fetchZyndCompanySettings();
      setCompanySettings(settings);
    } catch (err) {
      setCompanySettings(null);
      setError(getErrorMessage(err, "Could not load Zynd company details."));
    } finally {
      setCompanyLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadIntegrations();
    void loadCompanySettings();
  }, [loadCompanySettings, loadIntegrations]);

  const handleEnvironmentChange = async (
    providerId: MfIntegrationProviderStatus["id"],
    environment: IntegrationEnvironment,
  ) => {
    setSwitchingId(providerId);
    setError("");
    setMessage("");
    try {
      const updated = await updateMfIntegrationEnvironment(providerId, environment);
      setProviders((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setMessage(
        `${providerMeta[providerId]?.label ?? providerId} switched to ${environmentLabel(environment)} mode.`,
      );
    } catch (err) {
      setError(getErrorMessage(err, "Could not switch integration environment."));
    } finally {
      setSwitchingId(null);
    }
  };

  const handleCompanySave = async (payload: { distributor_arn: string; distributor_euin: string }) => {
    setCompanySaving(true);
    setError("");
    setMessage("");
    try {
      const updated = await updateZyndCompanySettings({
        distributor_arn: payload.distributor_arn,
        distributor_euin: payload.distributor_euin || undefined,
        clear_distributor_euin: !payload.distributor_euin,
      });
      setCompanySettings(updated);
      setMessage("Zynd company details saved.");
    } catch (err) {
      setError(getErrorMessage(err, "Could not save Zynd company details."));
    } finally {
      setCompanySaving(false);
    }
  };

  if (loading && companyLoading) {
    return (
      <div className={INTEGRATION_CARD_GRID_CLASS}>
        <AdminCardListSkeleton count={1} lines={2} />
        <AdminCardListSkeleton count={1} lines={2} />
        <AdminCardListSkeleton count={1} lines={2} />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      {error ? <AdminFeedbackMessage variant="destructive" onDismiss={() => setError("")}>{error}</AdminFeedbackMessage> : null}
      {message ? <AdminFeedbackMessage variant="success" onDismiss={() => setMessage("")}>{message}</AdminFeedbackMessage> : null}

      <ZyndCompanyDetailsCard
        settings={companySettings}
        loading={companyLoading}
        saving={companySaving}
        canManage={canManage}
        onSave={handleCompanySave}
      />

      <div className={INTEGRATION_CARD_GRID_CLASS}>
        {providers.map((provider) => (
          <IntegrationProviderCard
            key={provider.id}
            provider={provider}
            meta={providerMeta[provider.id]}
            canManage={canManage}
            isSwitching={switchingId === provider.id}
            onEnvironmentChange={handleEnvironmentChange}
          />
        ))}
      </div>
    </div>
  );
}

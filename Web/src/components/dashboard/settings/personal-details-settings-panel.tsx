"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";

import { AppleIcon, GoogleIcon } from "@/components/auth/oauth-provider-icons";
import {
  AuthenticatorVerifyDialog,
  PasswordVerifyDialog,
} from "@/features/account/mfa";
import type { StepUpVerification } from "@/features/account/mfa/types/step-up-types";
import { SettingsPanelHeader } from "@/components/dashboard/settings/settings-panel-header";
import { SettingsContentCard } from "@/components/dashboard/settings/settings-content-card";
import {
  SettingsProfileDetailsRow,
  SettingsProfileDetailsTable,
} from "@/components/dashboard/settings/settings-profile-details-table";
import {
  PersonalDetailsProfileSkeletonRows,
} from "@/components/dashboard/settings/settings-skeleton";
import { SETTINGS_NAV } from "@/components/dashboard/settings/settings-sidebar";
import { Button } from "@/components/ui/button";
import { FieldMessage, UiMessage } from "@/components/ui/ui-message";
import { useKycOptional } from "@/contexts/kyc-context";
import type { SettingsKycProfile } from "@/features/kyc/lib/settings-kyc-profile";
import { formatSettingsCountryCode } from "@/features/kyc/lib/settings-kyc-display";
import { ApiError } from "@/lib/api-client";
import {
  connectOAuthApple,
  connectOAuthGoogle,
  disconnectOAuth,
  fetchOAuthConnections,
  type OAuthConnections,
} from "@/lib/auth-api";
import { env } from "@/lib/env";
import { ensureAppleScript, ensureGoogleScript, isOAuthFlowCancelledError, requestAppleIdToken, requestGoogleIdToken } from "@/lib/oauth-client";
import { copy } from "@/shared/config/copy";
import { useResolvedDisplayName } from "@/shared/hooks/use-resolved-display-name";
import { cn } from "@/lib/utils";

const oauthButtonClassName =
  "h-9 gap-2 border-border bg-background text-foreground shadow-zynd-low hover:bg-muted";

const googleDisconnectButtonClassName =
  "border-success/50 bg-success/5 hover:border-success/60 hover:bg-success/10 dark:!border-success dark:!bg-success/20 dark:text-foreground dark:shadow-[0_0_0_1px_var(--success),0_0_16px_color-mix(in_srgb,var(--success)_40%,transparent)] dark:hover:!border-success dark:hover:!bg-success/30 dark:hover:shadow-[0_0_0_1px_var(--success),0_0_20px_color-mix(in_srgb,var(--success)_55%,transparent)]";

const googleConfigured = Boolean(env.googleClientId);
const appleConfigured = Boolean(env.appleClientId);

type PersonalDetailsSettingsPanelProps = {
  registeredEmail: string;
  phone: string | null;
  countryCode: string;
  mfaEnabled: boolean;
  kycProfile?: SettingsKycProfile | null;
  kycProfileLoading?: boolean;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message;
  return fallback;
}

export function PersonalDetailsSettingsPanel({
  registeredEmail,
  phone,
  countryCode,
  mfaEnabled,
  kycProfile,
  kycProfileLoading = false,
}: PersonalDetailsSettingsPanelProps) {
  const sectionMeta = SETTINGS_NAV.find((item) => item.id === "personal-details")!;
  const kyc = useKycOptional();
  const personalInfo = kycProfile?.personalInfo;
  const [connections, setConnections] = useState<OAuthConnections | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<"google" | "apple" | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [disconnectProvider, setDisconnectProvider] = useState<"google" | "apple" | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [authError, setAuthError] = useState("");
  const [pendingPassword, setPendingPassword] = useState("");

  const hasIdentity = Boolean(kycProfile?.kycVerified && (kycProfile?.panMasked || personalInfo));
  const hasAddress = Boolean(kycProfile?.kycVerified && kycProfile?.address);
  const showIdentitySection = kycProfileLoading || hasIdentity || kyc?.kycAllowed;
  const resolvedFullName = useResolvedDisplayName();

  const loadConnections = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchOAuthConnections();
      setConnections(result);
    } catch (err) {
      setError(getErrorMessage(err, copy.settings.couldNotLoadConnections));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  useEffect(() => {
    if (googleConfigured) {
      void ensureGoogleScript().catch(() => undefined);
    }
    if (appleConfigured) {
      void ensureAppleScript().catch(() => undefined);
    }
  }, [googleConfigured, appleConfigured]);

  const handleConnectGoogle = async () => {
    setActionLoading("google");
    setError("");
    setSuccess("");
    try {
      const { idToken } = await requestGoogleIdToken();
      const result = await connectOAuthGoogle(idToken);
      setConnections(result);
      setSuccess(copy.settings.googleConnectedSuccess);
    } catch (err) {
      if (!isOAuthFlowCancelledError(err)) {
        setError(getErrorMessage(err, copy.settings.couldNotConnectGoogle));
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleConnectApple = async () => {
    setActionLoading("apple");
    setError("");
    setSuccess("");
    try {
      const { idToken, profile } = await requestAppleIdToken();
      const result = await connectOAuthApple(idToken, profile);
      setConnections(result);
      setSuccess(copy.settings.appleConnectedSuccess);
    } catch (err) {
      if (!isOAuthFlowCancelledError(err)) {
        setError(getErrorMessage(err, copy.settings.couldNotConnectApple));
      }
    } finally {
      setActionLoading(null);
    }
  };

  const submitDisconnect = async (
    currentPassword: string,
    verification?: StepUpVerification,
  ) => {
    if (!disconnectProvider) return;

    setActionLoading(disconnectProvider);
    setError("");
    setPasswordError("");
    setAuthError("");
    setSuccess("");

    try {
      const result = await disconnectOAuth({
        provider: disconnectProvider,
        currentPassword,
        totpCode: verification?.totpCode,
        smsOtp: verification?.smsOtp,
      });
      setConnections(result);
      setSuccess(`${disconnectProvider === "google" ? "Google" : "Apple"} account disconnected.`);
      setPasswordDialogOpen(false);
      setAuthDialogOpen(false);
      setDisconnectProvider(null);
      setPendingPassword("");
    } catch (err) {
      const message = getErrorMessage(err, copy.settings.couldNotDisconnectAccount);
      if (authDialogOpen) {
        setAuthError(message);
      } else if (passwordDialogOpen) {
        setPasswordError(message);
      } else {
        setError(message);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const startDisconnect = (provider: "google" | "apple") => {
    setDisconnectProvider(provider);
    setPasswordError("");
    setAuthError("");
    setPendingPassword("");
    setPasswordDialogOpen(true);
  };

  const handlePasswordVerify = (password: string) => {
    setPendingPassword(password);
    if (mfaEnabled) {
      setPasswordDialogOpen(false);
      setAuthDialogOpen(true);
      return;
    }
    void submitDisconnect(password);
  };

  const googleConnected = connections?.google.connected ?? false;
  const appleConnected = connections?.apple.connected ?? false;
  const buttonsBusy = loading || actionLoading !== null;

  return (
    <SettingsContentCard
      header={
        <SettingsPanelHeader
          icon={sectionMeta.icon}
          title={sectionMeta.title}
          description={sectionMeta.description}
          actions={
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  oauthButtonClassName,
                  googleConnected && googleDisconnectButtonClassName,
                )}
                disabled={buttonsBusy || !googleConfigured}
                title={googleConfigured ? undefined : copy.settings.googleNotConfigured}
                onClick={() =>
                  googleConnected ? startDisconnect("google") : void handleConnectGoogle()
                }
              >
                <GoogleIcon className="size-3.5" />
                {actionLoading === "google"
                  ? copy.settings.working
                  : googleConnected
                    ? copy.settings.disconnectGoogle
                    : copy.settings.connectGoogle}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={oauthButtonClassName}
                disabled={buttonsBusy || !appleConfigured}
                title={appleConfigured ? undefined : copy.settings.appleNotConfigured}
                onClick={() =>
                  appleConnected ? startDisconnect("apple") : void handleConnectApple()
                }
              >
                <AppleIcon className="size-3.5" />
                {actionLoading === "apple"
                  ? copy.settings.working
                  : appleConnected
                    ? copy.settings.disconnectApple
                    : copy.settings.connectApple}
              </Button>
            </>
          }
        />
      }
    >
      <div className="space-y-4">
        <FieldMessage message={error} />
        {success ? <UiMessage variant="success" message={success} className="mb-3" /> : null}

        {kycProfileLoading ? (
          <PersonalDetailsProfileSkeletonRows />
        ) : (
          <SettingsProfileDetailsTable>
            <SettingsProfileDetailsRow
              label={copy.settings.fullNameLabel}
              value={resolvedFullName || copy.settings.notSet}
            />
            <SettingsProfileDetailsRow label={copy.settings.emailLabel} value={registeredEmail} />
            <SettingsProfileDetailsRow
              label={copy.settings.phoneLabel}
              value={phone || copy.settings.notSet}
            />
            <SettingsProfileDetailsRow
              label={copy.settings.countryLabel}
              value={formatSettingsCountryCode(countryCode)}
            />
            <SettingsProfileDetailsRow
              label={copy.settings.googleLabel}
              value={
                <span className="inline-flex items-center gap-2">
                  <GoogleIcon className="size-3.5 shrink-0" />
                  {googleConnected
                    ? connections?.google.email || copy.settings.connected
                    : copy.settings.notConnected}
                </span>
              }
            />
            <SettingsProfileDetailsRow
              label={copy.settings.appleLabel}
              value={
                <span className="inline-flex items-center gap-2">
                  <AppleIcon className="size-3.5 shrink-0" />
                  {appleConnected
                    ? connections?.apple.email || copy.settings.connected
                    : copy.settings.notConnected}
                </span>
              }
            />

            {kycProfile?.kycVerified ? (
              <SettingsProfileDetailsRow label="KYC status" verifiedBadge />
            ) : null}

            {hasIdentity ? (
              <>
                {kycProfile?.panMasked ? (
                  <SettingsProfileDetailsRow
                    label={copy.kyc.pan.numberLabel}
                    value={kycProfile.panMasked}
                    mono
                  />
                ) : null}
                {personalInfo ? (
                  <>
                    <SettingsProfileDetailsRow
                      label={copy.kyc.personalInfo.fields.fathersName}
                      value={personalInfo.fathersName}
                    />
                    <SettingsProfileDetailsRow
                      label={copy.kyc.personalInfo.fields.gender}
                      value={personalInfo.gender}
                    />
                    <SettingsProfileDetailsRow
                      label={copy.kyc.personalInfo.fields.incomeSlab}
                      value={personalInfo.incomeSlab}
                    />
                    <SettingsProfileDetailsRow
                      label={copy.kyc.personalInfo.fields.occupation}
                      value={personalInfo.occupation}
                    />
                    <SettingsProfileDetailsRow
                      label={copy.kyc.personalInfo.fields.maritalStatus}
                      value={personalInfo.maritalStatus}
                    />
                    <SettingsProfileDetailsRow
                      label={copy.kyc.personalInfo.fields.nationality}
                      value={personalInfo.nationality}
                    />
                    <SettingsProfileDetailsRow
                      label={copy.kyc.personalInfo.fields.placeOfBirth}
                      value={personalInfo.placeOfBirth}
                    />
                    <SettingsProfileDetailsRow
                      label={copy.kyc.personalInfo.fields.pepExposed}
                      value={personalInfo.pepExposed}
                    />
                  </>
                ) : null}
              </>
            ) : showIdentitySection ? (
              <div className="px-0 py-5 text-center">
                <div className="mx-auto flex size-8 items-center justify-center rounded-full bg-muted/60 text-muted-foreground ring-1 ring-inset ring-border/50">
                  <ShieldCheck className="size-4" strokeWidth={2.25} aria-hidden />
                </div>
                <p className="mt-3 text-compact font-medium text-foreground">{copy.kyc.menuLabel}</p>
                <p className="mt-1 text-caption text-muted-foreground">{copy.kyc.pageDescription}</p>
                <Button type="button" size="sm" className="mt-3" onClick={() => kyc?.openDialog()}>
                  {copy.kyc.menuLabel}
                </Button>
              </div>
            ) : null}

            {hasAddress ? (
              <>
                <SettingsProfileDetailsRow
                  label={copy.kyc.address.permanentTab}
                  value={kycProfile!.address!.permanent}
                  multiline
                />
                <SettingsProfileDetailsRow
                  label={copy.kyc.address.correspondenceTab}
                  value={kycProfile!.address!.correspondence}
                  multiline
                />
              </>
            ) : null}
          </SettingsProfileDetailsTable>
        )}
      </div>

      <PasswordVerifyDialog
        open={passwordDialogOpen}
        onOpenChange={(open) => {
          setPasswordDialogOpen(open);
          if (!open) {
            setPasswordError("");
            if (!authDialogOpen) {
              setDisconnectProvider(null);
              setPendingPassword("");
            }
          }
        }}
        title={copy.settings.disconnectOAuthTitle(disconnectProvider === "apple" ? "Apple" : "Google")}
        description={copy.settings.disconnectPasswordDescription}
        submitLabel={mfaEnabled ? "Continue" : copy.settings.disconnectSubmit}
        loading={actionLoading !== null && !authDialogOpen}
        error={passwordError}
        onSubmit={handlePasswordVerify}
      />

      <AuthenticatorVerifyDialog
        open={authDialogOpen}
        onOpenChange={(open) => {
          setAuthDialogOpen(open);
          if (!open) {
            setAuthError("");
            setPendingPassword("");
            setDisconnectProvider(null);
          }
        }}
        title={copy.settings.disconnectOAuthTitle(disconnectProvider === "apple" ? "Apple" : "Google")}
        description={copy.settings.disconnectMfaDescription}
        submitLabel={copy.settings.disconnectSubmit}
        loading={actionLoading !== null}
        error={authError}
        onSubmit={(verification) => void submitDisconnect(pendingPassword, verification)}
      />
    </SettingsContentCard>
  );
}

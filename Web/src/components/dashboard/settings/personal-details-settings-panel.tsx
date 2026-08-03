"use client";

import { useCallback, useEffect, useState } from "react";

import { AppleIcon, GoogleIcon } from "@/components/auth/oauth-provider-icons";
import {
  AuthenticatorVerifyDialog,
  PasswordVerifyDialog,
} from "@/features/account/mfa";
import type { StepUpVerification } from "@/features/account/mfa/types/step-up-types";
import { SettingsPanelHeader } from "@/components/dashboard/settings/settings-panel-header";
import { SettingsContentCard } from "@/components/dashboard/settings/settings-content-card";
import {
  SettingsDetailRow,
  SettingsDetailSection,
} from "@/components/dashboard/settings/settings-detail-row";
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
import { ensureAppleScript, ensureGoogleScript, requestAppleIdToken, requestGoogleIdToken } from "@/lib/oauth-client";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const oauthButtonClassName =
  "h-9 gap-2 border-border bg-background text-foreground shadow-zynd-low hover:bg-muted";

const googleDisconnectButtonClassName =
  "border-success/50 bg-success/5 hover:border-success/60 hover:bg-success/10 dark:!border-success dark:!bg-success/20 dark:text-foreground dark:shadow-[0_0_0_1px_var(--success),0_0_16px_color-mix(in_srgb,var(--success)_40%,transparent)] dark:hover:!border-success dark:hover:!bg-success/30 dark:hover:shadow-[0_0_0_1px_var(--success),0_0_20px_color-mix(in_srgb,var(--success)_55%,transparent)]";

const googleConfigured = Boolean(env.googleClientId);
const appleConfigured = Boolean(env.appleClientId);

type PersonalDetailsSettingsPanelProps = {
  displayName: string;
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return <SettingsDetailRow label={label} value={value} />;
}

export function PersonalDetailsSettingsPanel({
  displayName,
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
      setError(getErrorMessage(err, copy.settings.couldNotConnectGoogle));
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
      setError(getErrorMessage(err, copy.settings.couldNotConnectApple));
    } finally {
      setActionLoading(null);
    }
  };

  const submitDisconnect = async (
    currentPassword: string,
    verification?: StepUpVerification
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
      <div className="space-y-6">
        <FieldMessage message={error} />
        {success ? <UiMessage variant="success" message={success} className="mb-3" /> : null}

        <SettingsDetailSection title={copy.settings.accountSectionTitle}>
          <DetailRow label={copy.settings.fullNameLabel} value={displayName || copy.settings.notSet} />
          <DetailRow label={copy.settings.emailLabel} value={registeredEmail} />
          <DetailRow label={copy.settings.phoneLabel} value={phone || copy.settings.notSet} />
          <DetailRow label={copy.settings.countryLabel} value={formatSettingsCountryCode(countryCode)} />
          <DetailRow
            label={copy.settings.googleLabel}
            value={googleConnected ? connections?.google.email || copy.settings.connected : copy.settings.notConnected}
          />
          <DetailRow
            label={copy.settings.appleLabel}
            value={appleConnected ? connections?.apple.email || copy.settings.connected : copy.settings.notConnected}
          />
        </SettingsDetailSection>

        {kycProfileLoading ? (
          <p className="text-caption text-muted-foreground">{copy.settings.profileLoading}</p>
        ) : kycProfile?.panNumber || personalInfo || kycProfile?.address ? (
          <>
            {kycProfile.panNumber ? (
              <SettingsDetailSection
                title={copy.settings.identitySectionTitle}
                description={copy.settings.identitySectionDescription}
              >
                <SettingsDetailRow
                  label={copy.kyc.pan.numberLabel}
                  value={kycProfile.panNumber}
                  mono
                  verified={kycProfile.panVerified}
                />
                {personalInfo ? (
                  <>
                    <SettingsDetailRow
                      label={copy.kyc.personalInfo.fields.fathersName}
                      value={personalInfo.fathersName}
                    />
                    <SettingsDetailRow label={copy.kyc.personalInfo.fields.gender} value={personalInfo.gender} />
                    <SettingsDetailRow
                      label={copy.kyc.personalInfo.fields.incomeSlab}
                      value={personalInfo.incomeSlab}
                    />
                    <SettingsDetailRow
                      label={copy.kyc.personalInfo.fields.occupation}
                      value={personalInfo.occupation}
                    />
                    <SettingsDetailRow
                      label={copy.kyc.personalInfo.fields.maritalStatus}
                      value={personalInfo.maritalStatus}
                    />
                    <SettingsDetailRow
                      label={copy.kyc.personalInfo.fields.nationality}
                      value={personalInfo.nationality}
                    />
                    <SettingsDetailRow
                      label={copy.kyc.personalInfo.fields.placeOfBirth}
                      value={personalInfo.placeOfBirth}
                    />
                    <SettingsDetailRow
                      label={copy.kyc.personalInfo.fields.pepExposed}
                      value={personalInfo.pepExposed}
                    />
                  </>
                ) : null}
              </SettingsDetailSection>
            ) : null}

            {kycProfile.address ? (
              <SettingsDetailSection title={copy.settings.addressSectionTitle}>
                <SettingsDetailRow
                  label={copy.kyc.address.permanentTab}
                  value={kycProfile.address.permanent}
                  verified={kycProfile.address.verified}
                />
                <SettingsDetailRow
                  label={copy.kyc.address.correspondenceTab}
                  value={kycProfile.address.correspondence}
                />
              </SettingsDetailSection>
            ) : null}
          </>
        ) : kyc?.kycAllowed ? (
          <div className="rounded-[var(--radius-card)] border border-dashed border-border px-4 py-6 text-center">
            <p className="text-caption text-muted-foreground">{copy.kyc.pageDescription}</p>
            <Button type="button" size="sm" className="mt-3" onClick={() => kyc.openDialog()}>
              {copy.kyc.menuLabel}
            </Button>
          </div>
        ) : null}
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

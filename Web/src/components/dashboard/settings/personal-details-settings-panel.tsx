"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CreditCard,
  Globe,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { AppleIcon, GoogleIcon } from "@/components/auth/oauth-provider-icons";
import {
  AuthenticatorVerifyDialog,
  PasswordVerifyDialog,
} from "@/features/account/mfa";
import type { StepUpVerification } from "@/features/account/mfa/types/step-up-types";
import { SettingsPanelHeader } from "@/components/dashboard/settings/settings-panel-header";
import { SettingsContentCard } from "@/components/dashboard/settings/settings-content-card";
import {
  SettingsProfileFieldCard,
} from "@/components/dashboard/settings/settings-profile-field-card";
import { SettingsOAuthConnectionFieldCard } from "@/components/dashboard/settings/settings-oauth-connection-field-card";
import { SettingsProfileSectionCard } from "@/components/dashboard/settings/settings-profile-section-card";
import {
  PersonalDetailsAddressSkeletonCards,
  PersonalDetailsIdentitySkeletonCards,
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

  const hasIdentity = Boolean(kycProfile?.kycVerified && (kycProfile?.panNumber || personalInfo));
  const hasAddress = Boolean(kycProfile?.kycVerified && kycProfile?.address);
  const showIdentitySection = kycProfileLoading || hasIdentity || kyc?.kycAllowed;
  const showAddressSection = kycProfileLoading || hasAddress || kyc?.kycAllowed;

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

        <div className="space-y-5">
          <SettingsProfileSectionCard
            title={copy.settings.accountSectionTitle}
            icon={UserRound}
            tone="primary"
          >
            <SettingsProfileFieldCard
              label={copy.settings.fullNameLabel}
              value={displayName || copy.settings.notSet}
              icon={UserRound}
              variant="accent"
            />
            <SettingsProfileFieldCard
              label={copy.settings.emailLabel}
              value={registeredEmail}
              icon={Mail}
            />
            <SettingsProfileFieldCard
              label={copy.settings.phoneLabel}
              value={phone || copy.settings.notSet}
              icon={Phone}
            />
            <SettingsProfileFieldCard
              label={copy.settings.countryLabel}
              value={formatSettingsCountryCode(countryCode)}
              icon={Globe}
            />
            <SettingsOAuthConnectionFieldCard
              provider="google"
              connected={googleConnected}
              email={connections?.google.email}
            />
            <SettingsOAuthConnectionFieldCard
              provider="apple"
              connected={appleConnected}
              email={connections?.apple.email}
            />
          </SettingsProfileSectionCard>

          {showIdentitySection ? (
            <SettingsProfileSectionCard
              title={copy.settings.identitySectionTitle}
              icon={ShieldCheck}
              tone="success"
              badge={
                kycProfile?.kycVerified ? (
                  <span className="rounded-[var(--radius-full)] bg-success/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success">
                    KYC verified
                  </span>
                ) : null
              }
            >
              {kycProfileLoading ? (
                <PersonalDetailsIdentitySkeletonCards />
              ) : hasIdentity ? (
                <>
                  {kycProfile?.panNumber ? (
                    <SettingsProfileFieldCard
                      label={copy.kyc.pan.numberLabel}
                      value={kycProfile.panNumber}
                      icon={CreditCard}
                      mono
                      verified={kycProfile.panVerified}
                    />
                  ) : null}
                  {personalInfo ? (
                    <>
                      <SettingsProfileFieldCard
                        label={copy.kyc.personalInfo.fields.fathersName}
                        value={personalInfo.fathersName}
                      />
                      <SettingsProfileFieldCard
                        label={copy.kyc.personalInfo.fields.gender}
                        value={personalInfo.gender}
                      />
                      <SettingsProfileFieldCard
                        label={copy.kyc.personalInfo.fields.incomeSlab}
                        value={personalInfo.incomeSlab}
                      />
                      <SettingsProfileFieldCard
                        label={copy.kyc.personalInfo.fields.occupation}
                        value={personalInfo.occupation}
                      />
                      <SettingsProfileFieldCard
                        label={copy.kyc.personalInfo.fields.maritalStatus}
                        value={personalInfo.maritalStatus}
                      />
                      <SettingsProfileFieldCard
                        label={copy.kyc.personalInfo.fields.nationality}
                        value={personalInfo.nationality}
                      />
                      <SettingsProfileFieldCard
                        label={copy.kyc.personalInfo.fields.placeOfBirth}
                        value={personalInfo.placeOfBirth}
                        icon={MapPin}
                      />
                      <SettingsProfileFieldCard
                        label={copy.kyc.personalInfo.fields.pepExposed}
                        value={personalInfo.pepExposed}
                      />
                    </>
                  ) : null}
                </>
              ) : (
                <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-success/25 bg-card px-6 py-10 text-center sm:col-span-2 xl:col-span-3">
                  <div className="flex size-12 items-center justify-center rounded-full bg-success/10 text-success ring-1 ring-inset ring-success/20">
                    <ShieldCheck className="size-5" strokeWidth={2} aria-hidden />
                  </div>
                  <p className="mt-4 max-w-sm text-body font-medium text-foreground">
                    {copy.kyc.menuLabel}
                  </p>
                  <p className="mt-1 max-w-sm text-caption text-muted-foreground">
                    {copy.kyc.pageDescription}
                  </p>
                  <Button type="button" size="sm" className="mt-4" onClick={() => kyc?.openDialog()}>
                    {copy.kyc.menuLabel}
                  </Button>
                </div>
              )}
            </SettingsProfileSectionCard>
          ) : null}

          {showAddressSection ? (
            <SettingsProfileSectionCard
              title={copy.settings.addressSectionTitle}
              icon={MapPin}
              tone="info"
            >
              {kycProfileLoading ? (
                <PersonalDetailsAddressSkeletonCards />
              ) : hasAddress ? (
                <>
                  <SettingsProfileFieldCard
                    label={copy.kyc.address.permanentTab}
                    value={kycProfile!.address!.permanent}
                    verified={kycProfile!.address!.verified}
                    icon={MapPin}
                    multiline
                    className="sm:col-span-2 xl:col-span-3"
                  />
                  <SettingsProfileFieldCard
                    label={copy.kyc.address.correspondenceTab}
                    value={kycProfile!.address!.correspondence}
                    icon={MapPin}
                    multiline
                    className="sm:col-span-2 xl:col-span-3"
                  />
                </>
              ) : null}
            </SettingsProfileSectionCard>
          ) : null}
        </div>
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

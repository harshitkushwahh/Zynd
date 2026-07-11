"use client";

import { useCallback, useEffect, useState } from "react";
import { Lock } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { UiMessage } from "@/components/ui/ui-message";
import { Switch } from "@/components/ui/switch";
import {
  fetchNotificationPreferences,
  updateNotificationPreference,
  type NotificationCategory,
  type NotificationPreference,
} from "@/features/notifications/api/notifications-api";
import { NOTIFICATION_SURFACE_RADIUS_CLASS } from "@/features/notifications/lib/notification-filter-tabs";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const CATEGORY_ORDER: NotificationCategory[] = [
  "security",
  "kyc",
  "referral",
  "account",
];

const CATEGORY_LABELS: Record<
  NotificationCategory,
  { title: string; description: string }
> = {
  security: {
    title: copy.settings.notificationsCategorySecurityTitle,
    description: copy.settings.notificationsCategorySecurityDescription,
  },
  kyc: {
    title: copy.settings.notificationsCategoryKycTitle,
    description: copy.settings.notificationsCategoryKycDescription,
  },
  referral: {
    title: copy.settings.notificationsCategoryReferralTitle,
    description: copy.settings.notificationsCategoryReferralDescription,
  },
  account: {
    title: copy.settings.notificationsCategoryAccountTitle,
    description: copy.settings.notificationsCategoryAccountDescription,
  },
};

function PreferencesTableSkeleton() {
  return (
    <div className={cn("overflow-hidden border border-border", NOTIFICATION_SURFACE_RADIUS_CLASS)}>
      <div className="grid grid-cols-[1fr_5.5rem_5.5rem] gap-3 border-b border-border bg-muted/30 px-4 py-3 sm:grid-cols-[1fr_6rem_6rem] sm:px-5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-10 justify-self-center" />
        <Skeleton className="h-3 w-12 justify-self-center" />
      </div>
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="grid grid-cols-[1fr_5.5rem_5.5rem] items-center gap-3 border-b border-border/70 px-4 py-4 last:border-b-0 sm:grid-cols-[1fr_6rem_6rem] sm:px-5"
        >
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-full max-w-sm" />
          </div>
          <Skeleton className="size-5 justify-self-center rounded-full" />
          <Skeleton className="size-5 justify-self-center rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function NotificationsSettingsPanel() {
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingCategory, setSavingCategory] = useState<NotificationCategory | null>(null);

  const loadPreferences = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchNotificationPreferences();
      const sorted = [...response.preferences].sort(
        (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category),
      );
      setPreferences(sorted);
    } catch {
      setError(copy.settings.notificationsLoadFailed);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPreferences();
  }, [loadPreferences]);

  const handleToggle = async (
    category: NotificationCategory,
    field: "email_enabled" | "in_app_enabled",
    value: boolean,
  ) => {
    const pref = preferences.find((item) => item.category === category);
    if (!pref) return;
    if (field === "email_enabled" && pref.email_locked) return;

    setSavingCategory(category);
    setError(null);
    try {
      const updated = await updateNotificationPreference({
        category,
        emailEnabled: field === "email_enabled" ? value : pref.email_enabled,
        inAppEnabled: field === "in_app_enabled" ? value : pref.in_app_enabled,
      });
      setPreferences((current) =>
        current.map((item) => (item.category === category ? updated : item)),
      );
    } catch {
      setError(copy.settings.notificationsSaveFailed);
    } finally {
      setSavingCategory(null);
    }
  };

  if (loading) {
    return <PreferencesTableSkeleton />;
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <div className="flex flex-col gap-3">
          <UiMessage variant="error">{error}</UiMessage>
          <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => void loadPreferences()}>
            {copy.settings.notificationsRetry}
          </Button>
        </div>
      ) : null}

      {error ? null : (
      <div className={cn("overflow-hidden border border-border bg-card", NOTIFICATION_SURFACE_RADIUS_CLASS)}>
        <div
          className={cn(
            "grid grid-cols-[1fr_5.5rem_5.5rem] items-center gap-3 border-b border-border bg-muted/30 px-4 py-3",
            "sm:grid-cols-[1fr_6rem_6rem] sm:px-5",
          )}
          role="row"
        >
          <div
            className="text-caption font-semibold uppercase tracking-wide text-muted-foreground"
            role="columnheader"
          >
            {copy.settings.notificationsTableCategory}
          </div>
          <div
            className="text-center text-caption font-semibold uppercase tracking-wide text-muted-foreground"
            role="columnheader"
          >
            {copy.settings.notificationsTableEmail}
          </div>
          <div
            className="text-center text-caption font-semibold uppercase tracking-wide text-muted-foreground"
            role="columnheader"
          >
            {copy.settings.notificationsTableInApp}
          </div>
        </div>

        <div role="rowgroup">
          {preferences.map((pref) => {
            const meta = CATEGORY_LABELS[pref.category];
            const disabled = savingCategory === pref.category;

            return (
              <div
                key={pref.category}
                className={cn(
                  "grid grid-cols-[1fr_5.5rem_5.5rem] items-center gap-3 border-b border-border/70 px-4 py-4 last:border-b-0",
                  "sm:grid-cols-[1fr_6rem_6rem] sm:px-5",
                  disabled && "opacity-70",
                )}
                role="row"
              >
                <div className="min-w-0 pr-2" role="cell">
                  <p className="text-compact font-medium text-foreground">{meta.title}</p>
                  <p className="mt-1 text-caption leading-relaxed text-muted-foreground">
                    {meta.description}
                  </p>
                </div>

                <div className="flex flex-col items-center justify-center gap-1" role="cell">
                  {pref.email_locked ? (
                    <div className="flex flex-col items-center gap-1">
                      <Switch checked={pref.email_enabled} disabled aria-label="Email Required" />
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground">
                        <Lock className="size-2.5" />
                        {copy.settings.notificationsEmailRequired}
                      </span>
                    </div>
                  ) : (
                    <Switch
                      checked={pref.email_enabled}
                      disabled={disabled}
                      aria-label={`${meta.title} email notifications`}
                      onCheckedChange={(checked) =>
                        void handleToggle(pref.category, "email_enabled", checked)
                      }
                    />
                  )}
                </div>

                <div className="flex items-center justify-center" role="cell">
                  <Switch
                    checked={pref.in_app_enabled}
                    disabled={disabled}
                    aria-label={`${meta.title} in-app notifications`}
                    onCheckedChange={(checked) =>
                      void handleToggle(pref.category, "in_app_enabled", checked)
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";

import { useAuth } from "@/contexts/auth-context";
import type { NotificationStreamPayload } from "@/features/notifications/api/notification-stream";
import {
  dispatchWebPushNotification,
  parseFcmDataPayload,
} from "@/features/notifications/lib/web-push-events";
import { WEB_PUSH_NOTIFICATION_EVENT } from "@/features/notifications/lib/firebase-web-config";
import { attachWebPushForegroundListener } from "@/features/notifications/lib/firebase-web-messaging";
import {
  refreshWebPushDeviceIfNeeded,
  registerWebPushDevice,
} from "@/features/notifications/lib/push-device-registration";

export function PushDeviceRegistration() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      return;
    }

    void registerWebPushDevice();
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    void attachWebPushForegroundListener((data) => {
      const payload = parseFcmDataPayload(data);
      if (payload) {
        dispatchWebPushNotification(payload);
      }
    }).then((cleanup) => {
      if (cancelled) {
        cleanup?.();
        return;
      }
      unsubscribe = cleanup;
    });

    const onFocus = () => {
      void refreshWebPushDeviceIfNeeded();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      unsubscribe?.();
      window.removeEventListener("focus", onFocus);
    };
  }, [user]);

  return null;
}

export function useWebPushNotificationBridge(onNotification: (payload: NotificationStreamPayload) => void) {
  const onNotificationRef = useRef(onNotification);
  onNotificationRef.current = onNotification;

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail) {
        onNotificationRef.current(customEvent.detail);
      }
    };

    window.addEventListener(WEB_PUSH_NOTIFICATION_EVENT, handler);
    return () => window.removeEventListener(WEB_PUSH_NOTIFICATION_EVENT, handler);
  }, []);
}

"use client";

import { useEffect, useRef } from "react";

import {
  closeMfPaymentGatewayPopup,
  subscribeMfPaymentGatewayReturn,
} from "@/features/invest/lib/mf-payment-gateway-popup";

const POPUP_CLOSED_POLL_MS = 250;
/** Ignore instant popup.close noise (blockers / about:blank) so we do not treat it as payment abandon. */
const POPUP_MIN_OPEN_MS = 400;
/** Require consecutive closed reads — cross-origin navigations can briefly report closed. */
const POPUP_CLOSED_CONFIRM_POLLS = 2;

type UseMfPaymentGatewayPopupArgs = {
  orderId?: string;
  checkoutId?: string;
  planId?: string;
  onGatewayReturn: () => void;
  onPopupClosedWithoutReturn: () => void;
};

/** Listen for payment-return postMessage and detect user-closed gateway popup. */
export function useMfPaymentGatewayPopup({
  orderId,
  checkoutId,
  planId,
  onGatewayReturn,
  onPopupClosedWithoutReturn,
}: UseMfPaymentGatewayPopupArgs) {
  const popupRef = useRef<Window | null>(null);
  const returnHandledRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onGatewayReturnRef = useRef(onGatewayReturn);
  const onPopupClosedRef = useRef(onPopupClosedWithoutReturn);

  useEffect(() => {
    onGatewayReturnRef.current = onGatewayReturn;
    onPopupClosedRef.current = onPopupClosedWithoutReturn;
  });

  useEffect(() => {
    return subscribeMfPaymentGatewayReturn({ orderId, checkoutId, planId }, () => {
      returnHandledRef.current = true;
      closeMfPaymentGatewayPopup(popupRef.current);
      popupRef.current = null;
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      onGatewayReturnRef.current();
    });
  }, [checkoutId, orderId, planId]);

  function attachPopup(popup: Window | null) {
    popupRef.current = popup;
    returnHandledRef.current = false;
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (!popup) return;

    const openedAt = Date.now();
    let closedStreak = 0;
    pollTimerRef.current = setInterval(() => {
      if (returnHandledRef.current) return;
      const popup = popupRef.current;
      if (!popup || popup.closed) {
        closedStreak += 1;
      } else {
        closedStreak = 0;
      }

      if (
        closedStreak >= POPUP_CLOSED_CONFIRM_POLLS &&
        Date.now() - openedAt >= POPUP_MIN_OPEN_MS
      ) {
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        popupRef.current = null;
        onPopupClosedRef.current();
      }
    }, POPUP_CLOSED_POLL_MS);
  }

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
      closeMfPaymentGatewayPopup(popupRef.current);
    };
  }, []);

  return { attachPopup };
}

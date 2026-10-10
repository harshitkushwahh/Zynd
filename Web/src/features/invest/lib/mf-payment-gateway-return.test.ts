import { describe, expect, it } from "vitest";

import {
  resolveGatewayNavigationAction,
  shouldAbandonPaymentOnDismiss,
  shouldMarkHistoryGatewayReturn,
  shouldShowGatewayBackNotCompleted,
} from "@/features/invest/lib/mf-payment-gateway-return";

describe("mf payment gateway return", () => {
  it("resumes the overlay on browser Back and bfcache when a gateway handoff is pending", () => {
    expect(
      resolveGatewayNavigationAction({
        onGatewayReturnRoute: false,
        hasPendingResume: true,
        navigationType: "back_forward",
      }),
    ).toBe("resume");

    expect(
      resolveGatewayNavigationAction({
        onGatewayReturnRoute: false,
        hasPendingResume: true,
        navigationType: "navigate",
        persisted: true,
      }),
    ).toBe("resume");
  });

  it("does not resume or cancel a fresh in-app visit before the investor reached Cybrilla", () => {
    expect(
      resolveGatewayNavigationAction({
        onGatewayReturnRoute: false,
        hasPendingResume: false,
        navigationType: "back_forward",
      }),
    ).toBe("ignore");

    expect(
      resolveGatewayNavigationAction({
        onGatewayReturnRoute: false,
        hasPendingResume: true,
        navigationType: "navigate",
      }),
    ).toBe("ignore");
  });

  it("resumes a cross-origin postback when the return host asked the overlay to reopen", () => {
    expect(
      resolveGatewayNavigationAction({
        onGatewayReturnRoute: false,
        hasPendingResume: true,
        navigationType: "navigate",
        forceResume: true,
      }),
    ).toBe("resume");

    expect(
      resolveGatewayNavigationAction({
        onGatewayReturnRoute: true,
        hasPendingResume: true,
        navigationType: "navigate",
        forceResume: true,
      }),
    ).toBe("ignore");
  });

  it("marks only Back and bfcache as a cancelled-style history return", () => {
    expect(shouldMarkHistoryGatewayReturn({ navigationType: "back_forward" })).toBe(true);
    expect(shouldMarkHistoryGatewayReturn({ navigationType: "navigate", persisted: true })).toBe(true);
    expect(shouldMarkHistoryGatewayReturn({ navigationType: "reload" })).toBe(false);
    expect(shouldMarkHistoryGatewayReturn({ navigationType: "navigate" })).toBe(false);
  });

  it("abandons on the first pending reconcile after Back unless payment already succeeded", () => {
    expect(
      shouldShowGatewayBackNotCompleted({
        historyReturn: true,
        attempts: 1,
        outcome: "pending",
      }),
    ).toBe(true);

    expect(
      shouldShowGatewayBackNotCompleted({
        historyReturn: true,
        attempts: 3,
        outcome: "pending",
      }),
    ).toBe(true);

    expect(
      shouldShowGatewayBackNotCompleted({
        historyReturn: true,
        attempts: 3,
        outcome: "unclear",
      }),
    ).toBe(true);

    expect(
      shouldShowGatewayBackNotCompleted({
        historyReturn: true,
        attempts: 3,
        outcome: "success",
      }),
    ).toBe(false);

    expect(
      shouldShowGatewayBackNotCompleted({
        historyReturn: true,
        attempts: 3,
        outcome: "failed",
      }),
    ).toBe(false);

    expect(
      shouldShowGatewayBackNotCompleted({
        historyReturn: false,
        attempts: 3,
        outcome: "pending",
      }),
    ).toBe(false);
  });

  it("abandons dismiss only after payment started and before a terminal result", () => {
    expect(
      shouldAbandonPaymentOnDismiss({
        isTerminal: false,
        paymentSucceeded: false,
        paymentStarted: true,
      }),
    ).toBe(true);
    expect(
      shouldAbandonPaymentOnDismiss({
        isTerminal: false,
        paymentSucceeded: false,
        paymentStarted: false,
      }),
    ).toBe(false);
    expect(
      shouldAbandonPaymentOnDismiss({
        isTerminal: true,
        paymentSucceeded: false,
        paymentStarted: true,
      }),
    ).toBe(false);
  });
});

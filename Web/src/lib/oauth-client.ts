import { env } from "@/lib/env";
import type { AppleLoginProfile } from "@/features/auth/api/types";

export type GoogleCredentialResult = {
  idToken: string;
};

export type AppleCredentialResult = {
  idToken: string;
  profile?: AppleLoginProfile;
};

const GOOGLE_SCRIPT_ID = "zynd-google-gsi-client";
const APPLE_SCRIPT_ID = "zynd-apple-auth-js";

function waitForGoogleSdk(timeoutMs = 8000): Promise<NonNullable<Window["google"]>> {
  return new Promise((resolve, reject) => {
    const started = Date.now();

    const check = () => {
      const google = window.google;
      if (google?.accounts?.id) {
        resolve(google);
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        reject(new Error("Google Sign-In is still loading. Try again in a moment."));
        return;
      }
      window.setTimeout(check, 100);
    };

    check();
  });
}

function waitForAppleSdk(timeoutMs = 8000): Promise<NonNullable<Window["AppleID"]>> {
  return new Promise((resolve, reject) => {
    const started = Date.now();

    const check = () => {
      const apple = window.AppleID;
      if (apple?.auth) {
        resolve(apple);
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        reject(new Error("Apple Sign-In is still loading. Try again in a moment."));
        return;
      }
      window.setTimeout(check, 100);
    };

    check();
  });
}

export function ensureGoogleScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Sign-In is only available in the browser."));
  }
  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }
  const existing = document.getElementById(GOOGLE_SCRIPT_ID);
  if (existing) {
    return waitForGoogleSdk().then(() => undefined);
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = GOOGLE_SCRIPT_ID;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      waitForGoogleSdk()
        .then(() => resolve())
        .catch(reject);
    };
    script.onerror = () => reject(new Error("Could not load Google Sign-In."));
    document.head.appendChild(script);
  });
}

export function ensureAppleScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Apple Sign-In is only available in the browser."));
  }
  if (window.AppleID?.auth) {
    return Promise.resolve();
  }
  const existing = document.getElementById(APPLE_SCRIPT_ID);
  if (existing) {
    return waitForAppleSdk().then(() => undefined);
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = APPLE_SCRIPT_ID;
    script.src = "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      waitForAppleSdk()
        .then(() => resolve())
        .catch(reject);
    };
    script.onerror = () => reject(new Error("Could not load Apple Sign-In."));
    document.head.appendChild(script);
  });
}

export async function requestGoogleIdToken(): Promise<GoogleCredentialResult> {
  if (!env.googleClientId) {
    throw new Error("Google Sign-In is not configured yet.");
  }

  await ensureGoogleScript();
  const google = await waitForGoogleSdk();

  return new Promise((resolve, reject) => {
    let settled = false;
    const container = document.createElement("div");
    container.setAttribute("aria-hidden", "true");
    container.style.cssText =
      "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;";
    document.body.appendChild(container);

    const cleanup = () => {
      container.remove();
    };

    const finish = (handler: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      window.clearTimeout(clickRetryId);
      cleanup();
      handler();
    };

    const timeoutId = window.setTimeout(() => {
      finish(() => reject(new Error("Google Sign-In timed out. Try again.")));
    }, 120_000);

    google.accounts.id.initialize({
      client_id: env.googleClientId,
      ux_mode: "popup",
      use_fedcm_for_prompt: false,
      auto_select: false,
      callback: (response: { credential?: string }) => {
        const credential = response.credential;
        if (!credential) {
          finish(() => reject(new Error("Google Sign-In was cancelled.")));
          return;
        }
        finish(() => resolve({ idToken: credential }));
      },
    });

    google.accounts.id.renderButton(container, {
      type: "standard",
      theme: "outline",
      size: "large",
    });

    let clickRetryId = 0;
    const clickRenderedButton = (attempt = 0) => {
      if (settled) return;

      const button =
        container.querySelector<HTMLElement>('[role="button"]') ??
        container.querySelector<HTMLElement>("iframe") ??
        container.firstElementChild;

      if (button instanceof HTMLElement) {
        button.click();
        return;
      }

      if (attempt >= 20) {
        finish(() =>
          reject(new Error("Could not start Google Sign-In. Try again in a moment."))
        );
        return;
      }

      clickRetryId = window.setTimeout(() => clickRenderedButton(attempt + 1), 100);
    };

    clickRenderedButton();
  });
}

export async function requestAppleIdToken(): Promise<AppleCredentialResult> {
  if (!env.appleClientId) {
    throw new Error("Apple Sign-In is not configured yet.");
  }

  await ensureAppleScript();
  const apple = await waitForAppleSdk();

  const redirectURI = env.appleRedirectUri || window.location.origin;
  apple.auth.init({
    clientId: env.appleClientId,
    scope: "name email",
    redirectURI,
    usePopup: true,
  });

  const response = await apple.auth.signIn();
  const idToken = response.authorization?.id_token;
  if (!idToken) {
    throw new Error("Apple Sign-In was cancelled.");
  }

  return {
    idToken,
    profile: {
      userEmail: response.user?.email,
      firstName: response.user?.name?.firstName,
      lastName: response.user?.name?.lastName,
    },
  };
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
          prompt: (
            listener?: (notification: {
              isNotDisplayed: () => boolean;
              isSkippedMoment: () => boolean;
              getNotDisplayedReason?: () => string;
              getSkippedReason?: () => string;
            }) => void
          ) => void;
        };
      };
    };
    AppleID?: {
      auth: {
        init: (config: {
          clientId: string;
          scope: string;
          redirectURI: string;
          usePopup: boolean;
        }) => void;
        signIn: () => Promise<{
          authorization?: { id_token?: string };
          user?: {
            email?: string;
            name?: { firstName?: string; lastName?: string };
          };
        }>;
      };
    };
  }
}

/** Base name only — each `window.open` uses a unique suffix so we never retarget the dashboard tab. */
export const KYC_PARTNER_POPUP_NAME = "zynd_kyc_partner";

export type KycPartnerPopupKind = "digilocker" | "esign";

const POPUP_SIZE_BY_KIND: Record<KycPartnerPopupKind, { width: number; height: number }> = {
  digilocker: { width: 520, height: 720 },
  esign: { width: 660, height: 740 },
};

function popupFeatures(kind: KycPartnerPopupKind = "digilocker"): string {
  const { width, height } = POPUP_SIZE_BY_KIND[kind];
  const left = Math.max(
    0,
    Math.round(window.screenX + (window.outerWidth - width) / 2),
  );
  const top = Math.max(
    0,
    Math.round(window.screenY + (window.outerHeight - height) / 2),
  );
  return [
    "popup=yes",
    `width=${width}`,
    `height=${height}`,
    `left=${left}`,
    `top=${top}`,
    "resizable=yes",
    "scrollbars=yes",
  ].join(",");
}

function uniquePartnerPopupWindowName(): string {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${KYC_PARTNER_POPUP_NAME}_${Date.now().toString(36)}_${suffix}`;
}

/** Drop legacy partner popup name on this window (after embed-return full navigation). */
export function clearKycPartnerPopupWindowName(): void {
  if (typeof window === "undefined") return;
  const name = window.name;
  if (!name) return;
  if (name === KYC_PARTNER_POPUP_NAME || name.startsWith(`${KYC_PARTNER_POPUP_NAME}_`)) {
    window.name = "";
  }
}

/** Finprim blocks iframes; partner flows run in a centered popup over the KYC dialog. */
export function openKycPartnerPopup(
  initialUrl = "about:blank",
  kind: KycPartnerPopupKind = "digilocker",
): Window | null {
  if (typeof window === "undefined") return null;
  try {
    return window.open(initialUrl, uniquePartnerPopupWindowName(), popupFeatures(kind));
  } catch {
    return null;
  }
}

export function navigateKycPartnerPopup(popup: Window | null, url: string): boolean {
  const target = url.trim();
  if (!popup || popup.closed || !target) return false;
  try {
    popup.location.href = target;
    popup.focus();
    return true;
  } catch {
    return false;
  }
}

export function closeKycPartnerPopup(popup: Window | null): void {
  if (!popup || popup.closed) return;
  try {
    popup.close();
  } catch {
    // ignore
  }
}

export type LaunchKycPartnerResult =
  | { mode: "popup"; popup: Window }
  | { mode: "redirect" };

/** Try a centered popup; fall back to same-tab redirect when the browser blocks popups. */
export function launchKycPartnerUrl(
  url: string,
  kind: KycPartnerPopupKind = "digilocker",
): LaunchKycPartnerResult {
  const trimmed = url.trim();
  if (!trimmed || typeof window === "undefined") {
    return { mode: "redirect" };
  }

  const popup = openKycPartnerPopup("about:blank", kind);
  if (popup && navigateKycPartnerPopup(popup, trimmed)) {
    return { mode: "popup", popup };
  }

  closeKycPartnerPopup(popup);
  return { mode: "redirect" };
}

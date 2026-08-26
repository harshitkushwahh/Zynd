import type { InvestFundSummary } from "@/features/invest/api/invest-api";
import { resolveAmcLogoUrl } from "@/features/invest/lib/mf-format";

export const MF_FUND_SCREENER_DRAG_MIME = "application/x-zynd-fund-screener";

export type MfFundScreenerDragPayload = Pick<
  InvestFundSummary,
  | "product_id"
  | "name"
  | "min_lumpsum_amount_inr"
  | "amc_name"
  | "amc_slug"
  | "amc_logo_url"
>;

export function serializeMfFundScreenerDragPayload(
  fund: InvestFundSummary,
): MfFundScreenerDragPayload {
  return {
    product_id: fund.product_id,
    name: fund.name,
    min_lumpsum_amount_inr: fund.min_lumpsum_amount_inr,
    amc_name: fund.amc_name,
    amc_slug: fund.amc_slug,
    amc_logo_url: fund.amc_logo_url,
  };
}

const MF_SCREENER_DRAG_BODY_ATTR = "data-mf-screener-drag";

let activeMfFundScreenerDragPayload: MfFundScreenerDragPayload | null = null;

export function beginMfFundScreenerDrag(payload: MfFundScreenerDragPayload) {
  if (typeof document !== "undefined") {
    document.body.setAttribute(MF_SCREENER_DRAG_BODY_ATTR, "true");
  }
  activeMfFundScreenerDragPayload = payload;
}

export function endMfFundScreenerDrag() {
  if (typeof document !== "undefined") {
    document.body.removeAttribute(MF_SCREENER_DRAG_BODY_ATTR);
  }
  activeMfFundScreenerDragPayload = null;
}

export function getActiveMfFundScreenerDragPayload(): MfFundScreenerDragPayload | null {
  return activeMfFundScreenerDragPayload;
}

export function setMfFundScreenerDragActive(active: boolean) {
  if (typeof document === "undefined") return;
  if (active) {
    document.body.setAttribute(MF_SCREENER_DRAG_BODY_ATTR, "true");
    return;
  }
  document.body.removeAttribute(MF_SCREENER_DRAG_BODY_ATTR);
  activeMfFundScreenerDragPayload = null;
}

export function isMfFundScreenerDragActive(): boolean {
  if (typeof document === "undefined") return false;
  return document.body.hasAttribute(MF_SCREENER_DRAG_BODY_ATTR);
}

export function hasMfFundScreenerDragType(dataTransfer: DataTransfer): boolean {
  if (!dataTransfer.types?.length) return false;

  return Array.from(dataTransfer.types).some(
    (type) =>
      type === MF_FUND_SCREENER_DRAG_MIME ||
      type === "application/json" ||
      type.endsWith("zynd-fund-screener"),
  );
}

export function parseMfFundScreenerDragPayload(
  dataTransfer: DataTransfer,
): MfFundScreenerDragPayload | null {
  const raw =
    dataTransfer.getData(MF_FUND_SCREENER_DRAG_MIME) ||
    dataTransfer.getData("application/json");

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<MfFundScreenerDragPayload>;
    if (
      typeof parsed.product_id !== "string" ||
      typeof parsed.name !== "string" ||
      typeof parsed.amc_name !== "string" ||
      typeof parsed.amc_slug !== "string"
    ) {
      return null;
    }
    return {
      product_id: parsed.product_id,
      name: parsed.name,
      min_lumpsum_amount_inr: parsed.min_lumpsum_amount_inr ?? null,
      amc_name: parsed.amc_name,
      amc_slug: parsed.amc_slug,
      amc_logo_url: parsed.amc_logo_url ?? null,
    };
  } catch {
    return null;
  }
}

export function setMfFundScreenerDragPreview(
  event: React.DragEvent,
  fund: Pick<InvestFundSummary, "name" | "amc_name" | "amc_logo_url" | "amc_slug">,
) {
  const root = document.createElement("div");
  root.style.position = "fixed";
  root.style.top = "-1000px";
  root.style.left = "-1000px";
  root.style.pointerEvents = "none";
  root.style.zIndex = "9999";
  root.style.display = "flex";
  root.style.alignItems = "center";
  root.style.gap = "8px";
  root.style.maxWidth = "220px";
  root.style.padding = "8px 10px";
  root.style.borderRadius = "12px";
  root.style.border = "1px solid var(--border)";
  root.style.background = "var(--card)";
  root.style.boxShadow = "var(--shadow-zynd-high, 0 10px 30px rgba(0,0,0,0.12))";

  const logoWrap = document.createElement("div");
  logoWrap.style.width = "28px";
  logoWrap.style.height = "28px";
  logoWrap.style.flexShrink = "0";
  logoWrap.style.borderRadius = "8px";
  logoWrap.style.border = "1px solid var(--border)";
  logoWrap.style.background = "var(--background)";
  logoWrap.style.display = "flex";
  logoWrap.style.alignItems = "center";
  logoWrap.style.justifyContent = "center";
  logoWrap.style.overflow = "hidden";

  const logoUrl = resolveAmcLogoUrl(fund.amc_logo_url, fund.amc_slug);
  if (logoUrl) {
    const img = document.createElement("img");
    img.src = logoUrl;
    img.alt = "";
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "contain";
    logoWrap.appendChild(img);
  } else {
    logoWrap.style.fontSize = "10px";
    logoWrap.style.fontWeight = "600";
    logoWrap.style.color = "var(--muted-foreground)";
    logoWrap.textContent = fund.amc_name.slice(0, 2).toUpperCase();
  }

  const label = document.createElement("span");
  label.style.fontSize = "12px";
  label.style.fontWeight = "600";
  label.style.lineHeight = "1.25";
  label.style.color = "var(--foreground)";
  label.style.overflow = "hidden";
  label.style.textOverflow = "ellipsis";
  label.style.whiteSpace = "nowrap";
  label.textContent = fund.name;

  root.appendChild(logoWrap);
  root.appendChild(label);
  document.body.appendChild(root);
  event.dataTransfer.setDragImage(root, 20, 20);
  window.setTimeout(() => root.remove(), 0);
}

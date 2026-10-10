import { ZYND_DISTRIBUTOR_LOGO_SRC } from "@/lib/distributor-brand-assets";

/** Demo profile photo for client detail hero when no API image is set. */
export const DISTRIBUTOR_CLIENT_PROFILE_FALLBACK_SRC = "/pm.png";

export function getClientTenureLabel(createdAt: string, referenceDate = Date.now()): string {
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return "Zynd client";

  const years = (referenceDate - created) / (365.25 * 24 * 60 * 60 * 1000);
  if (years < 1) return "New client";

  const wholeYears = Math.floor(years);
  if (wholeYears >= 4) return "4+ years with Zynd";
  if (wholeYears === 1) return "1+ year with Zynd";
  return `${wholeYears}+ years with Zynd`;
}

export { ZYND_DISTRIBUTOR_LOGO_SRC };

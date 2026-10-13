export type InvestEducationStepId =
  | "cybrilla"
  | "folio_nomination"
  | "sip"
  | "lumpsum"
  | "family_goals";

export const INVEST_EDUCATION_STEP_IDS: InvestEducationStepId[] = [
  "cybrilla",
  "folio_nomination",
  "sip",
  "lumpsum",
  "family_goals",
];

/**
 * Illustration paths under `Web/public/`. Replace with your artwork at the same paths,
 * or update this map when files are ready.
 */
export const INVEST_EDUCATION_ILLUSTRATIONS: Record<InvestEducationStepId, string> = {
  cybrilla: "/partners/cybrilla-icon.png",
  folio_nomination: "/nomine-folio.png",
  sip: "/invest-education/sip-flow.png",
  lumpsum: "/invest-education/lumpsum-flow.png",
  family_goals: "/family-info.png",
};

/** Fallback art when custom step files are not uploaded yet. */
export const INVEST_EDUCATION_ILLUSTRATION_FALLBACKS: Record<InvestEducationStepId, string> = {
  cybrilla: "/partners/cybrilla-icon.png",
  folio_nomination: "/nomine-folio.png",
  sip: "/nach.png",
  lumpsum: "/upi.png",
  family_goals: "/family-info.png",
};

export function investEducationUsesLogoSupport(stepId: InvestEducationStepId, src: string) {
  if (/invest-education\//i.test(src)) return false;
  if (stepId === "cybrilla") return true;
  if (stepId === "sip" || stepId === "lumpsum") {
    return /nach\.|upi\./i.test(src);
  }
  return /nach\.|upi\.|cybrilla-icon|partners\//i.test(src);
}

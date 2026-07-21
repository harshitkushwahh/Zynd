export const RISK_PROFILE_HREF = "/dashboard/risk-profile";
export const RISK_PROFILE_ASSESSMENT_HREF = "/dashboard/risk-profile/assessment";

export function isRiskProfilePath(pathname: string) {
  return pathname.startsWith(RISK_PROFILE_HREF);
}

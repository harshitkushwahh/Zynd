export function isReferralPath(pathname: string) {
  return pathname.startsWith("/dashboard/referral");
}

export function isReferralListPath(pathname: string) {
  return pathname.startsWith("/dashboard/referral/referrals");
}

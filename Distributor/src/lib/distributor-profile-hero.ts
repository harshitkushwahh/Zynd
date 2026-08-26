function getTenureYears(createdAt: string, referenceDate = Date.now()): number | null {
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return null;
  return (referenceDate - created) / (365.25 * 24 * 60 * 60 * 1000);
}

export function getDistributorExperienceLabel(
  joinedAt: string,
  referenceDate = Date.now(),
): string {
  const years = getTenureYears(joinedAt, referenceDate);
  if (years === null) return "Zynd Mitra";

  if (years < 1) return "New distributor";

  const wholeYears = Math.floor(years);
  if (wholeYears >= 4) return "4+ years experience";
  if (wholeYears === 1) return "1 year experience";
  return `${wholeYears} years experience`;
}

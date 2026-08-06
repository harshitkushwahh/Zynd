/** User-facing Mitra hierarchy labels for the admin distributor-head console. */
export const MITRA_HIERARCHY_COPY = {
  superHead: "Mitra Super Head",
  stateHead: "Mitra State Head",
  branchManager: "Branch Manager",
  branchManagers: "Branch Managers",
  zyndMitra: "Zynd Mitra",
  zyndMitras: "Zynd Mitras",
  mitraNetwork: "Zynd Mitra network",
  hierarchyJourneyTitle: "Hierarchy journey",
  navDescription: "Mitra Super Head view of branch managers, Zynd Mitras, branches, and sales",
  accessDenied: "You do not have permission to view Mitra hierarchy administration.",
  managerNotFound: "Branch manager not found in this scope.",
  mitraNotFound: "Zynd Mitra not found in this scope.",
} as const;

export function mitraSuperHeadDocumentTitle(section?: string) {
  if (!section) return MITRA_HIERARCHY_COPY.superHead;
  return `${MITRA_HIERARCHY_COPY.superHead} · ${section}`;
}

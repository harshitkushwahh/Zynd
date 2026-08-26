/** User-facing Mitra hierarchy labels for the admin distributor-head console. */
export const MITRA_HIERARCHY_COPY = {
  superHead: "Mitra Super Head",
  stateHead: "Mitra State Head",
  branchManager: "Branch Manager",
  branchManagers: "Branch Managers",
  mitraManager: "Mitra Manager",
  mitraManagers: "Mitra Managers",
  zyndMitra: "Zynd Mitra",
  zyndMitras: "Zynd Mitras",
  mitraNetwork: "Zynd Mitra network",
  hierarchyJourneyTitle: "Hierarchy journey",
  hierarchyJourneySuperHeadHint:
    "Mitra Super Head at the top, then Mitra State Heads, branch managers, and Zynd Mitras.",
  navDescription: "Mitra Super Head view of branch managers, Zynd Mitras, branches, and sales",
  stateHeadNavDescription:
    "Mitra State Head view of branch managers, Zynd Mitras, branches, and sales in your state",
  accessDenied: "You do not have permission to view Mitra hierarchy administration.",
  managerNotFound: "Branch manager not found in this scope.",
  mitraNotFound: "Zynd Mitra not found in this scope.",
  stateHeadNotFound: "Mitra State Head not found in this scope.",
} as const;

export function mitraSuperHeadDocumentTitle(section?: string) {
  if (!section) return MITRA_HIERARCHY_COPY.superHead;
  return `${MITRA_HIERARCHY_COPY.superHead} · ${section}`;
}

import type {
  DistributorClientFamilyGroup,
  DistributorClientGoal,
  DistributorClientProfile,
  DistributorInvestor,
  DistributorOrder,
  DistributorSystematicPlan,
} from "@/lib/distributor-types";

export function buildClientGoalsForInvestor(_investor: DistributorInvestor): DistributorClientGoal[] {
  return [];
}

export function getInvestorById(_investorId: string): DistributorInvestor | undefined {
  return undefined;
}

export function getOrdersForClient(_clientCode: string): DistributorOrder[] {
  return [];
}

export function getSipsForClient(_clientCode: string): DistributorSystematicPlan[] {
  return [];
}

export function buildClientOrdersForInvestor(_investor: DistributorInvestor): DistributorOrder[] {
  return [];
}

export function buildClientSipsForInvestor(_investor: DistributorInvestor): DistributorSystematicPlan[] {
  return [];
}

export function getDistributorClientProfile(_investorId: string): DistributorClientProfile | null {
  return null;
}

export function getFamilyGroupFromProfile(
  profile: DistributorClientProfile,
  groupId: string,
): DistributorClientFamilyGroup | null {
  return profile.familyGroups.find((group) => group.id === groupId) ?? null;
}

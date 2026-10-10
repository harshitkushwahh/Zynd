import type { DistributorOrder, DistributorSystematicPlan } from "@/lib/distributor-types";

export type YourOrdersOperationMix = {
  total: number;
  oneTime: number;
  sip: number;
  redemption: number;
};

/** Support console stub — operation mix for client activity tiles. */
export function getYourOrdersOperationMix(orders: DistributorOrder[]): YourOrdersOperationMix {
  void orders;
  return { total: 0, oneTime: 0, sip: 0, redemption: 0 };
}

export function getYourSipsOperationMix(_plans: DistributorSystematicPlan[]): YourOrdersOperationMix {
  return { total: 0, oneTime: 0, sip: 0, redemption: 0 };
}

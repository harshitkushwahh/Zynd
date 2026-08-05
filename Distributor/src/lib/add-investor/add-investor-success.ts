export type AddInvestorSuccessState = {
  clientCode: string;
  investorName: string;
  email: string;
  mobile: string;
  pan: string;
  kycPath: string;
};

export function createDemoInvestorClientCode(): string {
  const suffix = String(Math.floor(Math.random() * 9000000) + 1000000);
  return `ZYD${suffix}`;
}

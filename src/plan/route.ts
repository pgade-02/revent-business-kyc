export type Route = "self_disclosure" | "verification_call";

// The threshold comes from `scoring_settings`. Its basis (VAT, services) is an
// open question in the PRD; for now it is compared with the contract total
// excluding VAT, including services.
export function routeForContractTotal(contractTotalFils: number, thresholdFils: number): Route {
  return contractTotalFils < thresholdFils ? "self_disclosure" : "verification_call";
}

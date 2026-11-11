import type { ScoringSettings } from "@/kyc/scoring/settings-schema";

// Version 1 of the risk settings, from docs/ARCHITECTURE.md §5. These are
// starting values, to be calibrated against reviewer decisions. Code reads them
// from the `scoring_settings` table, never from this file.
export const startingScoringSettings: ScoringSettings = {
  blockWeights: { documents: 15, identity: 25, financial: 50, integrity: 10 },
  financial: {
    leaseToIncomeBps: { weight: 20, fullMax: 1_500, halfMax: 3_000 },
    daysBelowZero: { weight: 15, fullMax: 0, halfMax: 5 },
    returnedItems: { weight: 10, fullMax: 0, halfMax: 2 },
    debtToIncomeBps: { weight: 5, fullMax: 2_000, halfMax: 4_000 },
  },
  bands: { greenMinScore: 75, amberMinScore: 50 },
  confidenceFloorBps: 7_000,
  expiresSoonDays: 60,
  statementMonthsRequired: 6,
  balanceMismatchHardStopCount: 1,
  routeThresholdFils: 4_000_000, // AED 40,000; basis still an open question in the PRD
};

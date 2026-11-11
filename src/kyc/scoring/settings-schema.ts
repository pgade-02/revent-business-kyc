import { z } from "zod";

const wholeNumber = z.number().int().nonnegative();
const bps = wholeNumber.max(10_000);

// A financial sub-score: full weight up to `fullMax`, half up to `halfMax`, zero above.
const subScoreBand = z
  .object({ weight: wholeNumber, fullMax: wholeNumber, halfMax: wholeNumber })
  .refine((band) => band.fullMax <= band.halfMax, { message: "fullMax must not exceed halfMax" });

// The shape of one `scoring_settings.settings` JSON value. Every value is a
// starting value, to be calibrated against reviewer decisions.
export const scoringSettingsSchema = z
  .object({
    blockWeights: z.object({
      documents: wholeNumber,
      identity: wholeNumber,
      financial: wholeNumber,
      integrity: wholeNumber,
    }),
    financial: z.object({
      leaseToIncomeBps: subScoreBand,
      daysBelowZero: subScoreBand,
      returnedItems: subScoreBand,
      debtToIncomeBps: subScoreBand,
    }),
    bands: z.object({ greenMinScore: wholeNumber.max(100), amberMinScore: wholeNumber.max(100) }),
    confidenceFloorBps: bps,
    expiresSoonDays: wholeNumber,
    statementMonthsRequired: wholeNumber.min(1),
    balanceMismatchHardStopCount: wholeNumber,
    routeThresholdFils: wholeNumber,
  })
  .superRefine((settings, ctx) => {
    const { documents, identity, financial, integrity } = settings.blockWeights;
    if (documents + identity + financial + integrity !== 100) {
      ctx.addIssue({ code: "custom", message: "block weights must add up to 100" });
    }
    const subScores = Object.values(settings.financial);
    const subScoreTotal = subScores.reduce((sum, band) => sum + band.weight, 0);
    if (subScoreTotal !== financial) {
      ctx.addIssue({ code: "custom", message: "financial sub-score weights must add up to the financial block weight" });
    }
    if (settings.bands.greenMinScore <= settings.bands.amberMinScore) {
      ctx.addIssue({ code: "custom", message: "greenMinScore must be above amberMinScore" });
    }
  });

export type ScoringSettings = z.infer<typeof scoringSettingsSchema>;

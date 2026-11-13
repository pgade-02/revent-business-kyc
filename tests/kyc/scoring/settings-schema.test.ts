import { describe, expect, it } from "vitest";
import { startingScoringSettings } from "@/db/seed/scoring-settings";
import { scoringSettingsSchema } from "@/kyc/scoring/settings-schema";

describe("scoringSettingsSchema", () => {
  it("accepts the starting settings", () => {
    expect(scoringSettingsSchema.safeParse(startingScoringSettings).success).toBe(true);
  });

  it("rejects block weights that do not add up to 100", () => {
    const settings = {
      ...startingScoringSettings,
      blockWeights: { ...startingScoringSettings.blockWeights, documents: 20 },
    };
    expect(scoringSettingsSchema.safeParse(settings).success).toBe(false);
  });

  it("rejects financial sub-scores that do not add up to the financial weight", () => {
    const settings = {
      ...startingScoringSettings,
      financial: {
        ...startingScoringSettings.financial,
        returnedItems: { weight: 5, fullMax: 0, halfMax: 2 },
      },
    };
    expect(scoringSettingsSchema.safeParse(settings).success).toBe(false);
  });

  it("rejects a band where 'full' is looser than 'half'", () => {
    const settings = {
      ...startingScoringSettings,
      financial: {
        ...startingScoringSettings.financial,
        daysBelowZero: { weight: 15, fullMax: 6, halfMax: 5 },
      },
    };
    expect(scoringSettingsSchema.safeParse(settings).success).toBe(false);
  });

  it("rejects a Green cut-off that is not above Amber", () => {
    const settings = { ...startingScoringSettings, bands: { greenMinScore: 50, amberMinScore: 50 } };
    expect(scoringSettingsSchema.safeParse(settings).success).toBe(false);
  });

  it("rejects a possible-match cut-off at or above the match cut-off", () => {
    const settings = { ...startingScoringSettings, nameMatch: { matchBps: 9_000, possibleMatchBps: 9_000 } };
    expect(scoringSettingsSchema.safeParse(settings).success).toBe(false);
  });
});

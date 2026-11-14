import { describe, expect, it } from "vitest";
import type { CheckResult, CheckStatus } from "@/kyc/checks/check-result";
import { computeScore, type UploadResults } from "@/kyc/scoring/score";
import type { MoneyFigures } from "@/kyc/statements/money-figures";
import { startingScoringSettings as settings } from "@/db/seed/scoring-settings";

const check = (code: string, status: CheckStatus): CheckResult => ({ code, status, detail: "test" });
const upload = (slot: UploadResults["slot"], ...results: CheckResult[]): UploadResults => ({ documentId: slot, slot, results });

const healthy: MoneyFigures = {
  monthsCovered: 6,
  planMonthly: 2_368_100,
  avgMonthlyIncome: 18_500_000,
  leaseToIncomeBps: 1_280,
  lowestBalance: 21_900_000,
  daysBelowZero: 0,
  returnedItems: 0,
  existingDebtMonthly: 650_000,
  debtToIncomeBps: 351,
  topPayerShareBps: 2_794,
  largestBalanceDropBps: 0,
  reasons: [],
};

const cleanUploads = [
  upload("trade_licence", check("DOC_UNREADABLE", "pass"), check("DOC_WRONG_TYPE", "pass"), check("DOC_EXPIRED", "pass")),
  upload("bank_statement", check("DOC_UNREADABLE", "pass"), check("STMT_BALANCE", "pass")),
  upload("passport", check("PASSPORT_MRZ", "pass")),
];
const cleanCrossChecks = [
  "NAME_COMPANY",
  "NAME_SIGNATORY",
  "LICENCE_NUMBER",
  "EMIRATE_MATCH",
  "EID_SIDES_MATCH",
  "DOB_MATCH",
  "STMT_COVERAGE",
  "STMT_CONTINUITY",
  "IBAN_CONSISTENT",
].map((code) => check(code, "pass"));

describe("computeScore", () => {
  it("gives a clean, healthy application 100 and Green", () => {
    expect(computeScore({ uploads: cleanUploads, crossChecks: cleanCrossChecks, figures: healthy, settings })).toMatchObject({
      score: 100,
      band: "GREEN",
      confidenceBps: 10_000,
      hardStops: [],
    });
  });

  it("reproduces the worked financial example in ARCHITECTURE §5: 35 of 50 = 7000 bps", () => {
    const figures = { ...healthy, leaseToIncomeBps: 53, daysBelowZero: 3, returnedItems: 2, debtToIncomeBps: 2_500 };
    const result = computeScore({ uploads: cleanUploads, crossChecks: cleanCrossChecks, figures, settings });
    expect(result.blocks.financial).toEqual({ bps: 7_000, confidenceBps: 10_000 });
    expect(result.score).toBe(85); // 15 + 25 + 35 + 10
  });

  it("counts a warning as half and a fail as zero within a block", () => {
    const crossChecks = cleanCrossChecks.map((result) =>
      result.code === "NAME_SIGNATORY"
        ? check("NAME_SIGNATORY", "warn")
        : result.code === "DOB_MATCH"
          ? check("DOB_MATCH", "fail")
          : result,
    );
    const result = computeScore({ uploads: cleanUploads, crossChecks, figures: healthy, settings });
    expect(result.blocks.identity.bps).toBe(7_500); // 4 pass, 1 warn, 1 fail of 6
  });

  it("never counts a skipped check as a pass; it lowers confidence instead", () => {
    const crossChecks = cleanCrossChecks.map((result) => (result.code === "LICENCE_NUMBER" ? check("LICENCE_NUMBER", "skipped") : result));
    const result = computeScore({ uploads: cleanUploads, crossChecks, figures: healthy, settings });
    expect(result.blocks.identity).toEqual({ bps: 10_000, confidenceBps: 8_333 }); // 5 of 6 ran
  });

  it("ignores checks that are shown but never scored", () => {
    const shownOnly = ["NATIONALITY_MATCH", "EID_EMPLOYER", "STMT_CURRENCY"].map((code) => check(code, "warn"));
    const result = computeScore({ uploads: cleanUploads, crossChecks: [...cleanCrossChecks, ...shownOnly], figures: healthy, settings });
    expect(result.score).toBe(100);
  });

  it("makes the band Red whatever the score on a hard stop", () => {
    const expired = [upload("trade_licence", check("DOC_EXPIRED", "fail")), ...cleanUploads.slice(1)];
    expect(computeScore({ uploads: expired, crossChecks: cleanCrossChecks, figures: healthy, settings })).toMatchObject({
      band: "RED",
      hardStops: ["Trade licence has expired."],
    });
  });

  it("makes an expired passport or Emirates ID a hard stop, named once even when both card sides fail", () => {
    const expiredCard = [
      ...cleanUploads,
      upload("emirates_id_front", check("DOC_UNREADABLE", "pass"), check("DOC_EXPIRED", "fail")),
      upload("emirates_id_back", check("DOC_UNREADABLE", "pass"), check("DOC_EXPIRED", "fail")),
    ];
    expect(computeScore({ uploads: expiredCard, crossChecks: cleanCrossChecks, figures: healthy, settings })).toMatchObject({
      band: "RED",
      hardStops: ["Emirates ID has expired."],
    });
  });

  it("scores documents one share each, so many passing checks cannot hide a failed document", () => {
    const manyPasses = ["DOC_UNREADABLE", "DOC_WRONG_TYPE", "FILE_DUPLICATE", "FILE_REUSED", "EID_DATES"].map((code) =>
      check(code, "pass"),
    );
    const uploads = [
      upload("trade_licence", ...manyPasses),
      upload("tax_certificate", ...manyPasses),
      upload("bank_statement", ...manyPasses),
      upload("passport", ...manyPasses, check("DOC_EXPIRED", "fail")),
    ];
    // 3 of 4 documents pass: 7500 bps, not the 95% an average of all 21 checks would give.
    expect(computeScore({ uploads, crossChecks: cleanCrossChecks, figures: healthy, settings }).blocks.documents).toEqual({
      bps: 7_500,
      confidenceBps: 10_000,
    });
  });

  it("stops on balance mismatches only above the setting (more than 1 statement)", () => {
    const one = [...cleanUploads, upload("bank_statement", check("STMT_BALANCE", "warn"))];
    const two = [...one, upload("bank_statement", check("STMT_BALANCE", "warn"))];
    expect(computeScore({ uploads: one, crossChecks: cleanCrossChecks, figures: healthy, settings }).hardStops).toEqual([]);
    expect(computeScore({ uploads: two, crossChecks: cleanCrossChecks, figures: healthy, settings }).hardStops).toEqual([
      "2 bank statements do not add up.",
    ]);
  });

  it("lowers Green to Amber when overall confidence is below the floor, e.g. no money figures", () => {
    const result = computeScore({ uploads: cleanUploads, crossChecks: cleanCrossChecks, figures: null, settings });
    expect(result).toMatchObject({ score: 50, band: "AMBER", confidenceBps: 0 });
    expect(result.blocks.financial).toEqual({ bps: 0, confidenceBps: 0 });
  });

  it("drops to Amber on weak finances alone, and to Red when the checks fail too", () => {
    const weak = { ...healthy, leaseToIncomeBps: 4_000, daysBelowZero: 9, returnedItems: 4, debtToIncomeBps: 5_000 };
    expect(computeScore({ uploads: cleanUploads, crossChecks: cleanCrossChecks, figures: weak, settings })).toMatchObject({
      score: 50,
      band: "AMBER",
    });
    const failing = cleanCrossChecks.map((result) => check(result.code, "fail"));
    expect(computeScore({ uploads: cleanUploads, crossChecks: failing, figures: weak, settings })).toMatchObject({ band: "RED" });
  });
});

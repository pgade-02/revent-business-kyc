import { z } from "zod";
import { divideRoundHalfUp } from "../../plan/money";
import type { CheckResult, CheckStatus } from "../checks/check-result";
import type { DocumentSlot } from "../documents/slots";
import type { MoneyFigures } from "../statements/money-figures";
import type { ScoringSettings } from "./settings-schema";

const FULL = 10_000;

// Which checks feed which block (ARCHITECTURE §5). Nationality, employer and currency are
// shown only and never scored (SECURITY §6, cross-checks spec §2).
const BLOCK_CHECKS = {
  documents: [
    "DOC_READING",
    "DOC_UNREADABLE",
    "DOC_WRONG_TYPE",
    "DOC_EXPIRED",
    "DOC_EXPIRES_SOON",
    "FILE_DUPLICATE",
    "FILE_REUSED",
    "PASSPORT_MRZ",
    "MRZ_CHECK_DIGITS",
    "EID_DATES",
  ],
  identity: [
    "NAME_COMPANY",
    "NAME_SIGNATORY",
    "LICENCE_NUMBER",
    "TRN_NUMBER",
    "ID_FORMAT",
    "EMIRATE_MATCH",
    "EID_SIDES_MATCH",
    "DOB_MATCH",
  ],
  integrity: ["STMT_BALANCE", "STMT_COVERAGE", "STMT_CONTINUITY", "IBAN_CONSISTENT"],
} as const;

const blockSchema = z.object({ bps: z.number().int().min(0).max(FULL), confidenceBps: z.number().int().min(0).max(FULL) });
export const scoreSchema = z.object({
  score: z.number().int().min(0).max(100),
  band: z.enum(["GREEN", "AMBER", "RED"]),
  confidenceBps: z.number().int().min(0).max(FULL),
  hardStops: z.array(z.string()),
  blocks: z.object({ documents: blockSchema, identity: blockSchema, financial: blockSchema, integrity: blockSchema }),
});
export type Score = z.infer<typeof scoreSchema>;
type Block = z.infer<typeof blockSchema>;

export type UploadResults = { documentId: string; slot: DocumentSlot; results: readonly CheckResult[] };

const POINTS: Record<CheckStatus, number | null> = { pass: FULL, warn: FULL / 2, fail: 0, skipped: null };

// Pass = full, warn = half, fail = zero, averaged over the checks that ran. Skipped checks
// never count as a pass; they lower the block's confidence instead.
function checkBlock(results: readonly CheckResult[], codes: readonly string[]): Block {
  const relevant = results.filter((result) => codes.includes(result.code));
  const ran = relevant.flatMap((result) => {
    const points = POINTS[result.status];
    return points === null ? [] : [points];
  });
  if (ran.length === 0) return { bps: FULL, confidenceBps: 0 };
  return {
    bps: divideRoundHalfUp(
      ran.reduce((sum, points) => sum + points, 0),
      ran.length,
    ),
    confidenceBps: divideRoundHalfUp(ran.length * FULL, relevant.length),
  };
}

// Each sub-score gives full, half or zero of its weight; a missing ratio gives zero.
function financialBlock(figures: MoneyFigures | null, settings: ScoringSettings): Block {
  if (!figures) return { bps: 0, confidenceBps: 0 };
  const bands = settings.financial;
  const share = (value: number | null, band: { weight: number; fullMax: number; halfMax: number }) =>
    value === null || value > band.halfMax ? 0 : value <= band.fullMax ? band.weight * 2 : band.weight;
  const doubled =
    share(figures.leaseToIncomeBps, bands.leaseToIncomeBps) +
    share(figures.daysBelowZero, bands.daysBelowZero) +
    share(figures.returnedItems, bands.returnedItems) +
    share(figures.debtToIncomeBps, bands.debtToIncomeBps);
  return { bps: divideRoundHalfUp(doubled * FULL, settings.blockWeights.financial * 2), confidenceBps: FULL };
}

function hardStops(uploads: readonly UploadResults[], settings: ScoringSettings): string[] {
  const failed = (slot: DocumentSlot | null, code: string) =>
    uploads.filter(
      (upload) =>
        (slot === null || upload.slot === slot) && upload.results.some((result) => result.code === code && result.status === "fail"),
    );
  const mismatchedStatements = uploads.filter((upload) =>
    upload.results.some((result) => result.code === "STMT_BALANCE" && result.status === "warn"),
  ).length;
  return [
    ...(failed("trade_licence", "DOC_EXPIRED").length > 0 ? ["Trade licence has expired."] : []),
    ...(mismatchedStatements > settings.balanceMismatchHardStopCount ? [`${mismatchedStatements} bank statements do not add up.`] : []),
    ...(failed(null, "DOC_WRONG_TYPE").length > 0 ? ["A required document is still the wrong type."] : []),
  ];
}

function bandFor(score: number, stops: readonly string[], confidenceBps: number, settings: ScoringSettings): Score["band"] {
  if (stops.length > 0) return "RED";
  const band = score >= settings.bands.greenMinScore ? "GREEN" : score >= settings.bands.amberMinScore ? "AMBER" : "RED";
  return band === "GREEN" && confidenceBps < settings.confidenceFloorBps ? "AMBER" : band;
}

// Part 2, step 4 (ARCHITECTURE §5). Code only; weights and thresholds come from the settings.
export function computeScore(input: {
  uploads: readonly UploadResults[];
  crossChecks: readonly CheckResult[];
  figures: MoneyFigures | null;
  settings: ScoringSettings;
}): Score {
  const { settings } = input;
  const all = [...input.uploads.flatMap((upload) => upload.results), ...input.crossChecks];
  const blocks = {
    documents: checkBlock(all, BLOCK_CHECKS.documents),
    identity: checkBlock(all, BLOCK_CHECKS.identity),
    financial: financialBlock(input.figures, settings),
    integrity: checkBlock(all, BLOCK_CHECKS.integrity),
  };
  const weighted = (Object.keys(blocks) as (keyof typeof blocks)[]).reduce(
    (sum, name) => sum + settings.blockWeights[name] * blocks[name].bps,
    0,
  );
  const score = divideRoundHalfUp(weighted, FULL);
  const confidenceBps = Math.min(...Object.values(blocks).map((block) => block.confidenceBps));
  const stops = hardStops(input.uploads, settings);
  return { score, band: bandFor(score, stops, confidenceBps, settings), confidenceBps, hardStops: stops, blocks };
}

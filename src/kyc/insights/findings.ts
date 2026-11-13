import { formatAed } from "../../lib/format-money";
import type { CheckResult } from "../checks/check-result";
import type { Score } from "../scoring/score";
import type { MoneyFigures } from "../statements/money-figures";

// Everything the insights may use, already computed and formatted by code (ARCHITECTURE §2,
// step 5). The AI sees this and nothing else: no documents, no page text.
export type Findings = {
  score: number;
  band: Score["band"];
  hardStops: string[];
  notPassed: CheckResult[]; // warnings, fails and skipped checks, with evidence
  passed: string[]; // codes only
  figures: Record<string, string> | null;
  figuresProblem: string | null;
  licenceActivities: string[];
};

const percent = (bps: number | null) => (bps === null ? "not available (no customer income)" : `${(bps / 100).toFixed(2)}%`);
// Intl puts a non-breaking space after "AED"; plain text keeps an ordinary one.
const aed = (fils: number | null) => (fils === null ? "not available" : formatAed(fils, "en").replace(/\s/g, " "));

function displayFigures(figures: MoneyFigures): Record<string, string> {
  return {
    monthsCovered: String(figures.monthsCovered),
    planMonthly: aed(figures.planMonthly),
    avgMonthlyIncome: aed(figures.avgMonthlyIncome),
    leaseToIncome: percent(figures.leaseToIncomeBps),
    lowestBalance: aed(figures.lowestBalance),
    daysBelowZero: String(figures.daysBelowZero),
    returnedItems: String(figures.returnedItems),
    existingDebtMonthly: aed(figures.existingDebtMonthly),
    debtToIncome: percent(figures.debtToIncomeBps),
    topPayerShare: percent(figures.topPayerShareBps),
    largestBalanceDrop: percent(figures.largestBalanceDropBps),
  };
}

export function buildFindings(input: {
  score: Score;
  checks: readonly CheckResult[];
  figures: MoneyFigures | null;
  figuresProblem: string | null;
  licenceActivities: readonly string[];
}): Findings {
  return {
    score: input.score.score,
    band: input.score.band,
    hardStops: input.score.hardStops,
    notPassed: input.checks.filter((check) => check.status !== "pass"),
    passed: input.checks.filter((check) => check.status === "pass").map((check) => check.code),
    figures: input.figures ? displayFigures(input.figures) : null,
    figuresProblem: input.figuresProblem,
    licenceActivities: [...input.licenceActivities],
  };
}

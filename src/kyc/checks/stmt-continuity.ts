import { parseAmountFils } from "../../plan/money";
import { daysBetween } from "../dates";
import type { ExtractedField } from "../extraction/extracted-field";
import { compactNumber } from "../matching/text";
import type { CheckResult } from "./check-result";

const CODE = "STMT_CONTINUITY";

export type StatementBalances = {
  documentId: string;
  iban: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  openingBalance: ExtractedField<string> | null;
  closingBalance: ExtractedField<string> | null;
};

type Pair = { earlier: StatementBalances; later: StatementBalances };

// Back-to-back statements of the same account: the later one starts the day after the
// earlier one ends. Gaps between months are STMT_COVERAGE's job, not this check's.
function backToBackPairs(statements: readonly StatementBalances[]): Pair[] {
  const sorted = [...statements].filter((statement) => statement.periodStart).sort((a, b) => (a.periodStart ?? "").localeCompare(b.periodStart ?? ""));
  return sorted.flatMap((earlier) => {
    const later = sorted.find(
      (candidate) =>
        compactNumber(candidate.iban ?? "") === compactNumber(earlier.iban ?? "") &&
        earlier.periodEnd !== null &&
        candidate.periodStart !== null &&
        daysBetween(earlier.periodEnd, candidate.periodStart) === 1,
    );
    return later ? [{ earlier, later }] : [];
  });
}

// Compared in whole fils: one fils off is a difference, not rounding.
function sameBalance({ earlier, later }: Pair): boolean | null {
  const closing = earlier.closingBalance ? parseAmountFils(earlier.closingBalance.value) : null;
  const opening = later.openingBalance ? parseAmountFils(later.openingBalance.value) : null;
  return closing === null || opening === null ? null : closing === opening;
}

export function checkStmtContinuity({ statements }: { statements: readonly StatementBalances[] }): CheckResult {
  const compared = backToBackPairs(statements).flatMap((pair) => {
    const same = sameBalance(pair);
    return same === null ? [] : [{ pair, same }];
  });
  if (compared.length === 0) {
    return { code: CODE, status: "skipped", detail: "Could not check: no back-to-back statements with both balances read." };
  }
  const breaks = compared.filter(({ same }) => !same);
  const firstBreak = breaks[0];
  if (!firstBreak) return { code: CODE, status: "pass", detail: `Balances carry over across ${compared.length} statement change(s).` };
  const months = breaks.map(({ pair }) => `${pair.earlier.periodEnd} → ${pair.later.periodStart}`).join("; ");
  const { later } = firstBreak.pair;
  return {
    code: CODE,
    status: "warn",
    detail: `Closing balance does not carry over to the next opening balance at: ${months}. A statement may be missing or edited.`,
    evidence: { documentId: later.documentId, page: later.openingBalance?.page ?? 1 },
  };
}

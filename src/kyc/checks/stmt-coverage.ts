import { daysBetween, monthEnd } from "../dates";
import type { CheckResult } from "./check-result";

const CODE = "STMT_COVERAGE";

export type StatementPeriod = { documentId: string; periodStart: string | null; periodEnd: string | null };
type Period = { start: string; end: string };

// The `count` full calendar months before `month` (YYYY-MM), oldest first.
export function monthsBefore(month: string, count: number): string[] {
  const year = Number(month.slice(0, 4));
  const index = Number(month.slice(5, 7)) - 1;
  return Array.from({ length: count }, (_, offset) => {
    const date = new Date(Date.UTC(year, index - count + offset, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

// Joins periods that overlap or follow on the next day, so two half-month statements cover a month.
function joined(periods: Period[]): Period[] {
  const sorted = [...periods].sort((a, b) => a.start.localeCompare(b.start));
  const result: Period[] = [];
  for (const period of sorted) {
    const last = result.at(-1);
    const gap = last ? daysBetween(last.end, period.start) : null;
    if (last && gap !== null && gap <= 1) last.end = period.end > last.end ? period.end : last.end;
    else result.push({ ...period });
  }
  return result;
}

type CoverageInput = { statements: readonly StatementPeriod[]; submitMonth: string; monthsRequired: number };

const periodsOf = (statements: readonly StatementPeriod[]) =>
  statements.flatMap(({ periodStart: start, periodEnd: end }) => (start && end ? [{ start, end }] : []));

// The required months that statements cover in full. The money figures use exactly these.
export function coveredMonths({ statements, submitMonth, monthsRequired }: CoverageInput): string[] {
  const covered = joined(periodsOf(statements));
  return monthsBefore(submitMonth, monthsRequired).filter((month) => covered.some((period) => period.start <= `${month}-01` && period.end >= monthEnd(month)));
}

export function checkStmtCoverage(input: CoverageInput): CheckResult {
  if (periodsOf(input.statements).length === 0) return { code: CODE, status: "skipped", detail: "Could not check: no statement period was read." };
  const required = monthsBefore(input.submitMonth, input.monthsRequired);
  const covered = coveredMonths(input);
  const missing = required.filter((month) => !covered.includes(month));

  const first = input.statements[0];
  const evidence = first ? { documentId: first.documentId, page: 1 } : undefined;
  if (missing.length === 0) {
    return { code: CODE, status: "pass", detail: `Statements cover all ${required.length} months: ${required[0]} to ${required.at(-1)}.`, evidence };
  }
  return {
    code: CODE,
    status: "fail",
    detail: `Statements do not cover ${missing.length} of the ${required.length} months needed: ${missing.join(", ")}.`,
    evidence,
  };
}

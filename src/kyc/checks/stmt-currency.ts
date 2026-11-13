import type { CheckResult } from "./check-result";
import { evidenceOf, type ReadValue } from "./read-value";

const CODE = "STMT_CURRENCY";

// A currency that was not read is treated as AED.
export const isAed = (currency: ReadValue | null) => !currency || currency.field.value.trim().toUpperCase() === "AED";

// v1 converts no currencies: a non-AED statement is left out of the money figures, and
// this result explains why. One entry per statement.
export function checkStmtCurrency({ currencies }: { currencies: readonly (ReadValue | null)[] }): CheckResult {
  if (currencies.length === 0) return { code: CODE, status: "skipped", detail: "No bank statements to check." };
  const foreign = currencies.flatMap((currency) => (currency && !isAed(currency) ? [currency] : []));
  const first = foreign[0];
  if (!first) return { code: CODE, status: "pass", detail: "All statements are in AED." };
  const codes = [...new Set(foreign.map((read) => read.field.value.trim().toUpperCase()))].join(", ");
  return {
    code: CODE,
    status: "warn",
    detail: `${foreign.length} statement(s) in ${codes} are left out of the money figures.`,
    evidence: evidenceOf(first),
  };
}

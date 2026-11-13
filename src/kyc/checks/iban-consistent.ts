import { compactNumber } from "../matching/text";
import type { CheckResult } from "./check-result";
import { evidenceOf, type ReadValue } from "./read-value";

const CODE = "IBAN_CONSISTENT";

// More than one account is not wrong in itself, but the money figures assume one, so the
// reviewer is told. IBANs are personal numbers and are never repeated in the detail.
export function checkIbanConsistent({ onStatements }: { onStatements: readonly ReadValue[] }): CheckResult {
  const first = onStatements[0];
  if (!first || onStatements.length < 2) {
    return { code: CODE, status: "skipped", detail: "Could not check: fewer than 2 IBANs were read from the statements." };
  }
  const accounts = new Set(onStatements.map((read) => compactNumber(read.field.value)));
  if (accounts.size === 1) {
    return { code: CODE, status: "pass", detail: `All ${onStatements.length} statements are for the same account.`, evidence: evidenceOf(first) };
  }
  const odd = onStatements.find((read) => compactNumber(read.field.value) !== compactNumber(first.field.value)) ?? first;
  return {
    code: CODE,
    status: "warn",
    detail: `The statements are for ${accounts.size} different accounts.`,
    evidence: evidenceOf(odd),
  };
}

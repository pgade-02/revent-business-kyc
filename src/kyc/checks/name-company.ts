import { compareCompanyNames } from "../matching/company-names";
import type { CheckResult } from "./check-result";
import { SLOT_LABEL, evidenceOf, type ReadValue } from "./read-value";

const CODE = "NAME_COMPANY";

// Unlike ID numbers, company names are business data, so the detail quotes them for the reviewer.
export function checkNameCompany({ typed, onDocuments }: { typed: string | null; onDocuments: readonly ReadValue[] }): CheckResult {
  if (!typed)
    return {
      code: CODE,
      status: "skipped",
      detail: "Could not check: no company name was typed.",
    };

  const compared = onDocuments.map((read) => ({
    read,
    result: compareCompanyNames(typed, read.field.value),
  }));
  const different = compared.filter(({ result }) => result === "different");
  const matched = compared.filter(({ result }) => result === "match");

  const first = different[0];
  if (first) {
    const list = different.map(({ read }) => `${SLOT_LABEL[read.slot]} "${read.field.value}"`).join("; ");
    return {
      code: CODE,
      status: "warn",
      detail: `Company name differs from "${typed}": ${list}.`,
      evidence: evidenceOf(first.read),
    };
  }
  const firstMatch = matched[0];
  if (!firstMatch) {
    return {
      code: CODE,
      status: "skipped",
      detail: "Could not check: no company name in English was read from the documents.",
    };
  }
  const where = [...new Set(matched.map(({ read }) => SLOT_LABEL[read.slot]))].join(", ");
  return {
    code: CODE,
    status: "pass",
    detail: `Company name matches on: ${where}.`,
    evidence: evidenceOf(firstMatch.read),
  };
}

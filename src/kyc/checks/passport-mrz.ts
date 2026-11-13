import { passportMrzCheckDigitFailures, type PassportMrz } from "../extraction/passport-mrz";
import type { CheckResult } from "./check-result";

const CODE = "PASSPORT_MRZ";

// A wrong check digit means the photo was misread or the page was edited. The customer can
// retake the photo; the reviewer sees which part failed, never its value.
export function checkPassportMrz(documentId: string, found: { mrz: PassportMrz; page: number } | null): CheckResult {
  if (!found) return { code: CODE, status: "skipped", detail: "No machine-readable lines were found." };
  const evidence = { documentId, page: found.page };
  const failures = passportMrzCheckDigitFailures(found.mrz);
  if (failures.length === 0) return { code: CODE, status: "pass", detail: "All 5 check digits are correct.", evidence };
  return {
    code: CODE,
    status: "fail",
    detail: `Check digit wrong for: ${failures.join(", ")}.`,
    evidence,
    customerMessageKey: "Checks.PASSPORT_MRZ",
  };
}

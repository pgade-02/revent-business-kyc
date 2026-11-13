import { mrzCheckDigitFailures, type EmiratesIdMrz } from "../extraction/emirates-id-mrz";
import type { CheckResult } from "./check-result";

const CODE = "MRZ_CHECK_DIGITS";

// Every check digit in the back's machine-readable lines must be right. A wrong one means
// the photo was misread or the card was edited; the customer can retake the photo, and
// the reviewer sees which part failed (never its value).
export function checkMrzCheckDigits(documentId: string, found: { mrz: EmiratesIdMrz; page: number } | null): CheckResult {
  if (!found) return { code: CODE, status: "skipped", detail: "No machine-readable lines were found." };
  const { mrz } = found;
  const evidence = { documentId, page: found.page };
  const failures = mrzCheckDigitFailures(mrz);
  if (failures.length === 0) return { code: CODE, status: "pass", detail: "All 4 check digits are correct.", evidence };
  return {
    code: CODE,
    status: "fail",
    detail: `Check digit wrong for: ${failures.join(", ")}.`,
    evidence,
    customerMessageKey: "Checks.MRZ_CHECK_DIGITS",
  };
}

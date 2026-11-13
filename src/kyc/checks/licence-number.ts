import { sameNumber } from "../matching/text";
import type { CheckResult } from "./check-result";
import { evidenceOf, type ReadValue } from "./read-value";

const CODE = "LICENCE_NUMBER";

// A warning, not a fail: a typo or a misread is as likely as another company's licence.
export function checkLicenceNumber({ typed, onLicence }: { typed: string | null; onLicence: ReadValue | null }): CheckResult {
  if (!typed || !onLicence) {
    return {
      code: CODE,
      status: "skipped",
      detail: "Could not check: the licence number was not typed or not read from the licence.",
    };
  }
  const evidence = evidenceOf(onLicence);
  const result = sameNumber(typed, onLicence.field.value);
  if (result === "match")
    return {
      code: CODE,
      status: "pass",
      detail: "Licence number on the licence matches the one typed.",
      evidence,
    };
  if (result === "different") {
    return {
      code: CODE,
      status: "warn",
      detail: "Licence number on the licence differs from the one typed in Company details.",
      evidence,
    };
  }
  return {
    code: CODE,
    status: "skipped",
    detail: "Could not check: the licence number read from the licence is empty.",
    evidence,
  };
}

import { sameNumber } from "../matching/text";
import type { CheckResult } from "./check-result";
import { evidenceOf, type ReadValue } from "./read-value";

const CODE = "TRN_NUMBER";

export function checkTrnNumber({ typed, onCertificate }: { typed: string | null; onCertificate: ReadValue | null }): CheckResult {
  if (!typed)
    return {
      code: CODE,
      status: "skipped",
      detail: "No TRN was typed in Company details.",
    };
  if (!onCertificate)
    return {
      code: CODE,
      status: "skipped",
      detail: "Could not check: no TRN was read from the tax certificate.",
    };
  const evidence = evidenceOf(onCertificate);
  const result = sameNumber(typed, onCertificate.field.value);
  if (result === "match")
    return {
      code: CODE,
      status: "pass",
      detail: "TRN on the tax certificate matches the one typed.",
      evidence,
    };
  if (result === "different") {
    return {
      code: CODE,
      status: "warn",
      detail: "TRN on the tax certificate differs from the one typed in Company details.",
      evidence,
    };
  }
  return {
    code: CODE,
    status: "skipped",
    detail: "Could not check: the TRN read from the tax certificate is empty.",
    evidence,
  };
}

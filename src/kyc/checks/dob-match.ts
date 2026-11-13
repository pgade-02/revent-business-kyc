import type { CheckResult } from "./check-result";
import { evidenceOf, type ReadValue } from "./read-value";

const CODE = "DOB_MATCH";

// The detail never repeats the dates; the reviewer opens both documents to compare.
export function checkDobMatch({ passport, emiratesIdBack }: { passport: ReadValue | null; emiratesIdBack: ReadValue | null }): CheckResult {
  if (!passport || !emiratesIdBack) {
    return { code: CODE, status: "skipped", detail: "Could not check: date of birth not read from the passport or the Emirates ID back." };
  }
  const evidence = evidenceOf(passport);
  if (passport.field.value === emiratesIdBack.field.value) {
    return { code: CODE, status: "pass", detail: "Date of birth on the passport matches the Emirates ID back.", evidence };
  }
  return {
    code: CODE,
    status: "warn",
    detail: "Date of birth differs between the passport and the Emirates ID back: they may belong to different people. Open both documents to compare.",
    evidence,
  };
}

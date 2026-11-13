import type { CheckResult } from "./check-result";
import { evidenceOf, type ReadValue } from "./read-value";

const CODE = "NATIONALITY_MATCH";

// Shown to the reviewer only; never a score input (SECURITY §6). Dual nationals can
// legitimately hold a passport from one country and be registered under another.
export function checkNationalityMatch({ passport, emiratesIdBack }: { passport: ReadValue | null; emiratesIdBack: ReadValue | null }): CheckResult {
  if (!passport || !emiratesIdBack) {
    return { code: CODE, status: "skipped", detail: "Could not check: nationality not read from the passport or the Emirates ID back." };
  }
  const evidence = evidenceOf(passport);
  if (passport.field.value === emiratesIdBack.field.value) {
    return { code: CODE, status: "pass", detail: "Nationality on the passport matches the Emirates ID back.", evidence };
  }
  return {
    code: CODE,
    status: "warn",
    detail: "Nationality differs between the passport and the Emirates ID back. Dual nationals can differ; open both documents to compare.",
    evidence,
  };
}

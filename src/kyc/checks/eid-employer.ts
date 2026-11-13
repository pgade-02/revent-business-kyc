import { compareCompanyNames } from "../matching/company-names";
import type { CheckResult } from "./check-result";
import { evidenceOf, type ReadValue } from "./read-value";

const CODE = "EID_EMPLOYER";

// Shown to the reviewer only, never scored: a signatory can be sponsored by another company
// or a family member, so a different employer has many innocent causes.
export function checkEidEmployer({ companyName, employer }: { companyName: string | null; employer: ReadValue | null }): CheckResult {
  if (!employer) return { code: CODE, status: "skipped", detail: "No employer is printed on the Emirates ID back." };
  const evidence = evidenceOf(employer);
  const result = companyName ? compareCompanyNames(companyName, employer.field.value) : "not_comparable";
  if (result === "match") return { code: CODE, status: "pass", detail: "Employer on the Emirates ID is this company.", evidence };
  if (result === "different") {
    return { code: CODE, status: "warn", detail: `Employer on the Emirates ID is "${employer.field.value}", not this company.`, evidence };
  }
  return { code: CODE, status: "skipped", detail: "Could not check: the employer could not be compared with the company name.", evidence };
}

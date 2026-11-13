import { EMIRATES } from "../company/company-details";
import { words } from "../matching/text";
import type { CheckResult } from "./check-result";
import { evidenceOf, type ReadValue } from "./read-value";

const CODE = "EMIRATE_MATCH";

type Emirate = (typeof EMIRATES)[number];

// "Abu Dhabi", "ABU-DHABI" and "Umm Al Quwain" become the codes the form uses.
function emirateOf(printed: string): Emirate | null {
  const key = words(printed).join("_");
  return EMIRATES.find((emirate) => emirate === key) ?? null;
}

export function checkEmirateMatch({ typed, onLicence }: { typed: Emirate | null; onLicence: ReadValue | null }): CheckResult {
  const printed = onLicence ? emirateOf(onLicence.field.value) : null;
  if (!typed || !onLicence || !printed) {
    return { code: CODE, status: "skipped", detail: "Could not check: the emirate was not typed or not read from the licence." };
  }
  const evidence = evidenceOf(onLicence);
  if (printed === typed) return { code: CODE, status: "pass", detail: "Emirate on the licence matches the one typed.", evidence };
  return { code: CODE, status: "warn", detail: `Licence was issued in "${onLicence.field.value}", but Company details says ${typed.replaceAll("_", " ")}.`, evidence };
}

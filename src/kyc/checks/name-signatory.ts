import type { ExtractedField } from "../extraction/extracted-field";
import { comparePersonNames, type NameCutoffs } from "../matching/person-names";
import type { MatchResult } from "../matching/text";
import type { CheckResult } from "./check-result";
import { SLOT_LABEL, evidenceOf, type ReadValue } from "./read-value";

const CODE = "NAME_SIGNATORY";

type Input = {
  typed: string | null;
  passport: ReadValue | null;
  emiratesIdFront: ReadValue | null;
  managers: { documentId: string; field: ExtractedField<readonly string[]> } | null;
  cutoffs: NameCutoffs;
};

type NamedSource = { label: string; name: string };

const PROBLEM: Partial<Record<MatchResult, string>> = { different: "differ", possible_match: "are spelled differently" };

// Person names are never quoted in the detail; it says which documents disagree.
function identityProblems(sources: NamedSource[], cutoffs: NameCutoffs) {
  const problems: string[] = [];
  let compared = 0;
  sources.forEach((a, index) => {
    for (const b of sources.slice(index + 1)) {
      const result = comparePersonNames(a.name, b.name, cutoffs);
      if (result === "not_comparable") continue;
      compared += 1;
      const problem = PROBLEM[result];
      if (problem) problems.push(`Names on the ${a.label} and the ${b.label} ${problem}.`);
    }
  });
  return { problems, compared };
}

function isManager(holder: string, managers: readonly string[], cutoffs: NameCutoffs): MatchResult {
  const results = managers.map((manager) => comparePersonNames(holder, manager, cutoffs));
  if (results.some((result) => result === "match" || result === "possible_match")) return "match";
  return results.includes("different") ? "different" : "not_comparable";
}

export function checkNameSignatory({ typed, passport, emiratesIdFront, managers, cutoffs }: Input): CheckResult {
  const sources: NamedSource[] = [
    ...(typed ? [{ label: "Signatory form", name: typed }] : []),
    ...[passport, emiratesIdFront].flatMap((read) => (read ? [{ label: SLOT_LABEL[read.slot], name: read.field.value }] : [])),
  ];
  const { problems, compared } = identityProblems(sources, cutoffs);

  const holder = passport?.field.value ?? emiratesIdFront?.field.value ?? typed;
  const authority = holder && managers ? isManager(holder, managers.field.value, cutoffs) : "not_comparable";
  if (authority === "different") problems.push("The signatory is not listed as a manager on the trade licence: authority not proven.");

  const firstRead = passport ?? emiratesIdFront;
  const evidence = firstRead ? evidenceOf(firstRead) : managers ? { documentId: managers.documentId, page: managers.field.page } : undefined;
  if (problems.length > 0) return { code: CODE, status: "warn", detail: problems.join(" "), evidence };
  if (compared === 0 && authority === "not_comparable") {
    return { code: CODE, status: "skipped", detail: "Could not check: fewer than two comparable names were read." };
  }
  const managerNote = authority === "match" ? " The signatory is a manager on the trade licence." : " Managers on the licence could not be compared.";
  return { code: CODE, status: "pass", detail: `Signatory names agree.${managerNote}`, evidence };
}

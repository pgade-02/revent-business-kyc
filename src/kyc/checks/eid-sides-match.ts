import { comparePersonNames, type NameCutoffs } from "../matching/person-names";
import { sameNumber, type MatchResult } from "../matching/text";
import type { CheckResult } from "./check-result";
import { evidenceOf, type ReadValue } from "./read-value";

const CODE = "EID_SIDES_MATCH";

export type EidSide = { emiratesIdNumber: ReadValue | null; expiryDate: ReadValue | null; fullName: ReadValue | null };

// The back's name line is cut at 30 characters, so a possible match counts as the same name.
const sameName = (cutoffs: NameCutoffs) => (a: string, b: string): MatchResult => {
  const result = comparePersonNames(a, b, cutoffs);
  return result === "possible_match" ? "match" : result;
};
const sameDate = (a: string, b: string): MatchResult => (a === b ? "match" : "different");

// Compares what is on both sides; the values are never repeated in the detail.
export function checkEidSidesMatch({ front, back, cutoffs }: { front: EidSide; back: EidSide; cutoffs: NameCutoffs }): CheckResult {
  const parts = [
    { part: "ID number", front: front.emiratesIdNumber, back: back.emiratesIdNumber, compare: sameNumber },
    { part: "expiry date", front: front.expiryDate, back: back.expiryDate, compare: sameDate },
    { part: "name", front: front.fullName, back: back.fullName, compare: sameName(cutoffs) },
  ];
  const compared = parts.flatMap(({ part, front: onFront, back: onBack, compare }) =>
    onFront && onBack ? [{ part, onFront, result: compare(onFront.field.value, onBack.field.value) }] : [],
  );
  const different = compared.filter(({ result }) => result === "different");
  const matched = compared.filter(({ result }) => result === "match");

  const firstDifferent = different[0];
  if (firstDifferent) {
    const list = different.map(({ part }) => part).join(", ");
    return {
      code: CODE,
      status: "warn",
      detail: `Front and back of the Emirates ID differ on: ${list}. They may be from different cards.`,
      evidence: evidenceOf(firstDifferent.onFront),
    };
  }
  const firstMatched = matched[0];
  if (!firstMatched) return { code: CODE, status: "skipped", detail: "Could not check: the back's machine-readable lines were not read." };
  const list = matched.map(({ part }) => part).join(", ");
  return { code: CODE, status: "pass", detail: `Front and back agree on: ${list}.`, evidence: evidenceOf(firstMatched.onFront) };
}

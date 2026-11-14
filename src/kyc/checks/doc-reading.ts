import type { CheckResult } from "./check-result";

const CODE = "DOC_READING";

export type ReadingProblem = "OCR_FAILED" | "LLM_UNAVAILABLE" | "INVALID_OUTPUT" | "NO_TABLE" | "UNREADABLE_ROW";

const DETAIL: Record<ReadingProblem, string> = {
  OCR_FAILED: "The pages could not be read: OCR did not answer.",
  LLM_UNAVAILABLE: "The fields could not be read: the AI did not answer in time.",
  INVALID_OUTPUT: "The fields could not be read: the AI answer was not in the required form.",
  NO_TABLE: "No transactions table was found, so the statement rows could not be read.",
  UNREADABLE_ROW: "A statement row could not be read as money, so no rows were kept.",
};

// A reading step that did not finish is a result of its own, so the reviewer sees it next to
// the document instead of a "Pass" built only from the checks that did run. No customer
// message: the customer sees "Needs review", and the reviewer decides what to ask for.
export function checkDocReading(documentId: string, problem: ReadingProblem): CheckResult {
  return { code: CODE, status: "fail", detail: DETAIL[problem], evidence: { documentId, page: 1 } };
}

import type { CheckResult } from "../checks/check-result";

// The three end states a customer sees per file (PRD §5). "Checking" is the
// moment before this runs, so it is not decided here.
export type DocumentStatus = "ready" | "needs_fix" | "needs_review";

// A failed check the customer can fix → "Needs a fix". Anything the system could not
// decide (reading failed, or a fail without a customer message) → "Needs review".
// Warnings never change the customer's status; only the reviewer sees them.
export function decideDocumentStatus(results: CheckResult[], readingSucceeded: boolean): DocumentStatus {
  if (results.some((result) => result.status === "fail" && result.customerMessageKey)) return "needs_fix";
  if (!readingSucceeded || results.some((result) => result.status === "fail")) return "needs_review";
  return "ready";
}

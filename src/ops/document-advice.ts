import type { CheckResult } from "@/kyc/checks/check-result";

export type DocumentVerdict = "passed" | "needs_look" | "problem";
export type DocumentAdvice = { verdict: DocumentVerdict; reasons: string[] };

// Sums up a document's checks as one result with its reasons; the reviewer decides.
export function documentAdvice(results: readonly CheckResult[]): DocumentAdvice {
  if (results.length === 0) return { verdict: "needs_look", reasons: ["This file has not been read yet."] };
  const failed = results.filter((result) => result.status === "fail");
  if (failed.length > 0) return { verdict: "problem", reasons: failed.map((result) => result.detail) };
  const unsure = results.filter((result) => result.status === "warn" || result.status === "skipped");
  if (unsure.length > 0) return { verdict: "needs_look", reasons: unsure.map((result) => result.detail) };
  return { verdict: "passed", reasons: [] };
}

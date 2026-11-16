import { describe, expect, it } from "vitest";
import type { CheckResult } from "@/kyc/checks/check-result";
import { documentAdvice } from "@/ops/document-advice";

const check = (code: string, status: CheckResult["status"], detail = `${code} ${status}`): CheckResult => ({ code, status, detail });

describe("documentAdvice", () => {
  it("says passed when every check passed", () => {
    expect(documentAdvice([check("DOC_EXPIRED", "pass")])).toEqual({ verdict: "passed", reasons: [] });
  });

  it("asks for a look on a warning or a value that was not found, with the reasons", () => {
    const advice = documentAdvice([check("EMIRATE_MATCH", "warn", "Emirate differs"), check("DOC_ISSUE_DATE", "skipped", "No issue date")]);
    expect(advice).toEqual({ verdict: "needs_look", reasons: ["Emirate differs", "No issue date"] });
  });

  it("reports a problem when a check failed, giving only the failures as reasons", () => {
    const advice = documentAdvice([check("DOC_EXPIRED", "fail", "Expired on 2026-01-01"), check("DOC_ISSUE_DATE", "skipped")]);
    expect(advice).toEqual({ verdict: "problem", reasons: ["Expired on 2026-01-01"] });
  });

  it("asks for a look when the file has not been read, never passing it", () => {
    expect(documentAdvice([])).toEqual({ verdict: "needs_look", reasons: ["This file has not been read yet."] });
  });
});

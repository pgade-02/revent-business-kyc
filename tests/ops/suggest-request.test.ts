import { describe, expect, it } from "vitest";
import type { CheckResult } from "@/kyc/checks/check-result";
import { suggestRequestItems, type DocumentForSuggestion } from "@/ops/suggest-request";
import type { Comparison, TypedComparisons } from "@/ops/typed-vs-document";

const fixable = (code: string): CheckResult => ({ code, status: "fail", detail: `${code} detail`, customerMessageKey: `Checks.${code}` });
const matches: Comparison = { verdict: "matches", reason: null, slot: "trade_licence", documentValue: "x" };
const different: Comparison = { ...matches, verdict: "different" };
const allMatch: TypedComparisons = { companyName: matches, licenceNumber: matches, emirate: matches, trn: matches, signatoryName: { ...matches, slot: "passport" } };
const document = (slot: DocumentForSuggestion["slot"], results: CheckResult[], reviewState: DocumentForSuggestion["reviewState"] = "to_review") => ({ slot, results, reviewState });

describe("suggestRequestItems", () => {
  it("asks for each document the customer can fix, with the reason from its check", () => {
    const items = suggestRequestItems({
      documents: [document("passport", [fixable("DOC_EXPIRED")]), document("trade_licence", [fixable("DOC_UNREADABLE")]), document("tax_certificate", [fixable("DOC_WRONG_TYPE")])],
      comparisons: allMatch,
      alreadyAsked: [],
    });
    expect(items).toEqual([
      { subject: "passport", reason: "expired" },
      { subject: "trade_licence", reason: "not_clear" },
      { subject: "tax_certificate", reason: "wrong_document" },
    ]);
  });

  it("asks with 'other' for a fixable check it has no reason for", () => {
    expect(suggestRequestItems({ documents: [document("passport", [fixable("NEW_FIXABLE_CHECK")])], comparisons: allMatch, alreadyAsked: [] })).toEqual([
      { subject: "passport", reason: "other" },
    ]);
  });

  it("does not ask about failures the customer cannot fix, warnings, or approved documents", () => {
    const notFixable: CheckResult = { code: "STMT_BALANCE", status: "fail", detail: "does not add up" };
    const warning: CheckResult = { code: "EMIRATE_MATCH", status: "warn", detail: "differs" };
    const items = suggestRequestItems({
      documents: [document("bank_statement", [notFixable]), document("trade_licence", [warning]), document("passport", [fixable("DOC_EXPIRED")], "approved")],
      comparisons: allMatch,
      alreadyAsked: [],
    });
    expect(items).toEqual([]);
  });

  it("asks once for company details and once for the signatory when typed values do not match", () => {
    const comparisons = { ...allMatch, companyName: different, licenceNumber: different, signatoryName: { ...different, slot: "passport" as const } };
    expect(suggestRequestItems({ documents: [], comparisons, alreadyAsked: [] })).toEqual([
      { subject: "company_details", reason: "details_do_not_match" },
      { subject: "signatory_details", reason: "details_do_not_match" },
    ]);
  });

  it("leaves out what was already asked for", () => {
    expect(suggestRequestItems({ documents: [document("passport", [fixable("DOC_EXPIRED")])], comparisons: allMatch, alreadyAsked: ["passport"] })).toEqual([]);
  });
});
